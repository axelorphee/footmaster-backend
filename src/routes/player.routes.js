const express = require('express');
const router = express.Router();
const controller = require('../controllers/player.controller');

// 🔹 Search first
router.get('/search', controller.searchPlayers);

// 🔹 List players
router.get('/', controller.getPlayers);

// 🔹 Player specific
router.get('/:playerId/info', controller.getPlayerInfo);
router.get('/:playerId/seasons', controller.getPlayerSeasons);
router.get('/:playerId/stats', controller.getPlayerStats);
router.get('/:playerId/matches', controller.getPlayerMatches);
router.get('/:playerId/trophies', controller.getPlayerTrophies);
router.get('/:playerId/transfers', controller.getPlayerTransfers);

module.exports = router;
