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

exports.getPlayerTrophies = async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const data = await playerService.getPlayerTrophies(playerId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getPlayerTransfers = async (req, res, next) => {
  try {
    const playerId = parseInt(req.params.playerId);
    const data = await playerService.getPlayerTransfers(playerId);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.getPlayers = async (req, res, next) => {
  try {
    const { page, season } = req.query;
    const data = await playerService.getPlayers(page || 1, season || 2026);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

exports.searchPlayers = async (req, res, next) => {
  try {
    const { q, page } = req.query;
    if (!q) {
      return res.status(400).json({ error: 'Missing query' });
    }

    const data = await playerService.searchPlayers(q, page || 1);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

