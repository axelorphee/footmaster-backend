const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const accountController = require('../controllers/account.controller');

router.put('/update-profile', authMiddleware, accountController.updateProfile);
router.put('/update-password', authMiddleware, accountController.updatePassword);
router.put('/update-email', authMiddleware, accountController.updateEmail);
router.get('/confirm-email-change', accountController.confirmEmailChange);
router.post('/request-delete', authMiddleware, accountController.requestDeleteAccount);
router.get('/confirm-delete', accountController.confirmDeleteAccount);B

module.exports = router;