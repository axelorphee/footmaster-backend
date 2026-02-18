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
