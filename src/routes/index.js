const express = require('express');
const authRoutes = require('./auth.routes');
const departmentRoutes = require('./department.routes');
const employeeRoutes = require('./employee.routes');
const shiftRoutes = require('./shift.routes');
const attendanceRoutes = require('./attendance.routes');
const salaryRoutes = require('./salary.routes');

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/employees', employeeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/salary', salaryRoutes);

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
