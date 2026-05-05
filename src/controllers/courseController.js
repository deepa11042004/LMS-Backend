const courseService = require('../services/courseService');

const isAbsoluteUrl = (value) => /^https?:\/\//i.test(value) || /^data:/i.test(value);

const resolveThumbnailUrl = (value, req) => {
  if (!value) return null;
  if (isAbsoluteUrl(value)) return value;

  const normalized = String(value).startsWith('/') ? String(value) : `/${value}`;
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto ? String(forwardedProto).split(',')[0].trim() : req.protocol;
  const baseUrl = `${protocol}://${req.get('host')}`;

  return `${baseUrl}${normalized}`;
};

const toPublicCourse = (course, req) => ({
  ...course,
  thumbnail: resolveThumbnailUrl(course.thumbnail, req),
});

async function listCourses(req, res) {
  try {
    const result = await courseService.listCourses();
    const courses = result.body.courses.map((course) => toPublicCourse(course, req));
    return res.status(result.status).json({ courses });
  } catch (err) {
    console.error('List courses error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function listAdminCourses(req, res) {
  try {
    const result = await courseService.listCourses({ includeUnpublished: true });
    const courses = result.body.courses.map((course) => toPublicCourse(course, req));
    return res.status(result.status).json({ courses });
  } catch (err) {
    console.error('List admin courses error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createCourse(req, res) {
  try {
    const payload = req.body || {};
    const thumbnail = req.uploadedThumbnail?.url || payload.thumbnail;

    const result = await courseService.createCourse({
      ...payload,
      thumbnail,
    });

    if (!result.body.course) {
      return res.status(result.status).json(result.body);
    }

    return res.status(result.status).json({
      ...result.body,
      course: toPublicCourse(result.body.course, req),
    });
  } catch (err) {
    console.error('Create course error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getCourseFull(req, res) {
  try {
    const result = await courseService.getCourseFull(req.params.id);

    if (!result.body.course) {
      return res.status(result.status).json(result.body);
    }

    const publicCourse = {
      ...result.body.course,
      thumbnail: resolveThumbnailUrl(result.body.course.thumbnail, req),
      modules: (result.body.course.modules || []).map((module) => ({
        ...module,
        lessons: (module.lessons || []).map((lesson) => ({ ...lesson })),
      })),
    };

    return res.status(result.status).json({
      course: publicCourse,
    });
  } catch (err) {
    console.error('Get full course error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function getCourseFullBySlug(req, res) {
  try {
    const result = await courseService.getCourseFullBySlug(req.params.slug);

    if (!result.body.course) {
      return res.status(result.status).json(result.body);
    }

    const publicCourse = {
      ...result.body.course,
      thumbnail: resolveThumbnailUrl(result.body.course.thumbnail, req),
      modules: (result.body.course.modules || []).map((module) => ({
        ...module,
        lessons: (module.lessons || []).map((lesson) => ({ ...lesson })),
      })),
    };

    return res.status(result.status).json({
      course: publicCourse,
    });
  } catch (err) {
    console.error('Get full course by slug error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function publishCourse(req, res) {
  try {
    const result = await courseService.publishCourse(req.params.id);

    if (!result.body.course) {
      return res.status(result.status).json(result.body);
    }

    return res.status(result.status).json({
      ...result.body,
      course: toPublicCourse(result.body.course, req),
    });
  } catch (err) {
    console.error('Publish course error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateCourse(req, res) {
  try {
    const result = await courseService.updateCourse(req.params.id, req.body || {});

    if (!result.body.course) {
      return res.status(result.status).json(result.body);
    }

    return res.status(result.status).json({
      ...result.body,
      course: toPublicCourse(result.body.course, req),
    });
  } catch (err) {
    console.error('Update course error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function listMyLearningCourses(req, res) {
  try {
    const userId = req.user?.userId;
    const result = await courseService.listMyLearningCourses(userId);
    const courses = (result.body.courses || []).map((course) => toPublicCourse(course, req));

    return res.status(result.status).json({ courses });
  } catch (err) {
    console.error('List my learning courses error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  listCourses,
  listAdminCourses,
  createCourse,
  updateCourse,
  getCourseFull,
  getCourseFullBySlug,
  publishCourse,
  listMyLearningCourses,
};