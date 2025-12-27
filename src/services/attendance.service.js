const { getFirestore, FieldValue, Timestamp } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS, ATTENDANCE_STATUS } = require('../config/constants');
const { generateId, formatDate, calculateWorkDuration, isFutureDate } = require('../utils/helpers');
const employeeService = require('./employee.service');
const auditService = require('./audit.service');

class AttendanceService {
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
     * Mark entry (check-in) for an employee
     */
    async markEntry(userId, entryTime, performedBy, req) {
        try {
            // Validate entry time is not in future
            if (isFutureDate(entryTime)) {
                throw new Error('Cannot mark attendance for future date');
            }

            // Get employee details
            const employee = await employeeService.getEmployeeById(userId);

            const dateStr = formatDate(entryTime);

            // Check if attendance already exists for this date
            const existingAttendance = await this.getAttendanceByDate(userId, dateStr);

            if (existingAttendance) {
                throw new Error('Entry already marked for this date');
            }

            // Generate attendance ID
            const attendanceId = await generateId(this.getDb(), COLLECTIONS.ATTENDANCE, 'ATT', dateStr);

            const attendanceData = {
                attendanceId,
                userId,
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                departmentId: employee.departmentId,
                departmentName: employee.departmentName,
                shiftId: employee.shiftId,
                shiftName: employee.shiftName,
                date: dateStr,
                entryTime: Timestamp.fromDate(new Date(entryTime)),
                exitTime: null,
                workDurationMinutes: null,
                status: ATTENDANCE_STATUS.PENDING,
                isCorrected: false,
                correctedBy: null,
                correctionReason: null,
                markedBy: performedBy.userId,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            };

            const docRef = await this.getDb().collection(COLLECTIONS.ATTENDANCE).add(attendanceData);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
                entityType: 'attendance',
                entityId: docRef.id,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: userId,
                targetEmployeeId: employee.employeeId,
                newData: attendanceData,
                req,
            });

