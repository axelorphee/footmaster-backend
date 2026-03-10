const express = require('express');
const router = express.Router();

const fantasyController = require('../controllers/fantasy.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireVerified = require('../middlewares/verified.middleware');

router.get('/leagues/public', authMiddleware, fantasyController.getPublicLeagues);

router.get('/leagues/my', authMiddleware, fantasyController.getMyLeagues);

router.get('/leagues/:leagueId', authMiddleware, fantasyController.getLeagueById);

router.get(
  '/leagues/:leagueId/requests',
  authMiddleware,
  requireVerified,
  fantasyController.getLeagueRequests
);

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

router.post(
  '/leagues/:leagueId/requests/:userId/approve',
  authMiddleware,
  requireVerified,
  fantasyController.approveLeagueRequest
);

router.post(
  '/leagues/:leagueId/requests/:userId/reject',
  authMiddleware,
  requireVerified,
  fantasyController.rejectLeagueRequest
);

module.exports = router;