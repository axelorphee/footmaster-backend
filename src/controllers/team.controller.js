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

exports.getSquad = async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const data = await teamService.getSquadAndCoach(teamId);
    res.json(data);
  } catch (err) {
    console.error('Squad error:', err.message);
    res.status(500).json({ message: 'Failed to load squad' });
  }
};

exports.getStandingsOverview = async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const { season } = req.query;

    const data = await teamService.getTeamStandingsOverview(
      teamId,
      season
    );

    res.json(data);
  } catch (err) {
    console.error('Standings overview error:', err.message);
    res.status(500).json({ message: 'Failed to load standings overview' });
  }
};

exports.getActiveSeason = async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const season = await teamService.getActiveSeasonForTeam(teamId);
    res.json({ season });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get active season' });
  }
};

exports.getTransfers = async (req, res) => {
  try {
    const teamId = parseInt(req.params.teamId);
    const data = await teamService.getTeamTransfers(teamId);
    res.json(data);
  } catch (err) {
    console.error('Transfers error:', err.message);
    res.status(500).json({ message: 'Failed to load transfers' });
  }
};

exports.getTeams = async (req, res, next) => {
  try {
    const data = await teamService.getTeams();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getTeamsByLeague = async (req, res) => {
  try {
    const { league, season } = req.query;

    if (!league || !season) {
      return res.status(400).json({ message: 'Missing league or season' });
    }

    const response = await require('../services/team.service')
      .getTeamsByLeagueAndSeason(league, season);

    res.json(response);
  } catch (err) {
    console.error('Teams by league error:', err.message);
    res.status(500).json({ message: 'Failed to load teams' });
  }
};

exports.searchTeams = async (req, res) => {
  try {
    const { search } = req.query;

    if (!search) {
      return res.status(400).json({ message: 'Missing search query' });
    }

    const response = await require('../services/team.service')
      .searchTeamsByName(search);

    res.json(response);
  } catch (err) {
    console.error('Search teams error:', err.message);
    res.status(500).json({ message: 'Failed to search teams' });
  }
};
