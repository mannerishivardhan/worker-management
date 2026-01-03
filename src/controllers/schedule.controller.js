const scheduleService = require('../services/schedule.service');

/**
 * Create weekly schedule (bulk assignment)
 */
const createWeeklySchedule = async (req, res) => {
    try {
        const scheduleData = req.body;
        const performedBy = req.user;

        const result = await scheduleService.createWeeklySchedule(scheduleData, performedBy);

        return res.status(201).json({
            success: true,
            message: `Weekly schedule created. ${result.created} assignments added.`,
            data: result
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : {}
        });
    }
};

/**
 * Get weekly schedule roster
 */
const getWeeklySchedule = async (req, res) => {
    try {
        const { week, departmentId } = req.query;

        if (!week) {
            return res.status(400).json({
                success: false,
                message: 'Week parameter is required (format: 2025-W52)'
            });
        }

        const schedule = await scheduleService.getWeeklySchedule(week, departmentId);

        return res.status(200).json({
            success: true,
            data: schedule
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : {}
        });
    }
};

/**
 * Update single assignment
 */
const updateAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const performedBy = req.user;

        const updated = await scheduleService.updateAssignment(id, updates, performedBy);

        return res.status(200).json({
            success: true,
            message: 'Assignment updated successfully',
            data: updated
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : {}
        });
    }
};

/**
 * Delete assignment
 */
const deleteAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const performedBy = req.user;

        const result = await scheduleService.deleteAssignment(id, performedBy);

        return res.status(200).json({
            success: true,
            ...result
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : {}
        });
    }
};

/**
 * Get employee's schedule
 */
const getEmployeeSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        const schedule = await scheduleService.getEmployeeSchedule(id, startDate, endDate);

        return res.status(200).json({
            success: true,
            data: schedule
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : {}
        });
    }
};

/**
 * Validate schedule
 */
const validateSchedule = async (req, res) => {
    try {
        const { assignments } = req.body;

        if (!assignments || !Array.isArray(assignments)) {
            return res.status(400).json({
                success: false,
                message: 'Assignments array is required'
            });
        }

        const validation = await scheduleService.validateSchedule(assignments);

        return res.status(200).json({
            success: true,
            data: validation
        });

    } catch (error) {
        return res.status(400).json({
            success: false,
            message: error.message,
            error: process.env.NODE_ENV === 'development' ? error.stack : {}
        });
    }
};

module.exports = {
    createWeeklySchedule,
    getWeeklySchedule,
    updateAssignment,
    deleteAssignment,
    getEmployeeSchedule,
    validateSchedule
};
