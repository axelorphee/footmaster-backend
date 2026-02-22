const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const accountController = require('../controllers/account.controller');

router.put('/update-profile', authMiddleware, accountController.updateProfile);
router.put('/update-password', authMiddleware, accountController.updatePassword);
router.put('/update-email', authMiddleware, accountController.updateEmail);
router.get('/confirm-email-change', accountController.confirmEmailChange);

module.exports = router;