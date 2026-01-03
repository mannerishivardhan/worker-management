const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const employeeController = require('../controllers/employee.controller');
const { verifyToken, requireRole, requireWriteAccess } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   POST /api/employees
 * @desc    Create employee
 * @access  Admin, Super Admin
 */
router.post(
    '/',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    [
        body('firstName').notEmpty().withMessage('First name is required'),
        body('lastName').notEmpty().withMessage('Last name is required'),

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
        body('role')
            .notEmpty().withMessage('Role is required')
            .isIn([ROLES.ADMIN, ROLES.EMPLOYEE]).withMessage('Invalid role'),
        body('departmentId').notEmpty().withMessage('Department ID is required'),
        body('monthlySalary')
            .notEmpty().withMessage('Monthly salary is required')
            .isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
        body('joiningDate')
            .optional()
            .isISO8601().withMessage('Invalid date format (use YYYY-MM-DD)'),
    ],
    validateRequest,
    employeeController.create
);

/**
 * @route   GET /api/employees
 * @desc    Get all employees
 * @access  All authenticated users (filtered by role)
 */
router.get('/', employeeController.getAll);

/**
 * @route   GET /api/employees/:id
 * @desc    Get employee by ID
 * @access  All authenticated users
 */
router.get('/:id', employeeController.getById);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee
 * @access  Admin, Super Admin
 */
router.put(
    '/:id',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    employeeController.update
);

/**
 * @route   POST /api/employees/:id/transfer
 * @desc    Transfer employee to another department
 * @access  Admin, Super Admin
 */
router.post(
    '/:id/transfer',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    [
        body('toDepartmentId').notEmpty().withMessage('Target department ID is required'),
    ],
    validateRequest,
    employeeController.transfer
);

/**
 * @route   POST /api/employees/:id/deactivate
 * @desc    Deactivate employee
 * @access  Admin, Super Admin
 */
router.post(
    '/:id/deactivate',
    requireWriteAccess,
    requireRole([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
    employeeController.deactivate
);

/**
 * @route   GET /api/employees/:id/history
 * @desc    Get employee change history
 * @access  All authenticated users
 */
router.get('/:id/history', employeeController.getHistory);

module.exports = router;
