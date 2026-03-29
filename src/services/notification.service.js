const pool = require('../config/database');

exports.getSubscriptions = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM notification_subscriptions
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows;
};

exports.upsertSubscription = async ({
  userId,
  sourceType,
  sourceId,
}) => {
  const result = await pool.query(
    `
    INSERT INTO notification_subscriptions (
      user_id,
      source_type,
      source_id,
      is_enabled
    )
    VALUES ($1, $2, $3, true)
    ON CONFLICT (user_id, source_type, source_id)
    DO UPDATE SET
      is_enabled = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [userId, sourceType, sourceId]
  );

  return result.rows[0];
};

exports.disableSubscription = async ({
  userId,
  sourceType,
  sourceId,
}) => {
  await pool.query(
    `
    UPDATE notification_subscriptions
    SET is_enabled = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND source_type = $2
      AND source_id = $3
    `,
    [userId, sourceType, sourceId]
  );

  return { success: true };
};