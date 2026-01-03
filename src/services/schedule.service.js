const { getFirestore, FieldValue, Timestamp } = require('../config/firebase');
const { COLLECTIONS, ASSIGNMENT_STATUS, ROLES } = require('../config/constants');
const {
    generateScheduleId,
    formatDate,
    getISOWeek,
    getWeekDates,
    getDayOfWeek
} = require('../utils/helpers');

class ScheduleService {
    constructor() {
        this.db = null;
    }

    getDb() {
        if (!this.db) {
            this.db = getFirestore();
        }
        return this.db;
    }

    /**
     * Check if department has any shifts defined
     * Required before allowing scheduling
     */
    async checkDepartmentHasShifts(departmentId) {
        const shiftsSnapshot = await this.getDb()
            .collection(COLLECTIONS.SHIFTS)
            .where('departmentId', '==', departmentId)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (shiftsSnapshot.empty) {
            throw new Error('Department has no shifts defined. Please create shifts before scheduling.');
        }

        return true;
    }

    /**
     * Validate employee belongs to the shift's department
     */
    async checkDepartmentBoundary(employeeId, shiftId) {
        // Get employee
        const employeeDoc = await this.getDb()
            .collection(COLLECTIONS.USERS)
            .doc(employeeId)
            .get();

        if (!employeeDoc.exists) {
            throw new Error('Employee not found');
        }

        const employee = employeeDoc.data();

        // Get shift
        const shiftDoc = await this.getDb()
            .collection(COLLECTIONS.SHIFTS)
            .doc(shiftId)
            .get();

        if (!shiftDoc.exists) {
            throw new Error('Shift not found');
        }

        const shift = shiftDoc.data();

        // Check department match
        if (employee.departmentId !== shift.departmentId) {
            throw new Error(
                `Employee is in ${employee.departmentName || 'different'} department, ` +
                `but shift requires ${shift.departmentName || 'different'} department`
            );
        }

        return true;
    }

