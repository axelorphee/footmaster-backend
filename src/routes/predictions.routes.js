const express = require('express');
const router = express.Router();
const controller = require('../controllers/predictions.controller');

router.get('/', controller.getPredictions);

module.exports = router;
