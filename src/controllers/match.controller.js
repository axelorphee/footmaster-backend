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

exports.getLineups = async (req, res) => {
  try {
    const { fixtureId } = req.params;

    const data = await matchService.getLineups(fixtureId);

    res.json(data);
  } catch (error) {
    console.error('Lineups error:', error.message);
    res.status(500).json({ message: 'Failed to load lineups' });
  }
};


exports.getEventsAndStats = async (req, res) => {
  try {
    const fixtureId = parseInt(req.params.fixtureId);

    if (!fixtureId) {
      return res.status(400).json({
        message: 'Invalid fixtureId',
      });
    }

    const data = await matchService.getMatchEventsAndStats(fixtureId);

    res.status(200).json(data);
  } catch (error) {
    console.error('Events error:', error.message);

    res.status(500).json({
      message: 'Failed to load events and statistics',
    });
  }
};
