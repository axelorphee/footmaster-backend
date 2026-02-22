const accountService = require('../services/account.service');

exports.updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { username } = req.body;

    const updatedUser = await accountService.updateProfile(userId, username);

    res.json({
      success: true,
      data: updatedUser,
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    await accountService.updatePassword(userId, currentPassword, newPassword);

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (err) {
    next(err);
  }
};