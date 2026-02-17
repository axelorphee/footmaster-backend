const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

exports.getLastFixturesByTeam = async (team, limit = 5) => {
  const response = await rapidApi.get('/fixtures', {
    params: {
      team,
      last: limit,
    },
  });

  return response.data.response || [];
};
