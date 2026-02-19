const favoritesService = require('../services/favorites.service');

exports.getFavorites = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const favorites = await favoritesService.getFavorites(userId);

    res.json({
      success: true,
      data: favorites,
    });
  } catch (err) {
    next(err);
  }
};

exports.addFavorite = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, item_id, name, logo } = req.body;

    const favorite = await favoritesService.addFavorite(
      userId,
      type,
      item_id,
      name,
      logo
    );

    res.status(201).json({
      success: true,
      data: favorite,
    });
  } catch (err) {
    next(err);
  }
};

exports.removeFavorite = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, item_id } = req.params;

    await favoritesService.removeFavorite(userId, type, item_id);

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
};
