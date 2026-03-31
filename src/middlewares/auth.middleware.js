const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const userResult = await pool.query(
      `
      SELECT
        password_changed_at,
        email_verified,
        is_app_admin
      FROM users
      WHERE id = $1
      `,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    const user = userResult.rows[0];

    if (user.password_changed_at) {
      const passwordChangedAt = Math.floor(
        new Date(user.password_changed_at).getTime() / 1000
      );

      if (decoded.iat < passwordChangedAt) {
        return res.status(401).json({
          success: false,
          message: 'Session expired. Please login again.',
        });
      }
    }

    req.user = {
      id: decoded.id,
      role: decoded.role,
      email_verified: user.email_verified,
      is_app_admin: user.is_app_admin,
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};