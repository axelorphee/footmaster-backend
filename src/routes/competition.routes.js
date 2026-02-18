const express = require('express');
const router = express.Router();
const controller = require('../controllers/competition.controller');

router.get('/', controller.getLeaguesGrouped);
router.get('/search', controller.searchLeagues);
router.get('/teams', controller.getTeamsByLeagueAndSeason);

router.get('/:leagueId/details', controller.getLeagueDetails);
router.get('/:leagueId/fixtures', controller.getLeagueFixtures);
router.get('/:leagueId/standings', controller.getLeagueStandings);
router.get('/:leagueId/statistics', controller.getLeagueStatistics);


module.exports = router;
