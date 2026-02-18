const express = require('express');
const router = express.Router();
const controller = require('../controllers/team.controller');

router.get('/', controller.getTeamsByLeague);
router.get('/search', controller.searchTeams);

router.get('/:teamId/overview', controller.getOverview);
router.get('/:teamId/matches', controller.getMatches);
router.get('/:teamId/squad', controller.getSquad);
router.get('/:teamId/standings-overview', controller.getStandingsOverview);
router.get('/:teamId/active-season', controller.getActiveSeason);
router.get('/:teamId/transfers', controller.getTransfers);




module.exports = router;
