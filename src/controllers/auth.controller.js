const authService = require('../services/auth.service');

exports.register = async (req, res, next) => {
  try {
    const { email, password, username, admin_code } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({
        success: false,
        message: 'Email, password and username are required',
      });
    }

    const result = await authService.register(
      email,
      password,
      username,
      admin_code || null
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const result = await authService.login(email, password);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    const result = await authService.verifyEmail(token);

    res.status(200).json({
      success: true,
      message: result,
    });
  } catch (err) {
    next(err);
  }
};

exports.claimAppAdmin = async (req, res, next) => {
  try {
    const { email, password, admin_code } = req.body;

    if (!email || !password || !admin_code) {
      return res.status(400).json({
        success: false,
        message: 'Email, password and admin_code are required',
      });
    }

    const user = await authService.claimAppAdmin(
      email,
      password,
      admin_code
    );

    res.status(200).json({
      success: true,
      message: 'App admin granted successfully',
      data: user,
    });
  } catch (err) {
    next(err);
  }
};