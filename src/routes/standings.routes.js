const express = require('express');
const router = express.Router();
const standingsController = require('../controllers/standings.controller');

// Route publique
router.get('/', standingsController.getStandingsByLeagueAndSeason);
router.get('/standings/grouped', standingsController.getStandingsGrouped);


module.exports = router;
