const pool = require('../config/database');
const axios = require('axios');
const transferNotificationService = require('./notification_transfer.service');

let engineInterval = null;
let transferInterval = null;
let engineRunning = false;

async function fetchLiveFixtures() {
  const response = await axios.get(
    'https://api-football-v1.p.rapidapi.com/v3/fixtures',
    {
      params: { live: 'all' },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      },
    }
  );

  return response.data?.response || [];
}

async function fetchFixtureById(fixtureId) {
  const response = await axios.get(
    'https://api-football-v1.p.rapidapi.com/v3/fixtures',
    {
      params: { id: fixtureId },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      },
    }
  );

  return response.data?.response?.[0] || null;
}

async function fetchFixtureLineups(fixtureId) {
  const response = await axios.get(
    'https://api-football-v1.p.rapidapi.com/v3/fixtures/lineups',
    {
      params: { fixture: fixtureId },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
      },
    }
  );

  return response.data?.response || [];
}

async function getTrackedFixtureIds() {
  const result = await pool.query(
    `
    SELECT DISTINCT fixture_id
    FROM notification_match_overrides
    WHERE is_enabled = true
    `
  );

  return result.rows.map((row) => row.fixture_id);
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

function minutesUntilKickoff(fixtureDate) {
  if (!fixtureDate) return null;
  const kickoff = new Date(fixtureDate).getTime();
  const now = Date.now();
  return Math.floor((kickoff - now) / 60000);
}

function isWithinThirtyMinuteWindow(fixtureDate) {
  const minutes = minutesUntilKickoff(fixtureDate);
  if (minutes === null) return false;
  return minutes >= 0 && minutes <= 30;
}

function buildFixtureMetadata({
  fixtureId,
  leagueId,
  season,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeTeamLogo,
  awayTeamLogo,
  leagueName,
  leagueLogo,
}) {
  return {
    fixture_id: fixtureId,
    league_id: leagueId,
    season,
    has_standings: true,
    home_team_id: homeTeamId,
    away_team_id: awayTeamId,
    home_team_name: homeTeamName,
    away_team_name: awayTeamName,
    home_team_logo: homeTeamLogo,
    away_team_logo: awayTeamLogo,
    league_name: leagueName,
    league_logo: leagueLogo,
  };
}

async function getStoredState(fixtureId) {
  const result = await pool.query(
    `
    SELECT *
    FROM notification_match_state
    WHERE fixture_id = $1
    `,
    [fixtureId]
  );

  return result.rows[0] || null;
}

async function upsertMatchState({
  fixtureId,
  leagueId,
  homeTeamId,
  awayTeamId,
  status,
  homeGoals,
  awayGoals,
  lastIsLineupAvailable = false,
  thirtyMinNotified = false,
  lineupNotified = false,
  matchStartedNotified = false,
  halftimeNotified = false,
  secondHalfStartedNotified = false,
  extraTimeStartedNotified = false,
  penaltyShootoutStartedNotified = false,
  matchFinishedNotified = false,
}) {
  const result = await pool.query(
    `
    INSERT INTO notification_match_state (
      fixture_id,
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
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,CURRENT_TIMESTAMP)
    ON CONFLICT (fixture_id)
    DO UPDATE SET
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
    RETURNING *
    `,
    [
      fixtureId,
      leagueId,
      homeTeamId,
      awayTeamId,
      status,
      homeGoals,
      awayGoals,
      lastIsLineupAvailable,
      thirtyMinNotified,
      lineupNotified,
      matchStartedNotified,
      halftimeNotified,
      secondHalfStartedNotified,
      extraTimeStartedNotified,
      penaltyShootoutStartedNotified,
      matchFinishedNotified,
    ]
  );

  return result.rows[0];
}

async function getUsersForFixture({ fixtureId, leagueId, homeTeamId, awayTeamId }) {
  const result = await pool.query(
    `
    SELECT DISTINCT user_id
    FROM (
      SELECT user_id
      FROM notification_match_overrides
      WHERE fixture_id = $1
        AND is_enabled = true

      UNION

      SELECT user_id
      FROM notification_subscriptions
      WHERE source_type = 'competition'
        AND source_id = $2
        AND is_enabled = true

      UNION

      SELECT user_id
      FROM notification_subscriptions
      WHERE source_type = 'team'
        AND source_id IN ($3, $4)
        AND is_enabled = true
    ) t
    `,
    [fixtureId, leagueId, homeTeamId, awayTeamId]
  );

  return result.rows.map((row) => row.user_id);
}

async function getUsersWithFixtureDisabled(fixtureId) {
  const result = await pool.query(
    `
    SELECT user_id
    FROM notification_match_overrides
    WHERE fixture_id = $1
      AND is_enabled = false
    `,
    [fixtureId]
  );

  return new Set(result.rows.map((row) => row.user_id));
}

async function createAppNotification({
  userId,
  sourceType,
  sourceId,
  fixtureId,
  eventType,
  title,
  message,
  metadata = {},
}) {
  await pool.query(
    `
    INSERT INTO app_notifications (
      user_id,
      source_type,
      source_id,
      fixture_id,
      event_type,
      title,
      message,
      metadata
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `,
    [
      userId,
      sourceType,
      sourceId,
      fixtureId,
      eventType,
      title,
      message,
      metadata,
    ]
  );
}

async function sendNotificationsToUsers(users, payloadBuilder) {
  for (const userId of users) {
    const payload = payloadBuilder(userId);
    await createAppNotification(payload);
  }
}

async function handleFixture(fixture) {
  const fixtureId = fixture?.fixture?.id;
  if (!fixtureId) return;

  const leagueId = fixture?.league?.id ?? null;
  const homeTeamId = fixture?.teams?.home?.id ?? null;
  const awayTeamId = fixture?.teams?.away?.id ?? null;
  const homeTeamName = fixture?.teams?.home?.name ?? 'Home team';
  const awayTeamName = fixture?.teams?.away?.name ?? 'Away team';
  const homeTeamLogo = fixture?.teams?.home?.logo ?? '';
  const awayTeamLogo = fixture?.teams?.away?.logo ?? '';
  const leagueName = fixture?.league?.name ?? 'Competition';
  const leagueLogo = fixture?.league?.logo ?? '';
  const season = fixture?.league?.season ?? new Date().getFullYear();
  const fixtureDate = fixture?.fixture?.date ?? null;
  const status = normalizeStatus(fixture?.fixture?.status?.short || '');
  const homeGoals = fixture?.goals?.home ?? 0;
  const awayGoals = fixture?.goals?.away ?? 0;

  const metadata = buildFixtureMetadata({
    fixtureId,
    leagueId,
    season,
    homeTeamId,
    awayTeamId,
    homeTeamName,
    awayTeamName,
    homeTeamLogo,
    awayTeamLogo,
    leagueName,
    leagueLogo,
  });

  const stored = await getStoredState(fixtureId);

  const users = await getUsersForFixture({
    fixtureId,
    leagueId,
    homeTeamId,
    awayTeamId,
  });

  const disabledUsers = await getUsersWithFixtureDisabled(fixtureId);
  const finalUsers = users.filter((userId) => !disabledUsers.has(userId));

  let thirtyMinNotified = stored?.thirty_min_notified ?? false;
  let lineupNotified = stored?.lineup_notified ?? false;
  let matchStartedNotified = stored?.match_started_notified ?? false;
  let halftimeNotified = stored?.halftime_notified ?? false;
  let secondHalfStartedNotified = stored?.second_half_started_notified ?? false;
  let extraTimeStartedNotified = stored?.extra_time_started_notified ?? false;
  let penaltyShootoutStartedNotified =
    stored?.penalty_shootout_started_notified ?? false;
  let matchFinishedNotified = stored?.match_finished_notified ?? false;
  let lastIsLineupAvailable = stored?.last_is_lineup_available ?? false;

  if (!stored) {
    await upsertMatchState({
      fixtureId,
      leagueId,
      homeTeamId,
      awayTeamId,
      status,
      homeGoals,
      awayGoals,
      lastIsLineupAvailable,
      thirtyMinNotified,
      lineupNotified,
      matchStartedNotified,
      halftimeNotified,
      secondHalfStartedNotified,
      extraTimeStartedNotified,
      penaltyShootoutStartedNotified,
      matchFinishedNotified,
    });
    return;
  }

  if (!thirtyMinNotified && !isStartedStatus(status) && isWithinThirtyMinuteWindow(fixtureDate)) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'thirty_min_before_match',
      title: `${homeTeamName} vs ${awayTeamName}`,
      message: `Le match commence dans moins de 30 minutes.`,
      metadata,
    }));
    thirtyMinNotified = true;
  }

  let currentLineupAvailable = lastIsLineupAvailable;

  if (!lineupNotified && !isStartedStatus(status)) {
    try {
      const lineups = await fetchFixtureLineups(fixtureId);
      currentLineupAvailable = Array.isArray(lineups) && lineups.length > 0;

      if (currentLineupAvailable) {
        await sendNotificationsToUsers(finalUsers, (userId) => ({
          userId,
          sourceType: 'fixture',
          sourceId: fixtureId,
          fixtureId,
          eventType: 'lineup_available',
          title: `${homeTeamName} vs ${awayTeamName}`,
          message: `La composition officielle est disponible.`,
          metadata,
        }));
        lineupNotified = true;
      }
    } catch (err) {
      console.error('Lineup fetch error:', err.message);
    }
  }

  if (!matchStartedNotified && isStartedStatus(status)) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'match_started',
      title: `${homeTeamName} vs ${awayTeamName}`,
      message: `Le match a commencé.`,
      metadata,
    }));
    matchStartedNotified = true;
  }

  const scoreChanged =
    stored.last_home_goals !== homeGoals || stored.last_away_goals !== awayGoals;

  if (
    scoreChanged &&
    (homeGoals > stored.last_home_goals || awayGoals > stored.last_away_goals)
  ) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'goal',
      title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
      message: `But dans le match.`,
      metadata,
    }));
  }

  if (!halftimeNotified && isHalftimeStatus(status)) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'halftime',
      title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
      message: `C'est la mi-temps.`,
      metadata,
    }));
    halftimeNotified = true;
  }

  if (!secondHalfStartedNotified && isSecondHalfStatus(status)) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'second_half_started',
      title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
      message: `La deuxième période a commencé.`,
      metadata,
    }));
    secondHalfStartedNotified = true;
  }

  if (!extraTimeStartedNotified && isExtraTimeStatus(status)) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'extra_time_started',
      title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
      message: `Les prolongations ont commencé.`,
      metadata,
    }));
    extraTimeStartedNotified = true;
  }

  if (!penaltyShootoutStartedNotified && isPenaltyShootoutStatus(status)) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'penalty_shootout_started',
      title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
      message: `La séance de tirs au but a commencé.`,
      metadata,
    }));
    penaltyShootoutStartedNotified = true;
  }

  if (!matchFinishedNotified && isFinishedStatus(status)) {
    await sendNotificationsToUsers(finalUsers, (userId) => ({
      userId,
      sourceType: 'fixture',
      sourceId: fixtureId,
      fixtureId,
      eventType: 'match_finished',
      title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
      message: `Le match est terminé.`,
      metadata,
    }));
    matchFinishedNotified = true;
  }

  await upsertMatchState({
    fixtureId,
    leagueId,
    homeTeamId,
    awayTeamId,
    status,
    homeGoals,
    awayGoals,
    lastIsLineupAvailable: currentLineupAvailable,
    thirtyMinNotified,
    lineupNotified,
    matchStartedNotified,
    halftimeNotified,
    secondHalfStartedNotified,
    extraTimeStartedNotified,
    penaltyShootoutStartedNotified,
    matchFinishedNotified,
  });
}

