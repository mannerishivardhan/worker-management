const { getFirestore, FieldValue, Timestamp } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS, TRANSFER_TYPES } = require('../config/constants');
const { generateId } = require('../utils/helpers');
const authService = require('./auth.service');
const departmentService = require('./department.service');
const auditService = require('./audit.service');

class EmployeeService {
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
     * Create a new employee
     * NOTE: Using email authentication. Phone auth code commented for future use.
     */
    async createEmployee(employeeData, performedBy, req) {
        try {
            // Check if email already exists
            const existingUser = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .where('email', '==', employeeData.email)
                .limit(1)
                .get();

            if (!existingUser.empty) {
                throw new Error('Email already registered');
            }

            // PHONE AUTH (COMMENTED FOR FUTURE USE):
            // const existingUser = await this.db
            //   .collection(COLLECTIONS.USERS)
            //   .where('phone', '==', employeeData.phone)
            //   .limit(1)
            //   .get();
            // if (!existingUser.empty) {
            //   throw new Error('Phone number already registered');
            // }

            // Verify department exists
            const department = await departmentService.getDepartmentById(employeeData.departmentId);

            // If department has shifts, shift assignment is mandatory
            if (department.hasShifts && !employeeData.shiftId) {
                throw new Error('Shift assignment is mandatory for this department');
            }

            // Generate employee ID
            const today = new Date().toISOString().split('T')[0];
            const employeeId = await generateId(this.getDb(), COLLECTIONS.USERS, 'EMP', today);

            // Hash password
            const hashedPassword = await authService.hashPassword(employeeData.password);

            // Get shift details if provided
            let shiftName = null;
            if (employeeData.shiftId) {
                const shiftDoc = await this.getDb().collection(COLLECTIONS.SHIFTS).doc(employeeData.shiftId).get();
                if (shiftDoc.exists) {
                    shiftName = shiftDoc.data().name;
                }
            }

            // Convert joiningDate to Firestore Timestamp
            let joiningDateTimestamp;
            if (employeeData.joiningDate) {
                // If provided as string (YYYY-MM-DD), convert to Timestamp
                const date = new Date(employeeData.joiningDate);
                joiningDateTimestamp = Timestamp.fromDate(date);
            } else {
                // Default to today at midnight
                const todayMidnight = new Date();
                todayMidnight.setHours(0, 0, 0, 0);
                joiningDateTimestamp = Timestamp.fromDate(todayMidnight);
            }

            const newEmployee = {
                employeeId,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                phone: employeeData.phone || null, // Optional, for contact purposes
                password: hashedPassword,
                role: employeeData.role,
                departmentId: employeeData.departmentId,
                departmentName: department.name,
                shiftId: employeeData.shiftId || null,
                shiftName: shiftName,
                monthlySalary: employeeData.monthlySalary,
                joiningDate: joiningDateTimestamp, // Firestore Timestamp
                isActive: true,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: performedBy.userId,
                updatedBy: performedBy.userId,
            };

            const userRef = await this.getDb().collection(COLLECTIONS.USERS).add(newEmployee);

            // Create initial department transfer record
            await this.createTransferRecord({
                userId: userRef.id,
                employeeId,
                employeeName: `${newEmployee.firstName} ${newEmployee.lastName}`,
                fromDepartmentId: null,
                fromDepartmentName: null,
                toDepartmentId: employeeData.departmentId,
                toDepartmentName: department.name,
                fromShiftId: null,
                fromShiftName: null,
                toShiftId: employeeData.shiftId || null,
                toShiftName: shiftName,
                transferType: TRANSFER_TYPES.INITIAL_ASSIGNMENT,
                reason: 'Initial employee registration',
                effectiveDate: today,
                transferredBy: performedBy.userId,
                transferredByName: `${performedBy.firstName} ${performedBy.lastName}`,
            });

            // Increment department employee count
            await departmentService.incrementEmployeeCount(employeeData.departmentId);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.USER_CREATED,
                entityType: 'user',
                entityId: userRef.id,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: userRef.id,
                targetEmployeeId: employeeId,
                newData: { ...newEmployee, password: '[REDACTED]' },
                req,
            });

            // Remove password from response
            delete newEmployee.password;

