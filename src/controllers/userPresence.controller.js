const service = require('../services/userPresence.service');

exports.heartbeat = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const data = await service.touchUserPresence(userId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};