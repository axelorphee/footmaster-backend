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
    const { inviteCode } = req.body || {};

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

exports.joinLeagueByCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { inviteCode } = req.body;

    const result = await fantasyService.joinLeagueByCode({
      userId,
      inviteCode,
    });

    res.json({
      success: true,
      data: result,
      message: 'League joined successfully by invite code',
    });
  } catch (err) {
    next(err);
  }
};

exports.leaveLeague = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params;

    const result = await fantasyService.leaveLeague({
      leagueId,
      userId,
    });

    res.json({
      success: true,
      data: result,
      message: 'League left successfully',
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

exports.removeLeagueMember = async (req, res, next) => {
  try {
    const actorUserId = req.user.id;
    const { leagueId, userId } = req.params;

    const result = await fantasyService.removeLeagueMember({
      leagueId,
      actorUserId,
      targetUserId: userId,
    });

    res.json({
      success: true,
      data: result,
      message: 'League member removed successfully',
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

exports.getTenantById = async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const tenant = await fantasyService.getTenantById(tenantId);

    res.json({
      success: true,
      data: tenant,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTenantRules = async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const rules = await fantasyService.getTenantRules(tenantId);

    res.json({
      success: true,
      data: rules,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTenantGameweeks = async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const gameweeks = await fantasyService.getTenantGameweeks(tenantId);

    res.json({
      success: true,
      data: gameweeks,
    });
  } catch (err) {
    next(err);
  }
};

exports.getTenantPlayers = async (req, res, next) => {
  try {
    const { tenantId } = req.params;
    const { position, status, teamId, search } = req.query;

    const players = await fantasyService.getTenantPlayers(tenantId, {
      position,
      status,
      teamId: teamId ? Number(teamId) : undefined,
      search,
    });

    res.json({
      success: true,
      data: players,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMySquadByGw = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tenantId, gw } = req.params;

    const squad = await fantasyService.getMySquadByGw({
      userId,
      tenantId,
      gw: Number(gw),
    });

    res.json({
      success: true,
      data: squad,
    });
  } catch (err) {
    next(err);
  }
};

exports.saveMySquadByGw = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tenantId, gw } = req.params;
    const { formation, picks } = req.body || {};

    const result = await fantasyService.saveMySquadByGw({
      userId,
      tenantId,
      gw: Number(gw),
      formation,
      picks,
    });

    res.json({
      success: true,
      data: result,
      message: 'Squad saved successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.upsertFantasyPlayerGwPoints = async (req, res, next) => {
  try {
    const { tenantId, gw } = req.params;
    const { statsByPlayerId } = req.body || {};

    const result = await fantasyService.upsertFantasyPlayerGwPointsFromStats({
      tenantId,
      gw: Number(gw),
      statsByPlayerId,
    });

    res.json({
      success: true,
      data: result,
      message: 'Fantasy player GW points upserted successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.calculateMySquadGwPoints = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tenantId, gw } = req.params;

    const result = await fantasyService.calculateMySquadGwPoints({
      userId,
      tenantId,
      gw: Number(gw),
    });

    res.json({
      success: true,
      data: result,
      message: 'Fantasy squad GW points calculated successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.syncMyTotalPointsForTenantLeagues = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tenantId } = req.params;

    const result = await fantasyService.syncUserTotalPointsForTenantLeagues({
      userId,
      tenantId,
    });

    res.json({
      success: true,
      data: result,
      message: 'League total points synced successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.getLeagueStandings = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { leagueId } = req.params;

    const result = await fantasyService.getLeagueStandings({
      leagueId,
      userId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.fetchAndUpsertFantasyPlayerGwPoints = async (req, res, next) => {
  try {
    const { tenantId, gw } = req.params;

    const result = await fantasyService.fetchAndUpsertFantasyPlayerGwPoints({
      tenantId,
      gw: Number(gw),
    });

    res.json({
      success: true,
      data: result,
      message: 'Fantasy player GW points fetched and upserted successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.runMyGwPointsPipeline = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { tenantId, gw } = req.params;

    const result = await fantasyService.runMyGwPointsPipeline({
      userId,
      tenantId,
      gw: Number(gw),
    });

    res.json({
      success: true,
      data: result,
      message: 'Fantasy GW points pipeline completed successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.getMyFantasyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const result = await fantasyService.getMyFantasyNotifications(userId);

    res.json({
      success: true,
      data: result,
      message: 'Fantasy notifications fetched successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.markFantasyNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const result = await fantasyService.markFantasyNotificationRead({
      notificationId,
      userId,
    });

    res.json({
      success: true,
      data: result,
      message: 'Fantasy notification marked as read',
    });
  } catch (err) {
    next(err);
  }
};
