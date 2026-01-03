const express = require('express');
const authRoutes = require('./auth.routes');
const departmentRoutes = require('./department.routes');
const employeeRoutes = require('./employee.routes');
const shiftRoutes = require('./shift.routes');
const attendanceRoutes = require('./attendance.routes');
const salaryRoutes = require('./salary.routes');
const scheduleRoutes = require('./schedule.routes'); // NEW: Shift scheduling

const router = express.Router();

// Mount routes
router.use('/auth', authRoutes);
router.use('/departments', departmentRoutes);
router.use('/employees', employeeRoutes);
router.use('/shifts', shiftRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/salary', salaryRoutes);
router.use('/schedules', scheduleRoutes); // FIX: Changed from /shifts to /schedules to avoid route conflict

// Health check route
router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
    });
});

module.exports = router;