            return {
                id: docRef.id,
                ...attendanceData,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Mark exit (check-out) for an employee
     */
    async markExit(userId, exitTime, performedBy, req) {
        try {
            // Validate exit time is not in future
            if (isFutureDate(exitTime)) {
                throw new Error('Cannot mark exit for future date');
            }

            const dateStr = formatDate(exitTime);

            // Find attendance record for this date
            const attendance = await this.getAttendanceByDate(userId, dateStr);

            if (!attendance) {
                throw new Error('No entry found for this date. Please mark entry first.');
            }

            if (attendance.exitTime) {
                throw new Error('Exit already marked for this date');
            }

            // Validate exit is after entry
            const entryDate = attendance.entryTime.toDate();
            const exitDate = new Date(exitTime);

            if (exitDate <= entryDate) {
                throw new Error('Exit time must be after entry time');
            }

            // Calculate work duration
            const workDurationMinutes = calculateWorkDuration(entryDate, exitDate);

            const updateData = {
                exitTime: Timestamp.fromDate(exitDate),
                workDurationMinutes,
                status: ATTENDANCE_STATUS.PRESENT,
                updatedAt: FieldValue.serverTimestamp(),
            };

            await this.getDb().collection(COLLECTIONS.ATTENDANCE).doc(attendance.id).update(updateData);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.ATTENDANCE_MARKED,
                entityType: 'attendance',
                entityId: attendance.id,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: userId,
                targetEmployeeId: attendance.employeeId,
                previousData: { exitTime: null, status: ATTENDANCE_STATUS.PENDING },
                newData: updateData,
                req,
            });

            return {
                id: attendance.id,
                ...attendance,
                ...updateData,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Correct attendance record
     */
    async correctAttendance(attendanceId, corrections, performedBy, req) {
        try {
            const attendanceRef = this.getDb().collection(COLLECTIONS.ATTENDANCE).doc(attendanceId);
            const attendanceDoc = await attendanceRef.get();

            if (!attendanceDoc.exists) {
                throw new Error('Attendance record not found');
            }

            const previousData = attendanceDoc.data();

            // Validate corrections
            if (corrections.entryTime && corrections.exitTime) {
                const entry = new Date(corrections.entryTime);
                const exit = new Date(corrections.exitTime);

                if (exit <= entry) {
                    throw new Error('Exit time must be after entry time');
                }
            }

            const updateData = {
                isCorrected: true,
                correctedBy: performedBy.userId,
                correctionReason: corrections.reason || 'Attendance correction',
                updatedAt: FieldValue.serverTimestamp(),
            };

            // Update entry time if provided
            if (corrections.entryTime) {
                updateData.entryTime = Timestamp.fromDate(new Date(corrections.entryTime));
            }

            // Update exit time if provided
            if (corrections.exitTime) {
                updateData.exitTime = Timestamp.fromDate(new Date(corrections.exitTime));
            }

            // Recalculate work duration if times were corrected
            if (corrections.entryTime || corrections.exitTime) {
                const entryTime = corrections.entryTime ? new Date(corrections.entryTime) : previousData.entryTime.toDate();
                const exitTime = corrections.exitTime ? new Date(corrections.exitTime) : previousData.exitTime?.toDate();

                if (exitTime) {
                    updateData.workDurationMinutes = calculateWorkDuration(entryTime, exitTime);
                    updateData.status = ATTENDANCE_STATUS.PRESENT;
                }
            }

            // Update status if provided
            if (corrections.status) {
                updateData.status = corrections.status;
            }

            await attendanceRef.update(updateData);

            // Audit log
            await auditService.log({
                action: AUDIT_ACTIONS.ATTENDANCE_CORRECTED,
                entityType: 'attendance',
                entityId: attendanceId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: previousData.userId,
                targetEmployeeId: previousData.employeeId,
                previousData,
                newData: updateData,
                reason: corrections.reason,
                req,
            });

            return {
                id: attendanceId,
                ...previousData,
                ...updateData,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get attendance records with filters
     */
    async getAttendance(filters = {}) {
        try {
            let query = this.getDb().collection(COLLECTIONS.ATTENDANCE);

            // Apply filters
            if (filters.userId) {
                query = query.where('userId', '==', filters.userId);
            }
            if (filters.departmentId) {
                query = query.where('departmentId', '==', filters.departmentId);
            }
            if (filters.date) {
                query = query.where('date', '==', filters.date);
            }
            if (filters.status) {
                query = query.where('status', '==', filters.status);
            }
            if (filters.startDate && filters.endDate) {
                query = query.where('date', '>=', filters.startDate)
                    .where('date', '<=', filters.endDate);
            }

            // Pagination
            if (filters.limit) {
                query = query.limit(parseInt(filters.limit));
            }
            if (filters.offset) {
                query = query.offset(parseInt(filters.offset));
            }

            query = query.orderBy('date', 'desc');

            const snapshot = await query.get();
            const attendance = [];

            snapshot.forEach(doc => {
                const data = doc.data();
                attendance.push({
                    id: doc.id,
                    ...data,
                    // Convert Timestamps to ISO strings for JSON response
                    entryTime: data.entryTime?.toDate().toISOString(),
                    exitTime: data.exitTime?.toDate().toISOString(),
                });
            });

            return attendance;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get attendance record by user and date
     * @private
     */
    async getAttendanceByDate(userId, dateStr) {
        try {
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.ATTENDANCE)
                .where('userId', '==', userId)
                .where('date', '==', dateStr)
                .limit(1)
                .get();

            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data(),
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get monthly attendance summary for an employee
     */
    async getMonthlyAttendanceSummary(userId, year, month) {
        try {
            // Format: YYYY-MM
            const monthStr = `${year}-${String(month).padStart(2, '0')}`;

            const snapshot = await this.db
                .collection(COLLECTIONS.ATTENDANCE)
                .where('userId', '==', userId)
                .where('date', '>=', `${monthStr}-01`)
                .where('date', '<=', `${monthStr}-31`)
                .get();

            let daysPresent = 0;
            let daysAbsent = 0;
            let daysPending = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === ATTENDANCE_STATUS.PRESENT) {
                    daysPresent++;
                } else if (data.status === ATTENDANCE_STATUS.ABSENT) {
                    daysAbsent++;
                } else if (data.status === ATTENDANCE_STATUS.PENDING) {
                    daysPending++;
                }
            });

            return {
                totalRecords: snapshot.size,
                daysPresent,
                daysAbsent,
                daysPending,
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new AttendanceService();
