const { lmsDB } = require('../config/db');

async function listCourses({ includeUnpublished = false } = {}) {
  const whereClause = includeUnpublished ? '' : 'WHERE is_published = 1';

  const [rows] = await lmsDB.query(
    `SELECT
      id,
      title,
      slug,
      subtitle,
      description,
      category,
      level,
      language,
      thumbnail,
      price,
      discount_price,
      currency,
      is_free,
      is_paid,
      lifetime_access,
      certificate_available,
      is_published,
      instructor_id,
      total_duration_minutes,
      enrolled_students,
      created_at,
      updated_at
     FROM courses
     ${whereClause}
     ORDER BY updated_at DESC, id DESC`
  );

  return rows;
}

async function findBySlug(slug) {
  const [rows] = await lmsDB.query(
    `SELECT
      id,
      title,
      slug,
      subtitle,
      description,
      category,
      level,
      language,
      thumbnail,
      price,
      discount_price,
      currency,
      is_free,
      is_paid,
      lifetime_access,
      certificate_available,
      is_published,
      instructor_id,
      total_duration_minutes,
      enrolled_students,
      created_at,
      updated_at
     FROM courses
     WHERE slug = ?
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function findPublishedBySlug(slug) {
  const [rows] = await lmsDB.query(
    `SELECT
      id,
      title,
      slug,
      subtitle,
      description,
      category,
      level,
      language,
      thumbnail,
      price,
      discount_price,
      currency,
      is_free,
      is_paid,
      lifetime_access,
      certificate_available,
      is_published,
      instructor_id,
      total_duration_minutes,
      enrolled_students,
      created_at,
      updated_at
     FROM courses
     WHERE slug = ? AND is_published = 1
     LIMIT 1`,
    [slug]
  );

  return rows[0] || null;
}

async function findById(id) {
  const [rows] = await lmsDB.query(
    `SELECT
      id,
      title,
      slug,
      subtitle,
      description,
      category,
      level,
      language,
      thumbnail,
      price,
      discount_price,
      currency,
      is_free,
      is_paid,
      lifetime_access,
      certificate_available,
      is_published,
      instructor_id,
      total_duration_minutes,
      enrolled_students,
      created_at,
      updated_at
     FROM courses
     WHERE id = ?
     LIMIT 1`,
    [id]
  );

  return rows[0] || null;
}

async function createCourse(payload) {
  const [result] = await lmsDB.query(
    `INSERT INTO courses (
      title,
      slug,
      subtitle,
      description,
      category,
      level,
      language,
      thumbnail,
      price,
      discount_price,
      currency,
      is_free,
      is_paid,
      lifetime_access,
      certificate_available,
      is_published,
      instructor_id,
      total_duration_minutes,
      enrolled_students
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.title,
      payload.slug,
      payload.subtitle,
      payload.description,
      payload.category,
      payload.level,
      payload.language,
      payload.thumbnail,
      payload.price,
      payload.discount_price,
      payload.currency,
      payload.is_free,
      payload.is_paid,
      payload.lifetime_access,
      payload.certificate_available,
      payload.is_published,
      payload.instructor_id,
      payload.total_duration_minutes,
      payload.enrolled_students,
    ]
  );

  return result.insertId;
}

async function setPublishedStatus(id, isPublished) {
  await lmsDB.query(
    `UPDATE courses
     SET is_published = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [isPublished ? 1 : 0, id]
  );
}

async function updateCourse(id, payload) {
  await lmsDB.query(
    `UPDATE courses
     SET title = ?,
         slug = ?,
         subtitle = ?,
         description = ?,
         category = ?,
         level = ?,
         language = ?,
         price = ?,
         discount_price = ?,
         currency = ?,
         is_free = ?,
         is_paid = ?,
         lifetime_access = ?,
         certificate_available = ?,
         is_published = ?,
         total_duration_minutes = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      payload.title,
      payload.slug,
      payload.subtitle,
      payload.description,
      payload.category,
      payload.level,
      payload.language,
      payload.price,
      payload.discount_price,
      payload.currency,
      payload.is_free,
      payload.is_paid,
      payload.lifetime_access,
      payload.certificate_available,
      payload.is_published,
      payload.total_duration_minutes,
      id,
    ]
  );
}

module.exports = {
  listCourses,
  findBySlug,
  findPublishedBySlug,
  findById,
  createCourse,
  setPublishedStatus,
  updateCourse,
};