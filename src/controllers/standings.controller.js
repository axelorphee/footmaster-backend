const standingsService = require('../services/standings.service');

exports.getStandingsByLeagueAndSeason = async (req, res, next) => {
  try {
    const { league, season } = req.query;

    if (!league || !season) {
      const error = new Error('League and season parameters required');
      error.statusCode = 400;
      throw error;
    }

    const result = await standingsService.getStandingsByLeagueAndSeason(
      league,
      season
    );

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