    /**
     * Create weekly schedule (bulk assignment)
     * Super admin: all departments
     * Dept admin: own department only
     */
    async createWeeklySchedule(scheduleData, performedBy) {
        try {
            const { week, departmentId, assignments } = scheduleData;

            if (!week || !departmentId || !assignments || assignments.length === 0) {
                throw new Error('Invalid schedule data. Required: week, departmentId, assignments');
            }

            // Check department has shifts
            await this.checkDepartmentHasShifts(departmentId);

            // Get week date range
            const { startDate, endDate } = getWeekDates(week);

            const createdAssignments = [];
            const errors = [];

            // Process each assignment
            for (const assignment of assignments) {
                const { employeeId, shiftId, dates } = assignment;

                // Validate each date in the assignment
                for (const date of dates) {
                    try {
                        // Validate department boundary
                        await this.checkDepartmentBoundary(employeeId, shiftId);

                        // Get employee and shift details
                        const employeeDoc = await this.getDb()
                            .collection(COLLECTIONS.USERS)
                            .doc(employeeId)
                            .get();

                        const shiftDoc = await this.getDb()
                            .collection(COLLECTIONS.SHIFTS)
                            .doc(shiftId)
                            .get();

                        const employee = employeeDoc.data();
                        const shift = shiftDoc.data();

                        // Generate assignment ID
                        const assignmentId = await generateScheduleId(this.getDb());

                        // Create assignment document
                        const assignmentDoc = {
                            assignmentId,
                            employeeId,
                            employeeName: `${employee.firstName} ${employee.lastName}`,
                            shiftId,
                            shiftName: shift.name,
                            departmentId,
                            date,
                            week,
                            dayOfWeek: getDayOfWeek(date),
                            status: ASSIGNMENT_STATUS.SCHEDULED,
                            plannedBy: performedBy.userId,
                            plannedAt: FieldValue.serverTimestamp(),
                            confirmedBy: null,
                            confirmedAt: null,
                            notes: assignment.notes || '',
                            isOvertime: false,
                            createdAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp(),
                            createdBy: performedBy.userId
                        };

                        const docRef = await this.getDb()
                            .collection(COLLECTIONS.SHIFT_ASSIGNMENTS)
                            .add(assignmentDoc);

                        createdAssignments.push({
                            id: docRef.id,
                            ...assignmentDoc
                        });

                    } catch (error) {
                        errors.push({
                            employeeId,
                            shiftId,
                            date,
                            error: error.message
                        });
                    }
                }
            }

            return {
                week,
                startDate,
                endDate,
                created: createdAssignments.length,
                failed: errors.length,
                assignments: createdAssignments,
                errors: errors.length > 0 ? errors : undefined
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Get weekly schedule roster
     * Returns organized view of all assignments for a week
     */
    async getWeeklySchedule(week, departmentId) {
        try {
            const { startDate, endDate } = getWeekDates(week);

            // Build query
            let query = this.getDb()
                .collection(COLLECTIONS.SHIFT_ASSIGNMENTS)
                .where('week', '==', week);

            if (departmentId) {
                query = query.where('departmentId', '==', departmentId);
            }

            const snapshot = await query.get();

            // Organize by date and shift
            const schedule = {};
            let totalAssignments = 0;
            const employeeSet = new Set();

            snapshot.forEach(doc => {
                const assignment = { id: doc.id, ...doc.data() };
                const { date, shiftId, employeeId } = assignment;

                // Initialize date if not exists
                if (!schedule[date]) {
                    schedule[date] = {};
                }

                // Initialize shift array if not exists
                if (!schedule[date][shiftId]) {
                    schedule[date][shiftId] = [];
                }

                // Add assignment to schedule
                schedule[date][shiftId].push({
                    employeeId: assignment.employeeId,
                    employeeName: assignment.employeeName,
                    status: assignment.status,
                    notes: assignment.notes,
                    assignmentId: assignment.assignmentId
                });

                totalAssignments++;
                employeeSet.add(employeeId);
            });

            return {
                week,
                startDate,
                endDate,
                days: schedule,
                summary: {
                    totalAssignments,
                    employeeCount: employeeSet.size,
                    datesScheduled: Object.keys(schedule).length
                }
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Update single assignment
     */
    async updateAssignment(assignmentId, updates, performedBy) {
        try {
            // Find assignment
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.SHIFT_ASSIGNMENTS)
                .where('assignmentId', '==', assignmentId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                throw new Error('Assignment not found');
            }

            const doc = snapshot.docs[0];
            const assignment = doc.data();

            // If changing shift, validate department boundary
            if (updates.shiftId && updates.shiftId !== assignment.shiftId) {
                await this.checkDepartmentBoundary(assignment.employeeId, updates.shiftId);

                // Get new shift details
                const shiftDoc = await this.getDb()
                    .collection(COLLECTIONS.SHIFTS)
                    .doc(updates.shiftId)
                    .get();

                if (shiftDoc.exists) {
                    updates.shiftName = shiftDoc.data().name;
                }
            }

            // Build update data
            const updateData = {
                ...updates,
                updatedAt: FieldValue.serverTimestamp()
            };

            // Update Firestore
            await this.getDb()
                .collection(COLLECTIONS.SHIFT_ASSIGNMENTS)
                .doc(doc.id)
                .update(updateData);

            return {
                id: doc.id,
                ...assignment,
                ...updateData
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete assignment
     */
    async deleteAssignment(assignmentId, performedBy) {
        try {
            // Find assignment
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.SHIFT_ASSIGNMENTS)
                .where('assignmentId', '==', assignmentId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                throw new Error('Assignment not found');
            }

            const doc = snapshot.docs[0];

            // Delete from Firestore
            await this.getDb()
                .collection(COLLECTIONS.SHIFT_ASSIGNMENTS)
                .doc(doc.id)
                .delete();

            return {
                success: true,
                message: 'Assignment deleted successfully'
            };

        } catch (error) {
            throw error;
        }
    }

    /**
     * Get employee's schedule for a date range
     */
    async getEmployeeSchedule(employeeId, startDate, endDate) {
        try {
            let query = this.getDb()
                .collection(COLLECTIONS.SHIFT_ASSIGNMENTS)
                .where('employeeId', '==', employeeId);

            if (startDate) {
                query = query.where('date', '>=', startDate);
            }

            if (endDate) {
                query = query.where('date', '<=', endDate);
            }

            const snapshot = await query.orderBy('date', 'asc').get();

            const schedule = [];
            snapshot.forEach(doc => {
                schedule.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return schedule;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Validate schedule data
     * Checks for data integrity issues
     */
    async validateSchedule(assignments) {
        try {
            const issues = [];

            for (const assignment of assignments) {
                const { employeeId, shiftId, date } = assignment;

                // Check past date
                const today = formatDate(new Date());
                if (date < today) {
                    issues.push({
                        date,
                        issue: 'Cannot schedule for past dates'
                    });
                }

                // Check department boundary
                try {
                    await this.checkDepartmentBoundary(employeeId, shiftId);
                } catch (error) {
                    issues.push({
                        employeeId,
                        shiftId,
                        date,
                        issue: error.message
                    });
                }
            }

            return {
                valid: issues.length === 0,
                issues: issues.length > 0 ? issues : undefined
            };

        } catch (error) {
            throw error;
        }
    }
}

module.exports = new ScheduleService();
