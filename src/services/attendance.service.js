const { getFirestore, FieldValue, Timestamp } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS, ATTENDANCE_STATUS } = require('../config/constants');
const { generateAttendanceId, formatDate, calculateWorkDuration, isFutureDate } = require('../utils/helpers');
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
     * PRODUCTION RULES: Admin-only, 24-hour cutoff, date-based validation
     */
    async markEntry(userId, entryTime, performedBy, req) {
        try {
            // Parse dates (timezone-safe - date only, not time)
            const entryDate = formatDate(entryTime); // "2025-12-29"
            const today = formatDate(new Date());

            // ============ VALIDATION RULES ============

            // Rule 1: No future dates
            if (entryDate > today) {
                throw new Error('Cannot mark attendance for future dates');
            }

            // Rule 2: Check existing attendance (no duplicates)
            const existingAttendance = await this.getAttendanceByDate(userId, entryDate);
            if (existingAttendance && existingAttendance.entryTime) {
                throw new Error('Entry already marked for this date');
            }

            // Rule 3: Employee must be active
            const employee = await employeeService.getEmployeeById(userId);
            if (!employee || !employee.isActive) {
                throw new Error('Employee is inactive or not found');
            }

            // Rule 4: Department must be active
            if (!employee.departmentId) {
                throw new Error('Employee has no department assigned');
            }

            const deptSnapshot = await this.getDb()
                .collection(COLLECTIONS.DEPARTMENTS)
                .doc(employee.departmentId)
                .get();

            if (!deptSnapshot.exists || !deptSnapshot.data().isActive) {
                throw new Error('Employee\'s department is inactive');
            }

            // Rule 5: 24-hour cutoff (strict)
            const now = new Date();
            const entryDateTime = new Date(entryDate + 'T00:00:00'); // Start of entry date
            const hoursPast = (now - entryDateTime) / (1000 * 60 * 60);

            if (hoursPast > 24) {
                // Only super admin can mark >24h with reason
                if (performedBy.role !== 'super_admin') {
                    throw new Error('Cannot mark attendance older than 24 hours. Contact super admin for corrections.');
                }

                // Super admin must provide correction reason
                if (!req.body.correctionReason) {
                    throw new Error('Super admin must provide correctionReason for attendance older than 24 hours');
                }
            }

            // ============ CREATE ENTRY ============

            // Generate NEW format ID: ATT_XXXXXX (random 6-char)
            const attendanceId = await generateAttendanceId(this.getDb());

            const isCorrected = hoursPast > 24;

            const attendanceData = {
                attendanceId,
                userId,
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                departmentId: employee.departmentId,
                departmentName: deptSnapshot.data().name,
                shiftId: employee.shiftId || null,
                shiftName: employee.shiftName || null,
                date: entryDate,
                entryTime: Timestamp.fromDate(new Date(entryTime)),
                exitTime: null,
                workDurationMinutes: null,
                regularHours: null,  // NEW: Regular shift hours worked
                overtimeHours: null,  // NEW: Overtime hours worked
                totalHours: null,  // NEW: Total hours (regular + overtime)
                overtimeApprovedBy: null,  // NEW: Who approved the overtime
                overtimeReason: null,  // NEW: Reason for overtime
                status: ATTENDANCE_STATUS.PENDING,
                isCorrected,
                correctedBy: isCorrected ? performedBy.userId : null,
                correctionReason: isCorrected ? req.body.correctionReason : null,
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
     * PRODUCTION RULES: Date-based validation, exit after entry, same day, duration limits
     */
    async markExit(userId, exitTime, performedBy, req) {
        try {
            // Parse dates (timezone-safe)
            const exitDate = formatDate(exitTime);
            const today = formatDate(new Date());

            // ============ VALIDATION RULES ============

            // Rule 12: No future dates
            if (exitDate > today) {
                throw new Error('Cannot mark check-out for future dates');
            }

            // Rule 7: Find attendance record with entry
            const attendance = await this.getAttendanceByDate(userId, exitDate);

            if (!attendance) {
                throw new Error('No attendance record found for this date. Mark entry first.');
            }

            if (!attendance.entryTime) {
                throw new Error('No check-in found. Mark entry first.');
            }

            // Rule 8: No duplicate exits
            if (attendance.exitTime) {
                throw new Error('Check-out already marked for this date');
            }

            // Rule 9: Exit must be after entry
            const entryTimestamp = attendance.entryTime.toDate();
            const exitTimestamp = new Date(exitTime);

            if (exitTimestamp <= entryTimestamp) {
                throw new Error('Check-out time must be after check-in time');
            }

            // Rule 10: Same day entry-exit
            const entryDateStr = formatDate(entryTimestamp);
            if (entryDateStr !== exitDate) {
                throw new Error('Check-in and check-out must be on the same day');
            }

            // Rule 11: Reasonable duration (30 min - 24 hours)
            const durationMs = exitTimestamp - entryTimestamp;
            const durationMinutes = durationMs / (1000 * 60);
            const durationHours = durationMinutes / 60;

            if (durationMinutes < 30) {
                throw new Error('Work duration less than 30 minutes. Please verify times.');
            }

            if (durationHours > 24) {
                throw new Error('Work duration exceeds 24 hours. Please verify times.');
            }

            // ============ UPDATE EXIT ============

            const workDurationMinutes = Math.round(durationMinutes);
            const workDurationHoursTotal = parseFloat((durationMinutes / 60).toFixed(2));

            // Calculate overtime (if employee has shift assigned)
            let regularHours = workDurationHoursTotal;
            let overtimeHours = 0;
            
            if (attendance.shiftId) {
                // Fetch shift to get standard work hours
                const shiftDoc = await this.getDb().collection(COLLECTIONS.SHIFTS).doc(attendance.shiftId).get();
                if (shiftDoc.exists) {
                    const shift = shiftDoc.data();
                    const shiftHours = shift.workDurationHours || 8;
                    
                    if (workDurationHoursTotal > shiftHours) {
                        regularHours = shiftHours;
                        overtimeHours = parseFloat((workDurationHoursTotal - shiftHours).toFixed(2));
                    }
                }
            }

            const updateData = {
                exitTime: Timestamp.fromDate(exitTimestamp),
                workDurationMinutes,
                regularHours: parseFloat(regularHours.toFixed(2)),  // NEW: Regular hours worked
                overtimeHours: parseFloat(overtimeHours.toFixed(2)),  // NEW: Overtime hours
                totalHours: workDurationHoursTotal,  // NEW: Total hours
                overtimeApprovedBy: overtimeHours > 0 ? performedBy.userId : null,  // NEW: Auto-approve for now
                overtimeReason: req.body.overtimeReason || null,  // NEW: Optional overtime reason
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
     * Rules: Past 7 days only, reason required (min 10 chars), recalculate salary
     */
    async correctAttendance(attendanceId, corrections, performedBy, req) {
        try {
            const attendanceRef = this.getDb().collection(COLLECTIONS.ATTENDANCE).doc(attendanceId);
            const attendanceDoc = await attendanceRef.get();

            if (!attendanceDoc.exists) {
                throw new Error('Attendance record not found');
            }

            const previousData = attendanceDoc.data();
            const attendanceDate = previousData.date; // YYYY-MM-DD
            const today = formatDate(new Date());

            // ============ VALIDATION RULES ============

            // Rule 1: Cannot correct today's attendance (use mark entry/exit instead)
            if (attendanceDate === today) {
                throw new Error('Cannot correct today\'s attendance. Use mark entry/exit buttons instead.');
            }

            // Rule 2: Can only correct past 7 days
            const attendanceDateObj = new Date(attendanceDate + 'T00:00:00');
            const todayObj = new Date(today + 'T00:00:00');
            const daysDiff = (todayObj - attendanceDateObj) / (1000 * 60 * 60 * 24);

            if (daysDiff > 7) {
                throw new Error('Can only correct attendance from the past 7 days');
            }

            // Rule 3: Reason is required and must be at least 10 characters
            if (!corrections.reason || corrections.reason.trim().length < 10) {
                throw new Error('Correction reason is required and must be at least 10 characters');
            }

            // Rule 4: Validate entry/exit times
            if (corrections.entryTime && corrections.exitTime) {
                const entry = new Date(corrections.entryTime);
                const exit = new Date(corrections.exitTime);

                if (exit <= entry) {
                    throw new Error('Exit time must be after entry time');
                }

                // Ensure times are reasonable (30 min - 24 hours)
                const durationMinutes = (exit - entry) / (1000 * 60);
                if (durationMinutes < 30) {
                    throw new Error('Work duration must be at least 30 minutes');
                }
                if (durationMinutes > 1440) {
                    throw new Error('Work duration cannot exceed 24 hours');
                }
            }

            // ============ PREPARE UPDATE DATA ============

            const updateData = {
                isCorrected: true,
                correctedBy: performedBy.userId,
                correctionReason: corrections.reason.trim(),
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
                const entryTime = corrections.entryTime ? new Date(corrections.entryTime) : previousData.entryTime?.toDate();
                const exitTime = corrections.exitTime ? new Date(corrections.exitTime) : previousData.exitTime?.toDate();

                if (entryTime && exitTime) {
                    updateData.workDurationMinutes = calculateWorkDuration(entryTime, exitTime);
                    updateData.status = ATTENDANCE_STATUS.PRESENT;
                }
            }

            // Update status if provided
            if (corrections.status) {
                updateData.status = corrections.status;
            }

            // Track if status changed (for salary recalculation)
            const statusChanged = updateData.status && updateData.status !== previousData.status;

            await attendanceRef.update(updateData);

            // ============ SALARY RECALCULATION ============
            // If status changed (e.g., pending → present, absent → present), update monthly salary
            if (statusChanged) {
                try {
                    // TODO: Implement salary recalculation when salary service is ready
                    // For now, just log that salary needs recalculation
                    console.log(`[Salary Impact] Attendance correction for user ${previousData.userId} on ${attendanceDate}`);
                    console.log(`[Salary Impact] Status changed: ${previousData.status} → ${updateData.status}`);
                } catch (salaryError) {
                    console.error('Failed to recalculate salary:', salaryError);
                    // Don't fail the correction if salary recalc fails - log it for manual review
                }
            }

            // ============ HISTORY LOGGING ============
            // Log correction to employee history
            const historyService = require('./history.service');
            try {
                await historyService.logChange(
                    previousData.userId,
                    'attendance_corrected',
                    {
                        date: attendanceDate,
                        entryTime: previousData.entryTime,
                        exitTime: previousData.exitTime,
                        status: previousData.status,
                        workDurationMinutes: previousData.workDurationMinutes
                    },
                    {
                        date: attendanceDate,
                        entryTime: updateData.entryTime || previousData.entryTime,
                        exitTime: updateData.exitTime || previousData.exitTime,
                        status: updateData.status || previousData.status,
                        workDurationMinutes: updateData.workDurationMinutes || previousData.workDurationMinutes
                    },
                    performedBy.userId,
                    `Attendance corrected for ${attendanceDate}: ${corrections.reason.trim()}`
                );
            } catch (historyError) {
                console.error('Failed to log to history:', historyError);
                // Don't fail the correction if history logging fails
            }

            // ============ AUDIT LOG ============
            await auditService.log({
                action: AUDIT_ACTIONS.ATTENDANCE_CORRECTED,
                entityType: 'attendance',
                entityId: attendanceId,
                performedBy: performedBy.userId,
                performedByName: `${performedBy.firstName} ${performedBy.lastName}`,
                performedByRole: performedBy.role,
                targetUserId: previousData.userId,
                targetEmployeeId: previousData.employeeId,
                previousData: {
                    date: attendanceDate,
                    entryTime: previousData.entryTime,
                    exitTime: previousData.exitTime,
                    status: previousData.status
                },
                newData: {
                    entryTime: updateData.entryTime,
                    exitTime: updateData.exitTime,
                    status: updateData.status,
                    correctionReason: updateData.correctionReason
                },
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

            const snapshot = await this.getDb()
                .collection(COLLECTIONS.ATTENDANCE)
                .where('userId', '==', userId)
                .where('date', '>=', `${monthStr}-01`)
                .where('date', '<=', `${monthStr}-31`)
                .get();

            let daysPresent = 0;
            let daysAbsent = 0;
            let daysPending = 0;
            let totalOvertimeHours = 0;  // NEW: Sum of all overtime hours

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === ATTENDANCE_STATUS.PRESENT) {
                    daysPresent++;
                    // NEW: Accumulate overtime hours
                    if (data.overtimeHours) {
                        totalOvertimeHours += data.overtimeHours;
                    }
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
                overtimeHours: parseFloat(totalOvertimeHours.toFixed(2)),  // NEW: Total overtime for month
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get past 7 days attendance for correction  
     * Returns attendance records from yesterday to 7 days ago
     */
    async getPast7DaysAttendance(userId) {
        try {
            const today = formatDate(new Date());

            // Calculate 7 days ago (not including today)
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const startDate = formatDate(sevenDaysAgo);

            // Get yesterday's date
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const endDate = formatDate(yesterday);

            const snapshot = await this.getDb()
                .collection(COLLECTIONS.ATTENDANCE)
                .where('userId', '==', userId)
                .where('date', '>=', startDate)
                .where('date', '<=', endDate)
                .orderBy('date', 'desc')
                .get();

            const attendance = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                attendance.push({
                    id: doc.id,
                    ...data,
                    // Convert Timestamps to ISO strings
                    entryTime: data.entryTime?.toDate().toISOString(),
                    exitTime: data.exitTime?.toDate().toISOString(),
                });
            });

            return attendance;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new AttendanceService();
