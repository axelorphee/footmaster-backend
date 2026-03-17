const axios = require('axios');

const CACHE_TTL = 1000 * 60 * 5;
const LIVE_CACHE_TTL = 1000 * 30;

const cache = new Map();

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

function groupFixturesByLeague(fixtures) {
  const grouped = {};

  for (const match of fixtures) {
    const league = match.league;
    const leagueId = league.id;

    if (!grouped[leagueId]) {
      grouped[leagueId] = {
        league: {
          id: league.id,
          name: league.name,
          country: league.country,
          logo: league.logo,
          season: league.season,
          type: league.type,
          standings: league.standings,
          flag: league.flag,
        },
        matches: [],
      };
    }

    grouped[leagueId].matches.push(match);
  }

  return Object.values(grouped);
}

function handleApiError(error) {
  if (error.response) {
    if (error.response.status === 429) {
      const err = new Error('API quota exceeded');
      err.statusCode = 503;
      throw err;
    }

    const err = new Error(`API Error: ${error.response.status}`);
    err.statusCode = error.response.status;
    throw err;
  }

  const err = new Error('External API unavailable');
  err.statusCode = 500;
  throw err;
}

exports.getMatchesByDate = async (date) => {
  const cacheKey = `matches_${date}`;
  const now = Date.now();

  if (cache.has(cacheKey)) {
    const cachedEntry = cache.get(cacheKey);

    if (now - cachedEntry.timestamp < CACHE_TTL) {
      console.log('Returning matches by date from cache');
      return cachedEntry.data;
    }

    cache.delete(cacheKey);
  }

  try {
    const response = await rapidApi.get('/fixtures', {
      params: { date },
    });

    const fixtures = response.data.response || [];
    const result = groupFixturesByLeague(fixtures);

    cache.set(cacheKey, {
      timestamp: now,
      data: result,
    });

    return result;
  } catch (error) {
    handleApiError(error);
  }
};

exports.getLiveMatches = async () => {
  const cacheKey = 'live_matches';
  const now = Date.now();

  if (cache.has(cacheKey)) {
    const cachedEntry = cache.get(cacheKey);

    if (now - cachedEntry.timestamp < LIVE_CACHE_TTL) {
      console.log('Returning live matches from cache');
      return cachedEntry.data;
    }

    cache.delete(cacheKey);
  }

  try {
    const response = await rapidApi.get('/fixtures', {
      params: { live: 'all' },
    });

    const fixtures = response.data.response || [];
    const result = groupFixturesByLeague(fixtures);

    cache.set(cacheKey, {
      timestamp: now,
      data: result,
    });

    return result;
  } catch (error) {
    handleApiError(error);
  }
};