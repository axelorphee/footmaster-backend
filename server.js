require('dotenv').config();
require('./src/config/database');

const app = require('./src/app');
const notificationEngineControlService = require('./src/services/notificationEngineControl.service');
const notificationEngineService = require('./src/services/notification_engine.service');

const PORT = process.env.PORT || 5000;

async function boot() {
  const server = app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
  });

  try {
    const control =
      await notificationEngineControlService.getNotificationEngineControl();

    if (control.enabled === true) {
      await notificationEngineService.startNotificationEngine();
      console.log('Notification engine auto-started from global control');
    } else {
      console.log('Notification engine global control is disabled');
    }
  } catch (err) {
    console.error('Notification engine boot check error:', err.message);
  }

  return server;
}

boot();