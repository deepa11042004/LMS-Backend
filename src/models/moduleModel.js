const { lmsDB } = require('../config/db');

async function listByCourseId(courseId) {
  const [rows] = await lmsDB.query(
    `SELECT
      id,
      course_id,
      title,
      description,
      order_index,
      created_at,
      updated_at
     FROM modules
     WHERE course_id = ?
     ORDER BY order_index ASC, id ASC`,
    [courseId]
  );

  return rows;
}

async function listIdsByCourseId(courseId) {
  const [rows] = await lmsDB.query(
    `SELECT id
     FROM modules
     WHERE course_id = ?
     ORDER BY order_index ASC, id ASC`,
    [courseId]
  );

  return rows.map((row) => Number(row.id));
}

async function findById(id) {
  const [rows] = await lmsDB.query(
    `SELECT
      id,
      course_id,
      title,
      description,
      order_index,
      created_at,
      updated_at
     FROM modules
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function getNextOrderIndexForCourse(courseId) {
  const [rows] = await lmsDB.query(
    `SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order
     FROM modules
     WHERE course_id = ?`,
    [courseId]
  );

  return Number(rows[0]?.next_order || 1);
}

async function createModule(payload) {
  const orderIndex = Number.isInteger(payload.order_index)
    ? payload.order_index
    : await getNextOrderIndexForCourse(payload.course_id);

  const [result] = await lmsDB.query(
    `INSERT INTO modules (
      course_id,
      title,
      description,
      order_index
    ) VALUES (?, ?, ?, ?)`,
    [payload.course_id, payload.title, payload.description, orderIndex]
  );

  return result.insertId;
}

async function updateModule(moduleId, payload) {
  const [result] = await lmsDB.query(
    `UPDATE modules
     SET title = ?, description = ?, order_index = ?
     WHERE id = ?`,
    [payload.title, payload.description, payload.order_index, moduleId]
  );

  return result.affectedRows;
}

async function deleteById(moduleId) {
  const [result] = await lmsDB.query('DELETE FROM modules WHERE id = ?', [moduleId]);
  return result.affectedRows;
}

async function reorderInCourse(courseId, orderedModuleIds) {
  const connection = await lmsDB.getConnection();

  try {
    await connection.beginTransaction();

    for (let index = 0; index < orderedModuleIds.length; index += 1) {
      await connection.query(
        `UPDATE modules
         SET order_index = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND course_id = ?`,
        [index + 1, orderedModuleIds[index], courseId]
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
  listByCourseId,
  listIdsByCourseId,
  findById,
  createModule,
  updateModule,
  deleteById,
  reorderInCourse,
};
