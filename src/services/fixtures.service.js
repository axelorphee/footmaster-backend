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

  const data = response.data.response;

  if (!data || !data.length) {
    throw new Error('Fixture not found');
  }

  return data[0]; // 🔥 on renvoie direct le bon objet
};


exports.getHeadToHead = async (h2h, last = 5) => {
  const response = await rapidApi.get('/fixtures/headtohead', {
    params: { h2h, last },
  });

  return response.data.response || [];
};

