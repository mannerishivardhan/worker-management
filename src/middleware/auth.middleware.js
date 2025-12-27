const jwt = require('jsonwebtoken');
const { JWT_SECRET, ROLES } = require('../config/constants');

/**
 * Middleware to verify JWT token
 */
const verifyToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided. Authorization header required.',
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Attach user info to request
        req.user = {
            userId: decoded.userId,
            employeeId: decoded.employeeId,
            role: decoded.role,
            departmentId: decoded.departmentId || null,
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token has expired. Please login again.',
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token. Please login again.',
            });
        }

        return res.status(500).json({
            success: false,
            message: 'Authentication error',
            error: error.message,
        });
    }
};

/**
 * Middleware to check if user has required role(s)
 * @param {Array<string>} allowedRoles - Array of allowed roles
 */
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required',
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
            });
        }

        next();
    };
};

/**
 * Middleware to check if user can access specific department
 * Super Admin can access all departments
 * Admin can only access their own department
 */
const checkDepartmentAccess = (req, res, next) => {
    const { role, departmentId: userDepartmentId } = req.user;

    // Tenant and Super Admin can access all departments
    if (role === ROLES.TENANT || role === ROLES.SUPER_ADMIN) {
        return next();
    }

    // Admin can only access their own department
    if (role === ROLES.ADMIN) {
        const targetDepartmentId = req.params.departmentId || req.body.departmentId;

        if (targetDepartmentId && targetDepartmentId !== userDepartmentId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. You can only access your own department.',
            });
        }
    }

    next();
};

/**
 * Middleware to check if user can perform write operations
 * Tenant can only read, cannot write
 */
const requireWriteAccess = (req, res, next) => {
    if (req.user.role === ROLES.TENANT) {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Tenant role has read-only access.',
        });
    }
    next();
};

module.exports = {
    verifyToken,
    requireRole,
    checkDepartmentAccess,
    requireWriteAccess,
};
