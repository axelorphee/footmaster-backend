const express = require('express');
const router = express.Router();

const controller = require('../controllers/notification_engine.controller');

router.post('/run', controller.runNotificationEngine);

module.exports = router;