const service = require('../services/notification.service');

exports.getSubscriptions = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const data = await service.getSubscriptions(userId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.enableSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { source_type, source_id } = req.body;

    const data = await service.upsertSubscription({
      userId,
      sourceType: source_type,
      sourceId: source_id,
    });

    res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.disableSubscription = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { type, id } = req.params;

    await service.disableSubscription({
      userId,
      sourceType: type,
      sourceId: id,
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getAppNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const data = await service.getAppNotifications(userId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.markAppNotificationRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { notificationId } = req.params;

    const data = await service.markAppNotificationRead({
      notificationId,
      userId,
    });

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.getMatchOverrides = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const data = await service.getMatchOverrides(userId);

    res.json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.enableMatchOverride = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fixture_id } = req.body;

    const data = await service.upsertMatchOverride({
      userId,
      fixtureId: fixture_id,
    });

    res.status(201).json({
      success: true,
      data,
    });
  } catch (err) {
    next(err);
  }
};

exports.disableMatchOverride = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { fixtureId } = req.params;

    await service.disableMatchOverride({
      userId,
      fixtureId,
    });

    res.json({
      success: true,
    });
  } catch (err) {
    next(err);
  }
};