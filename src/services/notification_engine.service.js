const pool = require('../config/database');
const axios = require('axios');

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

function isStartedStatus(status) {
  return ['1H', 'HT', '2H', 'ET', 'P', 'BT', 'PEN'].includes(
    String(status || '').toUpperCase()
  );
}

function isFinishedStatus(status) {
  return ['FT', 'AET', 'PEN'].includes(String(status || '').toUpperCase());
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
  matchStartedNotified = false,
  halftimeNotified = false,
  secondHalfStartedNotified = false,
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
      match_started_notified,
      halftime_notified,
      second_half_started_notified,
      match_finished_notified,
      updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,CURRENT_TIMESTAMP)
    ON CONFLICT (fixture_id)
    DO UPDATE SET
      league_id = EXCLUDED.league_id,
      home_team_id = EXCLUDED.home_team_id,
      away_team_id = EXCLUDED.away_team_id,
      last_status = EXCLUDED.last_status,
      last_home_goals = EXCLUDED.last_home_goals,
      last_away_goals = EXCLUDED.last_away_goals,
      last_is_lineup_available = EXCLUDED.last_is_lineup_available,
      match_started_notified = EXCLUDED.match_started_notified,
      halftime_notified = EXCLUDED.halftime_notified,
      second_half_started_notified = EXCLUDED.second_half_started_notified,
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
      matchStartedNotified,
      halftimeNotified,
      secondHalfStartedNotified,
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
  const status = String(fixture?.fixture?.status?.short || '').toUpperCase();
  const homeGoals = fixture?.goals?.home ?? 0;
  const awayGoals = fixture?.goals?.away ?? 0;

  const stored = await getStoredState(fixtureId);

  const users = await getUsersForFixture({
    fixtureId,
    leagueId,
    homeTeamId,
    awayTeamId,
  });

  const disabledUsers = await getUsersWithFixtureDisabled(fixtureId);
  const finalUsers = users.filter((userId) => !disabledUsers.has(userId));

  let matchStartedNotified = stored?.match_started_notified ?? false;
  let halftimeNotified = stored?.halftime_notified ?? false;
  let secondHalfStartedNotified = stored?.second_half_started_notified ?? false;
  let matchFinishedNotified = stored?.match_finished_notified ?? false;

  if (!stored) {
    await upsertMatchState({
      fixtureId,
      leagueId,
      homeTeamId,
      awayTeamId,
      status,
      homeGoals,
      awayGoals,
      matchStartedNotified,
      halftimeNotified,
      secondHalfStartedNotified,
      matchFinishedNotified,
    });
    return;
  }

  if (!matchStartedNotified && isStartedStatus(status)) {
    for (const userId of finalUsers) {
      await createAppNotification({
        userId,
        sourceType: 'fixture',
        sourceId: fixtureId,
        fixtureId,
        eventType: 'match_started',
        title: `${homeTeamName} vs ${awayTeamName}`,
        message: `Le match a commencé.`,
        metadata: {
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
        },
      });
    }
    matchStartedNotified = true;
  }

  const scoreChanged =
    stored.last_home_goals !== homeGoals || stored.last_away_goals !== awayGoals;

  if (scoreChanged && (homeGoals > stored.last_home_goals || awayGoals > stored.last_away_goals)) {
    for (const userId of finalUsers) {
      await createAppNotification({
        userId,
        sourceType: 'fixture',
        sourceId: fixtureId,
        fixtureId,
        eventType: 'goal',
        title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
        message: `But dans le match.`,
        metadata: {
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
        },
      });
    }
  }

  if (!matchFinishedNotified && isFinishedStatus(status)) {
    for (const userId of finalUsers) {
      await createAppNotification({
        userId,
        sourceType: 'fixture',
        sourceId: fixtureId,
        fixtureId,
        eventType: 'match_finished',
        title: `${homeTeamName} ${homeGoals} - ${awayGoals} ${awayTeamName}`,
        message: `Le match est terminé.`,
        metadata: {
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
        },
      });
    }
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
    matchStartedNotified,
    halftimeNotified,
    secondHalfStartedNotified,
    matchFinishedNotified,
  });
}

exports.runNotificationEngine = async () => {
  const fixtures = await fetchLiveFixtures();

  for (const fixture of fixtures) {
    try {
      await handleFixture(fixture);
    } catch (err) {
      console.error('Notification engine fixture error:', err.message);
    }
  }

  return { success: true, processed: fixtures.length };
};