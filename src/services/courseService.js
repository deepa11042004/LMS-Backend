const courseModel = require('../models/courseModel');
const moduleModel = require('../models/moduleModel');
const lessonModel = require('../models/lessonModel');
const enrollmentModel = require('../models/enrollmentModel');
const userModel = require('../models/userModel');
const instructorProfileModel = require('../models/instructorProfileModel');
const roles = require('../constants/roles');

const ALLOWED_LEVELS = new Set(['Beginner', 'Intermediate', 'Advanced']);

const normalizeText = (value = '') => String(value ?? '').trim();

const normalizeNullableText = (value = '') => {
  const cleaned = normalizeText(value);
  return cleaned || null;
};

const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNullableInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const toBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

const formatCourse = (course) => ({
  ...course,
  price: course.price === null || course.price === undefined ? null : Number(course.price),
  discount_price:
    course.discount_price === null || course.discount_price === undefined ? null : Number(course.discount_price),
  is_free: Number(course.is_free) === 1,
  is_paid: Number(course.is_paid) === 1,
  lifetime_access: Number(course.lifetime_access) === 1,
  certificate_available: Number(course.certificate_available) === 1,
  is_published: Number(course.is_published) === 1,
  status: Number(course.is_published) === 1 ? 'published' : 'draft',
  instructor_id: Number(course.instructor_id),
  total_duration_minutes: Number(course.total_duration_minutes || 0),
  enrolled_students: Number(course.enrolled_students || 0),
});

const formatLesson = (lesson) => ({
  id: Number(lesson.id),
  module_id: Number(lesson.module_id),
  title: lesson.title,
  description: lesson.description,
  youtube_url: lesson.youtube_url,
  order_index: Number(lesson.order_index || 0),
  is_free_preview: Number(lesson.is_free_preview) === 1,
  duration_seconds: Number(lesson.duration_seconds || 0),
  created_at: lesson.created_at,
  updated_at: lesson.updated_at,
});

const formatModule = (module, lessons = []) => ({
  id: Number(module.id),
  course_id: Number(module.course_id),
  title: module.title,
  description: module.description,
  order_index: Number(module.order_index || 0),
  created_at: module.created_at,
  updated_at: module.updated_at,
  lessons,
});

const mapLessonsByModule = (lessons) => {
  const grouped = new Map();

  lessons.forEach((lesson) => {
    const formatted = formatLesson(lesson);
    const moduleId = formatted.module_id;

    if (!grouped.has(moduleId)) {
      grouped.set(moduleId, []);
    }

    grouped.get(moduleId).push(formatted);
  });

  return grouped;
};

async function buildInstructorProfileById(instructorIdValue) {
  const instructorId = toNullableInteger(instructorIdValue);

  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    return null;
  }

  const user = await userModel.findById(instructorId);
  const profileRow = await instructorProfileModel.findByUserId(instructorId);

  if (!user && !profileRow) {
    return null;
  }

  const name = normalizeText(profileRow?.display_name || user?.full_name || `Instructor #${instructorId}`);
  const designation = normalizeText(profileRow?.designation || 'Instructor');
  const shortBio = normalizeText(profileRow?.bio || '');
  const description = normalizeText(profileRow?.profile_description || shortBio);

  return {
    id: instructorId,
    name,
    designation,
    short_bio: shortBio || null,
    description: description || null,
  };
}

async function listCourses(options = {}) {
  const rows = await courseModel.listCourses({
    includeUnpublished: Boolean(options.includeUnpublished),
  });

  return {
    status: 200,
    body: {
      courses: rows.map(formatCourse),
    },
  };
}

