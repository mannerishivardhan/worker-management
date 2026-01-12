const { getFirestore, FieldValue, Timestamp } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS, TRANSFER_TYPES } = require('../config/constants');
const { generateEmployeeId, generateAvatarUrl } = require('../utils/helpers'); // NEW: Sequential ID generator + Avatar
const authService = require('./auth.service');
const departmentService = require('./department.service');
const auditService = require('./audit.service');
const historyService = require('./history.service'); // NEW: History tracking

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

            // NOTE: Shift assignment is OPTIONAL even in shift-based departments
            // Employees can be: unassigned, day off, floating, etc.

            // Generate NEW format ID: EMP_00001 (sequential 5-digit)
            const employeeId = await generateEmployeeId(this.getDb());

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

            // Generate avatar URL (deterministic based on employee ID)
            const avatar = generateAvatarUrl(employeeId, employeeData.firstName, employeeData.lastName);

            // Calculate hourly rate and overtime only for employees (not admins)
            let hourlyRate = null;
            let overtimeMultiplier = null;
            let overtimeRate = null;
            let overtimeEligible = false;

            if (employeeData.role === 'employee' && employeeData.overtimeEligible) {
                hourlyRate = employeeData.monthlySalary / (30 * 8);
                overtimeMultiplier = employeeData.overtimeMultiplier || 1.5;
                overtimeRate = hourlyRate * overtimeMultiplier;
                overtimeEligible = true;
            }

            const newEmployee = {
                employeeId,
                firstName: employeeData.firstName,
                lastName: employeeData.lastName,
                email: employeeData.email,
                phone: employeeData.phone || null, // Optional, for contact purposes
                password: hashedPassword,
                role: employeeData.role,
                jobRole: employeeData.jobRole || null,  // NEW: Job classification (e.g., "Normal Security Staff")
                departmentId: employeeData.departmentId,
                departmentName: department.name,
                shiftId: employeeData.shiftId || null,
                shiftName: shiftName,
                monthlySalary: employeeData.monthlySalary,
                hourlyRate: hourlyRate ? parseFloat(hourlyRate.toFixed(2)) : null,  // NULL for admins
                overtimeEligible: overtimeEligible,  // FALSE for admins
                overtimeMultiplier: overtimeMultiplier,  // NULL for admins
                overtimeRate: overtimeRate ? parseFloat(overtimeRate.toFixed(2)) : null,  // NULL for admins
                joiningDate: joiningDateTimestamp, // Firestore Timestamp

                // NEW: Emergency contact information
                emergencyContact: employeeData.emergencyContact || {
                    name: null,
                    relationship: null,
                    phone: null,
                    alternatePhone: null,
                    address: null
                },

                // NEW: Avatar and photo
                avatar: avatar, // Auto-generated from DiceBear
                photoUrl: employeeData.photoUrl || null, // Custom photo (if uploaded)

                isActive: true,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                createdBy: performedBy.userId,
                createdByRole: performedBy.role,
                updatedBy: performedBy.userId,
                updatedByRole: performedBy.role,
            };

            const userRef = await this.getDb().collection(COLLECTIONS.USERS).add(newEmployee);

            // Define today for transfer record
            const today = new Date().toISOString().split('T')[0];

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

            // Only add orderBy if NO filters are applied (to avoid composite index requirement)
            // If filters are present, we'll sort in memory
            const hasFilters = filters.role || filters.departmentId || (filters.isActive !== undefined);
            if (!hasFilters) {
                query = query.orderBy('createdAt', 'desc');
            }

            // Pagination
            if (filters.limit) {
                query = query.limit(parseInt(filters.limit));
            }
            if (filters.offset) {
                query = query.offset(parseInt(filters.offset));
            }

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

            // Sort in memory if filters were applied
            if (hasFilters) {
                employees.sort((a, b) => {
                    const aTime = a.createdAt?._seconds || 0;
                    const bTime = b.createdAt?._seconds || 0;
                    return bTime - aTime; // desc order
                });
            }

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
                const existingUser = await this.getDb()
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
                updatedByRole: performedBy.role,
            };

            // If department is changed, update department name
            if (updates.departmentId && updates.departmentId !== previousData.departmentId) {
                const department = await departmentService.getDepartmentById(updates.departmentId);
                updateData.departmentName = department.name;

                // Update department employee counts
                await departmentService.decrementEmployeeCount(previousData.departmentId);
                await departmentService.incrementEmployeeCount(updates.departmentId);

                // Log department transfer to history
                await historyService.logChange(
                    userId,
                    'department_transferred',
                    {
                        departmentId: previousData.departmentId,
                        departmentName: previousData.departmentName
                    },
                    {
                        departmentId: updates.departmentId,
                        departmentName: department.name
                    },
                    performedBy.userId,
                    `Transferred from ${previousData.departmentName} to ${department.name}`
                );
            }

            // If role is changed, log to history
            if (updates.role && updates.role !== previousData.role) {
                await historyService.logChange(
                    userId,
                    'role_changed',
                    { role: previousData.role },
                    { role: updates.role },
                    performedBy.userId,
                    `Role changed from ${previousData.role} to ${updates.role}`
                );
            }

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

            // NEW: Log to employee history subcollection
            // Clean data to remove undefined values (Firestore doesn't accept them)
            const cleanPreviousData = { ...previousData };
            delete cleanPreviousData.password;

            const cleanNewData = { ...updateData };
            if (cleanNewData.password) {
                cleanNewData.password = '[REDACTED]';
            } else {
                delete cleanNewData.password;
            }

            await historyService.logChange(
                userId,
                'profile_updated',
                cleanPreviousData,
                cleanNewData,
                performedBy.userId,
                'Employee profile information updated'
            );

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
                updatedByRole: performedBy.role,
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
                updatedByRole: performedBy.role,
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
