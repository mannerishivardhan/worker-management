const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { authLimiter } = require('../middleware/rateLimiter.middleware');

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 * @note    Phone/OTP auth is commented for future use
 */
router.post(
    '/login',
    authLimiter,
    [
        // Current: Email authentication
        body('email')
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format'),

        // PHONE AUTH (COMMENTED FOR FUTURE USE):
        // body('phone')
        //   .notEmpty().withMessage('Phone number is required')
        //   .matches(/^\+[1-9]\d{1,14}$/).withMessage('Invalid phone number format'),

        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    ],
    validateRequest,
    authController.login
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify current user
 * @access  Private
 */
router.get('/verify', verifyToken, authController.verifyUser);

module.exports = router;
