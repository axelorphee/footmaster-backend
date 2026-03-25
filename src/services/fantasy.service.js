const pool = require('../config/database');

const competitionService = require('./competition.service');
const teamService = require('./team.service');
const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

function generateInviteCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';

  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

async function generateUniqueInviteCode() {
  let code;
  let exists = true;

  while (exists) {
    code = generateInviteCode(6);

    const result = await pool.query(
      'SELECT id FROM fantasy_leagues WHERE invite_code = $1 LIMIT 1',
      [code]
    );

    exists = result.rows.length > 0;
  }

  return code;
}

exports.createLeague = async ({ userId, name, description, type, tenantId }) => {
  const cleanName = name?.trim();
  const cleanDescription = description?.trim() || '';
  const cleanType = type === 'private' ? 'private' : 'public';
  const cleanTenantId = tenantId?.trim();

  if (!cleanName) {
    const error = new Error('League name is required');
    error.statusCode = 400;
    throw error;
  }

  if (!cleanTenantId) {
    const error = new Error('tenantId is required');
    error.statusCode = 400;
    throw error;
  }

  const tenantCheck = await pool.query(
    `
    SELECT tenant_id
    FROM fantasy_tenants
    WHERE tenant_id = $1
    `,
    [cleanTenantId]
  );

  if (tenantCheck.rows.length === 0) {
    const error = new Error('Invalid tenantId: tenant not found');
    error.statusCode = 400;
    throw error;
  }

  const inviteCode = cleanType === 'private'
    ? await generateUniqueInviteCode()
    : null;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const leagueResult = await client.query(
      `
      INSERT INTO fantasy_leagues (name, description, tenant_id, type, invite_code, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, description, tenant_id, type, invite_code, created_by, created_at
      `,
      [cleanName, cleanDescription, cleanTenantId, cleanType, inviteCode, userId]
    );

    const league = leagueResult.rows[0];

    await client.query(
      `
      INSERT INTO fantasy_league_members (league_id, user_id, role, status, joined_at, total_points)
      VALUES ($1, $2, 'admin', 'active', CURRENT_TIMESTAMP, 0)
      `,
      [league.id, userId]
    );

    await client.query('COMMIT');

    return league;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.joinLeague = async ({ leagueId, userId, inviteCode }) => {
  const leagueResult = await pool.query(
    `
    SELECT id, name, description, tenant_id, type, invite_code, created_by, created_at
    FROM fantasy_leagues
    WHERE id = $1
    `,
    [leagueId]
  );

  if (leagueResult.rows.length === 0) {
    const error = new Error('League not found');
    error.statusCode = 404;
    throw error;
  }

  const league = leagueResult.rows[0];

  const existingMemberResult = await pool.query(
    `
    SELECT id, role, status
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, userId]
  );

  if (existingMemberResult.rows.length > 0) {
    const existing = existingMemberResult.rows[0];

    if (existing.status === 'active') {
      const error = new Error('You are already a member of this league');
      error.statusCode = 400;
      throw error;
    }

    if (existing.status === 'pending') {
      const error = new Error('You already have a pending request for this league');
      error.statusCode = 400;
      throw error;
    }
  }

  let status = 'pending';
  let joinedAt = null;
  const role = 'member';

  if (league.type === 'public') {
    status = 'active';
    joinedAt = new Date();
  } else {
    const cleanInviteCode = inviteCode?.trim();

    if (!cleanInviteCode || cleanInviteCode !== league.invite_code) {
      const error = new Error('Invalid invite code');
      error.statusCode = 400;
      throw error;
    }

    status = 'pending';
    joinedAt = null;
  }

  const result = await pool.query(
    `
    INSERT INTO fantasy_league_members (league_id, user_id, role, status, joined_at, total_points)
    VALUES ($1, $2, $3, $4, $5, 0)
    RETURNING id, league_id, user_id, role, status, joined_at, total_points, created_at
    `,
    [leagueId, userId, role, status, joinedAt]
  );

  if (league.type === 'private' && status === 'pending') {
    const requesterResult = await pool.query(
      `
      SELECT username
      FROM users
      WHERE id = $1
      `,
      [userId]
    );

    const requesterUsername =
      requesterResult.rows[0]?.username || 'Un utilisateur';

    await createFantasyNotification({
      userId: league.created_by,
      leagueId: league.id,
      type: 'join_request',
      title: 'Nouvelle demande à rejoindre',
      message: `${requesterUsername} a demandé à rejoindre la ligue ${league.name}.`,
    });
  }

  return {
    league,
    membership: result.rows[0],
  };
};


exports.joinLeagueByCode = async ({ userId, inviteCode }) => {
  const cleanInviteCode = inviteCode?.trim();

  if (!cleanInviteCode) {
    const error = new Error('inviteCode is required');
    error.statusCode = 400;
    throw error;
  }

  const leagueResult = await pool.query(
    `
    SELECT id, name, description, tenant_id, type, invite_code, created_by, created_at
    FROM fantasy_leagues
    WHERE invite_code = $1
    LIMIT 1
    `,
    [cleanInviteCode]
  );

  if (leagueResult.rows.length === 0) {
    const error = new Error('Invalid invite code');
    error.statusCode = 404;
    throw error;
  }

  const league = leagueResult.rows[0];

  return await exports.joinLeague({
    leagueId: league.id,
    userId,
    inviteCode: cleanInviteCode,
  });
};

exports.leaveLeague = async ({ leagueId, userId }) => {
  const memberResult = await pool.query(
    `
    SELECT id, role, status
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, userId]
  );

  if (memberResult.rows.length === 0) {
    const error = new Error('You are not a member of this league');
    error.statusCode = 404;
    throw error;
  }

  const member = memberResult.rows[0];

  if (member.role === 'admin') {
    const error = new Error('League admin cannot leave the league');
    error.statusCode = 400;
    throw error;
  }

  const leagueResult = await pool.query(
    `
    SELECT id, name
    FROM fantasy_leagues
    WHERE id = $1
    `,
    [leagueId]
  );

  if (leagueResult.rows.length === 0) {
    const error = new Error('League not found');
    error.statusCode = 404;
    throw error;
  }

  const league = leagueResult.rows[0];

  const userResult = await pool.query(
    `
    SELECT username
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  const username = userResult.rows[0]?.username || 'Un utilisateur';

  const membersToNotifyResult = await pool.query(
    `
    SELECT user_id
    FROM fantasy_league_members
    WHERE league_id = $1
      AND status = 'active'
      AND user_id <> $2
    `,
    [leagueId, userId]
  );

  await pool.query(
    `
    DELETE FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, userId]
  );

  if (member.status === 'active') {
    for (const row of membersToNotifyResult.rows) {
      await createFantasyNotification({
        userId: row.user_id,
        leagueId: leagueId,
        type: 'member_left',
        title: 'Un membre a quitté la ligue',
        message: `${username} a quitté la ligue ${league.name}.`,
      });
    }
  }

  return {
    leagueId,
    userId,
    previousStatus: member.status,
    removed: true,
  };
};


