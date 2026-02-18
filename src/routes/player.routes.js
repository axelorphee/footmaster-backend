const express = require('express');
const router = express.Router();
const controller = require('../controllers/player.controller');

router.get('/:playerId/info', controller.getPlayerInfo);
router.get('/:playerId/seasons', controller.getPlayerSeasons);
router.get('/:playerId/stats', controller.getPlayerStats);
router.get('/:playerId/matches', controller.getPlayerMatches);

module.exports = router;
