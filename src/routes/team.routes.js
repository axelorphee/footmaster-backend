const express = require('express');
const router = express.Router();
const controller = require('../controllers/team.controller');

router.get('/:teamId/overview', controller.getOverview);
router.get('/:teamId/matches', controller.getMatches);
router.get('/:teamId/squad', controller.getSquad);


module.exports = router;
