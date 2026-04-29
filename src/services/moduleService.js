const courseModel = require('../models/courseModel');
const lessonModel = require('../models/lessonModel');
const moduleModel = require('../models/moduleModel');

const normalizeText = (value = '') => String(value ?? '').trim();

const normalizeNullableText = (value = '') => {
  const cleaned = normalizeText(value);
  return cleaned || null;
};

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseOptionalPositiveInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return { provided: false, value: null };
  }

  return { provided: true, value: toPositiveInteger(value) };
};

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

const normalizeOrderedIds = (ids = []) => {
  const seen = new Set();
  const normalized = [];

  ids.forEach((rawId) => {
    const id = toPositiveInteger(rawId);
    if (!id || seen.has(id)) return;
    seen.add(id);
    normalized.push(id);
  });

  return normalized;
};

async function listByCourseId(courseIdValue) {
  const courseId = toPositiveInteger(courseIdValue);
  if (!courseId) {
    return { status: 400, body: { message: 'Valid courseId is required.' } };
  }

  const course = await courseModel.findById(courseId);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  const modules = await moduleModel.listByCourseId(courseId);
  const lessons = await lessonModel.listByCourseId(courseId);
  const lessonsByModule = mapLessonsByModule(lessons);

  return {
    status: 200,
    body: {
      modules: modules.map((module) => formatModule(module, lessonsByModule.get(Number(module.id)) || [])),
    },
  };
}

async function createModule(courseIdValue, payload = {}) {
  const courseId = toPositiveInteger(courseIdValue);
  if (!courseId) {
    return { status: 400, body: { message: 'Valid courseId is required.' } };
  }

  const course = await courseModel.findById(courseId);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  const title = normalizeText(payload.title);
  const description = normalizeNullableText(payload.description);
  const parsedOrder = parseOptionalPositiveInteger(payload.order_index ?? payload.orderIndex);

  if (!title) {
    return { status: 400, body: { message: 'Module title is required.' } };
  }

  if (parsedOrder.provided && !parsedOrder.value) {
    return { status: 400, body: { message: 'order_index must be a positive integer.' } };
  }

  const insertedId = await moduleModel.createModule({
    course_id: courseId,
    title,
    description,
    order_index: parsedOrder.value,
  });

  const created = await moduleModel.findById(insertedId);

  return {
    status: 201,
    body: {
      message: 'Module created successfully.',
      module: formatModule(created, []),
    },
  };
}

async function updateModule(moduleIdValue, payload = {}) {
  const moduleId = toPositiveInteger(moduleIdValue);
  if (!moduleId) {
    return { status: 400, body: { message: 'Valid moduleId is required.' } };
  }

  const current = await moduleModel.findById(moduleId);
  if (!current) {
    return { status: 404, body: { message: 'Module not found.' } };
  }

  const title =
    payload.title === undefined
      ? current.title
      : normalizeText(payload.title);
  const description =
    payload.description === undefined
      ? current.description
      : normalizeNullableText(payload.description);

  const parsedOrder = parseOptionalPositiveInteger(payload.order_index ?? payload.orderIndex);
  if (parsedOrder.provided && !parsedOrder.value) {
    return { status: 400, body: { message: 'order_index must be a positive integer.' } };
  }

  const orderIndex = parsedOrder.provided ? parsedOrder.value : Number(current.order_index || 1);

  if (!title) {
    return { status: 400, body: { message: 'Module title is required.' } };
  }

  await moduleModel.updateModule(moduleId, {
    title,
    description,
    order_index: orderIndex,
  });

  const updated = await moduleModel.findById(moduleId);
  const lessons = await lessonModel.listByModuleId(moduleId);

  return {
    status: 200,
    body: {
      message: 'Module updated successfully.',
      module: formatModule(updated, lessons.map(formatLesson)),
    },
  };
}

async function deleteModule(moduleIdValue) {
  const moduleId = toPositiveInteger(moduleIdValue);
  if (!moduleId) {
    return { status: 400, body: { message: 'Valid moduleId is required.' } };
  }

  const current = await moduleModel.findById(moduleId);
  if (!current) {
    return { status: 404, body: { message: 'Module not found.' } };
  }

  await moduleModel.deleteById(moduleId);

  return {
    status: 200,
    body: {
      message: 'Module deleted successfully.',
    },
  };
}

async function reorderModules(courseIdValue, payload = {}) {
  const courseId = toPositiveInteger(courseIdValue);
  if (!courseId) {
    return { status: 400, body: { message: 'Valid courseId is required.' } };
  }

  const course = await courseModel.findById(courseId);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  const rawModuleIds = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.moduleIds)
      ? payload.moduleIds
      : Array.isArray(payload.modules)
        ? payload.modules
        : [];

  const requestedIds = normalizeOrderedIds(rawModuleIds);
  if (!requestedIds.length) {
    return { status: 400, body: { message: 'moduleIds must contain at least one module id.' } };
  }

  const currentIds = await moduleModel.listIdsByCourseId(courseId);
  if (!currentIds.length) {
    return { status: 400, body: { message: 'No modules found for this course.' } };
  }

  const currentIdSet = new Set(currentIds);
  const validRequestedIds = requestedIds.filter((id) => currentIdSet.has(id));

  if (!validRequestedIds.length) {
    return { status: 400, body: { message: 'None of the provided module ids belong to this course.' } };
  }

  const remaining = currentIds.filter((id) => !validRequestedIds.includes(id));
  const finalOrder = [...validRequestedIds, ...remaining];

  await moduleModel.reorderInCourse(courseId, finalOrder);

  const result = await listByCourseId(courseId);

  return {
    status: 200,
    body: {
      message: 'Modules reordered successfully.',
      modules: result.body.modules,
    },
  };
}

module.exports = {
  listByCourseId,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
};
