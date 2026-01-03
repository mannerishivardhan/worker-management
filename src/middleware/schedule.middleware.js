const { ROLES } = require('../config/constants');

/**
 * Check if user has permission for schedule operations
 * Super admin: All departments (with shifts)
 * Dept admin: Own department only (with shifts)
 * Employees: View own schedule only
 */
const checkSchedulePermission = async (req, res, next) => {
    try {
        const user = req.user;

        // Super admin: access to everything
        if (user.role === ROLES.SUPER_ADMIN) {
            return next();
        }

        // Dept admin: check department match
        if (user.role === ROLES.DEPT_ADMIN || user.role === ROLES.ADMIN) {
            const requestedDeptId = req.body.departmentId || req.query.departmentId;

            // If requesting specific department, verify it matches user's department
            if (requestedDeptId && requestedDeptId !== user.departmentId) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied. You can only manage schedules for your department.'
                });
            }

            // Inject user's department if not specified
            if (!requestedDeptId) {
                req.query.departmentId = user.departmentId;
                if (req.body) {
                    req.body.departmentId = user.departmentId;
                }
            }

            return next();
        }

        // Employees: can only view own schedule
        if (user.role === ROLES.EMPLOYEE) {
            // Check if viewing own schedule
            if (req.params.id === user.id || req.params.id === user.userId) {
                return next();
            }

            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only view your own schedule.'
            });
        }

        return res.status(403).json({
            success: false,
            message: 'Insufficient permissions'
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Error checking permissions',
            error: error.message
        });
    }
};

module.exports = {
    checkSchedulePermission
};
