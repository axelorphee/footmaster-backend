const searchService = require('../services/search.service');

exports.globalSearch = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.json([]);
    }

    const data = await searchService.globalSearch(q.trim());
    res.json(data);
  } catch (err) {
    next(err);
  }
};
