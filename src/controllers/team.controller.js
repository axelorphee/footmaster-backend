const teamService = require('../services/team.service');

exports.getLastFixturesByTeam = async (req, res, next) => {
  try {
    const { team, limit } = req.query;

    if (!team) {
      return res.status(400).json({ error: 'Missing team id' });
    }

    const data = await teamService.getLastFixturesByTeam(team, limit || 5);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

