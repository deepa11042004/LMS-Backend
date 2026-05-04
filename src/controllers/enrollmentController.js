const enrollmentService = require('../services/enrollmentService');

async function enrollInCourse(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await enrollmentService.enrollInFreeCourse({
      userId,
      courseId: req.params.courseId,
    });

    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Enroll course error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  enrollInCourse,
};