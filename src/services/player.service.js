const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

// 🔹 PLAYER INFO
exports.getPlayerInfo = async (playerId) => {
  const currentSeason = new Date().getFullYear();

  const trySeason = async (season) => {
    const resp = await rapidApi.get('/players', {
      params: { id: playerId, season }
    });

    return resp.data.response || [];
  };

  let data = await trySeason(currentSeason);

  if (!data.length) {
    data = await trySeason(currentSeason - 1);
  }

  if (!data.length) return null;

  return data[0];
};

// 🔹 SEASONS
exports.getPlayerSeasons = async (playerId) => {
  const resp = await rapidApi.get('/players/seasons', {
    params: { player: playerId }
  });

  const seasons = resp.data.response || [];

  return seasons
    .map(s => parseInt(s))
    .sort((a, b) => b - a);
};

// 🔹 STATS
exports.getPlayerStats = async (playerId, season) => {
  const resp = await rapidApi.get('/players', {
    params: { id: playerId, season }
  });

  const data = resp.data.response || [];

  if (!data.length) return [];

  return data[0].statistics || [];
};

// 🔹 MATCHES
exports.getPlayerMatches = async (playerId, season) => {
  const playerResp = await rapidApi.get('/players', {
    params: { id: playerId, season }
  });

  const data = playerResp.data.response || [];
  if (!data.length) return [];

  const statistics = data[0].statistics || [];

  const teamIds = [...new Set(
    statistics
      .map(s => s.team?.id)
      .filter(Boolean)
  )];

  const seenFixtures = new Set();
  const matches = [];

  for (const teamId of teamIds) {
    const fixturesResp = await rapidApi.get('/fixtures', {
      params: { team: teamId, season }
    });

    const fixtures = fixturesResp.data.response || [];

    for (const fx of fixtures) {
      const fixtureId = fx.fixture?.id;
      if (!fixtureId || seenFixtures.has(fixtureId)) continue;

      seenFixtures.add(fixtureId);

      matches.push({
        fixtureId,
        date: fx.fixture?.date,
        teams: fx.teams,
        homeLogo: fx.teams?.home?.logo,
        awayLogo: fx.teams?.away?.logo,
        scoreHome: fx.goals?.home,
        scoreAway: fx.goals?.away,
      });
    }
  }

  matches.sort((a, b) =>
    new Date(b.date || 0) - new Date(a.date || 0)
  );

  return matches;
};

exports.getPlayerTransfers = async (playerId) => {
  const resp = await rapidApi.get('/transfers', {
    params: { player: playerId }
  });

  const data = resp.data.response || [];

  if (!data.length) return [];

  return data[0].transfers || [];
};



exports.getPlayerTrophies = async (playerId) => {
  const resp = await rapidApi.get('/trophies', {
    params: { player: playerId }
  });

  return resp.data.response || [];
};

// 🔹 LIST PLAYERS (pagination)
exports.getPlayers = async (page = 1, season = 2026) => {
  const resp = await rapidApi.get('/players', {
    params: { page, season }
  });

  return resp.data.response || [];
};

// 🔹 SEARCH PLAYERS
exports.searchPlayers = async (query, page = 1) => {
  const resp = await rapidApi.get('/players/profiles', {
    params: { search: query, page }
  });

  return resp.data.response || [];
};