async function initializeTrackedFixturesState() {
  const liveFixtures = await fetchLiveFixtures();
  const trackedFixtureIds = await getTrackedFixtureIds();

  const fixtureMap = new Map();

  for (const fixture of liveFixtures) {
    const fixtureId = fixture?.fixture?.id;
    if (fixtureId) {
      fixtureMap.set(fixtureId, fixture);
    }
  }

  for (const fixtureId of trackedFixtureIds) {
    if (!fixtureMap.has(fixtureId)) {
      try {
        const fixture = await fetchFixtureById(fixtureId);
        if (fixture?.fixture?.id) {
          fixtureMap.set(fixture.fixture.id, fixture);
        }
      } catch (err) {
        console.error('Tracked fixture fetch error:', err.message);
      }
    }
  }

  const fixtures = Array.from(fixtureMap.values());

  for (const fixture of fixtures) {
    try {
      const fixtureId = fixture?.fixture?.id;
      if (!fixtureId) continue;

      const leagueId = fixture?.league?.id ?? null;
      const homeTeamId = fixture?.teams?.home?.id ?? null;
      const awayTeamId = fixture?.teams?.away?.id ?? null;
      const status = String(fixture?.fixture?.status?.short || '').toUpperCase();
      const homeGoals = fixture?.goals?.home ?? 0;
      const awayGoals = fixture?.goals?.away ?? 0;

      const stored = await getStoredState(fixtureId);

      await upsertMatchState({
        fixtureId,
        leagueId,
        homeTeamId,
        awayTeamId,
        status,
        homeGoals,
        awayGoals,
        lastIsLineupAvailable: stored?.last_is_lineup_available ?? false,
        thirtyMinNotified: stored?.thirty_min_notified ?? false,
        lineupNotified: stored?.lineup_notified ?? false,
        matchStartedNotified: stored?.match_started_notified ?? false,
        halftimeNotified: stored?.halftime_notified ?? false,
        secondHalfStartedNotified:
          stored?.second_half_started_notified ?? false,
        extraTimeStartedNotified:
          stored?.extra_time_started_notified ?? false,
        penaltyShootoutStartedNotified:
          stored?.penalty_shootout_started_notified ?? false,
        matchFinishedNotified: stored?.match_finished_notified ?? false,
      });
    } catch (err) {
      console.error('Notification engine baseline error:', err.message);
    }
  }

  return { success: true, initialized: fixtures.length };
}

