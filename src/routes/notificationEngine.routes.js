const express = require('express');
const router = express.Router();

const controller = require('../controllers/notification_engine.controller');

router.get('/status', controller.getNotificationEngineStatus);
router.post('/start', controller.startNotificationEngine);
router.post('/stop', controller.stopNotificationEngine);
router.post('/run', controller.runNotificationEngine);

module.exports = router;