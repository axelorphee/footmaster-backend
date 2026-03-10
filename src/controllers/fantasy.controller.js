const fantasyService = require('../services/fantasy.service');

exports.createLeague = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { name, description, type, tenantId } = req.body;

    const league = await fantasyService.createLeague({
      userId,
      name,
      description,
      type,
      tenantId,
    });

    res.status(201).json({
      success: true,
      data: league,
      message: 'League created successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.joinLeague = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params;

    const result = await fantasyService.joinLeague({
      leagueId,
      userId,
    });

    const status = result.membership.status;

    res.status(201).json({
      success: true,
      data: result,
      message:
        status === 'active'
          ? 'Joined league successfully'
          : 'Join request sent successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyLeagues = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const leagues = await fantasyService.getMyLeagues(userId);

    res.json({
      success: true,
      data: leagues,
    });
  } catch (err) {
    next(err);
  }
};

exports.getPublicLeagues = async (req, res, next) => {
  try {
    const leagues = await fantasyService.getPublicLeagues();

    res.json({
      success: true,
      data: leagues,
    });
  } catch (err) {
    next(err);
  }
};

exports.getLeagueById = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params;

    const result = await fantasyService.getLeagueById(leagueId, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};