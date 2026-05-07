const { lmsDB } = require('../config/db');
const courseModel = require('../models/courseModel');
const enrollmentModel = require('../models/enrollmentModel');

const ENROLLMENT_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

const toPositiveInteger = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const toBoolean = (value, fallback = false) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;

  const normalized = String(value).trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatEnrollment = (enrollment) => ({
  id: Number(enrollment.id),
  user_id: Number(enrollment.user_id),
  course_id: Number(enrollment.course_id),
  status: enrollment.status,
  enrolled_at: enrollment.enrolled_at,
  created_at: enrollment.created_at,
  updated_at: enrollment.updated_at,
});

const isCourseFree = (course = {}) => {
  if (toBoolean(course.is_free, false)) return true;
  if (course.is_paid !== undefined && course.is_paid !== null) {
    return !toBoolean(course.is_paid, false);
  }

  return toFiniteNumber(course.price, 0) <= 0;
};

async function ensureActiveEnrollment({ userId, courseId }, runner = lmsDB, options = {}) {
  const normalizedUserId = toPositiveInteger(userId);
  const normalizedCourseId = toPositiveInteger(courseId);

  if (!normalizedUserId || !normalizedCourseId) {
    throw new Error('Valid userId and courseId are required to create enrollment.');
  }

  const existing = await enrollmentModel.findByUserAndCourse(
    normalizedUserId,
    normalizedCourseId,
    runner,
    { forUpdate: Boolean(options.forUpdate) }
  );

  if (!existing) {
    const insertedId = await enrollmentModel.createEnrollment(
      {
        user_id: normalizedUserId,
        course_id: normalizedCourseId,
        status: ENROLLMENT_STATUSES.ACTIVE,
      },
      runner
    );

    const created = await enrollmentModel.findById(insertedId, runner, {
      forUpdate: Boolean(options.forUpdate),
    });

    await courseModel.syncEnrolledStudents(normalizedCourseId, runner);

    return {
      enrollment: created,
      created: true,
      reactivated: false,
    };
  }

  if (existing.status === ENROLLMENT_STATUSES.CANCELLED) {
    await enrollmentModel.reactivateById(existing.id, runner);

    const reactivated = await enrollmentModel.findById(existing.id, runner, {
      forUpdate: Boolean(options.forUpdate),
    });

    await courseModel.syncEnrolledStudents(normalizedCourseId, runner);

    return {
      enrollment: reactivated,
      created: false,
      reactivated: true,
    };
  }

  return {
    enrollment: existing,
    created: false,
    reactivated: false,
  };
}

async function enrollInFreeCourse({ userId, courseId }) {
  const normalizedUserId = toPositiveInteger(userId);
  const normalizedCourseId = toPositiveInteger(courseId);

  if (!normalizedUserId) {
    return { status: 401, body: { message: 'Unauthorized user.' } };
  }

  if (!normalizedCourseId) {
    return { status: 400, body: { message: 'Valid course id is required.' } };
  }

  const course = await courseModel.findById(normalizedCourseId);
  if (!course) {
    return { status: 404, body: { message: 'Course not found.' } };
  }

  if (Number(course.is_published) !== 1) {
    return { status: 400, body: { message: 'Course is not available for enrollment.' } };
  }

  if (!isCourseFree(course)) {
    return {
      status: 400,
      body: {
        message: 'This is a paid course. Create a payment order first.',
      },
    };
  }

  const result = await ensureActiveEnrollment({
    userId: normalizedUserId,
    courseId: normalizedCourseId,
  });

  const httpStatus = result.created || result.reactivated ? 201 : 200;

  return {
    status: httpStatus,
    body: {
      message:
        result.created || result.reactivated
          ? 'Enrollment activated successfully.'
          : 'User is already enrolled in this course.',
      enrollment: formatEnrollment(result.enrollment),
    },
  };
}

module.exports = {
  ENROLLMENT_STATUSES,
  formatEnrollment,
  isCourseFree,
  ensureActiveEnrollment,
  enrollInFreeCourse,
};