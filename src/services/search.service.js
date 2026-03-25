const axios = require('axios');

const rapidApi = axios.create({
  baseURL: 'https://api-football-v1.p.rapidapi.com/v3',
  headers: {
    'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
    'X-RapidAPI-Host': process.env.RAPIDAPI_HOST,
  },
});

function normalizeText(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueArray(values) {
  return [...new Set(values.filter(Boolean))];
}

function buildQueryVariants(query) {
  const normalized = normalizeText(query);
  if (!normalized || normalized.length < 3) return [];

  const words = normalized.split(' ').filter(Boolean);
  const variants = [];

  variants.push(normalized);

  if (words.length >= 2) {
    variants.push(words.join(' '));
    variants.push(words.slice(0, 2).join(' '));
  }

  if (words.length >= 3) {
    variants.push(words.slice(0, 3).join(' '));
  }

  if (words.length >= 1 && words[0].length >= 3) {
    variants.push(words[0]);
  }

  return uniqueArray(variants).slice(0, 3);
}

function levenshtein(a, b) {
  const s = normalizeText(a);
  const t = normalizeText(b);

  const m = s.length;
  const n = t.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

function similarityScore(name, query) {
  const n = normalizeText(name);
  const q = normalizeText(query);

  if (!n || !q) return 0;
  if (n === q) return 1000;
  if (n.startsWith(q)) return 900;
  if (n.includes(q)) return 750;

  const qWords = q.split(' ').filter(Boolean);
  const nWords = n.split(' ').filter(Boolean);

  let score = 0;

  for (const word of qWords) {
    if (nWords.includes(word)) {
      score += 120;
    } else if (n.includes(word)) {
      score += 70;
    }
  }

  const joinedName = n.replace(/\s/g, '');
  const joinedQuery = q.replace(/\s/g, '');

  if (joinedName === joinedQuery) {
    score += 250;
  } else if (joinedName.includes(joinedQuery)) {
    score += 120;
  }

  const dist = levenshtein(n, q);
  const maxLen = Math.max(n.length, q.length);

  if (maxLen > 0) {
    const ratio = 1 - dist / maxLen;
    score += Math.max(0, ratio * 200);
  }

  return Math.round(score);
}

function dedupeResults(results) {
  const map = new Map();

  for (const item of results) {
    const key = `${item.type}_${item.id}`;
    const existing = map.get(key);

    if (!existing || item._score > existing._score) {
      map.set(key, item);
    }
  }

  return [...map.values()];
}

function sortResults(results, originalQuery) {
  return results.sort((a, b) => {
    if (b._score !== a._score) {
      return b._score - a._score;
    }

    const aName = normalizeText(a.name);
    const bName = normalizeText(b.name);
    const q = normalizeText(originalQuery);

    const aStarts = aName.startsWith(q) ? 1 : 0;
    const bStarts = bName.startsWith(q) ? 1 : 0;

    if (bStarts !== aStarts) {
      return bStarts - aStarts;
    }

    return aName.localeCompare(bName);
  });
}

async function searchVariant(query) {
  const [leaguesResp, teamsResp, playersResp] = await Promise.all([
    rapidApi.get('/leagues', { params: { search: query } }),
    rapidApi.get('/teams', { params: { search: query } }),
    rapidApi.get('/players/profiles', { params: { search: query, page: 1 } }),
  ]);

  const leagues = leaguesResp.data.response || [];
  const teams = teamsResp.data.response || [];
  const players = playersResp.data.response || [];

  const results = [];

  for (const item of leagues) {
    const name = item.league?.name || '';
    results.push({
      type: 'competition',
      id: item.league?.id,
      name,
      logo: item.league?.logo,
      _score: similarityScore(name, query),
    });
  }

  for (const item of teams) {
    const name = item.team?.name || '';
    results.push({
      type: 'team',
      id: item.team?.id,
      name,
      logo: item.team?.logo,
      _score: similarityScore(name, query),
    });
  }

  for (const item of players) {
    const name = item.player?.name || '';
    results.push({
      type: 'player',
      id: item.player?.id,
      name,
      photo: item.player?.photo,
      _score: similarityScore(name, query),
    });
  }

  return results;
}

exports.globalSearch = async (query) => {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery || normalizedQuery.length < 3) {
    return [];
  }

  const variants = buildQueryVariants(normalizedQuery);
  const allResultsNested = await Promise.all(
    variants.map((variant) => searchVariant(variant))
  );

  const allResults = allResultsNested.flat();
  const deduped = dedupeResults(allResults);
  const sorted = sortResults(deduped, normalizedQuery);

  return sorted
    .filter((item) => item._score >= 80)
    .slice(0, 40)
    .map(({ _score, ...rest }) => rest);
};