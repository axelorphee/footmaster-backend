const axios = require('axios');

const USE_MOCK = false;
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

const cache = new Map();

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

exports.getStandingsByLeagueAndSeason = async (league, season) => {
  const cacheKey = `standings_${league}_${season}`;
  const now = Date.now();

  // Cache check
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);

    if (now - cached.timestamp < CACHE_TTL) {
      console.log('Standings from cache');
      return cached.data;
    }

    cache.delete(cacheKey);
  }

  let result;

  if (USE_MOCK) {
    result = {
      league: {
        id: league,
        season: season,
      },
      standings: [
        {
          rank: 1,
          team: { name: 'Arsenal' },
          points: 60,
        },
        {
          rank: 2,
          team: { name: 'Chelsea' },
          points: 55,
        },
      ],
    };
  } else {
    try {
      const response = await rapidApi.get('/standings', {
        params: { league, season },
      });

      const raw = response.data.response;

      if (!raw.length) {
        const error = new Error('No standings found');
        error.statusCode = 404;
        throw error;
      }

      const standingsRaw = raw[0].league.standings.flat();


      result = {
        league: {
          id: raw[0].league.id,
          name: raw[0].league.name,
          season: raw[0].league.season,
        },
        standings: standingsRaw,
      };

    } catch (error) {
      if (error.response) {
        const err = new Error(`API Error: ${error.response.status}`);
        err.statusCode = error.response.status;
        throw err;
      }

      const err = new Error('External API unavailable');
      err.statusCode = 500;
      throw err;
    }
  }

  cache.set(cacheKey, {
    timestamp: now,
    data: result,
  });

  return result;
};

exports.getStandingsGroupedByLeagueAndSeason = async (league, season) => {
  const response = await rapidApi.get('/standings', {
    params: { league, season },
  });

  const raw = response.data.response;

  if (!raw.length) {
    const error = new Error('No standings found');
    error.statusCode = 404;
    throw error;
  }

  return {
    league: raw[0].league,
    standings: raw[0].league.standings, // ⚠️ PAS de flat
  };
};
