const { lmsDB } = require('../config/db');

async function listByModuleId(moduleId) {
  const [rows] = await lmsDB.query(
    `SELECT
      id,
      module_id,
      title,
      description,
      youtube_url,
      order_index,
      is_free_preview,
      duration_seconds,
      created_at,
      updated_at
     FROM lessons
     WHERE module_id = ?
     ORDER BY order_index ASC, id ASC`,
    [moduleId]
  );

  return rows;
}

async function listByCourseId(courseId) {
  const [rows] = await lmsDB.query(
    `SELECT
      l.id,
      l.module_id,
      l.title,
      l.description,
      l.youtube_url,
      l.order_index,
      l.is_free_preview,
      l.duration_seconds,
      l.created_at,
      l.updated_at
     FROM lessons l
     INNER JOIN modules m ON m.id = l.module_id
     WHERE m.course_id = ?
     ORDER BY m.order_index ASC, m.id ASC, l.order_index ASC, l.id ASC`,
    [courseId]
  );

  return rows;
}

async function listIdsByModuleId(moduleId) {
  const [rows] = await lmsDB.query(
    `SELECT id
     FROM lessons
     WHERE module_id = ?
     ORDER BY order_index ASC, id ASC`,
    [moduleId]
  );

  return rows.map((row) => Number(row.id));
}

async function findById(id) {
  const [rows] = await lmsDB.query(
    `SELECT
      id,
      module_id,
      title,
      description,
      youtube_url,
      order_index,
      is_free_preview,
      duration_seconds,
      created_at,
      updated_at
     FROM lessons
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getNextOrderIndexForModule(moduleId) {
  const [rows] = await lmsDB.query(
    `SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
     FROM lessons
     WHERE module_id = ?`,
    [moduleId]
  );

  return Number(rows[0]?.next_order || 1);
}

async function createLesson(payload) {
  const orderIndex = Number.isInteger(payload.order_index)
    ? payload.order_index
    : await getNextOrderIndexForModule(payload.module_id);

  const [result] = await lmsDB.query(
    `INSERT INTO lessons (
      module_id,
      title,
      description,
      youtube_url,
      order_index,
      is_free_preview,
      duration_seconds
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.module_id,
      payload.title,
      payload.description,
      payload.youtube_url,
      orderIndex,
      payload.is_free_preview,
      payload.duration_seconds,
    ]
  );

  return result.insertId;
}

async function updateLesson(lessonId, payload) {
  const [result] = await lmsDB.query(
    `UPDATE lessons
     SET
       module_id = ?,
       title = ?,
       description = ?,
       youtube_url = ?,
       order_index = ?,
       is_free_preview = ?,
       duration_seconds = ?
     WHERE id = ?`,
    [
      payload.module_id,
      payload.title,
      payload.description,
      payload.youtube_url,
      payload.order_index,
      payload.is_free_preview,
      payload.duration_seconds,
      lessonId,
    ]
  );

  return result.affectedRows;
}

async function deleteById(lessonId) {
  const [result] = await lmsDB.query('DELETE FROM lessons WHERE id = ?', [lessonId]);
  return result.affectedRows;
}

async function reorderInModule(moduleId, orderedLessonIds) {
  const connection = await lmsDB.getConnection();

  try {
    await connection.beginTransaction();

    for (let index = 0; index < orderedLessonIds.length; index += 1) {
      await connection.query(
        `UPDATE lessons
         SET order_index = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND module_id = ?`,
        [index + 1, orderedLessonIds[index], moduleId]
      );
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  listByModuleId,
  listByCourseId,
  listIdsByModuleId,
  findById,
  createLesson,
  updateLesson,
  deleteById,
  reorderInModule,
};
