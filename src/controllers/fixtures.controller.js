const fixturesService = require('../services/fixtures.service');

exports.getFixtureById = async (req, res, next) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Missing fixture id' });
    }

    const data = await fixturesService.getFixtureById(id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getHeadToHead = async (req, res, next) => {
  try {
    const { h2h, last } = req.query;

    if (!h2h) {
      return res.status(400).json({ error: 'Missing h2h parameter' });
    }

    const data = await fixturesService.getHeadToHead(h2h, last || 5);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
