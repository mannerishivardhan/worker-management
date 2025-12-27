const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const shiftController = require('../controllers/shift.controller');
const { verifyToken, requireRole, requireWriteAccess } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   POST /api/shifts
 * @desc    Create shift
 * @access  Admin, Super Admin
 */
router.post(
    '/',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
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
 * @route   GET /api/shifts/:id
 * @desc    Get shift by ID
 * @access  All authenticated users
 */
router.get('/:id', shiftController.getById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    Update shift
 * @access  Admin, Super Admin
 */
router.put(
    '/:id',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    shiftController.update
);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    Delete shift (soft delete)
 * @access  Admin, Super Admin
 */
router.delete(
    '/:id',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    shiftController.delete
);

module.exports = router;
