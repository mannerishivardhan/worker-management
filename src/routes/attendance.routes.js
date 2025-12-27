const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const attendanceController = require('../controllers/attendance.controller');
const { verifyToken, requireRole, requireWriteAccess } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   POST /api/attendance/entry
 * @desc    Mark entry (check-in)
 * @access  Admin, Super Admin
 */
router.post(
    '/entry',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('entryTime').notEmpty().withMessage('Entry time is required').isISO8601().withMessage('Invalid date format'),
    ],
    validateRequest,
    attendanceController.markEntry
);

/**
 * @route   POST /api/attendance/exit
 * @desc    Mark exit (check-out)
 * @access  Admin, Super Admin
 */
router.post(
    '/exit',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    [
        body('userId').notEmpty().withMessage('User ID is required'),
        body('exitTime').notEmpty().withMessage('Exit time is required').isISO8601().withMessage('Invalid date format'),
    ],
    validateRequest,
    attendanceController.markExit
);

/**
 * @route   POST /api/attendance/:id/correct
 * @desc    Correct attendance record
 * @access  Admin, Super Admin
 */
router.post(
    '/:id/correct',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    attendanceController.correctAttendance
);

/**
 * @route   GET /api/attendance
 * @desc    Get attendance records
 * @access  Admin, Super Admin, Tenant
 */
router.get(
    '/',
    requireRole([ROLES.TENANT, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
    attendanceController.getAttendance
);

/**
 * @route   GET /api/attendance/my
 * @desc    Get my attendance (for employees)
 * @access  All authenticated users
 */
router.get('/my', attendanceController.getMyAttendance);

module.exports = router;
