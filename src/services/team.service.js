const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

// 🔹 TEAM OVERVIEW (InfoTab)
exports.getTeamOverview = async (teamId) => {
  const [infoResp, lastResp, nextResp, leaguesResp] = await Promise.all([
    rapidApi.get('/teams', { params: { id: teamId } }),
    rapidApi.get('/fixtures', { params: { team: teamId, last: 1 } }),
    rapidApi.get('/fixtures', { params: { team: teamId, next: 1 } }),
    rapidApi.get('/leagues', { params: { team: teamId } }),
  ]);

  const info = infoResp.data.response[0];

  return {
    team: info.team,
    venue: info.venue,
    lastMatch: lastResp.data.response[0] || null,
    nextMatch: nextResp.data.response[0] || null,
    competitions: leaguesResp.data.response.map(item => ({
      id: item.league.id,
      name: item.league.name,
      logo: item.league.logo,
    })),
  };
};

// 🔹 MATCHES (MatchsTab)
exports.getTeamMatches = async (teamId, type, limit = 10) => {
  const params = {
    team: teamId,
  };

  if (type === 'next') {
    params.next = limit;
  } else {
    params.last = limit;
  }

  const response = await rapidApi.get('/fixtures', { params });

  return response.data.response || [];
};

// 🔹 SQUAD + COACH
exports.getSquadAndCoach = async (teamId) => {
  const [squadResp, coachResp] = await Promise.all([
    rapidApi.get('/players/squads', { params: { team: teamId } }),
    rapidApi.get('/coachs', { params: { team: teamId } }),
  ]);

  const squad = squadResp.data.response[0]?.players || [];
  const coaches = coachResp.data.response || [];

  let currentCoach = null;

  for (const coach of coaches) {
    const career = coach.career || [];

    const isCurrent = career.some(
      (entry) =>
        entry.team &&
        entry.team.id === parseInt(teamId) &&
        entry.end === null
    );

    if (isCurrent) {
      currentCoach = coach;
      break;
    }
  }

  return {
    players: squad,
    coach: currentCoach,
  };
};

exports.getTeamStandingsOverview = async (teamId, season) => {
  const fixturesResp = await rapidApi.get('/fixtures', {
    params: { team: teamId, season },
  });

  const fixtures = fixturesResp.data.response || [];

  const leaguesMap = {};

  for (const match of fixtures) {
    const league = match.league;
    if (!league) continue;

    if (!leaguesMap[league.id]) {
      leaguesMap[league.id] = {
        id: league.id,
        name: league.name,
        logo: league.logo,
      };
    }
  }

  const competitions = Object.values(leaguesMap);

  const result = [];

  for (const comp of competitions) {
    try {
      const standingsResp = await rapidApi.get('/standings', {
        params: { league: comp.id, season },
      });

      if (
        standingsResp.data.response &&
        standingsResp.data.response.length &&
        standingsResp.data.response[0].league.standings
      ) {
        result.push(comp);
      }
    } catch (err) {
      // ignore silently
    }
  }

  return result;
};