async function createCourse(payload = {}) {
  const title = normalizeText(payload.title);
  const slug = normalizeText(payload.slug) || slugify(title);
  const subtitle = normalizeNullableText(payload.subtitle);
  const description = normalizeNullableText(payload.description);
  const category = normalizeNullableText(payload.category);
  const level = normalizeText(payload.level) || 'Beginner';
  const language = normalizeText(payload.language) || 'English';
  const thumbnail = normalizeNullableText(payload.thumbnail);
  const currency = normalizeText(payload.currency || 'INR').toUpperCase();

  const priceInput = toNullableNumber(payload.price);
  const discountInput = toNullableNumber(payload.discount_price ?? payload.discountPrice);
  const instructorId = toNullableInteger(payload.instructor_id ?? payload.instructorId);
  const duration = toNullableInteger(payload.total_duration_minutes ?? payload.totalDurationMinutes) ?? 0;

  const requestedIsFree = toBoolean(payload.is_free ?? payload.isFree, false);
  const inferredIsFreeFromPrice = (priceInput ?? 0) <= 0;
  const isFree = requestedIsFree || inferredIsFreeFromPrice;
  const isPaid = !isFree;

  const lifetimeAccess = toBoolean(payload.lifetime_access ?? payload.lifetimeAccess, true);
  const certificateAvailable = toBoolean(payload.certificate_available ?? payload.certificateAvailable, true);

  if (!title) {
    return { status: 400, body: { message: 'Title is required.' } };
  }

  if (!slug) {
    return { status: 400, body: { message: 'Slug is required.' } };
  }

  if (!ALLOWED_LEVELS.has(level)) {
    return { status: 400, body: { message: 'Level must be Beginner, Intermediate, or Advanced.' } };
  }

  if (!Number.isInteger(instructorId) || instructorId <= 0) {
    return { status: 400, body: { message: 'Valid instructor_id is required.' } };
  }

  const instructorUser = await userModel.findById(instructorId);
  if (!instructorUser || instructorUser.role !== roles.INSTRUCTOR || Number(instructorUser.is_active) !== 1) {
    return { status: 400, body: { message: 'instructor_id must reference an active instructor user.' } };
  }

  if (!Number.isFinite(duration) || duration < 0) {
    return { status: 400, body: { message: 'total_duration_minutes must be greater than or equal to 0.' } };
  }

  const price = isFree ? 0 : (priceInput ?? 0);
  const discountPrice = isFree ? null : discountInput;

  if (price < 0) {
    return { status: 400, body: { message: 'Price must be greater than or equal to 0.' } };
  }

  if (!isFree && price <= 0) {
    return { status: 400, body: { message: 'Paid course price must be greater than 0.' } };
  }

  if (discountPrice !== null && discountPrice < 0) {
    return { status: 400, body: { message: 'Discount price must be greater than or equal to 0.' } };
  }

  if (discountPrice !== null && discountPrice > price) {
    return { status: 400, body: { message: 'Discount price cannot be greater than price.' } };
  }

  const existing = await courseModel.findBySlug(slug);
  if (existing) {
    return { status: 409, body: { message: 'A course with this slug already exists.' } };
  }

  const insertedId = await courseModel.createCourse({
    title,
    slug,
    subtitle,
    description,
    category,
    level,
    language,
    thumbnail,
    price,
    discount_price: discountPrice,
    currency,
    is_free: isFree ? 1 : 0,
    is_paid: isPaid ? 1 : 0,
    lifetime_access: lifetimeAccess ? 1 : 0,
    certificate_available: certificateAvailable ? 1 : 0,
    is_published: 0,
    instructor_id: instructorId,
    total_duration_minutes: duration,
    enrolled_students: 0,
  });

  const created = await courseModel.findById(insertedId);

  return {
    status: 201,
    body: {
      message: 'Course created successfully',
      course: formatCourse(created),
    },
  };
}

async function getCourseFull(courseIdValue) {
  const courseId = toNullableInteger(courseIdValue);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return { status: 400, body: { message: 'Valid course id is required.' } };
  }

  const course = await courseModel.findById(courseId);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  const modules = await moduleModel.listByCourseId(courseId);
  const lessons = await lessonModel.listByCourseId(courseId);
  const instructorProfile = await buildInstructorProfileById(course.instructor_id);
  const lessonsByModule = mapLessonsByModule(lessons);

  const contentModules = modules.map((module) =>
    formatModule(module, lessonsByModule.get(Number(module.id)) || [])
  );

  return {
    status: 200,
    body: {
      course: {
        ...formatCourse(course),
        instructor_profile: instructorProfile,
        modules: contentModules,
      },
    },
  };
}

async function getCourseFullBySlug(slugValue) {
  const slug = normalizeText(slugValue);

  if (!slug) {
    return { status: 400, body: { message: 'Valid course slug is required.' } };
  }

  const course = await courseModel.findPublishedBySlug(slug);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  const courseId = Number(course.id);
  const modules = await moduleModel.listByCourseId(courseId);
  const lessons = await lessonModel.listByCourseId(courseId);
  const instructorProfile = await buildInstructorProfileById(course.instructor_id);
  const lessonsByModule = mapLessonsByModule(lessons);

  const contentModules = modules.map((module) =>
    formatModule(module, lessonsByModule.get(Number(module.id)) || [])
  );

  return {
    status: 200,
    body: {
      course: {
        ...formatCourse(course),
        instructor_profile: instructorProfile,
        modules: contentModules,
      },
    },
  };
}

async function publishCourse(courseIdValue) {
  const courseId = toNullableInteger(courseIdValue);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return { status: 400, body: { message: 'Valid course id is required.' } };
  }

  const course = await courseModel.findById(courseId);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  if (Number(course.is_published) !== 1) {
    await courseModel.setPublishedStatus(courseId, true);
  }

  const publishedCourse = await courseModel.findById(courseId);

  return {
    status: 200,
    body: {
      message: 'Course published successfully',
      course: formatCourse(publishedCourse),
    },
  };
}

