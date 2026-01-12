const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS, DEPARTMENT_STATUS, DEPARTMENT_HISTORY_ACTIONS } = require('../config/constants');
const { generateDepartmentId } = require('../utils/helpers'); // NEW: Use specific generator
const auditService = require('./audit.service');
const departmentHistoryService = require('./departmentHistory.service');

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
            // Use this as the DOCUMENT ID for atomicity (works for both SQL & NoSQL)
            const departmentId = await generateDepartmentId(this.getDb());

            const newDepartment = {
                name: departmentData.name,
                description: departmentData.description || '',
                hasShifts: departmentData.hasShifts || false,
                roles: departmentData.roles || [], // Array of {name, shifts: [{name, startTime, endTime}]}
                employeeCount: 0,
                isActive: true,
                status: DEPARTMENT_STATUS.ACTIVE,
                deactivationReason: null,
                deactivatedAt: null,
                deactivatedBy: null,
                departmentHead: {
                    userId: null,
                    employeeId: null,
                    employeeName: null,
                    assignedAt: null,
                    assignedBy: null
                },
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: performedBy.userId,
                createdByRole: performedBy.role,
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role,
            };

            // Set document ID = departmentId for atomicity (no separate departmentId field needed)
            await this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId).set(newDepartment);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.DEPARTMENT_CREATED,
                entityType: 'department',
                entityId: departmentId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                newData: newDepartment,
                req,
            });

            // Log to department history - now departmentId IS the document ID
            await departmentHistoryService.logChange({
                departmentId: departmentId,
                departmentName: newDepartment.name,
                actionType: DEPARTMENT_HISTORY_ACTIONS.CREATED,
                changedFields: [],
                previousData: null,
                newData: newDepartment,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                performedByEmployeeId: performedBy.employeeId || null,
                req
            });

            return {
                id: departmentId,
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

            // Log to department history
            const changedFields = Object.keys(updates).filter(key => 
                key !== 'updatedAt' && key !== 'updatedBy' && key !== 'updatedByRole'
            );

            await departmentHistoryService.logChange({
                departmentId: departmentId,
                departmentName: previousData.name,
                actionType: DEPARTMENT_HISTORY_ACTIONS.UPDATED,
                changedFields,
                previousData: Object.fromEntries(
                    changedFields.map(field => [field, previousData[field]])
                ),
                newData: Object.fromEntries(
                    changedFields.map(field => [field, updates[field]])
                ),
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                performedByEmployeeId: performedBy.employeeId || null,
                req
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

    /**
     * Deactivate a department (with reason)
     */
    async deactivateDepartment(departmentId, reason, performedBy, req) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const deptDoc = await deptRef.get();

            if (!deptDoc.exists) {
                throw new Error('Department not found');
            }

            const previousData = deptDoc.data();

            // Check if already deactivated
            if (previousData.status === DEPARTMENT_STATUS.DEACTIVATED) {
                throw new Error('Department is already deactivated');
            }

            // Check if there are active employees
            // This ensures data integrity - can't deactivate a department with employees
            if (previousData.employeeCount > 0) {
                throw new Error('Cannot deactivate department with active employees. Please transfer employees first.');
            }

            const updateData = {
                status: DEPARTMENT_STATUS.DEACTIVATED,
                isActive: false,
                deactivationReason: reason,
                deactivatedAt: FieldValue.serverTimestamp(),
                deactivatedBy: performedBy.userId,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role
            };

            await deptRef.update(updateData);

            // Log to audit
            await auditService.log({
                action: AUDIT_ACTIONS.DEPARTMENT_DEACTIVATED,
                entityType: 'department',
                entityId: departmentId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                previousData,
                newData: updateData,
                req,
            });

            // Log to department history
            await departmentHistoryService.logChange({
                departmentId: departmentId,
                departmentName: previousData.name,
                actionType: DEPARTMENT_HISTORY_ACTIONS.DEACTIVATED,
                changedFields: ['status', 'isActive', 'deactivationReason'],
                previousData: {
                    status: previousData.status,
                    isActive: previousData.isActive
                },
                newData: {
                    status: updateData.status,
                    isActive: updateData.isActive,
                    deactivationReason: updateData.deactivationReason
                },
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                performedByEmployeeId: performedBy.employeeId || null,
                reason,
                req
            });

            return {
                id: departmentId,
                ...previousData,
                ...updateData
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Activate a deactivated department
     */
    async activateDepartment(departmentId, performedBy, req) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const deptDoc = await deptRef.get();

            if (!deptDoc.exists) {
                throw new Error('Department not found');
            }

            const previousData = deptDoc.data();

            // Check if already active
            if (previousData.status === DEPARTMENT_STATUS.ACTIVE) {
                throw new Error('Department is already active');
            }

            const updateData = {
                status: DEPARTMENT_STATUS.ACTIVE,
                isActive: true,
                deactivationReason: null,
                deactivatedAt: null,
                deactivatedBy: null,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role
            };

            await deptRef.update(updateData);

            // Log to audit
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

            // Log to department history
            await departmentHistoryService.logChange({
                departmentId: departmentId,
                departmentName: previousData.name,
                actionType: DEPARTMENT_HISTORY_ACTIONS.ACTIVATED,
                changedFields: ['status', 'isActive'],
                previousData: {
                    status: previousData.status,
                    isActive: previousData.isActive
                },
                newData: {
                    status: updateData.status,
                    isActive: updateData.isActive
                },
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                performedByEmployeeId: performedBy.employeeId || null,
                req
            });

            return {
                id: departmentId,
                ...previousData,
                ...updateData
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Assign or change department head
     */
    async assignDepartmentHead(departmentId, employeeId, performedBy, req) {
        try {
            // Get department
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const deptDoc = await deptRef.get();

            if (!deptDoc.exists) {
                throw new Error('Department not found');
            }

            const previousData = deptDoc.data();

            // Get employee details
            const employeeDoc = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .doc(employeeId)
                .get();

            if (!employeeDoc.exists) {
                throw new Error('Employee not found');
            }

            const employee = employeeDoc.data();

            // Validate employee is active
            if (!employee.isActive) {
                throw new Error('Cannot assign inactive employee as department head');
            }

            // Validate employee belongs to this department
            if (employee.departmentId !== departmentId) {
                throw new Error('Employee must belong to this department to be assigned as head');
            }

            // Determine if this is new assignment or change
            const isChange = previousData.departmentHead?.userId !== null;
            const actionType = isChange 
                ? DEPARTMENT_HISTORY_ACTIONS.HEAD_CHANGED 
                : DEPARTMENT_HISTORY_ACTIONS.HEAD_ASSIGNED;

            const updateData = {
                departmentHead: {
                    userId: employeeId,
                    employeeId: employee.employeeId,
                    employeeName: `${employee.firstName} ${employee.lastName}`,
                    assignedAt: FieldValue.serverTimestamp(),
                    assignedBy: performedBy.userId
                },
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role
            };

            await deptRef.update(updateData);

            // Log to audit
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

            // Log to department history
            await departmentHistoryService.logChange({
                departmentId: departmentId,
                departmentName: previousData.name,
                actionType,
                changedFields: ['departmentHead'],
                previousData: {
                    departmentHead: previousData.departmentHead
                },
                newData: {
                    departmentHead: updateData.departmentHead
                },
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                performedByEmployeeId: performedBy.employeeId || null,
                relatedEntityType: 'employee',
                relatedEntityId: employee.employeeId,
                req
            });

            return {
                id: departmentId,
                ...previousData,
                ...updateData
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Remove department head
     */
    async removeDepartmentHead(departmentId, reason, performedBy, req) {
        try {
            const deptRef = this.getDb().collection(COLLECTIONS.DEPARTMENTS).doc(departmentId);
            const deptDoc = await deptRef.get();

            if (!deptDoc.exists) {
                throw new Error('Department not found');
            }

            const previousData = deptDoc.data();

            // Check if head exists
            if (!previousData.departmentHead?.userId) {
                throw new Error('No department head assigned');
            }

            const updateData = {
                departmentHead: {
                    userId: null,
                    employeeId: null,
                    employeeName: null,
                    assignedAt: null,
                    assignedBy: null
                },
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role
            };

            await deptRef.update(updateData);

            // Log to audit
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

            // Log to department history
            await departmentHistoryService.logChange({
                departmentId: departmentId,
                departmentName: previousData.name,
                actionType: DEPARTMENT_HISTORY_ACTIONS.HEAD_REMOVED,
                changedFields: ['departmentHead'],
                previousData: {
                    departmentHead: previousData.departmentHead
                },
                newData: {
                    departmentHead: updateData.departmentHead
                },
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                performedByEmployeeId: performedBy.employeeId || null,
                reason,
                req
            });

            return {
                id: departmentId,
                ...previousData,
                ...updateData
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new DepartmentService();