async function runNotificationEngineOnce() {
  const liveFixtures = await fetchLiveFixtures();
  const trackedFixtureIds = await getTrackedFixtureIds();

  const fixtureMap = new Map();

  for (const fixture of liveFixtures) {
    const fixtureId = fixture?.fixture?.id;
    if (fixtureId) {
      fixtureMap.set(fixtureId, fixture);
    }
  }

  for (const fixtureId of trackedFixtureIds) {
    if (!fixtureMap.has(fixtureId)) {
      try {
        const fixture = await fetchFixtureById(fixtureId);
        if (fixture?.fixture?.id) {
          fixtureMap.set(fixture.fixture.id, fixture);
        }
      } catch (err) {
        console.error('Tracked fixture fetch error:', err.message);
      }
    }
  }

  const fixtures = Array.from(fixtureMap.values());

  for (const fixture of fixtures) {
    try {
      await handleFixture(fixture);
    } catch (err) {
      console.error('Notification engine fixture error:', err.message);
    }
  }

  return { success: true, processed: fixtures.length };
}

exports.runNotificationEngine = async () => {
  return await runNotificationEngineOnce();
};

exports.startNotificationEngine = async () => {
  if (engineRunning) {
    return { success: true, message: 'Engine already running' };
  }

  engineRunning = true;

  await initializeTrackedFixturesState();

  engineInterval = setInterval(async () => {
    try {
      await runNotificationEngineOnce();
    } catch (err) {
      console.error('Notification engine loop error:', err.message);
    }
  }, 60000);

  transferInterval = setInterval(async () => {
    try {
      await transferNotificationService.runTransferNotificationEngine();
    } catch (err) {
      console.error('Transfer notification engine loop error:', err.message);
    }
  }, 3 * 60 * 60 * 1000);

  return { success: true, message: 'Engine started' };
};

exports.stopNotificationEngine = async () => {
  if (engineInterval) {
    clearInterval(engineInterval);
    engineInterval = null;
  }

  if (transferInterval) {
    clearInterval(transferInterval);
    transferInterval = null;
  }

  engineRunning = false;

  return { success: true, message: 'Engine stopped' };
};

exports.getNotificationEngineStatus = async () => {
  return {
    success: true,
    isRunning: engineRunning,
  };
};