exports.getMyLeagues = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      fl.id,
      fl.name,
      fl.description,
      fl.tenant_id,
      fl.type,
      fl.invite_code,
      fl.created_by,
      fl.created_at,
      flm.role AS membership_role,
      flm.status AS membership_status,
      flm.joined_at,
      flm.total_points
    FROM fantasy_league_members flm
    INNER JOIN fantasy_leagues fl ON fl.id = flm.league_id
    WHERE flm.user_id = $1
    ORDER BY fl.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.getPublicLeagues = async () => {
  const result = await pool.query(
    `
    SELECT
      fl.id,
      fl.name,
      fl.description,
      fl.tenant_id,
      fl.type,
      fl.created_by,
      fl.created_at,
      COUNT(flm.id) FILTER (WHERE flm.status = 'active') AS members_count
    FROM fantasy_leagues fl
    LEFT JOIN fantasy_league_members flm ON flm.league_id = fl.id
    WHERE fl.type = 'public'
    GROUP BY fl.id
    ORDER BY fl.created_at DESC
    `
  );

  return result.rows;
};

exports.getLeagueById = async (leagueId, userId) => {
  const leagueResult = await pool.query(
    `
    SELECT
      fl.id,
      fl.name,
      fl.description,
      fl.tenant_id,
      fl.type,
      fl.invite_code,
      fl.created_by,
      fl.created_at,
      COUNT(flm.id) FILTER (WHERE flm.status = 'active') AS members_count
    FROM fantasy_leagues fl
    LEFT JOIN fantasy_league_members flm ON flm.league_id = fl.id
    WHERE fl.id = $1
    GROUP BY fl.id
    `,
    [leagueId]
  );

  if (leagueResult.rows.length === 0) {
    const error = new Error('League not found');
    error.statusCode = 404;
    throw error;
  }

  const league = leagueResult.rows[0];

  const membershipResult = await pool.query(
    `
    SELECT id, role, status, joined_at, total_points
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, userId]
  );

  return {
    league,
    membership: membershipResult.rows[0] || null,
  };
};

exports.getLeagueRequests = async ({ leagueId, userId }) => {
  const adminCheck = await pool.query(
    `
    SELECT id
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'
    `,
    [leagueId, userId]
  );

  if (adminCheck.rows.length === 0) {
    const error = new Error('Not authorized to view league requests');
    error.statusCode = 403;
    throw error;
  }

  const result = await pool.query(
    `
    SELECT
      flm.id,
      flm.user_id,
      flm.role,
      flm.status,
      flm.joined_at,
      flm.total_points,
      flm.created_at,
      u.username,
      u.email
    FROM fantasy_league_members flm
    INNER JOIN users u ON u.id = flm.user_id
    WHERE flm.league_id = $1 AND flm.status = 'pending'
    ORDER BY flm.created_at ASC
    `,
    [leagueId]
  );

  return result.rows;
};

exports.removeLeagueMember = async ({ leagueId, actorUserId, targetUserId }) => {
  const actorResult = await pool.query(
    `
    SELECT id, role, status
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, actorUserId]
  );

  if (actorResult.rows.length === 0) {
    const error = new Error('You are not a member of this league');
    error.statusCode = 403;
    throw error;
  }

  const actor = actorResult.rows[0];

  const targetResult = await pool.query(
    `
    SELECT id, role, status
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, targetUserId]
  );

  if (targetResult.rows.length === 0) {
    const error = new Error('Target member not found');
    error.statusCode = 404;
    throw error;
  }

  const target = targetResult.rows[0];

  const leagueResult = await pool.query(
    `
    SELECT id, name
    FROM fantasy_leagues
    WHERE id = $1
    `,
    [leagueId]
  );

  if (leagueResult.rows.length === 0) {
    const error = new Error('League not found');
    error.statusCode = 404;
    throw error;
  }

  const league = leagueResult.rows[0];

  const targetUserResult = await pool.query(
    `
    SELECT username
    FROM users
    WHERE id = $1
    `,
    [targetUserId]
  );

  const targetUsername = targetUserResult.rows[0]?.username || 'Un utilisateur';

  const isSelf = actorUserId === targetUserId;
  const isTargetAdmin = target.role === 'admin';

  if (isSelf) {
    const error = new Error('Use leaveLeague for self leave/cancel');
    error.statusCode = 400;
    throw error;
  }

  if (actor.role !== 'admin' || actor.status !== 'active') {
    const error = new Error('Only league admin can remove another member');
    error.statusCode = 403;
    throw error;
  }

  if (isTargetAdmin) {
    const error = new Error('Admin cannot remove another admin');
    error.statusCode = 400;
    throw error;
  }

  const otherMembersToNotifyResult = await pool.query(
    `
    SELECT user_id
    FROM fantasy_league_members
    WHERE league_id = $1
      AND status = 'active'
      AND user_id <> $2
      AND user_id <> $3
    `,
    [leagueId, actorUserId, targetUserId]
  );

  await pool.query(
    `
    DELETE FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, targetUserId]
  );

  await createFantasyNotification({
    userId: targetUserId,
    leagueId: leagueId,
    type: 'removed_from_league',
    title: 'Retiré d’une ligue',
    message: `Tu as été retiré de la ligue ${league.name} par un administrateur.`,
  });

  if (target.status === 'active') {
    for (const row of otherMembersToNotifyResult.rows) {
      await createFantasyNotification({
        userId: row.user_id,
        leagueId: leagueId,
        type: 'member_removed',
        title: 'Un membre a été retiré',
        message: `${targetUsername} a été retiré de la ligue ${league.name} par un administrateur.`,
      });
    }
  }

  return {
    leagueId,
    actorUserId,
    targetUserId,
    removed: true,
    previousStatus: target.status,
    mode: 'admin_remove_member',
  };
};



