const cron = require('node-cron');
const pool = require('../config/database');

const startCleanupJob = () => {
  cron.schedule('*/15 * * * *', async () => {
    try {
      console.log('Running cleanup job...');

      await pool.query(`
        UPDATE users
        SET
          password_temp = NULL,
          password_change_token = NULL,
          password_change_expires = NULL
        WHERE password_change_expires IS NOT NULL
        AND password_change_expires < NOW()
      `);

      await pool.query(`
        UPDATE users
        SET
          email_temp = NULL,
          email_verification_token = NULL,
          email_verification_expires = NULL
        WHERE email_verification_expires IS NOT NULL
        AND email_verification_expires < NOW()
      `);

      await pool.query(`
        UPDATE users
        SET
          delete_account_token = NULL,
          delete_account_expires = NULL
        WHERE delete_account_expires IS NOT NULL
        AND delete_account_expires < NOW()
      `);

      console.log('Cleanup job completed.');
    } catch (err) {
      console.error('Cleanup job error:', err);
    }
  });
};

module.exports = startCleanupJob;