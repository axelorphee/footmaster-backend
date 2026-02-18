const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');

router.get('/', (req, res) => {
  const timezones = moment.tz.names();
  res.json({ response: timezones });
});

module.exports = router;
