const pool = require('../config/database');

const SETTINGS_KEY = 'notification_engine_control';

async function getNotificationEngineControl() {
  const result = await pool.query(
    `
    SELECT value_json, updated_at
    FROM app_runtime_settings
    WHERE key = $1
    `,
    [SETTINGS_KEY]
  );

  if (result.rows.length === 0) {
    const insertResult = await pool.query(
      `
      INSERT INTO app_runtime_settings (key, value_json)
      VALUES ($1, $2::jsonb)
      RETURNING value_json, updated_at
      `,
      [SETTINGS_KEY, JSON.stringify({ enabled: false })]
    );

    return {
      enabled: insertResult.rows[0].value_json?.enabled === true,
      updated_at: insertResult.rows[0].updated_at,
    };
  }

  return {
    enabled: result.rows[0].value_json?.enabled === true,
    updated_at: result.rows[0].updated_at,
  };
}

async function setNotificationEngineControl(enabled) {
  const result = await pool.query(
    `
    INSERT INTO app_runtime_settings (key, value_json, updated_at)
    VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
    ON CONFLICT (key)
    DO UPDATE SET
      value_json = EXCLUDED.value_json,
      updated_at = CURRENT_TIMESTAMP
    RETURNING value_json, updated_at
    `,
    [SETTINGS_KEY, JSON.stringify({ enabled: !!enabled })]
  );

  return {
    enabled: result.rows[0].value_json?.enabled === true,
    updated_at: result.rows[0].updated_at,
  };
}

module.exports = {
  getNotificationEngineControl,
  setNotificationEngineControl,
};