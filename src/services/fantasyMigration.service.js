const admin = require('../config/firebase');
const pool = require('../config/database');

const db = admin.firestore();

function parseDate(value) {
  if (!value) return null;

  if (typeof value.toDate === 'function') {
    return value.toDate();
  }

  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function normalizePosition(position) {
  const p = String(position || '').trim().toUpperCase();
  if (['GK', 'DEF', 'MID', 'FWD'].includes(p)) return p;
  return null;
}

exports.migrateTenantBundle = async (tenantId) => {
  const tenantRef = db.collection('fantasy_tenants').doc(tenantId);
  const rulesRef = db.collection('fantasy_rules').doc(tenantId);

  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    const error = new Error('Tenant not found in Firestore');
    error.statusCode = 404;
    throw error;
  }

  const tenantData = tenantSnap.data() || {};

  const rulesSnap = await rulesRef.get();
  const rulesData = rulesSnap.exists ? (rulesSnap.data() || {}) : null;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `
      INSERT INTO fantasy_tenants (
        tenant_id, league_id, season, name, logo, country, seeded, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,COALESCE($8, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        league_id = EXCLUDED.league_id,
        season = EXCLUDED.season,
        name = EXCLUDED.name,
        logo = EXCLUDED.logo,
        country = EXCLUDED.country,
        seeded = EXCLUDED.seeded,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        tenantId,
        Number(tenantData.leagueId),
        Number(tenantData.season),
        tenantData.name || '',
        tenantData.logo || null,
        tenantData.country || null,
        Boolean(tenantData.seeded),
        parseDate(tenantData.createdAt),
      ]
    );

    const budgetCap =
      rulesData?.budgetCap ??
      tenantData?.budgetDefault ??
      90.0;

    const maxPlayersPerClub =
      rulesData?.maxPerClub ??
      tenantData?.maxPlayersPerClub ??
      3;

    const allowedFormations =
      rulesData?.allowedFormations ??
      tenantData?.formations ??
      ['3-4-3', '4-4-2', '3-5-2'];

    await client.query(
      `
      INSERT INTO fantasy_rules (
        tenant_id, budget_cap, max_players_per_club, allowed_formations, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id)
      DO UPDATE SET
        budget_cap = EXCLUDED.budget_cap,
        max_players_per_club = EXCLUDED.max_players_per_club,
        allowed_formations = EXCLUDED.allowed_formations,
        updated_at = CURRENT_TIMESTAMP
      `,
      [
        tenantId,
        Number(budgetCap),
        Number(maxPlayersPerClub),
        JSON.stringify(allowedFormations),
      ]
    );

    const gwSnap = await db
      .collection('fantasy_gameweeks')
      .where('tenantId', '==', tenantId)
      .get();

    for (const doc of gwSnap.docs) {
      const gw = doc.data() || {};

      await client.query(
        `
        INSERT INTO fantasy_gameweeks (
          tenant_id, gw, fixture_ids, status, start_utc, end_utc, deadline_utc, created_at, updated_at
        )
        VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT (tenant_id, gw)
        DO UPDATE SET
          fixture_ids = EXCLUDED.fixture_ids,
          status = EXCLUDED.status,
          start_utc = EXCLUDED.start_utc,
          end_utc = EXCLUDED.end_utc,
          deadline_utc = EXCLUDED.deadline_utc,
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          tenantId,
          Number(gw.gw),
          JSON.stringify(gw.fixtureIds || []),
          gw.status || 'upcoming',
          parseDate(gw.startUtc),
          parseDate(gw.endUtc),
          parseDate(gw.deadlineUtc || gw.deadline),
        ]
      );
    }

    const playersSnap = await db
      .collection('fantasy_players')
      .where('tenantId', '==', tenantId)
      .get();

    for (const doc of playersSnap.docs) {
      const p = doc.data() || {};
      const position = normalizePosition(p.position);

      if (!p.playerId || !position) continue;

      await client.query(
        `
        INSERT INTO fantasy_players (
          tenant_id, player_id, team_id, team_name, name, position, price, status, photo_url, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
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
          tenantId,
          Number(p.playerId),
          p.teamId != null ? Number(p.teamId) : null,
          p.teamName || null,
          p.name || '',
          position,
          Number(p.price || 0),
          p.status || 'A',
          p.photoUrl || null,
        ]
      );
    }

    await client.query('COMMIT');

    return {
      tenantId,
      migrated: true,
      gameweeksCount: gwSnap.size,
      playersCount: playersSnap.size,
      rulesFound: !!rulesData,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};