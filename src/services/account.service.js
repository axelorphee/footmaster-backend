const pool = require('../config/database');
const bcrypt = require('bcrypt');

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