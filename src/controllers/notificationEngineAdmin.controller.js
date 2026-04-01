const controlService = require('../services/notificationEngineControl.service');
const notificationEngineService = require('../services/notification_engine.service');

exports.getNotificationEngineControl = async (req, res, next) => {
  try {
    const data = await controlService.getNotificationEngineControl();

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.enableNotificationEngineControl = async (req, res, next) => {
  try {
    const data = await controlService.setNotificationEngineControl(true);
    const engine = await notificationEngineService.startNotificationEngine();

    res.json({
      success: true,
      message: 'Notification engine globally enabled',
      data: {
        control: data,
        engine,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.disableNotificationEngineControl = async (req, res, next) => {
  try {
    const data = await controlService.setNotificationEngineControl(false);
    const engine = await notificationEngineService.stopNotificationEngine();

    res.json({
      success: true,
      message: 'Notification engine globally disabled',
      data: {
        control: data,
        engine,
      },
    });
  } catch (err) {
    next(err);
  }
};