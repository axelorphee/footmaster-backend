const pool = require('../config/database');
const axios = require('axios');

exports.getSubscriptions = async (userId) => {
  const result = await pool.query(
    `SELECT * FROM notification_subscriptions
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows;
};

function formatDateYYYYMMDD(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeStatus(status) {
  return String(status || '').toUpperCase();
}

function isStartedStatus(status) {
  return ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'PEN'].includes(
    normalizeStatus(status)
  );
}

function isFinishedStatus(status) {
  return ['FT', 'AET', 'PEN'].includes(normalizeStatus(status));
}

function isHalftimeStatus(status) {
  return normalizeStatus(status) === 'HT';
}

function isSecondHalfStatus(status) {
  return normalizeStatus(status) === '2H';
}

function isExtraTimeStatus(status) {
  return normalizeStatus(status) === 'ET';
}

function isPenaltyShootoutStatus(status) {
  return ['P', 'PEN'].includes(normalizeStatus(status));
}

async function fetchFixturesByTeamAndDate(teamId, date) {
  const response = await axios.get(
    'https://api-football-v1.p.rapidapi.com/v3/fixtures',
    {
      params: {
        team: teamId,
        date,
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      },
    }
  );

  return response.data?.response || [];
}

async function fetchFixturesByLeagueAndDate(leagueId, date) {
  const response = await axios.get(
    'https://api-football-v1.p.rapidapi.com/v3/fixtures',
    {
      params: {
        league: leagueId,
        date,
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      },
    }
  );

  return response.data?.response || [];
}

async function upsertDiscoveredFixtureState(fixture) {
  const fixtureId = fixture?.fixture?.id;
  if (!fixtureId) return;

  const existingStateResult = await pool.query(
    `
    SELECT *
    FROM notification_match_state
    WHERE fixture_id = $1
    `,
    [fixtureId]
  );

  const existingState = existingStateResult.rows[0] || null;

  const fixtureDate = fixture?.fixture?.date ?? null;
  const leagueId = fixture?.league?.id ?? null;
  const homeTeamId = fixture?.teams?.home?.id ?? null;
  const awayTeamId = fixture?.teams?.away?.id ?? null;
  const status = normalizeStatus(fixture?.fixture?.status?.short || '');
  const homeGoals = fixture?.goals?.home ?? 0;
  const awayGoals = fixture?.goals?.away ?? 0;

  await pool.query(
    `
    INSERT INTO notification_match_state (
      fixture_id,
      fixture_date,
      league_id,
      home_team_id,
      away_team_id,
      last_status,
      last_home_goals,
      last_away_goals,
      last_is_lineup_available,
      thirty_min_notified,
      lineup_notified,
      match_started_notified,
      halftime_notified,
      second_half_started_notified,
      extra_time_started_notified,
      penalty_shootout_started_notified,
      match_finished_notified,
      updated_at
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,CURRENT_TIMESTAMP
    )
    ON CONFLICT (fixture_id)
    DO UPDATE SET
      fixture_date = COALESCE(EXCLUDED.fixture_date, notification_match_state.fixture_date),
      league_id = EXCLUDED.league_id,
      home_team_id = EXCLUDED.home_team_id,
      away_team_id = EXCLUDED.away_team_id,
      last_status = EXCLUDED.last_status,
      last_home_goals = EXCLUDED.last_home_goals,
      last_away_goals = EXCLUDED.last_away_goals,
      last_is_lineup_available = EXCLUDED.last_is_lineup_available,
      thirty_min_notified = EXCLUDED.thirty_min_notified,
      lineup_notified = EXCLUDED.lineup_notified,
      match_started_notified = EXCLUDED.match_started_notified,
      halftime_notified = EXCLUDED.halftime_notified,
      second_half_started_notified = EXCLUDED.second_half_started_notified,
      extra_time_started_notified = EXCLUDED.extra_time_started_notified,
      penalty_shootout_started_notified = EXCLUDED.penalty_shootout_started_notified,
      match_finished_notified = EXCLUDED.match_finished_notified,
      updated_at = CURRENT_TIMESTAMP
    `,
    [
      fixtureId,
      fixtureDate,
      leagueId,
      homeTeamId,
      awayTeamId,
      status,
      homeGoals,
      awayGoals,
      existingState?.last_is_lineup_available ?? false,
      existingState?.thirty_min_notified ?? false,
      existingState?.lineup_notified ?? false,
      existingState?.match_started_notified ??
        (isStartedStatus(status) || isFinishedStatus(status)),
      existingState?.halftime_notified ??
        (
          isHalftimeStatus(status) ||
          isSecondHalfStatus(status) ||
          isExtraTimeStatus(status) ||
          isPenaltyShootoutStatus(status) ||
          isFinishedStatus(status)
        ),
      existingState?.second_half_started_notified ??
        (
          isSecondHalfStatus(status) ||
          isExtraTimeStatus(status) ||
          isPenaltyShootoutStatus(status) ||
          isFinishedStatus(status)
        ),
      existingState?.extra_time_started_notified ??
        (
          isExtraTimeStatus(status) ||
          isPenaltyShootoutStatus(status) ||
          isFinishedStatus(status)
        ),
      existingState?.penalty_shootout_started_notified ??
        (
          isPenaltyShootoutStatus(status) ||
          (isFinishedStatus(status) && status === 'PEN')
        ),
      existingState?.match_finished_notified ?? isFinishedStatus(status),
    ]
  );
}

async function seedFixturesForSubscription({ sourceType, sourceId }) {
  const now = new Date();
  const todayStr = formatDateYYYYMMDD(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowStr = formatDateYYYYMMDD(tomorrow);

  let fixtures = [];

  if (sourceType === 'team') {
    const todayFixtures = await fetchFixturesByTeamAndDate(sourceId, todayStr);
    const tomorrowFixtures = await fetchFixturesByTeamAndDate(sourceId, tomorrowStr);
    fixtures = [...todayFixtures, ...tomorrowFixtures];
  } else if (sourceType === 'competition') {
    const todayFixtures = await fetchFixturesByLeagueAndDate(sourceId, todayStr);
    const tomorrowFixtures = await fetchFixturesByLeagueAndDate(sourceId, tomorrowStr);
    fixtures = [...todayFixtures, ...tomorrowFixtures];
  } else {
    return { seeded: 0 };
  }

  const fixtureMap = new Map();

  for (const fixture of fixtures) {
    const fixtureId = fixture?.fixture?.id;
    if (fixtureId) {
      fixtureMap.set(fixtureId, fixture);
    }
  }

  let seeded = 0;

  for (const fixture of fixtureMap.values()) {
    await upsertDiscoveredFixtureState(fixture);
    seeded++;
  }

  return { seeded };
}

exports.upsertSubscription = async ({
  userId,
  sourceType,
  sourceId,
}) => {
  const result = await pool.query(
    `
    INSERT INTO notification_subscriptions (
      user_id,
      source_type,
      source_id,
      is_enabled
    )
    VALUES ($1, $2, $3, true)
    ON CONFLICT (user_id, source_type, source_id)
    DO UPDATE SET
      is_enabled = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [userId, sourceType, sourceId]
  );

  if (sourceType === 'team' || sourceType === 'competition') {
    try {
      await seedFixturesForSubscription({
        sourceType,
        sourceId,
      });
    } catch (err) {
      console.error('Subscription fixture seed error:', err.message);
    }
  }

  return result.rows[0];
};

