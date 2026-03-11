const admin = require('firebase-admin');

let app;

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    const serviceAccount = require('./firebase-service-account.json');

    app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
} else {
  app = admin.app();
}

module.exports = admin;