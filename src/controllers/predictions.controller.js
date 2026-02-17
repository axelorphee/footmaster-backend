const predictionsService = require('../services/predictions.service');

exports.getPredictions = async (req, res, next) => {
  try {
    const { fixture } = req.query;

    if (!fixture) {
      return res.status(400).json({ error: 'Missing fixture id' });
    }

    const data = await predictionsService.getPredictions(fixture);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
