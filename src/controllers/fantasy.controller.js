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
    const { inviteCode } = req.body;

    const result = await fantasyService.joinLeague({
      leagueId,
      userId,
      inviteCode,
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

exports.getLeagueRequests = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params;

    const requests = await fantasyService.getLeagueRequests({
      leagueId,
      userId,
    });

    res.json({
      success: true,
      data: requests,
    });
  } catch (err) {
    next(err);
  }
};

exports.approveLeagueRequest = async (req, res, next) => {
  try {
    const adminUserId = req.user.id;
    const { leagueId, userId } = req.params;

    const result = await fantasyService.approveLeagueRequest({
      leagueId,
      adminUserId,
      targetUserId: userId,
    });

    res.json({
      success: true,
      data: result,
      message: 'Join request approved successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.rejectLeagueRequest = async (req, res, next) => {
  try {
    const adminUserId = req.user.id;
    const { leagueId, userId } = req.params;

    await fantasyService.rejectLeagueRequest({
      leagueId,
      adminUserId,
      targetUserId: userId,
    });

    res.json({
      success: true,
      message: 'Join request rejected successfully',
    });
  } catch (err) {
    next(err);
  }
};