exports.approveLeagueRequest = async ({ leagueId, adminUserId, targetUserId }) => {
  const adminCheck = await pool.query(
    `
    SELECT id
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'
    `,
    [leagueId, adminUserId]
  );

  if (adminCheck.rows.length === 0) {
    const error = new Error('Not authorized to approve requests');
    error.statusCode = 403;
    throw error;
  }

  const requestCheck = await pool.query(
    `
    SELECT id, status
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, targetUserId]
  );

  if (requestCheck.rows.length === 0) {
    const error = new Error('Join request not found');
    error.statusCode = 404;
    throw error;
  }

  const requestRow = requestCheck.rows[0];

  if (requestRow.status !== 'pending') {
    const error = new Error('This request is no longer pending');
    error.statusCode = 400;
    throw error;
  }

  const leagueResult = await pool.query(
    `
    SELECT id, name
    FROM fantasy_leagues
    WHERE id = $1
    `,
    [leagueId]
  );

  const league = leagueResult.rows[0];

  const result = await pool.query(
    `
    UPDATE fantasy_league_members
    SET status = 'active',
        joined_at = CURRENT_TIMESTAMP
    WHERE league_id = $1 AND user_id = $2
    RETURNING id, league_id, user_id, role, status, joined_at, total_points, created_at
    `,
    [leagueId, targetUserId]
  );

  await createFantasyNotification({
    userId: targetUserId,
    leagueId: leagueId,
    type: 'join_request_approved',
    title: 'Demande acceptée',
    message: `Ta demande pour rejoindre la ligue ${league.name} a été acceptée.`,
  });

  return result.rows[0];
};


exports.rejectLeagueRequest = async ({ leagueId, adminUserId, targetUserId }) => {
  const adminCheck = await pool.query(
    `
    SELECT id
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2 AND role = 'admin' AND status = 'active'
    `,
    [leagueId, adminUserId]
  );

  if (adminCheck.rows.length === 0) {
    const error = new Error('Not authorized to reject requests');
    error.statusCode = 403;
    throw error;
  }

  const requestCheck = await pool.query(
    `
    SELECT id, status
    FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, targetUserId]
  );

  if (requestCheck.rows.length === 0) {
    const error = new Error('Join request not found');
    error.statusCode = 404;
    throw error;
  }

  const requestRow = requestCheck.rows[0];

  if (requestRow.status !== 'pending') {
    const error = new Error('This request is no longer pending');
    error.statusCode = 400;
    throw error;
  }

  const leagueResult = await pool.query(
    `
    SELECT id, name
    FROM fantasy_leagues
    WHERE id = $1
    `,
    [leagueId]
  );

  const league = leagueResult.rows[0];

  await pool.query(
    `
    DELETE FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, targetUserId]
  );

  await createFantasyNotification({
    userId: targetUserId,
    leagueId: leagueId,
    type: 'join_request_rejected',
    title: 'Demande refusée',
    message: `Ta demande pour rejoindre la ligue ${league.name} a été refusée.`,
  });

  return { success: true };
};


exports.getTenantById = async (tenantId) => {
  const result = await pool.query(
    `
    SELECT
      tenant_id,
      league_id,
      season,
      name,
      logo,
      country,
      seeded,
      created_at,
      updated_at
    FROM fantasy_tenants
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Tenant not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

exports.getTenantRules = async (tenantId) => {
  const result = await pool.query(
    `
    SELECT
      tenant_id,
      budget_cap,
      max_players_per_club,
      allowed_formations,
      created_at,
      updated_at
    FROM fantasy_rules
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Fantasy rules not found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

exports.getTenantGameweeks = async (tenantId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      gw,
      fixture_ids,
      status,
      start_utc,
      end_utc,
      deadline_utc,
      created_at,
      updated_at
    FROM fantasy_gameweeks
    WHERE tenant_id = $1
    ORDER BY gw ASC
    `,
    [tenantId]
  );

  return result.rows;
};

exports.getTenantPlayers = async (tenantId, filters = {}) => {
  const values = [tenantId];
  const conditions = ['tenant_id = $1'];
  let index = 2;

  if (filters.position) {
    conditions.push(`position = $${index}`);
    values.push(filters.position);
    index++;
  }

  if (filters.status) {
    conditions.push(`status = $${index}`);
    values.push(filters.status);
    index++;
  } else {
    conditions.push(`status = $${index}`);
    values.push('A');
    index++;
  }

  if (filters.teamId) {
    conditions.push(`team_id = $${index}`);
    values.push(filters.teamId);
    index++;
  }

  if (filters.search) {
    conditions.push(`LOWER(name) LIKE $${index}`);
    values.push(`%${filters.search.toLowerCase()}%`);
    index++;
  }

  const result = await pool.query(
    `
    SELECT
      id,
      tenant_id,
      player_id,
      team_id,
      team_name,
      name,
      position,
      price,
      status,
      photo_url,
      created_at,
      updated_at
    FROM fantasy_players
    WHERE ${conditions.join(' AND ')}
    ORDER BY price ASC, name ASC
    `,
    values
  );

  return result.rows;
};

exports.getMySquadByGw = async ({ userId, tenantId, gw }) => {
  const squadResult = await pool.query(
    `
    SELECT
      id,
      user_id,
      tenant_id,
      gw,
      formation,
      budget_cap,
      max_players_per_club,
      created_at,
      updated_at
    FROM fantasy_user_squads
    WHERE user_id = $1 AND tenant_id = $2 AND gw = $3
    `,
    [userId, tenantId, gw]
  );

  if (squadResult.rows.length === 0) {
    return null;
  }

  const squad = squadResult.rows[0];

  const picksResult = await pool.query(
    `
    SELECT
      id,
      squad_id,
      slot,
      player_id,
      is_captain,
      is_vice,
      is_bench,
      position_snapshot,
      team_id_snapshot,
      price_snapshot,
      created_at,
      updated_at
    FROM fantasy_user_squad_picks
    WHERE squad_id = $1
    ORDER BY slot ASC
    `,
    [squad.id]
  );

  return {
    ...squad,
    picks: picksResult.rows,
  };
};

exports.saveMySquadByGw = async ({ userId, tenantId, gw, formation, picks }) => {
  if (!tenantId || !gw || !formation || !Array.isArray(picks)) {
    const error = new Error('tenantId, gw, formation and picks are required');
    error.statusCode = 400;
    throw error;
  }

  if (picks.length !== 15) {
    const error = new Error('A squad must contain exactly 15 picks');
    error.statusCode = 400;
    throw error;
  }

  const tenantResult = await pool.query(
    `
    SELECT tenant_id
    FROM fantasy_tenants
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  if (tenantResult.rows.length === 0) {
    const error = new Error('Tenant not found');
    error.statusCode = 404;
    throw error;
  }

  const rulesResult = await pool.query(
    `
    SELECT budget_cap, max_players_per_club, allowed_formations
    FROM fantasy_rules
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  if (rulesResult.rows.length === 0) {
    const error = new Error('Fantasy rules not found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  const rules = rulesResult.rows[0];
  const budgetCap = Number(rules.budget_cap);
  const maxPlayersPerClub = Number(rules.max_players_per_club);
  const allowedFormations = Array.isArray(rules.allowed_formations)
    ? rules.allowed_formations
    : [];

  if (!allowedFormations.includes(formation)) {
    const error = new Error('Formation not allowed');
    error.statusCode = 400;
    throw error;
  }

  const gameweekResult = await pool.query(
    `
    SELECT gw, deadline_utc
    FROM fantasy_gameweeks
    WHERE tenant_id = $1 AND gw = $2
    `,
    [tenantId, gw]
  );

  if (gameweekResult.rows.length === 0) {
    const error = new Error('Gameweek not found');
    error.statusCode = 404;
    throw error;
  }

  const gameweek = gameweekResult.rows[0];
  if (gameweek.deadline_utc) {
    const now = new Date();
    const deadline = new Date(gameweek.deadline_utc);
    if (now > deadline) {
      const error = new Error('Deadline exceeded for this gameweek');
      error.statusCode = 403;
      throw error;
    }
  }

  const seenSlots = new Set();
  const seenPlayers = new Set();

  let startersCount = 0;
  let benchCount = 0;
  let captainCount = 0;
  let viceCount = 0;

  for (const pick of picks) {
    const slot = Number(pick.slot);
    const playerId = pick.playerId != null ? Number(pick.playerId) : null;
    const isCaptain = Boolean(pick.isCaptain);
    const isVice = Boolean(pick.isVice);
    const isBench = Boolean(pick.isBench);

    if (!slot || slot < 1 || slot > 15) {
      const error = new Error('Each pick must have a valid slot between 1 and 15');
      error.statusCode = 400;
      throw error;
    }

    if (seenSlots.has(slot)) {
      const error = new Error('Duplicate slot detected');
      error.statusCode = 400;
      throw error;
    }
    seenSlots.add(slot);

    if (playerId == null) {
      const error = new Error('Each pick must have a playerId');
      error.statusCode = 400;
      throw error;
    }

    if (seenPlayers.has(playerId)) {
      const error = new Error('Duplicate player detected in squad');
      error.statusCode = 400;
      throw error;
    }
    seenPlayers.add(playerId);

    if (isBench) {
      benchCount++;
    } else {
      startersCount++;
      if (isCaptain) captainCount++;
      if (isVice) viceCount++;
    }

    if (isCaptain && isVice) {
      const error = new Error('A player cannot be captain and vice-captain at the same time');
      error.statusCode = 400;
      throw error;
    }
  }

  if (startersCount !== 11 || benchCount !== 4) {
    const error = new Error('Squad must contain 11 starters and 4 bench players');
    error.statusCode = 400;
    throw error;
  }

  if (captainCount !== 1) {
    const error = new Error('Squad must contain exactly one captain among starters');
    error.statusCode = 400;
    throw error;
  }

  if (viceCount !== 1) {
    const error = new Error('Squad must contain exactly one vice-captain among starters');
    error.statusCode = 400;
    throw error;
  }

  const playerIds = Array.from(seenPlayers);

  const playersResult = await pool.query(
    `
    SELECT player_id, position, team_id, price, status
    FROM fantasy_players
    WHERE tenant_id = $1 AND player_id = ANY($2::int[])
    `,
    [tenantId, playerIds]
  );

  if (playersResult.rows.length !== 15) {
    const error = new Error('Some selected players were not found in fantasy players');
    error.statusCode = 400;
    throw error;
  }

  const playersMap = new Map();
  for (const row of playersResult.rows) {
    playersMap.set(Number(row.player_id), row);
  }

  let totalPrice = 0;
  const clubCounts = new Map();
  let gk = 0, def = 0, mid = 0, fwd = 0;

  for (const pick of picks) {
    const playerId = Number(pick.playerId);
    const isBench = Boolean(pick.isBench);
    const player = playersMap.get(playerId);

    if (!player) {
      const error = new Error(`Player ${playerId} not found`);
      error.statusCode = 400;
      throw error;
    }

    if (player.status !== 'A') {
      const error = new Error(`Player ${playerId} is not active`);
      error.statusCode = 400;
      throw error;
    }

    totalPrice += Number(player.price);

    if (!isBench) {
      const teamId = player.team_id != null ? Number(player.team_id) : null;
      if (teamId != null) {
        clubCounts.set(teamId, (clubCounts.get(teamId) || 0) + 1);
        if (clubCounts.get(teamId) > maxPlayersPerClub) {
          const error = new Error('Too many starting players from the same club');
          error.statusCode = 400;
          throw error;
        }
      }

      if (player.position === 'GK') gk++;
      if (player.position === 'DEF') def++;
      if (player.position === 'MID') mid++;
      if (player.position === 'FWD') fwd++;
    }
  }

  if (totalPrice > budgetCap) {
    const error = new Error('Budget exceeded');
    error.statusCode = 400;
    throw error;
  }

  const formationKey = `${def}-${mid}-${fwd}`;
  if (gk !== 1 || formationKey !== formation) {
    const error = new Error('Starting eleven does not match the selected formation');
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const existingSquadResult = await client.query(
      `
      SELECT id
      FROM fantasy_user_squads
      WHERE user_id = $1 AND tenant_id = $2 AND gw = $3
      `,
      [userId, tenantId, gw]
    );

    let squadId;

    if (existingSquadResult.rows.length === 0) {
      const insertSquadResult = await client.query(
        `
        INSERT INTO fantasy_user_squads (
          user_id, tenant_id, gw, formation, budget_cap, max_players_per_club, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        RETURNING id
        `,
        [userId, tenantId, gw, formation, budgetCap, maxPlayersPerClub]
      );

      squadId = insertSquadResult.rows[0].id;
    } else {
      squadId = existingSquadResult.rows[0].id;

      await client.query(
        `
        UPDATE fantasy_user_squads
        SET formation = $1,
            budget_cap = $2,
            max_players_per_club = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        `,
        [formation, budgetCap, maxPlayersPerClub, squadId]
      );

      await client.query(
        `
        DELETE FROM fantasy_user_squad_picks
        WHERE squad_id = $1
        `,
        [squadId]
      );
    }

    for (const pick of picks) {
      const playerId = Number(pick.playerId);
      const player = playersMap.get(playerId);

      await client.query(
        `
        INSERT INTO fantasy_user_squad_picks (
          squad_id, slot, player_id, is_captain, is_vice, is_bench,
          position_snapshot, team_id_snapshot, price_snapshot, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        `,
        [
          squadId,
          Number(pick.slot),
          playerId,
          Boolean(pick.isCaptain),
          Boolean(pick.isVice),
          Boolean(pick.isBench),
          player.position,
          player.team_id != null ? Number(player.team_id) : null,
          Number(player.price),
        ]
      );
    }

    await client.query('COMMIT');

    return {
      squadId,
      tenantId,
      gw,
      formation,
      budgetCap,
      maxPlayersPerClub,
      totalPrice,
      picksCount: picks.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

function fantasyInt(value, def = 0) {
  if (typeof value === 'number') return Math.trunc(value);
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Math.trunc(Number(value));
  }
  return def;
}

function fantasyBoolOrNumGt0(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === 'true' || v === '1';
  }
  return false;
}

function calculatePlayerFantasyPoints({ pos, stat, rules }) {
  let pts = 0.0;

  const minutes = fantasyInt(stat.minutes);
  const played = minutes > 0;
  const played60 = minutes >= 60;

  const goals = fantasyInt(stat.goals);
  const assists = fantasyInt(stat.assists);
  const conceded = fantasyInt(stat.goals_conceded);
  const isCs = fantasyBoolOrNumGt0(stat.clean_sheet);

  const ycCount = fantasyInt(stat.yellow);
  const rcCount = fantasyInt(stat.red);
  const ownGoals = fantasyInt(stat.own_goals);
  const pensMiss = fantasyInt(stat.penalties_missed);
  const pensSaved = fantasyInt(stat.penalties_saved);
  const saves = fantasyInt(stat.saves);

  const goalByPos = rules.goal || {};
  const csByPos = rules.cs || {};
  const gcRule = rules.goals_conceded || {};
  const savesRule = rules.saves || {};

  if (played) pts += Number(rules.appearance ?? 1);
  if (played60) pts += Number(rules.appearance90 ?? 2);

  pts += goals * Number(goalByPos[pos] ?? 0);
  pts += assists * Number(rules.assist ?? 3);

  if (played && (isCs || conceded === 0)) {
    pts += Number(csByPos[pos] ?? 0);
  }

  if (conceded > 0) {
    const per = fantasyInt(gcRule.per, 1);
    const malus = Number(gcRule[pos] ?? 0);
    if (per > 0 && malus !== 0) {
      pts += Math.trunc(conceded / per) * malus;
    }
  }

  pts += pensMiss * Number(rules.penalty_missed ?? -2);

  if (pos === 'GK') {
    pts += pensSaved * Number(rules.penalty_saved ?? 5);
    const every = fantasyInt(savesRule.every, 3);
    const inc = Number(savesRule[pos] ?? 1);
    if (every > 0 && inc !== 0) {
      pts += Math.trunc(saves / every) * inc;
    }
  }

  pts += ycCount * Number(rules.yellow ?? -1);
  pts += rcCount * Number(rules.red ?? -3);
  pts += ownGoals * Number(rules.own_goal ?? -2);

  return Number(pts.toFixed(2));
}

exports.getDefaultFantasyScoringRules = () => {
  return {
    captain_multiplier: 2,
    vice_if_captain_dnp: true,
    appearance: 1,
    appearance90: 2,
    assist: 3,
    yellow: -1,
    red: -3,
    own_goal: -2,
    penalty_missed: -2,
    penalty_saved: 5,
    goal: { GK: 6, DEF: 6, MID: 5, FWD: 4 },
    cs: { GK: 4, DEF: 4, MID: 1, FWD: 0 },
    goals_conceded: { per: 2, GK: -1, DEF: -1, MID: -0.5, FWD: -0.25 },
    saves: { every: 3, GK: 1 }
  };
};

exports.loadFantasyScoringRules = async (tenantId) => {
  const rulesResult = await pool.query(
    `
    SELECT tenant_id, budget_cap, max_players_per_club, allowed_formations
    FROM fantasy_rules
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  if (rulesResult.rows.length === 0) {
    const error = new Error('Fantasy rules not found for this tenant');
    error.statusCode = 404;
    throw error;
  }

  const dbRules = rulesResult.rows[0];
  const defaults = exports.getDefaultFantasyScoringRules();

  return {
    ...defaults,
    budget_cap: Number(dbRules.budget_cap),
    max_players_per_club: Number(dbRules.max_players_per_club),
    allowed_formations: Array.isArray(dbRules.allowed_formations) ? dbRules.allowed_formations : []
  };
};

exports.calculateMySquadGwPoints = async ({ userId, tenantId, gw }) => {
  const squadResult = await pool.query(
    `
    SELECT id, user_id, tenant_id, gw, formation
    FROM fantasy_user_squads
    WHERE user_id = $1 AND tenant_id = $2 AND gw = $3
    `,
    [userId, tenantId, gw]
  );

  if (squadResult.rows.length === 0) {
    const error = new Error('Squad not found for this gameweek');
    error.statusCode = 404;
    throw error;
  }

  const squad = squadResult.rows[0];

  const picksResult = await pool.query(
    `
    SELECT
      slot,
      player_id,
      is_captain,
      is_vice,
      is_bench,
      position_snapshot,
      team_id_snapshot,
      price_snapshot
    FROM fantasy_user_squad_picks
    WHERE squad_id = $1
    ORDER BY slot ASC
    `,
    [squad.id]
  );

  const picks = picksResult.rows;
  if (picks.length !== 15) {
    const error = new Error('Squad picks are incomplete');
    error.statusCode = 400;
    throw error;
  }

  const rules = await exports.loadFantasyScoringRules(tenantId);

  const playerIds = picks.map((p) => Number(p.player_id));

  const playerPointsResult = await pool.query(
    `
    SELECT player_id, points, breakdown
    FROM fantasy_player_gw_points
    WHERE tenant_id = $1 AND gw = $2 AND player_id = ANY($3::int[])
    `,
    [tenantId, gw, playerIds]
  );

  const pointsMap = new Map();
  for (const row of playerPointsResult.rows) {
    pointsMap.set(Number(row.player_id), {
      points: Number(row.points),
      breakdown: row.breakdown || {}
    });
  }

  let basePoints = 0;
  let captainBonus = 0;
  let viceBonus = 0;

  const perPlayer = [];
  const starters = picks.filter((p) => !p.is_bench);

  for (const pick of starters) {
    const pid = Number(pick.player_id);
    const playerPoints = pointsMap.get(pid);
    const pts = playerPoints ? Number(playerPoints.points) : 0;

    basePoints += pts;

    perPlayer.push({
      slot: Number(pick.slot),
      player_id: pid,
      is_captain: Boolean(pick.is_captain),
      is_vice: Boolean(pick.is_vice),
      is_bench: Boolean(pick.is_bench),
      points: pts,
      breakdown: playerPoints ? playerPoints.breakdown : {}
    });
  }

  const captainMultiplier = Number(rules.captain_multiplier ?? 2);
  const viceIfCaptainDnp = Boolean(rules.vice_if_captain_dnp ?? true);

  const captainPick = starters.find((p) => Boolean(p.is_captain));
  const vicePick = starters.find((p) => Boolean(p.is_vice));

  const captainPoints = captainPick
    ? Number(pointsMap.get(Number(captainPick.player_id))?.points ?? 0)
    : 0;

  if (captainPick && captainPoints > 0) {
    captainBonus = Number(((captainMultiplier - 1) * captainPoints).toFixed(2));
  } else if (viceIfCaptainDnp && vicePick) {
    const vicePoints = Number(pointsMap.get(Number(vicePick.player_id))?.points ?? 0);
    if (vicePoints > 0) {
      viceBonus = Number(((captainMultiplier - 1) * vicePoints).toFixed(2));
    }
  }

  const totalPoints = Number((basePoints + captainBonus + viceBonus).toFixed(2));

  const breakdown = {
    per_player: perPlayer,
    captain_multiplier: captainMultiplier,
    vice_if_captain_dnp: viceIfCaptainDnp
  };

  const upsertResult = await pool.query(
    `
    INSERT INTO fantasy_user_squad_gw_points (
      squad_id, tenant_id, user_id, gw, base_points, captain_bonus, vice_bonus, total_points, breakdown, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT (squad_id, gw)
    DO UPDATE SET
      base_points = EXCLUDED.base_points,
      captain_bonus = EXCLUDED.captain_bonus,
      vice_bonus = EXCLUDED.vice_bonus,
      total_points = EXCLUDED.total_points,
      breakdown = EXCLUDED.breakdown,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [
      squad.id,
      tenantId,
      userId,
      gw,
      basePoints,
      captainBonus,
      viceBonus,
      totalPoints,
      JSON.stringify(breakdown)
    ]
  );

  return upsertResult.rows[0];
};

exports.upsertFantasyPlayerGwPointsFromStats = async ({ tenantId, gw, statsByPlayerId }) => {
  if (!tenantId || !gw || !statsByPlayerId || typeof statsByPlayerId !== 'object') {
    const error = new Error('tenantId, gw and statsByPlayerId are required');
    error.statusCode = 400;
    throw error;
  }

  const rules = await exports.loadFantasyScoringRules(tenantId);

  const playerIds = Object.keys(statsByPlayerId)
    .map((id) => Number(id))
    .filter((id) => !Number.isNaN(id));

  if (playerIds.length === 0) {
    return {
      tenantId,
      gw,
      processed: 0,
    };
  }

  const playersResult = await pool.query(
    `
    SELECT player_id, position
    FROM fantasy_players
    WHERE tenant_id = $1 AND player_id = ANY($2::int[])
    `,
    [tenantId, playerIds]
  );

  const posMap = new Map();
  for (const row of playersResult.rows) {
    posMap.set(Number(row.player_id), row.position);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let processed = 0;

    for (const rawId of Object.keys(statsByPlayerId)) {
      const playerId = Number(rawId);
      if (Number.isNaN(playerId)) continue;

      const stat = statsByPlayerId[rawId] || {};
      const pos = posMap.get(playerId) || 'MID';

      const points = calculatePlayerFantasyPoints({
        pos,
        stat,
        rules,
      });

      const breakdown = {
        pos,
        stat,
      };

      await client.query(
        `
        INSERT INTO fantasy_player_gw_points (
          tenant_id, gw, player_id, points, breakdown, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, gw, player_id)
        DO UPDATE SET
          points = EXCLUDED.points,
          breakdown = EXCLUDED.breakdown,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          tenantId,
          gw,
          playerId,
          points,
          JSON.stringify(breakdown),
        ]
      );

      processed++;
    }

    await client.query('COMMIT');

    return {
      tenantId,
      gw,
      processed,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

exports.syncUserTotalPointsForTenantLeagues = async ({ userId, tenantId }) => {
  if (!userId || !tenantId) {
    const error = new Error('userId and tenantId are required');
    error.statusCode = 400;
    throw error;
  }

  const totalResult = await pool.query(
    `
    SELECT COALESCE(SUM(total_points), 0) AS total_points
    FROM fantasy_user_squad_gw_points
    WHERE user_id = $1 AND tenant_id = $2
    `,
    [userId, tenantId]
  );

  const totalPoints = Number(totalResult.rows[0]?.total_points ?? 0);

  const updateResult = await pool.query(
    `
    UPDATE fantasy_league_members flm
    SET total_points = $1
    FROM fantasy_leagues fl
    WHERE flm.league_id = fl.id
      AND flm.user_id = $2
      AND fl.tenant_id = $3
      AND flm.status = 'active'
    RETURNING flm.id, flm.league_id, flm.user_id, flm.total_points
    `,
    [totalPoints, userId, tenantId]
  );

  return {
    userId,
    tenantId,
    totalPoints,
    updatedMemberships: updateResult.rows.length,
  };
};

exports.getLeagueStandings = async ({ leagueId, userId }) => {
  const membershipCheck = await pool.query(
    `
    SELECT flm.id, flm.role, flm.status
    FROM fantasy_league_members flm
    WHERE flm.league_id = $1 AND flm.user_id = $2
    `,
    [leagueId, userId]
  );

  if (membershipCheck.rows.length === 0) {
    const error = new Error('You are not a member of this league');
    error.statusCode = 403;
    throw error;
  }

  const membership = membershipCheck.rows[0];

  if (membership.status !== 'active') {
    const error = new Error('Your membership is not active in this league');
    error.statusCode = 403;
    throw error;
  }

  const leagueResult = await pool.query(
    `
    SELECT id, name, description, tenant_id, type, invite_code, created_by, created_at
    FROM fantasy_leagues
    WHERE id = $1
    `,
    [leagueId]
  );

  if (leagueResult.rows.length === 0) {
    const error = new Error('League not found');
    error.statusCode = 404;
    throw error;
  }

  const standingsResult = await pool.query(
    `
    SELECT
      flm.user_id,
      u.username,
      u.email,
      flm.role,
      flm.status,
      flm.joined_at,
      flm.total_points
    FROM fantasy_league_members flm
    INNER JOIN users u ON u.id = flm.user_id
    WHERE flm.league_id = $1
      AND flm.status = 'active'
    ORDER BY flm.total_points DESC, flm.joined_at ASC NULLS LAST, u.username ASC
    `,
    [leagueId]
  );

  const standings = standingsResult.rows.map((row, index) => ({
    rank: index + 1,
    user_id: row.user_id,
    username: row.username,
    email: row.email,
    role: row.role,
    status: row.status,
    joined_at: row.joined_at,
    total_points: Number(row.total_points ?? 0),
  }));

  return {
    league: leagueResult.rows[0],
    standings,
  };
};

exports.refreshFantasyGameweekStatuses = async (tenantId = null) => {
  const values = [];
  let whereClause = '';

  if (tenantId) {
    values.push(tenantId);
    whereClause = `WHERE tenant_id = $1`;
  }

  const result = await pool.query(
    `
    SELECT id, tenant_id, gw, start_utc, end_utc, status
    FROM fantasy_gameweeks
    ${whereClause}
    ORDER BY tenant_id ASC, gw ASC
    `,
    values
  );

  const now = new Date();
  const updated = [];

  for (const row of result.rows) {
    const startUtc = row.start_utc ? new Date(row.start_utc) : null;
    const endUtc = row.end_utc ? new Date(row.end_utc) : null;

    let newStatus = 'upcoming';

    if (
      startUtc instanceof Date &&
      !Number.isNaN(startUtc.getTime()) &&
      endUtc instanceof Date &&
      !Number.isNaN(endUtc.getTime())
    ) {
      if (now < startUtc) {
        newStatus = 'upcoming';
      } else if (now >= startUtc && now <= endUtc) {
        newStatus = 'live';
      } else if (now > endUtc) {
        newStatus = 'finished';
      }
    }

    if (row.status !== newStatus) {
      await pool.query(
        `
        UPDATE fantasy_gameweeks
        SET status = $1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [newStatus, row.id]
      );

      updated.push({
        id: row.id,
        tenant_id: row.tenant_id,
        gw: row.gw,
        old_status: row.status,
        new_status: newStatus,
      });
    }
  }

  return {
    success: true,
    checked: result.rows.length,
    updatedCount: updated.length,
    updated,
  };
};

exports.fetchAndUpsertFantasyPlayerGwPoints = async ({ tenantId, gw }) => {
  await exports.refreshFantasyGameweekStatuses(tenantId);

  const gameweekResult = await pool.query(
    `
    SELECT fixture_ids, status, end_utc
    FROM fantasy_gameweeks
    WHERE tenant_id = $1 AND gw = $2
    `,
    [tenantId, gw]
  );

  if (gameweekResult.rows.length === 0) {
    const error = new Error('Gameweek not found');
    error.statusCode = 404;
    throw error;
  }

  const gameweek = gameweekResult.rows[0];

  const fixtureIds = Array.isArray(gameweek.fixture_ids)
    ? gameweek.fixture_ids
    : [];

  const status = (gameweek.status || '').toString().toLowerCase().trim();
  const endUtc = gameweek.end_utc ? new Date(gameweek.end_utc) : null;
  const now = new Date();

  const isFinishedByStatus =
    status === 'finished' ||
    status === 'completed' ||
    status === 'closed';

  const isFinishedByTime =
    endUtc instanceof Date && !Number.isNaN(endUtc.getTime())
      ? now > endUtc
      : false;

  const isGwFinished = isFinishedByStatus || isFinishedByTime;

  if (fixtureIds.length === 0) {
    return {
      tenantId,
      gw,
      processed: 0,
      fixturesProcessed: 0,
      cached: true,
      gwFinished: isGwFinished,
    };
  }

  if (isGwFinished) {
    const cachedResult = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM fantasy_player_gw_points
      WHERE tenant_id = $1 AND gw = $2
      `,
      [tenantId, gw]
    );

    const cachedCount = Number(cachedResult.rows[0]?.count ?? 0);

    if (cachedCount > 0) {
      return {
        tenantId,
        gw,
        processed: cachedCount,
        fixturesProcessed: 0,
        cached: true,
        gwFinished: true,
      };
    }
  }

  const statsByPlayerId = {};

  for (const fixtureId of fixtureIds) {
    const resp = await rapidApi.get('/fixtures/players', {
      params: { fixture: fixtureId },
    });

    const response = resp.data?.response || [];

    for (const teamBlock of response) {
      const players = Array.isArray(teamBlock.players) ? teamBlock.players : [];

      for (const p of players) {
        const pid = Number(p?.player?.id);
        if (!pid) continue;

        const stat = Array.isArray(p.statistics) && p.statistics.length > 0
          ? p.statistics[0]
          : {};

        statsByPlayerId[pid] = {
          minutes: stat?.games?.minutes ?? 0,
          goals: stat?.goals?.total ?? 0,
          assists: stat?.goals?.assists ?? 0,
          yellow: stat?.cards?.yellow ?? 0,
          red: stat?.cards?.red ?? 0,
          clean_sheet: (stat?.goals?.conceded ?? 0) === 0,
          goals_conceded: stat?.goals?.conceded ?? 0,
          own_goals: stat?.goals?.owngoal ?? 0,
          penalties_missed: stat?.penalty?.missed ?? 0,
          penalties_saved: stat?.penalty?.saved ?? 0,
          saves: stat?.goals?.saves ?? 0,
        };
      }
    }
  }

  const upsertResult = await exports.upsertFantasyPlayerGwPointsFromStats({
    tenantId,
    gw,
    statsByPlayerId,
  });

  return {
    tenantId,
    gw,
    processed: upsertResult.processed,
    fixturesProcessed: fixtureIds.length,
    cached: false,
    gwFinished: isGwFinished,
  };
};

exports.runMyGwPointsPipeline = async ({ userId, tenantId, gw }) => {
  const fetchResult = await exports.fetchAndUpsertFantasyPlayerGwPoints({
    tenantId,
    gw,
  });

  const squadPointsResult = await exports.calculateMySquadGwPoints({
    userId,
    tenantId,
    gw,
  });

  const syncResult = await exports.syncUserTotalPointsForTenantLeagues({
    userId,
    tenantId,
  });

  return {
    tenantId,
    gw,
    fetch: fetchResult,
    squad_points: squadPointsResult,
    sync: syncResult,
  };
};

async function createFantasyNotification({
  userId,
  leagueId = null,
  type,
  title,
  message,
}) {
  const result = await pool.query(
    `
    INSERT INTO fantasy_notifications (user_id, league_id, type, title, message)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, league_id, type, title, message, is_read, created_at
    `,
    [userId, leagueId, type, title, message]
  );

  return result.rows[0];
};

exports.getMyFantasyNotifications = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      fn.id,
      fn.user_id,
      fn.league_id,
      fn.type,
      fn.title,
      fn.message,
      fn.is_read,
      fn.created_at,
      fl.name AS league_name
    FROM fantasy_notifications fn
    LEFT JOIN fantasy_leagues fl ON fl.id = fn.league_id
    WHERE fn.user_id = $1
    ORDER BY fn.created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.markFantasyNotificationRead = async ({ notificationId, userId }) => {
  const result = await pool.query(
    `
    UPDATE fantasy_notifications
    SET is_read = true
    WHERE id = $1 AND user_id = $2
    RETURNING id, user_id, league_id, type, title, message, is_read, created_at
    `,
    [notificationId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Notification not found');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

function normalizeFantasyPosition(raw) {
  const s = (raw || '').toString().toLowerCase().trim();
  if (!s) return null;
  if (s.includes('goalkeeper') || s === 'gk' || s === 'g') return 'GK';
  if (s.includes('defender') || s === 'def' || s === 'd') return 'DEF';
  if (s.includes('midfielder') || s === 'mid' || s === 'mf' || s === 'm') return 'MID';
  if (s.includes('attacker') || s.includes('forward') || s === 'fwd' || s === 'fw' || s === 'f') return 'FWD';
  return null;
}

function computeFantasyPrice(pos, minutes, goals, assists) {
  const minMax = {
    GK: [4.0, 6.5],
    DEF: [4.0, 7.5],
    MID: [4.5, 12.5],
    FWD: [4.5, 12.5],
  }[pos] || [4.5, 12.5];

  const base = {
    GK: 4.5,
    DEF: 4.5,
    MID: 6.0,
    FWD: 7.0,
  }[pos] || 6.0;

  let p = base;
  p += goals * 0.35;
  p += assists * 0.25;
  p += (minutes / 900.0) * 0.30;

  if (p < minMax[0]) p = minMax[0];
  if (p > minMax[1]) p = minMax[1];

  return Number(p.toFixed(1));
}

function weekOfYear(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function ensureFantasyTenantRow({
  tenantId,
  leagueId,
  season,
  name,
  logo,
  country,
}) {
  await pool.query(
    `
    INSERT INTO fantasy_tenants (
      tenant_id,
      league_id,
      season,
      name,
      logo,
      country,
      seeded,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      league_id = EXCLUDED.league_id,
      season = EXCLUDED.season,
      name = EXCLUDED.name,
      logo = EXCLUDED.logo,
      country = EXCLUDED.country,
      updated_at = CURRENT_TIMESTAMP
    `,
    [tenantId, leagueId, season, name, logo || null, country || null]
  );
}

async function ensureFantasyRulesRow(tenantId) {
  await pool.query(
    `
    INSERT INTO fantasy_rules (
      tenant_id,
      budget_cap,
      max_players_per_club,
      allowed_formations,
      created_at,
      updated_at
    )
    VALUES (
      $1,
      90.0,
      3,
      '["3-4-3","3-5-2","4-4-2","4-3-3","4-5-1","5-3-2","5-4-1"]'::jsonb,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (tenant_id)
    DO NOTHING
    `,
    [tenantId]
  );
}

async function seedFantasyGameweeks({
  tenantId,
  leagueId,
  season,
}) {
  const existingResult = await pool.query(
    `
    SELECT id
    FROM fantasy_gameweeks
    WHERE tenant_id = $1
    LIMIT 1
    `,
    [tenantId]
  );

  if (existingResult.rows.length > 0) return;

  const fixtures = await competitionService.getLeagueFixtures(leagueId, season);
  const byGw = new Map();

  for (const fx of fixtures) {
    const roundStr = (fx.league?.round || '').toString();
    const match = roundStr.match(/(\d+)/);
    let gw;

    if (match) {
      gw = parseInt(match[1], 10);
    } else {
      const date = new Date(fx.fixture.date);
      gw = weekOfYear(date);
    }

    if (!byGw.has(gw)) byGw.set(gw, []);
    byGw.get(gw).push(fx);
  }

  const gws = Array.from(byGw.keys()).sort((a, b) => a - b);

  for (const gw of gws) {
    const fixturesForGw = byGw.get(gw) || [];

    fixturesForGw.sort(
      (a, b) => new Date(a.fixture.date) - new Date(b.fixture.date)
    );

    const firstKick = new Date(fixturesForGw[0].fixture.date);
    const lastKick = new Date(fixturesForGw[fixturesForGw.length - 1].fixture.date);
    const deadline = new Date(firstKick.getTime() - 90 * 60 * 1000);
    const fixtureIds = fixturesForGw.map(f => f.fixture.id);

    await pool.query(
      `
      INSERT INTO fantasy_gameweeks (
        tenant_id,
        gw,
        fixture_ids,
        status,
        start_utc,
        end_utc,
        deadline_utc,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3::jsonb, 'upcoming', $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, gw)
      DO NOTHING
      `,
      [
        tenantId,
        gw,
        JSON.stringify(fixtureIds),
        firstKick.toISOString(),
        lastKick.toISOString(),
        deadline.toISOString(),
      ]
    );
  }
}

async function refreshFantasyPlayerPrices({
  tenantId,
  leagueId,
  season,
}) {
  console.log('refreshFantasyPlayerPrices started for', tenantId, leagueId, season);

  const apiById = new Map();
  let page = 1;

  while (true) {
    console.log('Fetching players page', page);

    const resp = await axios.get('https://api-football-v1.p.rapidapi.com/v3/players', {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      },
      params: {
        league: leagueId,
        season,
        page,
      },
    });

    const items = resp.data.response || [];

    for (const row of items) {
      const player = row.player || {};
      const statistics = row.statistics || [];

      const playerId = player.id;
      if (!playerId) continue;

      let rawPos = null;
      let teamId = null;
      let teamName = '';
      let minutes = 0;
      let goals = 0;
      let assists = 0;

      for (const stat of statistics) {
        const games = stat.games || {};
        const goalsMap = stat.goals || {};
        const team = stat.team || {};

        rawPos = rawPos || games.position || null;
        teamId = teamId || team.id || null;
        teamName = teamName || team.name || '';

        minutes += parseInt(games.minutes || 0, 10) || 0;
        goals += parseInt(goalsMap.total || 0, 10) || 0;
        assists += parseInt(goalsMap.assists || 0, 10) || 0;
      }

      const normPos = normalizeFantasyPosition(rawPos);
      if (!normPos) continue;

      const price = computeFantasyPrice(normPos, minutes, goals, assists);

      apiById.set(playerId, {
        tenantId,
        playerId,
        teamId,
        teamName,
        name: (player.name || '').toString(),
        position: normPos,
        price,
        status: 'A',
        photoUrl: (player.photo || '').toString() || null,
      });
    }

    const paging = resp.data.paging || {};
    const cur = parseInt(paging.current || 1, 10);
    const tot = parseInt(paging.total || 1, 10);

    if (cur >= tot) break;
    page++;
  }

  for (const row of apiById.values()) {
    await pool.query(
      `
      INSERT INTO fantasy_players (
        tenant_id,
        player_id,
        team_id,
        team_name,
        name,
        position,
        price,
        status,
        photo_url,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, player_id)
      DO UPDATE SET
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        name = EXCLUDED.name,
        position = EXCLUDED.position,
        price = EXCLUDED.price,
        status = EXCLUDED.status,
        photo_url = EXCLUDED.photo_url,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        row.tenantId,
        row.playerId,
        row.teamId,
        row.teamName,
        row.name,
        row.position,
        row.price,
        row.status,
        row.photoUrl,
      ]
    );
  }
}

exports.refreshFantasyTenantPrices = async ({
  tenantId,
  leagueId,
  season,
  name,
  logo,
  country,
}) => {
  if (!tenantId || !leagueId || !season || !name) {
    const error = new Error('tenantId, leagueId, season and name are required');
    error.statusCode = 400;
    throw error;
  }

  await ensureFantasyTenantRow({
    tenantId,
    leagueId,
    season,
    name,
    logo,
    country,
  });

  await ensureFantasyRulesRow(tenantId);
  await refreshFantasyPlayerPrices({ tenantId, leagueId, season });

  await pool.query(
    `
    UPDATE fantasy_tenants
    SET updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  return await exports.getTenantById(tenantId);
};

async function seedFantasyPlayersLight({
  tenantId,
  leagueId,
  season,
}) {
  const existingResult = await pool.query(
    `
    SELECT id
    FROM fantasy_players
    WHERE tenant_id = $1
    LIMIT 1
    `,
    [tenantId]
  );

  if (existingResult.rows.length > 0) return;

  const teamsResponse = await competitionService.getTeamsByLeagueAndSeason(leagueId, season);
  const teams = Array.isArray(teamsResponse?.response)
    ? teamsResponse.response
    : Array.isArray(teamsResponse)
        ? teamsResponse
        : [];

  const playersMap = new Map();

  for (const teamRow of teams) {
    const team = teamRow.team || teamRow;
    const teamId = team?.id;
    const teamName = team?.name || '';

    if (!teamId) continue;

    let squad = [];

    try {
      const squadData = await teamService.getSquadAndCoach(teamId);
      squad = squadData.players || [];
    } catch (_) {
      squad = [];
    }

    for (const p of squad) {
      const pid = p.id || p.player?.id;
      if (!pid) continue;

      const name = (p.name || p.player?.name || '').toString();
      const photo = (p.photo || p.player?.photo || '').toString();
      const rawPos = (p.position || p.player?.position || '').toString();

      const normPos = normalizeFantasyPosition(rawPos);
      if (!normPos) continue;

      const basePrice = {
        GK: 4.5,
        DEF: 4.5,
        MID: 6.0,
        FWD: 7.0,
      }[normPos] || 6.0;

      playersMap.set(pid, {
        tenantId,
        playerId: pid,
        teamId,
        teamName,
        name,
        position: normPos,
        price: basePrice,
        status: 'A',
        photoUrl: photo || null,
      });
    }
  }

  for (const row of playersMap.values()) {
    await pool.query(
      `
      INSERT INTO fantasy_players (
        tenant_id,
        player_id,
        team_id,
        team_name,
        name,
        position,
        price,
        status,
        photo_url,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, player_id)
      DO UPDATE SET
        team_id = EXCLUDED.team_id,
        team_name = EXCLUDED.team_name,
        name = EXCLUDED.name,
        position = EXCLUDED.position,
        price = EXCLUDED.price,
        status = EXCLUDED.status,
        photo_url = EXCLUDED.photo_url,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        row.tenantId,
        row.playerId,
        row.teamId,
        row.teamName,
        row.name,
        row.position,
        row.price,
        row.status,
        row.photoUrl,
      ]
    );
  }
}

exports.ensureFantasyTenantSeeded = async ({
  tenantId,
  leagueId,
  season,
  name,
  logo,
  country,
}) => {
  if (!tenantId || !leagueId || !season || !name) {
    const error = new Error('tenantId, leagueId, season and name are required');
    error.statusCode = 400;
    throw error;
  }

  await ensureFantasyTenantRow({
    tenantId,
    leagueId,
    season,
    name,
    logo,
    country,
  });

  await ensureFantasyRulesRow(tenantId);
  await seedFantasyGameweeks({ tenantId, leagueId, season });
  await seedFantasyPlayersLight({ tenantId, leagueId, season });

  await pool.query(
    `
    UPDATE fantasy_tenants
    SET seeded = true,
        updated_at = CURRENT_TIMESTAMP
    WHERE tenant_id = $1
    `,
    [tenantId]
  );

  return await exports.getTenantById(tenantId);
};
