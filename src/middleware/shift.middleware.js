const { ROLES } = require('../config/constants');
const departmentService = require('../services/department.service');
const shiftService = require('../services/shift.service');

/**
 * Check if user has permission to manage shifts in the specified department
 * - Super Admin: Can manage all shifts
 * - Dept Admin: Can only manage shifts in their own department
 */
const checkShiftPermission = async (req, res, next) => {
    try {
        const user = req.user;

        // Super Admin has full access
        if (user.role === ROLES.SUPER_ADMIN) {
            return next();
        }

        // Department Admin checks
        if (user.role === ROLES.DEPT_ADMIN) {
            // Get department ID from request body or loaded shift
            const departmentId = req.body.departmentId || (req.shift && req.shift.departmentId);

            if (!departmentId) {
                return res.status(400).json({
                    success: false,
                    message: 'Department ID is required'
                });
            }

            // Check if this is the admin's department
            if (user.departmentId !== departmentId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only manage shifts in your own department'
                });
            }

            // Check if department has shifts enabled
            const department = await departmentService.getDepartmentById(departmentId);
            if (!department.hasShifts) {
                return res.status(400).json({
                    success: false,
                    message: 'This department does not use shifts'
                });
            }

            return next();
        }

        // Other roles cannot manage shifts
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to manage shifts'
        });

    } catch (error) {
        next(error);
    }
};

/**
 * Load shift into request object for permission checking
 * Used before update/delete operations
 */
const loadShift = async (req, res, next) => {
    try {
        const shift = await shiftService.getShiftById(req.params.id);
        req.shift = shift;
        next();
    } catch (error) {
        next(error);
    }
};

module.exports = {
    checkShiftPermission,
    loadShift
};
