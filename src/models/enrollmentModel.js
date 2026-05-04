const { lmsDB } = require('../config/db');

const BASE_SELECT = `SELECT
  id,
  user_id,
  course_id,
  status,
  enrolled_at,
  created_at,
  updated_at
 FROM enrollments`;

async function findById(id, runner = lmsDB, options = {}) {
  const forUpdateClause = options.forUpdate ? ' FOR UPDATE' : '';

  const [rows] = await runner.query(
    `${BASE_SELECT}
     WHERE id = ?
     LIMIT 1${forUpdateClause}`,
    [id]
  );

  return rows[0] || null;
}

async function findByUserAndCourse(userId, courseId, runner = lmsDB, options = {}) {
  const forUpdateClause = options.forUpdate ? ' FOR UPDATE' : '';

  const [rows] = await runner.query(
    `${BASE_SELECT}
     WHERE user_id = ? AND course_id = ?
     LIMIT 1${forUpdateClause}`,
    [userId, courseId]
  );

  return rows[0] || null;
}

async function createEnrollment(payload, runner = lmsDB) {
  const [result] = await runner.query(
    `INSERT INTO enrollments (
      user_id,
      course_id,
      status,
      enrolled_at
    ) VALUES (?, ?, ?, ?)`,
    [
      payload.user_id,
      payload.course_id,
      payload.status || 'active',
      payload.enrolled_at || new Date(),
    ]
  );

  return result.insertId;
}

async function updateStatusById(enrollmentId, status, runner = lmsDB) {
  const [result] = await runner.query(
    `UPDATE enrollments
     SET status = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [status, enrollmentId]
  );

  return result.affectedRows;
}

async function reactivateById(enrollmentId, runner = lmsDB) {
  const [result] = await runner.query(
    `UPDATE enrollments
     SET
       status = 'active',
       enrolled_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [enrollmentId]
  );

  return result.affectedRows;
}

module.exports = {
  findById,
  findByUserAndCourse,
  createEnrollment,
  updateStatusById,
  reactivateById,
};