const lessonService = require('../services/lessonService');

async function listByModuleId(req, res) {
  try {
    const result = await lessonService.listByModuleId(req.params.moduleId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('List lessons error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createLesson(req, res) {
  try {
    const result = await lessonService.createLesson(req.params.moduleId, req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Create lesson error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateLesson(req, res) {
  try {
    const result = await lessonService.updateLesson(req.params.lessonId, req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Update lesson error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteLesson(req, res) {
  try {
    const result = await lessonService.deleteLesson(req.params.lessonId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Delete lesson error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function reorderLessons(req, res) {
  try {
    const result = await lessonService.reorderLessons(req.params.moduleId, req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Reorder lessons error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  listByModuleId,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
};
