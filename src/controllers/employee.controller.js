const employeeService = require('../services/employee.service');
const historyService = require('../services/history.service');

class EmployeeController {
    /**
     * Create employee
     */
    async create(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const employee = await employeeService.createEmployee(req.body, performedBy, req);

            res.status(201).json({
                success: true,
                message: 'Employee created successfully',
                data: employee,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all employees
     */
    async getAll(req, res, next) {
        try {
            const filters = {
                role: req.query.role,
                departmentId: req.query.departmentId,
                shiftId: req.query.shiftId,
                isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
                limit: req.query.limit,
                offset: req.query.offset,
            };

            const employees = await employeeService.getEmployees(filters);

            res.status(200).json({
                success: true,
                data: employees,
                total: employees.length,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get employee by ID
     */
    async getById(req, res, next) {
        try {
            const employee = await employeeService.getEmployeeById(req.params.id);

            res.status(200).json({
                success: true,
                data: employee,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update employee
     */
    async update(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const employee = await employeeService.updateEmployee(req.params.id, req.body, performedBy, req);

            res.status(200).json({
                success: true,
                message: 'Employee updated successfully',
                data: employee,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Deactivate employee
     */
    async deactivate(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            await employeeService.deactivateEmployee(req.params.id, performedBy, req);

            res.status(200).json({
                success: true,
                message: 'Employee deactivated successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Transfer employee
     */
    async transfer(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                ...req.body._performedBy,
            };

            const result = await employeeService.transferEmployee(
                req.params.id,
                req.body.toDepartmentId,
                req.body.toShiftId,
                req.body.reason,
                req.body.effectiveDate,
                performedBy,
                req
            );

            res.status(200).json({
                success: true,
                message: 'Employee transferred successfully',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * NEW: Get employee history
     */
    async getHistory(req, res, next) {
        try {
            const filters = {
                changeType: req.query.changeType,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                limit: req.query.limit || 50,
            };

            const history = await historyService.getHistory(req.params.id, filters);

            res.status(200).json({
                success: true,
                data: history,
                total: history.length,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new EmployeeController();
