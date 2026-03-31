module.exports = (req, res, next) => {
  if (!req.user || req.user.is_app_admin !== true) {
    return res.status(403).json({
      success: false,
      message: 'App admin access required',
    });
  }

  if (req.user.email_verified !== true) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
    });
  }

  next();
};