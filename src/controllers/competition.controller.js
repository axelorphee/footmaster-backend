const competitionService = require('../services/competition.service');

exports.getLeaguesGrouped = async (req, res, next) => {
  try {
    const data = await competitionService.getLeaguesGrouped();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.searchLeagues = async (req, res, next) => {
  try {
    const { q } = req.query;
    const data = await competitionService.searchLeagues(q);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
