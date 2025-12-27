module.exports = {
    // JWT Configuration
    JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-in-production',
    JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',

    // Server Configuration
    PORT: process.env.PORT || 3000,
    HOST: process.env.HOST || 'localhost',
    NODE_ENV: process.env.NODE_ENV || 'development',

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
        USER_CREATED: 'user_created',
        USER_UPDATED: 'user_updated',
        USER_DEACTIVATED: 'user_deactivated',
        DEPARTMENT_CREATED: 'department_created',
        DEPARTMENT_UPDATED: 'department_updated',
        SHIFT_CREATED: 'shift_created',
        SHIFT_UPDATED: 'shift_updated',
        SHIFT_ASSIGNED: 'shift_assigned',
        ATTENDANCE_MARKED: 'attendance_marked',
        ATTENDANCE_CORRECTED: 'attendance_corrected',
        EMPLOYEE_TRANSFERRED: 'employee_transferred',
        LOGIN_SUCCESS: 'login_success',
        LOGIN_FAILED: 'login_failed',
    },

    // Collection Names
    COLLECTIONS: {
        USERS: 'users',
        DEPARTMENTS: 'departments',
        SHIFTS: 'shifts',
        ATTENDANCE: 'attendance',
        AUDIT_LOGS: 'audit_logs',
        DEPARTMENT_TRANSFERS: 'department_transfers',
    },
};
