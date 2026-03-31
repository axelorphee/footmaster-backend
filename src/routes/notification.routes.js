const express = require('express');
const router = express.Router();

const controller = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/feed', authMiddleware, controller.getAppNotifications);

router.patch(
  '/feed/:notificationId/read',
  authMiddleware,
  controller.markAppNotificationRead
);

router.get('/matches', authMiddleware, controller.getMatchOverrides);

router.post('/matches', authMiddleware, controller.enableMatchOverride);

router.get(
  '/matches/:fixtureId/preferences',
  authMiddleware,
  controller.getMatchEventPreferences
);

router.put(
  '/matches/:fixtureId/preferences/:eventType',
  authMiddleware,
  controller.updateMatchEventPreference
);

router.delete(
  '/matches/:fixtureId',
  authMiddleware,
  controller.disableMatchOverride
);

router.get(
  '/preferences',
  authMiddleware,
  controller.getNotificationPreferences
);

router.put(
  '/preferences/:eventType',
  authMiddleware,
  controller.updateNotificationPreference
);

router.get('/', authMiddleware, controller.getSubscriptions);

router.post('/', authMiddleware, controller.enableSubscription);

router.delete(
  '/:type/:id',
  authMiddleware,
  controller.disableSubscription
);

module.exports = router;