const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

// 🔹 GET ALL LEAGUES GROUPED BY CONTINENT
exports.getLeaguesGrouped = async () => {
  const resp = await rapidApi.get('/leagues');
  const leagues = resp.data.response || [];

  const grouped = {};

  for (const item of leagues) {
    const continent = item.country?.continent || 'Other';

    const league = {
      id: item.league?.id,
      name: item.league?.name,
      logo: item.league?.logo,
      type: item.league?.type,
      country: item.country?.name,
      code: item.country?.code,
      continent,
    };

    if (!grouped[continent]) grouped[continent] = [];
    grouped[continent].push(league);
  }

  return grouped;
};

// 🔹 SEARCH LEAGUES
exports.searchLeagues = async (query) => {
  const resp = await rapidApi.get('/leagues', {
    params: { search: query }
  });

  const data = resp.data.response || [];

  return data.map(item => ({
    id: item.league?.id,
    name: item.league?.name,
    logo: item.league?.logo,
    country: item.country?.name,
    type: item.league?.type,
  }));
};

exports.getLeagueDetails = async (leagueId) => {
  const resp = await rapidApi.get('/leagues', {
    params: { id: leagueId }
  });

  return resp.data.response[0] || null;
};

exports.getLeagueFixtures = async (leagueId, season) => {
  const resp = await rapidApi.get('/fixtures', {
    params: { league: leagueId, season }
  });

  return resp.data.response || [];
};

exports.getLeagueStandings = async (leagueId, season) => {
  const resp = await rapidApi.get('/standings', {
    params: { league: leagueId, season }
  });

  return resp.data.response || [];
};


exports.getTeamsByLeagueAndSeason = async (
  leagueId,
  season
) => {
  const resp = await rapidApi.get('/teams', {
    params: {
      league: leagueId,
      season: season,
    },
  });

  return resp.data.response || [];
};


exports.getLeagueStatistics = async (leagueId, season) => {
  const [
    topScorersResp,
    topAssistsResp,
    topYellowResp,
    topRedResp,
    standingsResp
  ] = await Promise.all([
    rapidApi.get('/players/topscorers', { params: { league: leagueId, season } }),
    rapidApi.get('/players/topassists', { params: { league: leagueId, season } }),
    rapidApi.get('/players/topyellowcards', { params: { league: leagueId, season } }),
    rapidApi.get('/players/topredcards', { params: { league: leagueId, season } }),
    rapidApi.get('/standings', { params: { league: leagueId, season } }),
  ]);

  const topScorers = topScorersResp.data.response || [];
  const topAssists = topAssistsResp.data.response || [];
  const topYellow = topYellowResp.data.response || [];
  const topRed = topRedResp.data.response || [];

  let allTeams = [];

  const standingsData = standingsResp.data.response || [];

  if (standingsData.length) {
    const standingsRaw = standingsData[0]?.league?.standings;

    if (Array.isArray(standingsRaw)) {
      for (const group of standingsRaw) {
        if (Array.isArray(group)) {
          allTeams.push(...group);
        }
      }
    }
  }

  return {
    top_scorers: topScorers,
    top_assists: topAssists,
    most_yellowcards: topYellow,
    most_redcards: topRed,
    standings: allTeams,
  };
};

