const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS } = require('../config/constants');
const { getClientIp } = require('../utils/helpers');

class AuditService {
    constructor() {
        this.db = null;
    }

    // Lazy initialize database connection
    getDb() {
        if (!this.db) {
            this.db = getFirestore();
        }
        return this.db;
    }

    /**
     * Log an audit event
     * @param {Object} auditData - Audit data
     * @param {string} auditData.action - Action performed
     * @param {string} auditData.entityType - Type of entity modified
     * @param {string} auditData.entityId - ID of the entity
     * @param {string} auditData.performedBy - User ID who performed the action
     * @param {string} auditData.performedByName - Name of user
     * @param {string} auditData.performedByRole - Role of user
     * @param {Object} auditData.previousData - State before change
     * @param {Object} auditData.newData - State after change
     * @param {string} auditData.reason - Optional reason for the action
     * @param {Object} auditData.req - Express request object (for IP)
     */
    async log(auditData) {
        try {
            const {
                action,
                entityType,
                entityId,
                performedBy,
                performedByName,
                performedByRole,
                targetUserId = null,
                targetEmployeeId = null,
                previousData = null,
                newData = null,
                reason = null,
                req = null,
            } = auditData;

            const auditLog = {
                action,
                entityType,
                entityId,
                performedBy,
                performedByName,
                performedByRole,
                targetUserId,
                targetEmployeeId,
                previousData,
                newData,
                reason,
                ipAddress: req ? getClientIp(req) : 'system',
                timestamp: FieldValue.serverTimestamp(),
            };

            await this.getDb().collection(COLLECTIONS.AUDIT_LOGS).add(auditLog);
        } catch (error) {
            // Don't throw error for audit logging failures - log it instead
            console.error('Failed to create audit log:', error);
        }
    }

    /**
     * Get audit logs with filters
     */
    async getAuditLogs(filters = {}) {
        try {
            let query = this.getDb().collection(COLLECTIONS.AUDIT_LOGS);

            // Apply filters
            if (filters.action) {
                query = query.where('action', '==', filters.action);
            }
            if (filters.entityType) {
                query = query.where('entityType', '==', filters.entityType);
            }
            if (filters.performedBy) {
                query = query.where('performedBy', '==', filters.performedBy);
            }
            if (filters.startDate) {
                query = query.where('timestamp', '>=', new Date(filters.startDate));
            }
            if (filters.endDate) {
                query = query.where('timestamp', '<=', new Date(filters.endDate));
            }

            // Order and pagination
            query = query.orderBy('timestamp', 'desc');
            if (filters.limit) {
                query = query.limit(parseInt(filters.limit));
            }
            if (filters.offset) {
                query = query.offset(parseInt(filters.offset));
            }

            const snapshot = await query.get();
            const logs = [];

            snapshot.forEach(doc => {
                logs.push({
                    id: doc.id,
                    ...doc.data(),
                });
            });

            return logs;
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            throw new Error('Failed to fetch audit logs');
        }
    }
}

module.exports = new AuditService();
