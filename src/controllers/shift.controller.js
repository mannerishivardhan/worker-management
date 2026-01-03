const shiftService = require('../services/shift.service');

class ShiftController {
    /**
     * Create shift
     */
    async create(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                firstName: req.body._performedBy?.firstName || 'Admin',
                lastName: req.body._performedBy?.lastName || 'User',
                role: req.user.role,
            };

            const shift = await shiftService.createShift(req.body, performedBy, req);

            res.status(201).json({
                success: true,
                message: 'Shift created successfully',
                data: shift,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get all shifts
     */
    async getAll(req, res, next) {
        try {
            const filters = {
                departmentId: req.query.departmentId,
                isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
                limit: req.query.limit,
                offset: req.query.offset,
            };

            const shifts = await shiftService.getShifts(filters);

            res.status(200).json({
                success: true,
                data: shifts,
                total: shifts.length,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * NEW: Get shifts for calendar view with employee details
     */
    async getCalendar(req, res, next) {
        try {
            const filters = {
                departmentId: req.query.departmentId,
                isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : true, // Default to active only
            };

            const result = await shiftService.getShiftsForCalendar(filters);

            res.status(200).json({
                success: true,
                data: result.shifts,
                summary: result.summary,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get shift by ID
     */
    async getById(req, res, next) {
        try {
            const shift = await shiftService.getShiftById(req.params.id);

            res.status(200).json({
                success: true,
                data: shift,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update shift
     */
    async update(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                firstName: req.body._performedBy?.firstName || 'Admin',
                lastName: req.body._performedBy?.lastName || 'User',
                role: req.user.role,
            };

            const shift = await shiftService.updateShift(req.params.id, req.body, performedBy, req);

            res.status(200).json({
                success: true,
                message: 'Shift updated successfully',
                data: shift,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Delete shift
     */
    async delete(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                firstName: req.body._performedBy?.firstName || 'Admin',
                lastName: req.body._performedBy?.lastName || 'User',
                role: req.user.role,
            };

            await shiftService.deleteShift(req.params.id, performedBy, req);

            res.status(200).json({
                success: true,
                message: 'Shift deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ShiftController();
