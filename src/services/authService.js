const { comparePassword } = require('../utils/hashPassword');
const { signToken } = require('../utils/jwt');
const roles = require('../constants/roles');
const userModel = require('../models/userModel');

const ALLOWED_ROLES = new Set(Object.values(roles));

const normalizeEmail = (email) => (email || '').trim().toLowerCase();
const cleanText = (value) => (value || '').trim();

async function login({ email, password, requiredRole }) {
  const normalizedEmail = normalizeEmail(email);
  const cleanPassword = cleanText(password);
  const cleanRequiredRole = cleanText(requiredRole).toLowerCase();

  if (!normalizedEmail || !cleanPassword) {
    return { status: 400, body: { message: 'Email and password are required' } };
  }

  if (cleanRequiredRole && !ALLOWED_ROLES.has(cleanRequiredRole)) {
    return { status: 400, body: { message: 'Invalid role provided' } };
  }

  const user = await userModel.findByEmail(normalizedEmail);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  if (user.is_active === 0 || user.is_active === false) {
    return { status: 403, body: { message: 'Account disabled' } };
  }

  if (cleanRequiredRole && user.role !== cleanRequiredRole) {
    return { status: 403, body: { message: 'Role is not authorized for this login' } };
  }

  const matches = await comparePassword(cleanPassword, user.password);
  if (!matches) {
    return { status: 401, body: { message: 'Invalid password' } };
  }

  await userModel.updateLastLogin(user.id);

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  return {
    status: 200,
    body: {
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
    },
  };
}

async function getProfile(userId) {
  const user = await userModel.findById(userId);
  if (!user) {
    return { status: 404, body: { message: 'User not found' } };
  }

  return {
    status: 200,
    body: {
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
        last_login: user.last_login,
      },
    },
  };
}

module.exports = {
  login,
  getProfile,
};