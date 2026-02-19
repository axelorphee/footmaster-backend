const express = require('express');
const router = express.Router();
const favoritesController = require('../controllers/favorites.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, favoritesController.getFavorites);
router.post('/', authMiddleware, favoritesController.addFavorite);
router.delete('/:type/:item_id', authMiddleware, favoritesController.removeFavorite);

module.exports = router;