async function updateCourse(courseIdValue, payload = {}) {
  const courseId = toNullableInteger(courseIdValue);

  if (!Number.isInteger(courseId) || courseId <= 0) {
    return { status: 400, body: { message: 'Valid course id is required.' } };
  }

  const course = await courseModel.findById(courseId);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  const title = normalizeText(payload.title || course.title);
  const slug = normalizeText(payload.slug || course.slug);
  const subtitle = normalizeNullableText(payload.subtitle !== undefined ? payload.subtitle : course.subtitle);
  const description = normalizeNullableText(payload.description !== undefined ? payload.description : course.description);
  const category = normalizeNullableText(payload.category !== undefined ? payload.category : course.category);
  const level = normalizeText(payload.level || course.level);
  const language = normalizeText(payload.language || course.language);
  const currency = normalizeText(payload.currency || course.currency || 'INR').toUpperCase();

  if (!title) return { status: 400, body: { message: 'Title is required.' } };
  if (!slug) return { status: 400, body: { message: 'Slug is required.' } };
  if (!ALLOWED_LEVELS.has(level)) {
    return { status: 400, body: { message: 'Level must be Beginner, Intermediate, or Advanced.' } };
  }

  const priceInput = payload.price !== undefined ? toNullableNumber(payload.price) : Number(course.price ?? 0);
  const discountInput = payload.discount_price !== undefined
    ? toNullableNumber(payload.discount_price)
    : toNullableNumber(course.discount_price);
  const duration = payload.total_duration_minutes !== undefined
    ? (toNullableInteger(payload.total_duration_minutes) ?? 0)
    : Number(course.total_duration_minutes || 0);

  const isPublishedRaw = payload.is_published !== undefined ? payload.is_published : course.is_published;
  const isPublished = toBoolean(isPublishedRaw, false);

  const price = priceInput ?? 0;
  const discountPrice = discountInput;
  const isFree = price <= 0;
  const isPaid = !isFree;

  const lifetimeAccess = payload.lifetime_access !== undefined
    ? toBoolean(payload.lifetime_access, true)
    : toBoolean(course.lifetime_access, true);
  const certificateAvailable = payload.certificate_available !== undefined
    ? toBoolean(payload.certificate_available, true)
    : toBoolean(course.certificate_available, true);

  // Check slug uniqueness only if it changed
  if (slug !== normalizeText(course.slug)) {
    const existing = await courseModel.findBySlug(slug);
    if (existing && Number(existing.id) !== courseId) {
      return { status: 409, body: { message: 'A course with this slug already exists.' } };
    }
  }

  await courseModel.updateCourse(courseId, {
    title,
    slug,
    subtitle,
    description,
    category,
    level,
    language,
    price,
    discount_price: discountPrice,
    currency,
    is_free: isFree ? 1 : 0,
    is_paid: isPaid ? 1 : 0,
    lifetime_access: lifetimeAccess ? 1 : 0,
    certificate_available: certificateAvailable ? 1 : 0,
    is_published: isPublished ? 1 : 0,
    total_duration_minutes: duration,
  });

  const updated = await courseModel.findById(courseId);

  return {
    status: 200,
    body: {
      message: 'Course updated successfully',
      course: formatCourse(updated),
    },
  };
}

async function listMyLearningCourses(userIdValue) {
  const userId = toNullableInteger(userIdValue);

  if (!Number.isInteger(userId) || userId <= 0) {
    return { status: 400, body: { message: 'Valid user id is required.' } };
  }

  const rows = await enrollmentModel.listByUserWithCourses(userId, ['active', 'completed']);

  const courses = rows.map((row) => {
    const formattedCourse = formatCourse({
      id: row.course_id,
      title: row.title,
      slug: row.slug,
      subtitle: row.subtitle,
      description: row.description,
      category: row.category,
      level: row.level,
      language: row.language,
      thumbnail: row.thumbnail,
      price: row.price,
      discount_price: row.discount_price,
      currency: row.currency,
      is_free: row.is_free,
      is_paid: row.is_paid,
      lifetime_access: row.lifetime_access,
      certificate_available: row.certificate_available,
      is_published: row.is_published,
      instructor_id: row.instructor_id,
      total_duration_minutes: row.total_duration_minutes,
      enrolled_students: row.enrolled_students,
      created_at: row.course_created_at,
      updated_at: row.course_updated_at,
    });

    return {
      ...formattedCourse,
      enrollment: {
        id: Number(row.id),
        user_id: Number(row.user_id),
        course_id: Number(row.course_id),
        status: row.status,
        enrolled_at: row.enrolled_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
      },
    };
  });

  return {
    status: 200,
    body: {
      courses,
    },
  };
}

module.exports = {
  listCourses,
  createCourse,
  updateCourse,
  getCourseFull,
  getCourseFullBySlug,
  publishCourse,
  listMyLearningCourses,
};