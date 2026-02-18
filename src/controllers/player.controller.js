const playerService = require('../services/player.service');

exports.getPlayerInfo = async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const data = await playerService.getPlayerInfo(playerId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getPlayerSeasons = async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const data = await playerService.getPlayerSeasons(playerId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getPlayerStats = async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { season } = req.query;

    const data = await playerService.getPlayerStats(playerId, season);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getPlayerMatches = async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const { season } = req.query;

    const data = await playerService.getPlayerMatches(playerId, season);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
