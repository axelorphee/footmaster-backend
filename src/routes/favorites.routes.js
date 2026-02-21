const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favorites.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const requireVerified = require('../middlewares/verified.middleware');

router.get('/', authMiddleware, favoritesController.getFavorites);

router.post(
  '/',
  authMiddleware,
  requireVerified,
  favoritesController.addFavorite
);

router.delete(
  '/:type/:item_id',
  authMiddleware,
  requireVerified,
  favoritesController.removeFavorite
);

module.exports = router;
