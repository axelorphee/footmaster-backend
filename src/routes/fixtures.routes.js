const express = require('express');
const router = express.Router();
const controller = require('../controllers/fixtures.controller');

router.get('/', controller.getFixtureById);
router.get('/headtohead', controller.getHeadToHead);

module.exports = router;
