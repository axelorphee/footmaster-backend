const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

exports.getPredictions = async (fixture) => {
  const response = await rapidApi.get('/predictions', {
    params: { fixture },
  });

  return response.data.response[0] || null;
};
