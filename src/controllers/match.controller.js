const matchService = require('../services/match.service');

exports.getPrematch = async (req, res) => {
  try {
    const fixtureId = parseInt(req.params.fixtureId);

    if (!fixtureId) {
      return res.status(400).json({
        message: 'Invalid fixtureId',
      });
    }

    const data = await matchService.getPrematchData(fixtureId);

    res.status(200).json(data);
  } catch (error) {
    console.error('Prematch error:', error.message);

    res.status(500).json({
      message: 'Failed to load prematch data',
    });
  }
};
