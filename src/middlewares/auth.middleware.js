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

    // 🔐 Vérification invalidation après changement password
const userResultFull = await pool.query(
  'SELECT password_changed_at, email_verified FROM users WHERE id = $1',
  [decoded.id]
);

if (userResultFull.rows.length === 0) {
  return res.status(401).json({
    success: false,
    message: 'User not found',
  });
}

const userFull = userResultFull.rows[0];

// Si le password a été changé après émission du token
if (userFull.password_changed_at) {
  const passwordChangedAt = Math.floor(
    new Date(userFull.password_changed_at).getTime() / 1000
  );

  if (decoded.iat < passwordChangedAt) {
    return res.status(401).json({
      success: false,
      message: 'Session expired. Please login again.',
    });
  }
}

    // 🔥 Vérification dynamique en base
    const result = await pool.query(
      'SELECT email_verified FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }

    const emailVerified = result.rows[0].email_verified;

    req.user = {
      id: decoded.id,
      role: decoded.role,
      email_verified: emailVerified, // ← valeur réelle DB
    };

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
  }
};