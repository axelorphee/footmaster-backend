const express = require('express');
const router = express.Router();
const standingsController = require('../controllers/standings.controller');

// Route publique
router.get('/', standingsController.getStandingsByLeagueAndSeason);
router.get('/standings/grouped', controller.getStandingsGrouped);


module.exports = router;
