const express = require('express');
const router = express.Router();
const matchController = require('../controllers/match.controller');

// GET /api/match/:fixtureId/prematch
router.get('/:fixtureId/prematch', matchController.getPrematch);
router.get('/:fixtureId/lineups', matchController.getLineups);
router.get('/:fixtureId/events', matchController.getEventsAndStats);



module.exports = router;
