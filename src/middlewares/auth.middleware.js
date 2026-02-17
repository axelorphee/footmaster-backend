const admin = require('../config/firebase');


module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Authorization token required');
      error.statusCode = 401;
      throw error;
    }

    const idToken = authHeader.split('Bearer ')[1];

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    req.user = decodedToken;

    next();
  } catch (error) {
    const err = new Error('Invalid or expired token');
    err.statusCode = 401;
    next(err);
  }
};
