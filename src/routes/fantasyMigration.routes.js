const express = require('express');
const router = express.Router();

const fantasyMigrationController = require('../controllers/fantasyMigration.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const requireVerified = require('../middlewares/verified.middleware');

router.post(
  '/tenants/:tenantId/migrate',
  authMiddleware,
  requireVerified,
  fantasyMigrationController.migrateTenantBundle
);

module.exports = router;