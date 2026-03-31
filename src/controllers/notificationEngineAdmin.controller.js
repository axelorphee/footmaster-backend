const controlService = require('../services/notificationEngineControl.service');

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

    res.json({
      success: true,
      message: 'Notification engine globally enabled',
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.disableNotificationEngineControl = async (req, res, next) => {
  try {
    const data = await controlService.setNotificationEngineControl(false);

    res.json({
      success: true,
      message: 'Notification engine globally disabled',
      data,
    });
  } catch (err) {
    next(err);
  }
};