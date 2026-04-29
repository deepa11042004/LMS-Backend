const moduleService = require('../services/moduleService');

async function listByCourseId(req, res) {
  try {
    const result = await moduleService.listByCourseId(req.params.courseId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('List modules error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function createModule(req, res) {
  try {
    const result = await moduleService.createModule(req.params.courseId, req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Create module error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateModule(req, res) {
  try {
    const result = await moduleService.updateModule(req.params.moduleId, req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Update module error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function deleteModule(req, res) {
  try {
    const result = await moduleService.deleteModule(req.params.moduleId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Delete module error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function reorderModules(req, res) {
  try {
    const result = await moduleService.reorderModules(req.params.courseId, req.body || {});
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Reorder modules error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  listByCourseId,
  createModule,
  updateModule,
  deleteModule,
  reorderModules,
};
