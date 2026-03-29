const express = require('express');
const router = express.Router();

const controller = require('../controllers/notification.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.get('/', authMiddleware, controller.getSubscriptions);

router.post('/', authMiddleware, controller.enableSubscription);

router.delete(
  '/:type/:id',
  authMiddleware,
  controller.disableSubscription
);

router.get('/feed', authMiddleware, controller.getAppNotifications);

router.patch(
  '/feed/:notificationId/read',
  authMiddleware,
  controller.markAppNotificationRead
);

module.exports = router;