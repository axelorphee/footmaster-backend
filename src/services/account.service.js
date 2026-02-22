const pool = require('../config/database');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const emailService = require('./email.service');

exports.updateProfile = async (userId, username) => {
  const result = await pool.query(
    `UPDATE users
     SET username = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING id, email, username, role, email_verified`,
    [username, userId]
  );

  return result.rows[0];
};

exports.updatePassword = async (userId, currentPassword, newPassword) => {
  const userResult = await pool.query(
    'SELECT password FROM users WHERE id = $1',
    [userId]
  );

  if (userResult.rows.length === 0) {
    throw new Error('User not found');
  }

  const user = userResult.rows[0];

  const isMatch = await bcrypt.compare(currentPassword, user.password);

  if (!isMatch) {
    throw new Error('Current password incorrect');
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await pool.query(
    `UPDATE users
     SET password = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [hashedPassword, userId]
  );
};

exports.updateEmail = async (userId, newEmail) => {
  const existing = await pool.query(
    'SELECT id FROM users WHERE email = $1',
    [newEmail]
  );

  if (existing.rows.length > 0) {
    throw new Error('Email already in use');
  }

  // ✅ ON GÉNÈRE ICI
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 1000 * 60 * 60);

  await pool.query(
    `UPDATE users
     SET email_temp = $1,
         email_verification_token = $2,
         email_verification_expires = $3
     WHERE id = $4`,
    [newEmail, token, expires, userId]
  );

  await emailService.sendVerificationEmail(newEmail, token, 'email-change');
};

exports.confirmEmailChange = async (token) => {
  const userResult = await pool.query(
    'SELECT * FROM users WHERE email_verification_token = $1',
    [token]
  );

  if (userResult.rows.length === 0) {
    throw new Error('Invalid token');
  }

  const user = userResult.rows[0];

  if (new Date() > user.email_verification_expires) {
    throw new Error('Token expired');
  }

  await pool.query(
    `UPDATE users
     SET email = email_temp,
         email_temp = NULL,
         email_verified = true,
         email_verification_token = NULL,
         email_verification_expires = NULL
     WHERE id = $1`,
    [user.id]
  );
};