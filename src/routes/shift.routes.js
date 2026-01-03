const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const shiftController = require('../controllers/shift.controller');
const { verifyToken, requireRole, requireWriteAccess } = require('../middleware/auth.middleware');
const { checkShiftPermission, loadShift } = require('../middleware/shift.middleware'); // NEW
const { validateRequest } = require('../middleware/validation.middleware');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   POST /api/shifts
 * @desc    Create shift
 * @access  Admin, Super Admin, Dept Admin (own dept only)
 */
router.post(
    '/',
    requireWriteAccess,
    requireRole([ROLES.DEPT_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    checkShiftPermission, // NEW: Dept admins restricted to their dept
    [
        body('name').notEmpty().withMessage('Shift name is required'),
        body('departmentId').notEmpty().withMessage('Department ID is required'),
        body('startTime')
            .notEmpty().withMessage('Start time is required')
            .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid time format (HH:mm)'),
        body('endTime')
            .notEmpty().withMessage('End time is required')
            .matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Invalid time format (HH:mm)'),
    ],
    validateRequest,
    shiftController.create
);

/**
 * @route   GET /api/shifts
 * @desc    Get all shifts
 * @access  All authenticated users
 */
router.get('/', shiftController.getAll);

/**
 * @route   GET /api/shifts/calendar
 * @desc    Get shifts for calendar view with full employee details
 * @access  All authenticated users
 */
router.get('/calendar', shiftController.getCalendar);

/**
 * @route   GET /api/shifts/:id
 * @desc    Get shift by ID
 * @access  All authenticated users
 */
router.get('/:id', shiftController.getById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Update shift
 * @access  Admin, Super Admin, Dept Admin (own dept only)
 */
router.put(
    '/:id',
    requireWriteAccess,
    requireRole([ROLES.DEPT_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    loadShift, // NEW: Load shift first  
    checkShiftPermission, // NEW: Check permissions
    shiftController.update
);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Delete shift (soft delete)
 * @access  Admin, Super Admin, Dept Admin (own dept only)
 */
router.delete(
    '/:id',
    requireWriteAccess,
    requireRole([ROLES.DEPT_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    loadShift, // NEW: Load shift first
    checkShiftPermission, // NEW: Check permissions
    shiftController.delete
);

module.exports = router;
