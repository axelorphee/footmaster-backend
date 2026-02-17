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

exports.getMatchesByDate = async (date) => {
  const cacheKey = `matches_${date}`;
  const now = Date.now();

  // ✅ Check cache
  if (cache.has(cacheKey)) {
    const cachedEntry = cache.get(cacheKey);

    if (now - cachedEntry.timestamp < CACHE_TTL) {
      console.log('Returning from cache');
      return cachedEntry.data;
    }

    cache.delete(cacheKey);
  }

  let result;

  if (USE_MOCK) {
    result = [
      {
        league: {
          id: 39,
          name: 'Premier League',
          country: 'England',
          logo: null,
        },
        matches: [
          {
            fixture: { id: 12345 },
            teams: {
              home: { name: 'Arsenal' },
              away: { name: 'Chelsea' },
            },
          },
        ],
      },
    ];
  } else {
    try {
      const response = await rapidApi.get('/fixtures', {
        params: { date },
      });

      const fixtures = response.data.response;
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
            },
            matches: [],
          };
        }

        grouped[leagueId].matches.push(match);
      }

      result = Object.values(grouped);

    } catch (error) {
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
  }

  // ✅ Store in cache
  cache.set(cacheKey, {
    timestamp: now,
    data: result,
  });

  return result;
};
