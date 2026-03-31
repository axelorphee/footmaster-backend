const pool = require('../config/database');

exports.touchUserPresence = async (userId) => {
  const result = await pool.query(
    `
    INSERT INTO user_presence (
      user_id,
      last_seen_at,
      updated_at
    )
    VALUES ($1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id)
    DO UPDATE SET
      last_seen_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, last_seen_at, updated_at
    `,
    [userId]
  );

  return result.rows[0];
};

exports.hasRecentlyActiveUsers = async (minutes = 10) => {
  const result = await pool.query(
    `
    SELECT 1
    FROM user_presence
    WHERE last_seen_at >= NOW() - ($1 || ' minutes')::interval
    LIMIT 1
    `,
    [minutes]
  );

  return result.rows.length > 0;
};