const express = require('express');
const router = express.Router();
const controller = require('../controllers/competition.controller');

router.get('/', controller.getLeaguesGrouped);
router.get('/search', controller.searchLeagues);

module.exports = router;
