const pool = require('../config/db');

async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, password, role, is_active, created_at, updated_at, last_login FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0];
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, full_name, email, password, role, is_active, created_at, updated_at, last_login FROM users WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0];
}

async function updateLastLogin(id) {
  await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [id]);
}

async function updateFullName(id, fullName) {
  await pool.query('UPDATE users SET full_name = ?, updated_at = NOW() WHERE id = ?', [fullName, id]);
}

async function listActiveInstructors() {
  const [rows] = await pool.query(
    `
      SELECT id, full_name, email, role, is_active
      FROM users
      WHERE role = 'instructor' AND is_active = 1
      ORDER BY full_name ASC, id ASC
    `
  );

  return rows;
}

module.exports = {
  findByEmail,
  findById,
  updateLastLogin,
  updateFullName,
  listActiveInstructors,
};