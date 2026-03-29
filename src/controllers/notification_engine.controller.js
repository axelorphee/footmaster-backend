const notificationEngineService = require('../services/notification_engine.service');

exports.runNotificationEngine = async (req, res, next) => {
  try {
    const data = await notificationEngineService.runNotificationEngine();

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};