exports.disableSubscription = async ({
  userId,
  sourceType,
  sourceId,
}) => {
  await pool.query(
    `
    UPDATE notification_subscriptions
    SET is_enabled = false,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $1
      AND source_type = $2
      AND source_id = $3
    `,
    [userId, sourceType, sourceId]
  );

  return { success: true };
};

exports.getAppNotifications = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      user_id,
      source_type,
      source_id,
      fixture_id,
      event_type,
      title,
      message,
      is_read,
      metadata,
      created_at
    FROM app_notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return result.rows;
};

exports.markAppNotificationRead = async ({ notificationId, userId }) => {
  const result = await pool.query(
    `
    UPDATE app_notifications
    SET is_read = true
    WHERE id = $1 AND user_id = $2
    RETURNING
      id,
      user_id,
      source_type,
      source_id,
      fixture_id,
      event_type,
      title,
      message,
      is_read,
      metadata,
      created_at
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

exports.getMatchOverrides = async (userId) => {
  const result = await pool.query(
    `
    SELECT *
    FROM notification_match_overrides
    WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows;
};

exports.upsertMatchOverride = async ({
  userId,
  fixtureId,
  fixtureDate,
}) => {
  const result = await pool.query(
    `
    INSERT INTO notification_match_overrides (
      user_id,
      fixture_id,
      is_enabled
    )
    VALUES ($1, $2, true)
    ON CONFLICT (user_id, fixture_id)
    DO UPDATE SET
      is_enabled = true,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [userId, fixtureId]
  );

    if (fixtureDate) {
    await pool.query(
      `
      INSERT INTO notification_match_state (
        fixture_id,
        fixture_date,
        last_status,
        last_home_goals,
        last_away_goals,
        last_is_lineup_available,
        thirty_min_notified,
        lineup_notified,
        match_started_notified,
        halftime_notified,
        second_half_started_notified,
        extra_time_started_notified,
        penalty_shootout_started_notified,
        match_finished_notified,
        updated_at
      )
      VALUES ($1, $2, '', 0, 0, false, false, false, false, false, false, false, false, false, CURRENT_TIMESTAMP)
      ON CONFLICT (fixture_id)
      DO UPDATE SET
        fixture_date = COALESCE(notification_match_state.fixture_date, EXCLUDED.fixture_date),
        updated_at = CURRENT_TIMESTAMP
      `,
      [fixtureId, fixtureDate]
    );
  }

  return result.rows[0];
};

exports.disableMatchOverride = async ({
  userId,
  fixtureId,
}) => {
  const result = await pool.query(
    `
    INSERT INTO notification_match_overrides (
      user_id,
      fixture_id,
      is_enabled
    )
    VALUES ($1, $2, false)
    ON CONFLICT (user_id, fixture_id)
    DO UPDATE SET
      is_enabled = false,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [userId, fixtureId]
  );

  return result.rows[0];
};

const ALLOWED_NOTIFICATION_EVENT_TYPES = [
  'match_30min',
  'lineup_available',
  'match_started',
  'halftime',
  'second_half_started',
  'goal',
  'extra_time_started',
  'penalty_shootout_started',
  'match_finished',
  'transfer_news',
];

exports.getNotificationPreferences = async (userId) => {
  const result = await pool.query(
    `
    SELECT event_type, is_enabled, created_at, updated_at
    FROM notification_user_preferences
    WHERE user_id = $1
    ORDER BY event_type ASC
    `,
    [userId]
  );

  const savedMap = new Map(
    result.rows.map((row) => [row.event_type, row])
  );

  return ALLOWED_NOTIFICATION_EVENT_TYPES.map((eventType) => {
    const existing = savedMap.get(eventType);

    return {
      event_type: eventType,
      is_enabled: existing ? existing.is_enabled : true,
      created_at: existing ? existing.created_at : null,
      updated_at: existing ? existing.updated_at : null,
    };
  });
};

exports.upsertNotificationPreference = async ({
  userId,
  eventType,
  isEnabled,
}) => {
  if (!ALLOWED_NOTIFICATION_EVENT_TYPES.includes(eventType)) {
    const error = new Error('Invalid notification event type');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO notification_user_preferences (
      user_id,
      event_type,
      is_enabled
    )
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, event_type)
    DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, event_type, is_enabled, created_at, updated_at
    `,
    [userId, eventType, isEnabled]
  );

  return result.rows[0];
};

exports.getMatchEventPreferences = async ({ userId, fixtureId }) => {
  const result = await pool.query(
    `
    SELECT event_type, is_enabled, created_at, updated_at
    FROM notification_match_event_preferences
    WHERE user_id = $1
      AND fixture_id = $2
    ORDER BY event_type ASC
    `,
    [userId, fixtureId]
  );

  const savedMap = new Map(
    result.rows.map((row) => [row.event_type, row])
  );

  return ALLOWED_NOTIFICATION_EVENT_TYPES.map((eventType) => {
    const existing = savedMap.get(eventType);

    return {
      fixture_id: Number(fixtureId),
      event_type: eventType,
      is_enabled: existing ? existing.is_enabled : true,
      created_at: existing ? existing.created_at : null,
      updated_at: existing ? existing.updated_at : null,
    };
  });
};

exports.upsertMatchEventPreference = async ({
  userId,
  fixtureId,
  eventType,
  isEnabled,
}) => {
  if (!ALLOWED_NOTIFICATION_EVENT_TYPES.includes(eventType)) {
    const error = new Error('Invalid notification event type');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `
    INSERT INTO notification_match_event_preferences (
      user_id,
      fixture_id,
      event_type,
      is_enabled
    )
    VALUES ($1, $2, $3, $4)
    ON CONFLICT (user_id, fixture_id, event_type)
    DO UPDATE SET
      is_enabled = EXCLUDED.is_enabled,
      updated_at = CURRENT_TIMESTAMP
    RETURNING user_id, fixture_id, event_type, is_enabled, created_at, updated_at
    `,
    [userId, fixtureId, eventType, isEnabled]
  );

  return result.rows[0];
};