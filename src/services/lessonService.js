const lessonModel = require('../models/lessonModel');
const moduleModel = require('../models/moduleModel');

const YOUTUBE_URL_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}(&[^\s]*)?|youtu\.be\/[A-Za-z0-9_-]{11}(\?[^\s]*)?)$/i;

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

const toNonNegativeInteger = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};

const parseOptionalNonNegativeInteger = (value) => {
  if (value === null || value === undefined || value === '') {
    return { provided: false, value: null };
  }

  return { provided: true, value: toNonNegativeInteger(value) };
};

const toBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
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

const isValidYouTubeUrl = (value) => YOUTUBE_URL_REGEX.test(normalizeText(value));

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

async function listByModuleId(moduleIdValue) {
  const moduleId = toPositiveInteger(moduleIdValue);
  if (!moduleId) {
    return { status: 400, body: { message: 'Valid moduleId is required.' } };
  }

  const module = await moduleModel.findById(moduleId);
  if (!module) {
    return { status: 404, body: { message: 'Module not found.' } };
  }

  const lessons = await lessonModel.listByModuleId(moduleId);

  return {
    status: 200,
    body: {
      lessons: lessons.map(formatLesson),
    },
  };
}

async function createLesson(moduleIdValue, payload = {}) {
  const moduleId = toPositiveInteger(moduleIdValue);
  if (!moduleId) {
    return { status: 400, body: { message: 'Valid moduleId is required.' } };
  }

  const module = await moduleModel.findById(moduleId);
  if (!module) {
    return { status: 404, body: { message: 'Module not found.' } };
  }

  const title = normalizeText(payload.title);
  const description = normalizeNullableText(payload.description);
  const youtubeUrl = normalizeNullableText(payload.youtube_url ?? payload.youtubeUrl ?? payload.videoUrl);
  const isFreePreview = toBoolean(payload.is_free_preview ?? payload.isPreview, false);

  const parsedOrder = parseOptionalPositiveInteger(payload.order_index ?? payload.orderIndex);
  if (parsedOrder.provided && !parsedOrder.value) {
    return { status: 400, body: { message: 'order_index must be a positive integer.' } };
  }

  const parsedDuration = parseOptionalNonNegativeInteger(payload.duration_seconds ?? payload.durationSeconds);
  if (parsedDuration.provided && parsedDuration.value === null) {
    return { status: 400, body: { message: 'duration_seconds must be a non-negative integer.' } };
  }

  if (!title) {
    return { status: 400, body: { message: 'Lesson title is required.' } };
  }

  if (!youtubeUrl) {
    return { status: 400, body: { message: 'youtube_url is required.' } };
  }

  if (!isValidYouTubeUrl(youtubeUrl)) {
    return { status: 400, body: { message: 'Please provide a valid YouTube URL.' } };
  }

  const insertedId = await lessonModel.createLesson({
    module_id: moduleId,
    title,
    description,
    youtube_url: youtubeUrl,
    order_index: parsedOrder.value,
    is_free_preview: isFreePreview ? 1 : 0,
    duration_seconds: parsedDuration.value || 0,
  });

  const created = await lessonModel.findById(insertedId);

  return {
    status: 201,
    body: {
      message: 'Lesson created successfully.',
      lesson: formatLesson(created),
    },
  };
}

