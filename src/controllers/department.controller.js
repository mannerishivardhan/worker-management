const departmentService = require('../services/department.service');
const departmentHistoryService = require('../services/departmentHistory.service');

class DepartmentController {
    /**
     * Create department
     */
    async create(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy, // Additional user details from middleware
            };

            const department = await departmentService.createDepartment(req.body, performedBy, req);

            res.status(201).json({
                success: true,
                message: 'Department created successfully',
                data: department,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all departments
     */
    async getAll(req, res, next) {
        try {
            const filters = {
                isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
                hasShifts: req.query.hasShifts !== undefined ? req.query.hasShifts === 'true' : undefined,
                limit: req.query.limit,
                offset: req.query.offset,
            };

            const departments = await departmentService.getDepartments(filters);

            res.status(200).json({
                success: true,
                data: departments,
                total: departments.length,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get department by ID
     */
    async getById(req, res, next) {
        try {
            const department = await departmentService.getDepartmentById(req.params.id);

            res.status(200).json({
                success: true,
                data: department,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update department
     */
    async update(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const department = await departmentService.updateDepartment(
                req.params.id,
                req.body,
                performedBy,
                req
            );

            res.status(200).json({
                success: true,
                message: 'Department updated successfully',
                data: department,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete department
     */
    async delete(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            await departmentService.deleteDepartment(req.params.id, performedBy, req);

            res.status(200).json({
                success: true,
                message: 'Department deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * NEW: Deactivate department (with reason)
     */
    async deactivate(req, res, next) {
        try {
            const { reason } = req.body;
            
            if (!reason || reason.trim() === '') {
                return res.status(400).json({
                    success: false,
                    message: 'Deactivation reason is required'
                });
            }

            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const department = await departmentService.deactivateDepartment(
                req.params.id,
                reason,
                performedBy,
                req
            );

            res.status(200).json({
                success: true,
                message: 'Department deactivated successfully',
                data: department,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * NEW: Activate department
     */
    async activate(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const department = await departmentService.activateDepartment(
                req.params.id,
                performedBy,
                req
            );

            res.status(200).json({
                success: true,
                message: 'Department activated successfully',
                data: department,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * NEW: Assign department head
     */
    async assignHead(req, res, next) {
        try {
            const { employeeId } = req.body;

            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    message: 'Employee ID is required'
                });
            }

            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const department = await departmentService.assignDepartmentHead(
                req.params.id,
                employeeId,
                performedBy,
                req
            );

            res.status(200).json({
                success: true,
                message: 'Department head assigned successfully',
                data: department,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * NEW: Remove department head
     */
    async removeHead(req, res, next) {
        try {
            const { reason } = req.body;

            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const department = await departmentService.removeDepartmentHead(
                req.params.id,
                reason || 'No reason provided',
                performedBy,
                req
            );

            res.status(200).json({
                success: true,
                message: 'Department head removed successfully',
                data: department,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * NEW: Get department history
     */
    async getHistory(req, res, next) {
        try {
            const filters = {
                actionType: req.query.actionType,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                limit: parseInt(req.query.limit) || 50
            };

            // departmentId IS the document ID now (DEPT_XXXX)
            const history = await departmentHistoryService.getHistory(
                req.params.id,
                filters
            );

            res.status(200).json({
                success: true,
                data: history,
                total: history.length
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new DepartmentController();
