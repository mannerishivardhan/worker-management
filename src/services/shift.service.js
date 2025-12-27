const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../config/constants');
const { generateId } = require('../utils/helpers');
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

            // Validate time
            if (shiftData.startTime >= shiftData.endTime) {
                throw new Error('End time must be after start time');
            }

            // Generate shift ID
            const today = new Date().toISOString().split('T')[0];
            const shiftId = await generateId(this.getDb(), COLLECTIONS.SHIFTS, 'SHIFT', today);

            // Calculate work duration in hours
            const [startHour, startMin] = shiftData.startTime.split(':').map(Number);
            const [endHour, endMin] = shiftData.endTime.split(':').map(Number);
            const workDurationHours = (endHour * 60 + endMin - (startHour * 60 + startMin)) / 60;

            const newShift = {
                shiftId,
                name: shiftData.name,
                departmentId: shiftData.departmentId,
                departmentName: department.name,
                startTime: shiftData.startTime,
                endTime: shiftData.endTime,
                workDurationHours: parseFloat(workDurationHours.toFixed(2)),
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
