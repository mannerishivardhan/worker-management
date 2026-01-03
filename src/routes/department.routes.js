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
 * @route   POST /api/departments/:id/deactivate
 * @desc    Deactivate department (soft delete)
 * @access  Admin, Super Admin
 */
router.post(
    '/:id/deactivate',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    departmentController.deactivate
);

module.exports = router;
