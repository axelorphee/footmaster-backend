const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

exports.getFixtureById = async (id) => {
  const response = await rapidApi.get('/fixtures', {
    params: { id },
  });

  return response.data;
};

exports.getHeadToHead = async (h2h, last = 5) => {
  const response = await rapidApi.get('/fixtures/headtohead', {
    params: { h2h, last },
  });

  return response.data;
};
