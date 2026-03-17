const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

async function getFixtureDetails(fixtureId) {
  const response = await rapidApi.get('/fixtures', {
    params: { id: fixtureId },
  });

  const data = response.data.response;

  if (!data || !data.length) {
    throw new Error('Fixture not found');
  }

  return data[0];
}

async function getHeadToHead(homeTeamId, awayTeamId, limit = 5) {
  const h2h = `${homeTeamId}-${awayTeamId}`;

  const response = await rapidApi.get('/fixtures/headtohead', {
    params: { h2h, last: limit },
  });

  return response.data.response || [];
}

async function getFixtureInjuries(fixtureId) {
  const response = await rapidApi.get('/injuries', {
    params: { fixture: fixtureId },
  });

  return response.data.response || [];
}

async function getPrematchData(fixtureId) {
  const fixture = await getFixtureDetails(fixtureId);

  const homeTeamId = fixture.teams.home.id;
  const awayTeamId = fixture.teams.away.id;

  const matchDate = new Date(fixture.fixture.date);

  const [homeLastRaw, awayLastRaw, h2hRaw, injuriesRaw] = await Promise.all([
    rapidApi.get('/fixtures', {
      params: { team: homeTeamId, last: 10 },
    }),
    rapidApi.get('/fixtures', {
      params: { team: awayTeamId, last: 10 },
    }),
    rapidApi.get('/fixtures/headtohead', {
      params: { h2h: `${homeTeamId}-${awayTeamId}`, last: 10 },
    }),
    rapidApi.get('/injuries', {
      params: { fixture: fixtureId },
    }),
  ]);

  const homeLast = homeLastRaw.data.response || [];
  const awayLast = awayLastRaw.data.response || [];
  const headToHead = h2hRaw.data.response || [];
  const injuries = injuriesRaw.data.response || [];

  function filterMatches(matches) {
    return matches
      .filter((m) => {
        const date = new Date(m.fixture.date);
        return m.fixture.id !== fixtureId && date < matchDate;
      })
      .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
      .slice(0, 5);
  }

  return {
    fixture,
    homeLast: filterMatches(homeLast),
    awayLast: filterMatches(awayLast),
    headToHead: filterMatches(headToHead),
    injuries,
  };
}

async function getLineups(fixtureId) {
  const response = await rapidApi.get('/fixtures/lineups', {
    params: { fixture: fixtureId },
  });

  return response.data.response || [];
}

async function getMatchEventsAndStats(fixtureId) {
  const [eventsResp, statsResp] = await Promise.all([
    rapidApi.get('/fixtures/events', {
      params: { fixture: fixtureId },
    }),
    rapidApi.get('/fixtures/statistics', {
      params: { fixture: fixtureId },
    }),
  ]);

  return {
    events: eventsResp.data.response || [],
    statistics: statsResp.data.response || [],
  };
}

module.exports = {
  getFixtureDetails,
  getHeadToHead,
  getFixtureInjuries,
  getPrematchData,
  getLineups,
  getMatchEventsAndStats,
};