const router = require('express').Router();
const scheduleController = require('../controllers/schedule.controller');
const { verifyToken, requireRole } = require('../middleware/auth.middleware');
const { checkSchedulePermission } = require('../middleware/schedule.middleware');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(verifyToken);

// Create weekly schedule
// Super admin: all departments, Dept admin: own department only
router.post('/schedule',
    requireRole([ROLES.ADMIN, ROLES.DEPT_ADMIN, ROLES.SUPER_ADMIN]),
    checkSchedulePermission,
    scheduleController.createWeeklySchedule
);

// Update assignment
router.put('/schedule/:id',
    requireRole([ROLES.ADMIN, ROLES.DEPT_ADMIN, ROLES.SUPER_ADMIN]),
    checkSchedulePermission,
    scheduleController.updateAssignment
);

// Delete assignment
router.delete('/schedule/:id',
    requireRole([ROLES.ADMIN, ROLES.DEPT_ADMIN, ROLES.SUPER_ADMIN]),
    checkSchedulePermission,
    scheduleController.deleteAssignment
);

// Get weekly schedule
// Admins see department(s), Employees can also view
router.get('/schedule',
    requireRole([ROLES.ADMIN, ROLES.DEPT_ADMIN, ROLES.SUPER_ADMIN, ROLES.EMPLOYEE]),
    checkSchedulePermission,
    scheduleController.getWeeklySchedule
);

// Get employee schedule
// Employees can view own schedule
router.get('/schedule/employee/:id',
    scheduleController.getEmployeeSchedule
);

// Validate schedule
router.post('/schedule/validate',
    requireRole([ROLES.ADMIN, ROLES.DEPT_ADMIN, ROLES.SUPER_ADMIN]),
    scheduleController.validateSchedule
);

module.exports = router;
