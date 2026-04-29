const courseModel = require('../models/courseModel');
const moduleModel = require('../models/moduleModel');
const lessonModel = require('../models/lessonModel');

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

  const isPaid = toBoolean(payload.is_paid ?? payload.isPaid, (priceInput || 0) > 0);
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

  if (!Number.isFinite(duration) || duration < 0) {
    return { status: 400, body: { message: 'total_duration_minutes must be greater than or equal to 0.' } };
  }

  const price = isPaid ? (priceInput ?? 0) : 0;

  if (price < 0) {
    return { status: 400, body: { message: 'Price must be greater than or equal to 0.' } };
  }

  if (discountInput !== null && discountInput < 0) {
    return { status: 400, body: { message: 'Discount price must be greater than or equal to 0.' } };
  }

  if (discountInput !== null && discountInput > price) {
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
    discount_price: discountInput,
    currency,
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
  const lessonsByModule = mapLessonsByModule(lessons);

  const contentModules = modules.map((module) =>
    formatModule(module, lessonsByModule.get(Number(module.id)) || [])
  );

  return {
    status: 200,
    body: {
      course: {
        ...formatCourse(course),
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

module.exports = {
  listCourses,
  createCourse,
  getCourseFull,
  publishCourse,
};