const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../config/constants');
const { generateDepartmentId } = require('../utils/helpers'); // NEW: Use specific generator
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

            // Generate NEW format ID: DEPT_XXXX (random 4-char)
            const departmentId = await generateDepartmentId(this.getDb());

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
                createdByRole: performedBy.role,
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role,
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

            if (filters.isActive !== undefined) {
                query = query.where('isActive', '==', filters.isActive);
            }

            query = query.orderBy('name', 'asc');

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
            const doc = await this.getDb()
                .collection(COLLECTIONS.DEPARTMENTS)
                .doc(departmentId)
                .get();

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

            // Check if name is being updated and if it conflicts
            if (updates.name && updates.name !== previousData.name) {
                const existingDept = await this.getDb()
                    .collection(COLLECTIONS.DEPARTMENTS)
                    .where('name', '==', updates.name)
                    .where('isActive', '==', true)
                    .limit(1)
                    .get();

                if (!existingDept.empty && existingDept.docs[0].id !== departmentId) {
                    throw new Error('Department with this name already exists');
                }
            }

            const updateData = {
                ...updates,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role,
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
     * Delete department (hard delete - only if no employees)
     */
    async deleteDepartment(departmentId, performedBy, req) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const deptDoc = await deptRef.get();

            if (!deptDoc.exists) {
                throw new Error('Department not found');
            }

            const deptData = deptDoc.data();

            // Check if department has employees
            if (deptData.employeeCount > 0) {
                throw new Error('Cannot delete department with active employees');
            }

            const previousData = deptData;

            await deptRef.delete();

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.DEPARTMENT_DELETED,
                entityType: 'department',
                entityId: departmentId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                previousData,
                reason: 'Department hard deleted',
                req,
            });

            return { success: true };
        } catch (error) {
            throw error;
        }
    }

    /**
     * NEW: Deactivate department (soft delete)
     * Can only deactivate if no active employees
     */
    async deactivateDepartment(departmentId, performedBy, req) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const deptDoc = await deptRef.get();

            if (!deptDoc.exists) {
                throw new Error('Department not found');
            }

            const deptData = deptDoc.data();

            // Check if already deactivated
            if (!deptData.isActive) {
                throw new Error('Department is already deactivated');
            }

            // Check for active employees
            const activeEmployees = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .where('departmentId', '==', departmentId)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (!activeEmployees.empty) {
                throw new Error('Cannot deactivate department with active employees. Please transfer or deactivate all employees first.');
            }

            const previousData = deptData;

            // Soft delete - set isActive to false
            await deptRef.update({
                isActive: false,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
                deactivatedAt: FieldValue.serverTimestamp(),
                deactivatedBy: performedBy.userId,
            });

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.DEPARTMENT_DEACTIVATED,
                entityType: 'department',
                entityId: departmentId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                previousData,
                newData: { isActive: false },
                reason: 'Department deactivated (soft delete)',
                req,
            });

            return {
                success: true,
                message: 'Department deactivated successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Increment employee count for a department
     */
    async incrementEmployeeCount(departmentId) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            await deptRef.update({
                employeeCount: FieldValue.increment(1),
                updatedAt: FieldValue.serverTimestamp(),
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Decrement employee count for a department
     */
    async decrementEmployeeCount(departmentId) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            await deptRef.update({
                employeeCount: FieldValue.increment(-1),
                updatedAt: FieldValue.serverTimestamp(),
            });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new DepartmentService();
