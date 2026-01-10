const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../config/constants');
const { generateShiftId } = require('../utils/helpers'); // NEW: Random 4-char ID
const auditService = require('./audit.service');
const departmentService = require('./department.service');

class ShiftService {
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
     * Create a new shift
     */
    async createShift(shiftData, performedBy, req) {
        try {
            // Verify department exists and has shifts enabled
            const department = await departmentService.getDepartmentById(shiftData.departmentId);

            if (!department.hasShifts) {
                throw new Error('This department does not use shifts');
            }

            // Validate and calculate work duration
            const [startHour, startMin] = shiftData.startTime.split(':').map(Number);
            const [endHour, endMin] = shiftData.endTime.split(':').map(Number);

            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;

            // Support overnight shifts (crosses midnight)
            let workDurationHours;
            if (endMinutes < startMinutes) {
                // Overnight shift: 22:00 to 06:00 = 8 hours
                workDurationHours = ((24 * 60 - startMinutes) + endMinutes) / 60;
            } else {
                // Same day shift
                workDurationHours = (endMinutes - startMinutes) / 60;
                if (workDurationHours <= 0) {
                    throw new Error('End time must be after start time');
                }
            }

            // Generate NEW format ID: SHFT_XXXX (random 4-char)
            const shiftId = await generateShiftId(this.getDb());

            const newShift = {
                shiftId,
                name: shiftData.name,
                jobRole: shiftData.jobRole || null,  // NEW: Job role classification (e.g., "Normal Security Staff", "Nepali Workers")
                departmentId: shiftData.departmentId,
                departmentName: department.name,
                startTime: shiftData.startTime,
                endTime: shiftData.endTime,
                workDurationHours: parseFloat(workDurationHours.toFixed(2)),
                overtimeAllowed: shiftData.overtimeAllowed !== undefined ? shiftData.overtimeAllowed : true,  // NEW: Can this shift have overtime?
                overtimeMultiplier: shiftData.overtimeMultiplier || 1.5,  // NEW: Overtime pay rate multiplier
                isActive: true,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: performedBy.userId,
            };

            const docRef = await this.getDb().collection(COLLECTIONS.SHIFTS).add(newShift);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.SHIFT_CREATED,
                entityType: 'shift',
                entityId: docRef.id,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                newData: newShift,
                req,
            });

            return {
                id: docRef.id,
                ...newShift,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all shifts with filters
     */
    async getShifts(filters = {}) {
        try {
            let query = this.getDb().collection(COLLECTIONS.SHIFTS);

            // Apply filters
            if (filters.departmentId) {
                query = query.where('departmentId', '==', filters.departmentId);
            }
            if (filters.isActive !== undefined) {
                query = query.where('isActive', '==', filters.isActive);
            }

            // Pagination
            if (filters.limit) {
                query = query.limit(parseInt(filters.limit));
            }
            if (filters.offset) {
                query = query.offset(parseInt(filters.offset));
            }

            query = query.orderBy('createdAt', 'desc');

            const snapshot = await query.get();
            const shifts = [];

            snapshot.forEach(doc => {
                shifts.push({
                    id: doc.id,
                    ...doc.data(),
                });
            });

            return shifts;
        } catch (error) {
            throw error;
        }
    }

    /**
     * NEW: Get shifts for calendar view with full employee details
     * Returns shifts with complete employee information, not just counts
     */
    async getShiftsForCalendar(filters = {}) {
        try {
            // Get all shifts with filters
            const shifts = await this.getShifts(filters);

            // For each shift, fetch employees assigned to it
            const shiftsWithEmployees = await Promise.all(
                shifts.map(async (shift) => {
                    // Get employees assigned to this shift
                    const employeesSnapshot = await this.getDb()
                        .collection(COLLECTIONS.USERS)
                        .where('shiftId', '==', shift.id)
                        .where('isActive', '==', true)
                        .get();

                    const employees = [];
                    employeesSnapshot.forEach(doc => {
                        const empData = doc.data();
                        employees.push({
                            id: doc.id,
                            employeeId: empData.employeeId,
                            firstName: empData.firstName,
                            lastName: empData.lastName,
                            role: empData.role,
                            avatar: empData.avatar || null,
                            isActive: empData.isActive,
                        });
                    });

                    return {
                        ...shift,
                        employees: employees,
                        employeeCount: employees.length,
                    };
                })
            );

            // Calculate summary stats
            const summary = {
                totalShifts: shiftsWithEmployees.length,
                totalEmployees: shiftsWithEmployees.reduce((sum, shift) => sum + shift.employeeCount, 0),
                averageEmployeesPerShift: shiftsWithEmployees.length > 0
                    ? parseFloat((shiftsWithEmployees.reduce((sum, shift) => sum + shift.employeeCount, 0) / shiftsWithEmployees.length).toFixed(2))
                    : 0,
            };

            return {
                shifts: shiftsWithEmployees,
                summary,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get shift by ID
     */
    async getShiftById(shiftId) {
        try {
            const doc = await this.getDb().collection(COLLECTIONS.SHIFTS).doc(shiftId).get();

            if (!doc.exists) {
                throw new Error('Shift not found');
            }

            return {
                id: doc.id,
                ...doc.data(),
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update shift
     */
    async updateShift(shiftId, updates, performedBy, req) {
        try {
            const shiftRef = this.getDb().collection(COLLECTIONS.SHIFTS).doc(shiftId);
            const shiftDoc = await shiftRef.get();

            if (!shiftDoc.exists) {
                throw new Error('Shift not found');
            }

            const previousData = shiftDoc.data();

            // Validate time if being updated
            const startTime = updates.startTime || previousData.startTime;
            const endTime = updates.endTime || previousData.endTime;

            if (startTime >= endTime) {
                throw new Error('End time must be after start time');
            }

            // Recalculate work duration if times changed
            let workDurationHours = previousData.workDurationHours;
            if (updates.startTime || updates.endTime) {
                const [startHour, startMin] = startTime.split(':').map(Number);
                const [endHour, endMin] = endTime.split(':').map(Number);
                workDurationHours = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;
            }

            const updateData = {
                ...updates,
                workDurationHours: parseFloat(workDurationHours.toFixed(2)),
                updatedAt: FieldValue.serverTimestamp(),
            };

            await shiftRef.update(updateData);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.SHIFT_UPDATED,
                entityType: 'shift',
                entityId: shiftId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                previousData,
                newData: updateData,
                req,
            });

            return {
                id: shiftId,
                ...previousData,
                ...updateData,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete shift (soft delete)
     */
    async deleteShift(shiftId, performedBy, req) {
        try {
            // Check if shift is assigned to any active employees
            const employeesSnapshot = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .where('shiftId', '==', shiftId)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (!employeesSnapshot.empty) {
                throw new Error('Cannot delete shift assigned to active employees');
            }

            const shiftRef = this.getDb().collection(COLLECTIONS.SHIFTS).doc(shiftId);
            const previousData = (await shiftRef.get()).data();

            await shiftRef.update({
                isActive: false,
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.SHIFT_UPDATED,
                entityType: 'shift',
                entityId: shiftId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                previousData,
                newData: { isActive: false },
                reason: 'Shift deleted',
                req,
            });

            return { success: true };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new ShiftService();
