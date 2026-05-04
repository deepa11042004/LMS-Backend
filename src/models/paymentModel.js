const { lmsDB } = require('../config/db');

const BASE_SELECT = `SELECT
  id,
  user_id,
  course_id,
  enrollment_id,
  amount,
  currency,
  payment_status,
  payment_provider,
  payment_id,
  order_id,
  created_at,
  updated_at
 FROM payments`;

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

async function findByOrderIdForUser(orderId, userId, runner = lmsDB, options = {}) {
  const forUpdateClause = options.forUpdate ? ' FOR UPDATE' : '';

  const [rows] = await runner.query(
    `${BASE_SELECT}
     WHERE order_id = ? AND user_id = ?
     LIMIT 1${forUpdateClause}`,
    [orderId, userId]
  );

  return rows[0] || null;
}

async function createPayment(payload, runner = lmsDB) {
  const [result] = await runner.query(
    `INSERT INTO payments (
      user_id,
      course_id,
      enrollment_id,
      amount,
      currency,
      payment_status,
      payment_provider,
      payment_id,
      order_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.user_id,
      payload.course_id,
      payload.enrollment_id || null,
      payload.amount,
      payload.currency || 'INR',
      payload.payment_status || 'pending',
      payload.payment_provider || 'razorpay',
      payload.payment_id || null,
      payload.order_id || null,
    ]
  );

  return result.insertId;
}

async function updatePayment(paymentId, payload = {}, runner = lmsDB) {
  const assignments = [];
  const values = [];

  if (Object.prototype.hasOwnProperty.call(payload, 'payment_status')) {
    assignments.push('payment_status = ?');
    values.push(payload.payment_status);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'payment_id')) {
    assignments.push('payment_id = ?');
    values.push(payload.payment_id);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'order_id')) {
    assignments.push('order_id = ?');
    values.push(payload.order_id);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'enrollment_id')) {
    assignments.push('enrollment_id = ?');
    values.push(payload.enrollment_id);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'amount')) {
    assignments.push('amount = ?');
    values.push(payload.amount);
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'currency')) {
    assignments.push('currency = ?');
    values.push(payload.currency);
  }

  if (!assignments.length) {
    return 0;
  }

  assignments.push('updated_at = CURRENT_TIMESTAMP');

  const [result] = await runner.query(
    `UPDATE payments
     SET ${assignments.join(', ')}
     WHERE id = ?`,
    [...values, paymentId]
  );

  return result.affectedRows;
}

module.exports = {
  findById,
  findByOrderIdForUser,
  createPayment,
  updatePayment,
};