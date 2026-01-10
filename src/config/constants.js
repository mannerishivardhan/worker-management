module.exports = {
    // JWT Configuration
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
    JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',

    // Server Configuration
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || 'localhost',
    NODE_ENV: process.env.NODE_ENV || 'development',
    PRODUCTION_URL: process.env.PRODUCTION_URL || 'http://localhost:3000',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',

    // Rate Limiting
    RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,

    // User Roles
    ROLES: {
        TENANT: 'tenant',
        SUPER_ADMIN: 'super_admin',
        ADMIN: 'admin',
        EMPLOYEE: 'employee',
    },

    // Attendance Status
    ATTENDANCE_STATUS: {
        PRESENT: 'present',
        ABSENT: 'absent',
        HALF_DAY: 'half_day',
        PENDING: 'pending',
    },

    // Transfer Types
    TRANSFER_TYPES: {
        INITIAL_ASSIGNMENT: 'initial_assignment',
        TRANSFER: 'transfer',
        PROMOTION: 'promotion',
    },

    // Action Types for Audit Logs
    AUDIT_ACTIONS: {
        // Authentication
        LOGIN_SUCCESS: 'LOGIN_SUCCESS',
        LOGIN_FAILED: 'LOGIN_FAILED',
        LOGOUT: 'LOGOUT', // NEW: Track logout events

        // Department
        DEPARTMENT_CREATED: 'DEPARTMENT_CREATED',
        DEPARTMENT_UPDATED: 'DEPARTMENT_UPDATED',
        DEPARTMENT_DELETED: 'DEPARTMENT_DELETED',
        DEPARTMENT_DEACTIVATED: 'DEPARTMENT_DEACTIVATED', // NEW

        // Employee
        EMPLOYEE_CREATED: 'EMPLOYEE_CREATED',
        EMPLOYEE_UPDATED: 'EMPLOYEE_UPDATED',
        EMPLOYEE_DEACTIVATED: 'EMPLOYEE_DEACTIVATED',
        EMPLOYEE_TRANSFERRED: 'EMPLOYEE_TRANSFERRED',

        // Shift
        SHIFT_CREATED: 'SHIFT_CREATED',
        SHIFT_UPDATED: 'SHIFT_UPDATED',
        SHIFT_DELETED: 'SHIFT_DELETED',

        // Attendance
        ATTENDANCE_MARKED: 'ATTENDANCE_MARKED',
        ATTENDANCE_CORRECTED: 'ATTENDANCE_CORRECTED',
    },

    // Collection Names
    COLLECTIONS: {
        USERS: 'users',
        DEPARTMENTS: 'departments',
        SHIFTS: 'shifts',
        ATTENDANCE: 'attendance',
        AUDIT_LOGS: 'audit_logs',
        TRANSFER_HISTORY: 'transfer_history',
        REFRESH_TOKENS: 'refresh_tokens', // NEW: For sliding window refresh tokens
        SHIFT_ASSIGNMENTS: 'shift_assignments', // NEW: For shift scheduling
    },

    // Shift Assignment Status (NEW: For scheduling)
    ASSIGNMENT_STATUS: {
        SCHEDULED: 'scheduled',    // Shift planned but not started
        CONFIRMED: 'confirmed',    // Employee confirmed the shift
        CANCELLED: 'cancelled',    // Shift assignment cancelled
        COMPLETED: 'completed',    // Shift completed
    },

    // Overtime Multipliers (NEW: For overtime pay calculations)
    OVERTIME_MULTIPLIERS: {
        STANDARD: 1.5,    // 150% for regular overtime (after 8 hours)
        WEEKEND: 2.0,     // 200% for weekend/holiday work
        NIGHT: 1.75,      // 175% for night shift overtime
        HOLIDAY: 2.5,     // 250% for public holiday work
    },

    // Default Work Hours
    DEFAULT_WORK_HOURS: {
        DAILY: 8,         // Standard 8-hour workday
        WEEKLY: 40,       // Standard 40-hour workweek
        MONTHLY: 240,     // Approximate monthly hours (30 days × 8 hours)
    },
};
