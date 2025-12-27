const departmentService = require('../services/department.service');

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
}

module.exports = new DepartmentController();