async function updateLesson(lessonIdValue, payload = {}) {
  const lessonId = toPositiveInteger(lessonIdValue);
  if (!lessonId) {
    return { status: 400, body: { message: 'Valid lessonId is required.' } };
  }

  const current = await lessonModel.findById(lessonId);
  if (!current) {
    return { status: 404, body: { message: 'Lesson not found.' } };
  }

  const hasModuleField =
    Object.prototype.hasOwnProperty.call(payload, 'module_id')
    || Object.prototype.hasOwnProperty.call(payload, 'moduleId');

  const nextModuleId = hasModuleField
    ? toPositiveInteger(payload.module_id ?? payload.moduleId)
    : Number(current.module_id);

  if (!nextModuleId) {
    return { status: 400, body: { message: 'module_id must be a positive integer.' } };
  }

  if (hasModuleField) {
    const targetModule = await moduleModel.findById(nextModuleId);
    if (!targetModule) {
      return { status: 404, body: { message: 'Target module not found.' } };
    }
  }

  const title =
    payload.title === undefined
      ? current.title
      : normalizeText(payload.title);
  const description =
    payload.description === undefined
      ? current.description
      : normalizeNullableText(payload.description);

  const hasYoutubeField =
    Object.prototype.hasOwnProperty.call(payload, 'youtube_url')
    || Object.prototype.hasOwnProperty.call(payload, 'youtubeUrl')
    || Object.prototype.hasOwnProperty.call(payload, 'videoUrl');

  const youtubeUrl = hasYoutubeField
    ? normalizeNullableText(payload.youtube_url ?? payload.youtubeUrl ?? payload.videoUrl)
    : current.youtube_url;

  const hasPreviewField =
    Object.prototype.hasOwnProperty.call(payload, 'is_free_preview')
    || Object.prototype.hasOwnProperty.call(payload, 'isPreview');

  const isFreePreview = hasPreviewField
    ? toBoolean(payload.is_free_preview ?? payload.isPreview, false)
    : Number(current.is_free_preview) === 1;

  const parsedOrder = parseOptionalPositiveInteger(payload.order_index ?? payload.orderIndex);
  if (parsedOrder.provided && !parsedOrder.value) {
    return { status: 400, body: { message: 'order_index must be a positive integer.' } };
  }

  const parsedDuration = parseOptionalNonNegativeInteger(payload.duration_seconds ?? payload.durationSeconds);
  if (parsedDuration.provided && parsedDuration.value === null) {
    return { status: 400, body: { message: 'duration_seconds must be a non-negative integer.' } };
  }

  const orderIndex = parsedOrder.provided ? parsedOrder.value : Number(current.order_index || 1);
  const durationSeconds = parsedDuration.provided ? parsedDuration.value : Number(current.duration_seconds || 0);

  if (!title) {
    return { status: 400, body: { message: 'Lesson title is required.' } };
  }

  if (!youtubeUrl) {
    return { status: 400, body: { message: 'youtube_url is required.' } };
  }

  if (!isValidYouTubeUrl(youtubeUrl)) {
    return { status: 400, body: { message: 'Please provide a valid YouTube URL.' } };
  }

  await lessonModel.updateLesson(lessonId, {
    module_id: nextModuleId,
    title,
    description,
    youtube_url: youtubeUrl,
    order_index: orderIndex,
    is_free_preview: isFreePreview ? 1 : 0,
    duration_seconds: durationSeconds,
  });

  const updated = await lessonModel.findById(lessonId);

  return {
    status: 200,
    body: {
      message: 'Lesson updated successfully.',
      lesson: formatLesson(updated),
    },
  };
}

async function deleteLesson(lessonIdValue) {
  const lessonId = toPositiveInteger(lessonIdValue);
  if (!lessonId) {
    return { status: 400, body: { message: 'Valid lessonId is required.' } };
  }

  const current = await lessonModel.findById(lessonId);
  if (!current) {
    return { status: 404, body: { message: 'Lesson not found.' } };
  }

  await lessonModel.deleteById(lessonId);

  return {
    status: 200,
    body: {
      message: 'Lesson deleted successfully.',
    },
  };
}

async function reorderLessons(moduleIdValue, payload = {}) {
  const moduleId = toPositiveInteger(moduleIdValue);
  if (!moduleId) {
    return { status: 400, body: { message: 'Valid moduleId is required.' } };
  }

  const module = await moduleModel.findById(moduleId);
  if (!module) {
    return { status: 404, body: { message: 'Module not found.' } };
  }

  const rawLessonIds = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.lessonIds)
      ? payload.lessonIds
      : Array.isArray(payload.lessons)
        ? payload.lessons
        : [];

  const requestedIds = normalizeOrderedIds(rawLessonIds);
  if (!requestedIds.length) {
    return { status: 400, body: { message: 'lessonIds must contain at least one lesson id.' } };
  }

  const currentIds = await lessonModel.listIdsByModuleId(moduleId);
  if (!currentIds.length) {
    return { status: 400, body: { message: 'No lessons found for this module.' } };
  }

  const currentIdSet = new Set(currentIds);
  const validRequestedIds = requestedIds.filter((id) => currentIdSet.has(id));

  if (!validRequestedIds.length) {
    return { status: 400, body: { message: 'None of the provided lesson ids belong to this module.' } };
  }

  const remaining = currentIds.filter((id) => !validRequestedIds.includes(id));
  const finalOrder = [...validRequestedIds, ...remaining];

  await lessonModel.reorderInModule(moduleId, finalOrder);

  const lessons = await lessonModel.listByModuleId(moduleId);

  return {
    status: 200,
    body: {
      message: 'Lessons reordered successfully.',
      lessons: lessons.map(formatLesson),
    },
  };
}

module.exports = {
  listByModuleId,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
};
