const express = require('express');
const router = express.Router();

const fantasyController = require('../controllers/fantasy.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireVerified = require('../middlewares/verified.middleware');

router.get('/leagues/public', authMiddleware, fantasyController.getPublicLeagues);

router.get('/leagues/my', authMiddleware, fantasyController.getMyLeagues);

router.get('/leagues/:leagueId', authMiddleware, fantasyController.getLeagueById);

router.get(
  '/leagues/:leagueId/standings',
  authMiddleware,
  fantasyController.getLeagueStandings
);

router.get(
  '/leagues/:leagueId/requests',
  authMiddleware,
  requireVerified,
  fantasyController.getLeagueRequests
);

router.get('/tenants/:tenantId', authMiddleware, fantasyController.getTenantById);

router.get('/tenants/:tenantId/rules', authMiddleware, fantasyController.getTenantRules);

router.get('/tenants/:tenantId/gameweeks', authMiddleware, fantasyController.getTenantGameweeks);

router.get('/tenants/:tenantId/players', authMiddleware, fantasyController.getTenantPlayers);

router.get(
  '/tenants/:tenantId/squads/:gw/me',
  authMiddleware,
  fantasyController.getMySquadByGw
);

router.post(
  '/tenants/:tenantId/squads/:gw/me',
  authMiddleware,
  requireVerified,
  fantasyController.saveMySquadByGw
);

router.post(
  '/tenants/:tenantId/gameweeks/:gw/player-points',
  authMiddleware,
  requireVerified,
  fantasyController.upsertFantasyPlayerGwPoints
);

router.post(
  '/tenants/:tenantId/gameweeks/:gw/my-points/calculate',
  authMiddleware,
  requireVerified,
  fantasyController.calculateMySquadGwPoints
);

router.post(
  '/tenants/:tenantId/gameweeks/:gw/player-points/fetch',
  authMiddleware,
  requireVerified,
  fantasyController.fetchAndUpsertFantasyPlayerGwPoints
);

router.post(
  '/tenants/:tenantId/gameweeks/:gw/my-points/run',
  authMiddleware,
  requireVerified,
  fantasyController.runMyGwPointsPipeline
);

router.post(
  '/tenants/:tenantId/my-total-points/sync',
  authMiddleware,
  requireVerified,
  fantasyController.syncMyTotalPointsForTenantLeagues
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
  '/leagues/join-by-code',
  authMiddleware,
  requireVerified,
  fantasyController.joinLeagueByCode
);

router.delete(
  '/leagues/:leagueId/me',
  authMiddleware,
  requireVerified,
  fantasyController.leaveLeague
);

router.delete(
  '/leagues/:leagueId/members/:userId',
  authMiddleware,
  requireVerified,
  fantasyController.removeLeagueMember
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

router.get(
  '/notifications/me',
  authMiddleware,
  requireVerified,
  fantasyController.getMyFantasyNotifications
);

router.post(
  '/notifications/:notificationId/read',
  authMiddleware,
  requireVerified,
  fantasyController.markFantasyNotificationRead
);

router.post(
  '/tenants/ensure-seeded',
  authMiddleware,
  requireVerified,
  fantasyController.ensureFantasyTenantSeeded
);



module.exports = router;