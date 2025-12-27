const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salary.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(verifyToken);

/**
 * @route   GET /api/salary/calculate/:id
 * @desc    Calculate salary for specific employee
 * @access  Admin, Super Admin, Tenant
 * @query   year, month (required)
 */
router.get(
    '/calculate/:id',
    requireRole([ROLES.TENANT, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
    salaryController.calculateSalary
);

/**
 * @route   GET /api/salary/my
 * @desc    Get my salary
 * @access  All authenticated users
 * @query   year, month (required)
 */
router.get('/my', salaryController.getMySalary);

/**
 * @route   GET /api/salary/reports/department/:departmentId
 * @desc    Get department salary report
 * @access  Admin, Super Admin, Tenant
 * @query   year, month (required)
 */
router.get(
    '/reports/department/:departmentId',
    requireRole([ROLES.TENANT, ROLES.SUPER_ADMIN, ROLES.ADMIN]),
    salaryController.getDepartmentReport
);

/**
 * @route   GET /api/salary/reports/system
 * @desc    Get system-wide salary report
 * @access  Super Admin, Tenant
 * @query   year, month (required)
 */
router.get(
    '/reports/system',
    requireRole([ROLES.TENANT, ROLES.SUPER_ADMIN]),
    salaryController.getSystemReport
);

module.exports = router;
