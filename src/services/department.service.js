const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../config/constants');
const { generateId } = require('../utils/helpers');
const auditService = require('./audit.service');

class DepartmentService {
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
     * Create a new department
     */
    async createDepartment(departmentData, performedBy, req) {
        try {
            // Check if department name already exists
            const existingDept = await this.getDb()
                .collection(COLLECTIONS.DEPARTMENTS)
                .where('name', '==', departmentData.name)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (!existingDept.empty) {
                throw new Error('Department with this name already exists');
            }

            // Generate department ID
            const today = new Date().toISOString().split('T')[0];
            const departmentId = await generateId(this.getDb(), COLLECTIONS.DEPARTMENTS, 'DEPT', today);

            const newDepartment = {
                departmentId,
                name: departmentData.name,
                description: departmentData.description || '',
                hasShifts: departmentData.hasShifts || false,
                employeeCount: 0,
                isActive: true,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: performedBy.userId,
                updatedBy: performedBy.userId,
            };

            const docRef = await this.getDb().collection(COLLECTIONS.DEPARTMENTS).add(newDepartment);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.DEPARTMENT_CREATED,
                entityType: 'department',
                entityId: docRef.id,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                newData: newDepartment,
                req,
            });

            return {
                id: docRef.id,
                ...newDepartment,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all departments with optional filters
     */
    async getDepartments(filters = {}) {
        try {
            let query = this.getDb().collection(COLLECTIONS.DEPARTMENTS);

            // Apply filters
            if (filters.isActive !== undefined) {
                query = query.where('isActive', '==', filters.isActive);
            }
            if (filters.hasShifts !== undefined) {
                query = query.where('hasShifts', '==', filters.hasShifts);
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
            const departments = [];

            snapshot.forEach(doc => {
                departments.push({
                    id: doc.id,
                    ...doc.data(),
                });
            });

            return departments;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get department by ID
     */
    async getDepartmentById(departmentId) {
        try {
            const doc = await this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId).get();

            if (!doc.exists) {
                throw new Error('Department not found');
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
     * Update department
     */
    async updateDepartment(departmentId, updates, performedBy, req) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const deptDoc = await deptRef.get();

            if (!deptDoc.exists) {
                throw new Error('Department not found');
            }

            const previousData = deptDoc.data();

            // If name is being changed, check uniqueness
            if (updates.name && updates.name !== previousData.name) {
                const existingDept = await this.getDb()
                    .collection(COLLECTIONS.DEPARTMENTS)
                    .where('name', '==', updates.name)
                    .where('isActive', '==', true)
                    .limit(1)
                    .get();

                if (!existingDept.empty) {
                    throw new Error('Department with this name already exists');
                }
            }

            const updateData = {
                ...updates,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
            };

            await deptRef.update(updateData);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.DEPARTMENT_UPDATED,
                entityType: 'department',
                entityId: departmentId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                previousData,
                newData: updateData,
                req,
            });

            return {
                id: departmentId,
                ...previousData,
                ...updateData,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Delete department (soft delete)
     */
    async deleteDepartment(departmentId, performedBy, req) {
        try {
            // Check if department has active employees
            const employeesSnapshot = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .where('departmentId', '==', departmentId)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (!employeesSnapshot.empty) {
                throw new Error('Cannot delete department with active employees');
            }

            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const previousData = (await deptRef.get()).data();

            await deptRef.update({
                isActive: false,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
            });

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.DEPARTMENT_UPDATED,
                entityType: 'department',
                entityId: departmentId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                previousData,
                newData: { isActive: false },
                reason: 'Department deleted',
                req,
            });

            return { success: true };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Increment employee count for a department
     */
    async incrementEmployeeCount(departmentId) {
        try {
            await this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId).update({
                employeeCount: FieldValue.increment(1),
            });
        } catch (error) {
            console.error('Error incrementing employee count:', error);
        }
    }

    /**
     * Decrement employee count for a department
     */
    async decrementEmployeeCount(departmentId) {
        try {
            await this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId).update({
                employeeCount: FieldValue.increment(-1),
            });
        } catch (error) {
            console.error('Error decrementing employee count:', error);
        }
    }
}

module.exports = new DepartmentService();
