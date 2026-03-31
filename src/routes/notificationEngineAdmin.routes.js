const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const appAdminMiddleware = require('../middlewares/appAdmin.middleware');
const controller = require('../controllers/notificationEngineAdmin.controller');

router.get(
  '/control',
  authMiddleware,
  appAdminMiddleware,
  controller.getNotificationEngineControl
);

router.post(
  '/control/enable',
  authMiddleware,
  appAdminMiddleware,
  controller.enableNotificationEngineControl
);

router.post(
  '/control/disable',
  authMiddleware,
  appAdminMiddleware,
  controller.disableNotificationEngineControl
);

module.exports = router;