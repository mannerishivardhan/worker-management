const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const departmentController = require('../controllers/department.controller');
const { verifyToken, requireRole, requireWriteAccess } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   POST /api/departments
 * @desc    Create department
 * @access  Admin, Super Admin
 */
router.post(
    '/',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    [
        body('name').notEmpty().withMessage('Department name is required'),
        body('hasShifts').isBoolean().withMessage('hasShifts must be a boolean'),
    ],
    validateRequest,
    departmentController.create
);

/**
 * @route   GET /api/departments
 * @desc    Get all departments
 * @access  All authenticated users
 */
router.get('/', departmentController.getAll);

/**
 * @route   GET /api/departments/:id
 * @desc    Get department by ID
 * @access  All authenticated users
 */
router.get('/:id', departmentController.getById);

/**
 * @route   PUT /api/departments/:id
 * @desc    Update department
 * @access  Admin, Super Admin
 */
router.put(
    '/:id',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    departmentController.update
);

/**
 * @route   DELETE /api/departments/:id
 * @desc    Delete department (hard delete)
 * @access  Admin, Super Admin
 */
router.delete(
    '/:id',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    departmentController.delete
);

/**
 * @route   PUT /api/departments/:id/deactivate
 * @desc    Deactivate department (with reason)
 * @access  Admin, Super Admin
 */
router.put(
    '/:id/deactivate',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    [
        body('reason').notEmpty().withMessage('Deactivation reason is required')
    ],
    validateRequest,
    departmentController.deactivate
);

/**
 * @route   PUT /api/departments/:id/activate
 * @desc    Activate department
 * @access  Admin, Super Admin
 */
router.put(
    '/:id/activate',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    departmentController.activate
);

/**
 * @route   PUT /api/departments/:id/head
 * @desc    Assign department head
 * @access  Admin, Super Admin
 */
router.put(
    '/:id/head',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    [
        body('employeeId').notEmpty().withMessage('Employee ID is required')
    ],
    validateRequest,
    departmentController.assignHead
);

/**
 * @route   DELETE /api/departments/:id/head
 * @desc    Remove department head
 * @access  Admin, Super Admin
 */
router.delete(
    '/:id/head',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    departmentController.removeHead
);

/**
 * @route   GET /api/departments/:id/history
 * @desc    Get department history
 * @access  Admin, Super Admin
 */
router.get(
    '/:id/history',
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    departmentController.getHistory
);

module.exports = router;
