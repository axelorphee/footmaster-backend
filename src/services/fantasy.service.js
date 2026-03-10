const pool = require('../config/database');

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
  const cleanTenantId = tenantId?.trim() || 'default';

  if (!cleanName) {
    const error = new Error('League name is required');
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

    if (cleanInviteCode && cleanInviteCode === league.invite_code) {
      status = 'active';
      joinedAt = new Date();
    }
  }

  const result = await pool.query(
    `
    INSERT INTO fantasy_league_members (league_id, user_id, role, status, joined_at, total_points)
    VALUES ($1, $2, $3, $4, $5, 0)
    RETURNING id, league_id, user_id, role, status, joined_at, total_points, created_at
    `,
    [leagueId, userId, role, status, joinedAt]
  );

  return {
    league,
    membership: result.rows[0],
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

  await pool.query(
    `
    DELETE FROM fantasy_league_members
    WHERE league_id = $1 AND user_id = $2
    `,
    [leagueId, targetUserId]
  );

  return { success: true };
};