            return {
                id: userRef.id,
                ...newEmployee,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all employees with filters
     */
    async getEmployees(filters = {}) {
        try {
            let query = this.getDb().collection(COLLECTIONS.USERS);

            // Apply filters
            if (filters.role) {
                query = query.where('role', '==', filters.role);
            }
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
            const employees = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                delete data.password; // Never return password
                employees.push({
                    id: doc.id,
                    ...data,
                });
            });

            return employees;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get employee by ID
     */
    async getEmployeeById(userId) {
        try {
            const doc = await this.getDb().collection(COLLECTIONS.USERS).doc(userId).get();

            if (!doc.exists) {
                throw new Error('Employee not found');
            }

            const data = doc.data();
            delete data.password;

            return {
                id: doc.id,
                ...data,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update employee
     */
    async updateEmployee(userId, updates, performedBy, req) {
        try {
            const userRef = this.getDb().collection(COLLECTIONS.USERS).doc(userId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                throw new Error('Employee not found');
            }

            const previousData = userDoc.data();

            // If email is being changed, check uniqueness
            if (updates.email && updates.email !== previousData.email) {
                const existingUser = await this.db
                    .collection(COLLECTIONS.USERS)
                    .where('email', '==', updates.email)
                    .limit(1)
                    .get();

                if (!existingUser.empty) {
                    throw new Error('Email already registered');
                }
            }

            // PHONE AUTH (COMMENTED FOR FUTURE USE):
            // if (updates.phone && updates.phone !== previousData.phone) {
            //   const existingUser = await this.db
            //     .collection(COLLECTIONS.USERS)
            //     .where('phone', '==', updates.phone)
            //     .limit(1)
            //     .get();
            //   if (!existingUser.empty) {
            //     throw new Error('Phone number already registered');
            //   }
            // }

            const updateData = {
                ...updates,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
            };

            // If password is being updated, hash it
            if (updates.password) {
                updateData.password = await authService.hashPassword(updates.password);
            }

            await userRef.update(updateData);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.USER_UPDATED,
                entityType: 'user',
                entityId: userId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: userId,
                targetEmployeeId: previousData.employeeId,
                previousData: { ...previousData, password: '[REDACTED]' },
                newData: { ...updateData, password: updateData.password ? '[REDACTED]' : undefined },
                req,
            });

            delete updateData.password;

            return {
                id: userId,
                ...previousData,
                ...updateData,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Transfer employee to another department
     */
    async transferEmployee(userId, transferData, performedBy, req) {
        try {
            const userRef = this.getDb().collection(COLLECTIONS.USERS).doc(userId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                throw new Error('Employee not found');
            }

            const employee = userDoc.data();
            const newDepartment = await departmentService.getDepartmentById(transferData.toDepartmentId);

            // Get new shift details if provided
            let newShiftName = null;
            if (transferData.toShiftId) {
                const shiftDoc = await this.getDb().collection(COLLECTIONS.SHIFTS).doc(transferData.toShiftId).get();
                if (shiftDoc.exists) {
                    newShiftName = shiftDoc.data().name;
                }
            }

            // Update employee record
            await userRef.update({
                departmentId: transferData.toDepartmentId,
                departmentName: newDepartment.name,
                shiftId: transferData.toShiftId || null,
                shiftName: newShiftName,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
            });

            // Create transfer record
            const today = new Date().toISOString().split('T')[0];
            await this.createTransferRecord({
                userId,
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                fromDepartmentId: employee.departmentId,
                fromDepartmentName: employee.departmentName,
                toDepartmentId: transferData.toDepartmentId,
                toDepartmentName: newDepartment.name,
                fromShiftId: employee.shiftId,
                fromShiftName: employee.shiftName,
                toShiftId: transferData.toShiftId || null,
                toShiftName: newShiftName,
                transferType: transferData.transferType || TRANSFER_TYPES.TRANSFER,
                reason: transferData.reason || 'Department transfer',
                effectiveDate: transferData.effectiveDate || today,
                transferredBy: performedBy.userId,
                transferredByName: `${performedBy.firstName} ${performedBy.lastName}`,
            });

            // Update department employee counts
            await departmentService.decrementEmployeeCount(employee.departmentId);
            await departmentService.incrementEmployeeCount(transferData.toDepartmentId);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.EMPLOYEE_TRANSFERRED,
                entityType: 'user',
                entityId: userId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: userId,
                targetEmployeeId: employee.employeeId,
                previousData: {
                    departmentId: employee.departmentId,
                    departmentName: employee.departmentName,
                },
                newData: {
                    departmentId: transferData.toDepartmentId,
                    departmentName: newDepartment.name,
                },
                reason: transferData.reason,
                req,
            });

            return { success: true };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Deactivate employee
     */
    async deactivateEmployee(userId, performedBy, req) {
        try {
            const userRef = this.getDb().collection(COLLECTIONS.USERS).doc(userId);
            const userDoc = await userRef.get();

            if (!userDoc.exists) {
                throw new Error('Employee not found');
            }

            const previousData = userDoc.data();

            await userRef.update({
                isActive: false,
                updatedAt: FieldValue.serverTimestamp(),
                updatedBy: performedBy.userId,
            });

            // Decrement department employee count
            if (previousData.isActive) {
                await departmentService.decrementEmployeeCount(previousData.departmentId);
            }

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.USER_DEACTIVATED,
                entityType: 'user',
                entityId: userId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: userId,
                targetEmployeeId: previousData.employeeId,
                previousData: { isActive: true },
                newData: { isActive: false },
                req,
            });

            return { success: true };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get employee transfer history
     */
    async getTransferHistory(userId) {
        try {
            const snapshot = await this.db
                .collection(COLLECTIONS.DEPARTMENT_TRANSFERS)
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .get();

            const transfers = [];
            snapshot.forEach(doc => {
                transfers.push({
                    id: doc.id,
                    ...doc.data(),
                });
            });

            return transfers;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Create department transfer record
     * @private
     */
    async createTransferRecord(transferData) {
        try {
            const today = transferData.effectiveDate || new Date().toISOString().split('T')[0];
            const transferId = await generateId(this.getDb(), COLLECTIONS.DEPARTMENT_TRANSFERS, 'TRN', today);

            const transfer = {
                transferId,
                ...transferData,
                createdAt: FieldValue.serverTimestamp(),
            };

            await this.getDb().collection(COLLECTIONS.DEPARTMENT_TRANSFERS).add(transfer);
        } catch (error) {
            console.error('Error creating transfer record:', error);
            // Don't throw - transfer history is supplementary
        }
    }
}

module.exports = new EmployeeService();
