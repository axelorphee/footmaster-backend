const fantasyMigrationService = require('../services/fantasyMigration.service');

exports.migrateTenantBundle = async (req, res, next) => {
  try {
    const { tenantId } = req.params;

    const result = await fantasyMigrationService.migrateTenantBundle(tenantId);

    res.json({
      success: true,
      data: result,
      message: 'Fantasy tenant bundle migrated successfully',
    });
  } catch (err) {
    next(err);
  }
};