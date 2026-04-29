const authService = require('../services/authService');

async function login(req, res) {
  try {
    const payload = req.body || {};
    const result = await authService.login({
      email: payload.email,
      password: payload.password,
      requiredRole: payload.requiredRole,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

async function profile(req, res) {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const result = await authService.getProfile(userId);
    return res.status(result.status).json(result.body);
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  login,
  profile,
};