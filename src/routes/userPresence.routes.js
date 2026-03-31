const express = require('express');
const router = express.Router();

const authMiddleware = require('../middlewares/auth.middleware');
const controller = require('../controllers/userPresence.controller');

router.post('/heartbeat', authMiddleware, controller.heartbeat);

module.exports = router;