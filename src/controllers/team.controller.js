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

exports.getOverview = async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const data = await teamService.getTeamOverview(teamId);
    res.json(data);
  } catch (err) {
    console.error('Team overview error:', err.message);
    res.status(500).json({ message: 'Failed to load team overview' });
  }
};

exports.getMatches = async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { type, limit } = req.query;

    const data = await teamService.getTeamMatches(
      teamId,
      type,
      parseInt(limit) || 10
    );

    res.json(data);
  } catch (err) {
    console.error('Team matches error:', err.message);
    res.status(500).json({ message: 'Failed to load team matches' });
  }
};

