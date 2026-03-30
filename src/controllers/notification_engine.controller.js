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

exports.startNotificationEngine = async (req, res, next) => {
  try {
    const data = await notificationEngineService.startNotificationEngine();

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.stopNotificationEngine = async (req, res, next) => {
  try {
    const data = await notificationEngineService.stopNotificationEngine();

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.getNotificationEngineStatus = async (req, res, next) => {
  try {
    const data = await notificationEngineService.getNotificationEngineStatus();

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};