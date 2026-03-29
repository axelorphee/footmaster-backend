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

exports.getAppNotifications = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id,
      source_type,
      source_id,
      fixture_id,
      event_type,
      title,
      message,
      is_read,
      metadata,
      created_at
    FROM app_notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.markAppNotificationRead = async ({ notificationId, userId }) => {
  const result = await pool.query(
    `
    UPDATE app_notifications
    SET is_read = true
    WHERE id = $1 AND user_id = $2
    RETURNING
      id,
      user_id,
      source_type,
      source_id,
      fixture_id,
      event_type,
      title,
      message,
      is_read,
      metadata,
      created_at
    `,
    [notificationId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

exports.getMatchOverrides = async (userId) => {
  const result = await pool.query(
    `
    SELECT *
    FROM notification_match_overrides
    WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows;
};

exports.upsertMatchOverride = async ({
  userId,
  fixtureId,
}) => {
  const result = await pool.query(
    `
    INSERT INTO notification_match_overrides (
      user_id,
      fixture_id,
      is_enabled
    )
    VALUES ($1, $2, true)
    ON CONFLICT (user_id, fixture_id)
    DO UPDATE SET
      is_enabled = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [userId, fixtureId]
  );

  return result.rows[0];
};

exports.disableMatchOverride = async ({
  userId,
  fixtureId,
}) => {
  const result = await pool.query(
    `
    INSERT INTO notification_match_overrides (
      user_id,
      fixture_id,
      is_enabled
    )
    VALUES ($1, $2, false)
    ON CONFLICT (user_id, fixture_id)
    DO UPDATE SET
      is_enabled = false,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [userId, fixtureId]
  );

  return result.rows[0];
};