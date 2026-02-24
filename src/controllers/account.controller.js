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

exports.updateEmail = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { newEmail, currentPassword } = req.body;

    await accountService.updateEmail(
      userId,
      newEmail,
      currentPassword
    );

    res.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (err) {
    next(err);
  }
};

exports.confirmEmailChange = async (req, res, next) => {
  try {
    const { token } = req.query;

    await accountService.confirmEmailChange(token);

    res.json({
      success: true,
      message: 'Email updated successfully',
    });
  } catch (err) {
    next(err);
  }
};

exports.requestDeleteAccount = async (req, res, next) => {
  try {
    const userId = req.user.id;

    await accountService.requestDeleteAccount(userId);

    res.json({
      success: true,
      message: 'Confirmation email sent',
    });
  } catch (err) {
    next(err);
  }
};

exports.confirmDeleteAccount = async (req, res, next) => {
  try {
    const { token } = req.query;

    await accountService.confirmDeleteAccount(token);

    res.json({
      success: true,
      message: 'Account deleted successfully',
    });
  } catch (err) {
    next(err);
  }
};