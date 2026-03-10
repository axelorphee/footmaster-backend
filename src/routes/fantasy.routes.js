const express = require('express');
const router = express.Router();

const fantasyController = require('../controllers/fantasy.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireVerified = require('../middlewares/verified.middleware');

router.get('/leagues/public', authMiddleware, fantasyController.getPublicLeagues);

router.get('/leagues/my', authMiddleware, fantasyController.getMyLeagues);

router.get('/leagues/:leagueId', authMiddleware, fantasyController.getLeagueById);

router.post(
  '/leagues',
  authMiddleware,
  requireVerified,
  fantasyController.createLeague
);

router.post(
  '/leagues/:leagueId/join',
  authMiddleware,
  requireVerified,
  fantasyController.joinLeague
);

module.exports = router;