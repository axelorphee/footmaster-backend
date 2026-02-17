const express = require('express');
const router = express.Router();
const matchesController = require('../controllers/matches.controller');

// Route publique : accessible sans authentification
router.get('/', matchesController.getMatchesByDate);

module.exports = router;
