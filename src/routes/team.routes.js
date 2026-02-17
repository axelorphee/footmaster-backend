const express = require('express');
const router = express.Router();
const controller = require('../controllers/team.controller');

router.get('/last-fixtures', controller.getLastFixturesByTeam);


module.exports = router;
