const attendanceService = require('../services/attendance.service');

class AttendanceController {
    /**
     * Mark entry (check-in)
     */
    async markEntry(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                firstName: req.body._performedBy?.firstName || 'Admin',
                lastName: req.body._performedBy?.lastName || 'User',
                role: req.user.role,
            };

            const { userId, entryTime } = req.body;

            const attendance = await attendanceService.markEntry(userId, entryTime, performedBy, req);

            res.status(201).json({
                success: true,
                message: 'Entry marked successfully',
                data: attendance,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Mark exit (check-out)
     */
    async markExit(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                firstName: req.body._performedBy?.firstName || 'Admin',
                lastName: req.body._performedBy?.lastName || 'User',
                role: req.user.role,
            };

            const { userId, exitTime } = req.body;

            const attendance = await attendanceService.markExit(userId, exitTime, performedBy, req);

            res.status(200).json({
                success: true,
                message: 'Exit marked successfully',
                data: attendance,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Correct attendance
     */
    async correctAttendance(req, res, next) {
        try {
            const performedBy = {
                userId: req.user.userId,
                firstName: req.body._performedBy?.firstName || 'Admin',
                lastName: req.body._performedBy?.lastName || 'User',
                role: req.user.role,
            };

            const attendance = await attendanceService.correctAttendance(
                req.params.id,
                req.body,
                performedBy,
                req
            );

            res.status(200).json({
                success: true,
                message: 'Attendance corrected successfully',
                data: attendance,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get attendance records
     */
    async getAttendance(req, res, next) {
        try {
            const filters = {
                userId: req.query.userId,
                departmentId: req.query.departmentId,
                date: req.query.date,
                status: req.query.status,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                limit: req.query.limit,
                offset: req.query.offset,
            };

            const attendance = await attendanceService.getAttendance(filters);

            res.status(200).json({
                success: true,
                data: attendance,
                total: attendance.length,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get my attendance (for employees)
     */
    async getMyAttendance(req, res, next) {
        try {
            const filters = {
                userId: req.user.userId,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                limit: req.query.limit,
                offset: req.query.offset,
            };

            const attendance = await attendanceService.getAttendance(filters);

            res.status(200).json({
                success: true,
                data: attendance,
                total: attendance.length,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AttendanceController();
