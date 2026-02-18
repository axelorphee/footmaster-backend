const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

exports.globalSearch = async (query) => {
  const [
    leaguesResp,
    teamsResp,
    playersResp
  ] = await Promise.all([
    rapidApi.get('/leagues', { params: { search: query } }),
    rapidApi.get('/teams', { params: { search: query } }),
    rapidApi.get('/players', { params: { search: query } }),
  ]);

  const leagues = leaguesResp.data.response || [];
  const teams = teamsResp.data.response || [];
  const players = playersResp.data.response || [];

  const results = [];

  for (const item of leagues) {
    results.push({
      type: 'competition',
      id: item.league?.id,
      name: item.league?.name,
      logo: item.league?.logo,
    });
  }

  for (const item of teams) {
    results.push({
      type: 'team',
      id: item.team?.id,
      name: item.team?.name,
      logo: item.team?.logo,
    });
  }

  for (const item of players) {
    results.push({
      type: 'player',
      id: item.player?.id,
      name: item.player?.name,
      photo: item.player?.photo,
    });
  }

  return results;
};
