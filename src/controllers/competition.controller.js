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

exports.getLeagueDetails = async (req, res, next) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const data = await competitionService.getLeagueDetails(leagueId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getLeagueFixtures = async (req, res, next) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const { season } = req.query;
    const data = await competitionService.getLeagueFixtures(leagueId, season);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getLeagueStandings = async (req, res, next) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const { season } = req.query;

    const data = await competitionService.getLeagueStandings(
      leagueId,
      season
    );

    res.json(data);
  } catch (err) {
    next(err);
  }
};


exports.getTeamsByLeagueAndSeason = async (req, res, next) => {
  try {
    const { league, season } = req.query;

    const data =
      await competitionService.getTeamsByLeagueAndSeason(
        league,
        season
      );

    res.json(data);
  } catch (err) {
    next(err);
  }
};


exports.getLeagueStatistics = async (req, res, next) => {
  try {
    const leagueId = parseInt(req.params.leagueId);
    const { season } = req.query;

    const data = await competitionService.getLeagueStatistics(
      leagueId,
      season
    );

    res.json(data);
  } catch (err) {
    next(err);
  }
};

