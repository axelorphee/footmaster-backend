const matchesService = require('../services/matches.service');

exports.getMatchesByDate = async (req, res, next) => {
  try {
    const { date } = req.query;

    if (!date) {
      const error = new Error('Date parameter required');
      error.statusCode = 400;
      throw error;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(date)) {
      const error = new Error('Invalid date format. Use YYYY-MM-DD');
      error.statusCode = 400;
      throw error;
    }

    const result = await matchesService.getMatchesByDate(date);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
