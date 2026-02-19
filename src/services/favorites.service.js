const pool = require('../config/database');

exports.getFavorites = async (userId) => {
  const result = await pool.query(
    'SELECT id, type, item_id, name, logo FROM favorites WHERE user_id = $1',
    [userId]
  );

  return result.rows;
};

exports.addFavorite = async (userId, type, itemId, name, logo) => {
  const existing = await pool.query(
    'SELECT * FROM favorites WHERE user_id = $1 AND type = $2 AND item_id = $3',
    [userId, type, itemId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  const result = await pool.query(
    `INSERT INTO favorites (user_id, type, item_id, name, logo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, item_id, name, logo`,
    [userId, type, itemId, name, logo]
  );

  return result.rows[0];
};

exports.removeFavorite = async (userId, type, itemId) => {
  await pool.query(
    'DELETE FROM favorites WHERE user_id = $1 AND type = $2 AND item_id = $3',
    [userId, type, itemId]
  );

  return { success: true };
};
