const express = require('express');
const router = express.Router();
const matchesController = require('../controllers/matches.controller');

router.get('/live', matchesController.getLiveMatches);
router.get('/', matchesController.getMatchesByDate);

module.exports = router;