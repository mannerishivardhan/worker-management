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
 * @returns Access token (15 min) + Refresh token (30 days with sliding window)
 */
router.post(
    '/login',
    // authLimiter, // Temporarily disabled for testing
    [
        body('email')
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format'),

        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),

        body('deviceId')
            .optional()
            .isString().withMessage('Device ID must be a string'),
    ],
    validateRequest,
    authController.login
);

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token using refresh token
 * @access  Public
 * @note    Sliding Window: Returns NEW refresh token (30 days from now)
 */
router.post(
    '/refresh',
    authLimiter,
    [
        body('refreshToken')
            .notEmpty().withMessage('Refresh token is required')
            .isString().withMessage('Refresh token must be a string'),

        body('deviceId')
            .optional()
            .isString().withMessage('Device ID must be a string'),
    ],
    validateRequest,
    authController.refresh
);

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user - invalidate refresh token
 * @access  Private
 */
router.post(
    '/logout',
    verifyToken,
    [
        body('refreshToken')
            .notEmpty().withMessage('Refresh token is required')
            .isString().withMessage('Refresh token must be a string'),
    ],
    validateRequest,
    authController.logout
);

/**
 * @route   POST /api/auth/logout-all
 * @desc    Logout from all devices - revoke all refresh tokens
 * @access  Private
 */
router.post(
    '/logout-all',
    verifyToken,
    authController.logoutAll
);

/**
 * @route   GET /api/auth/verify
 * @desc    Verify current user
 * @access  Private
 */
router.get('/verify', verifyToken, authController.verifyUser);

module.exports = router;
