const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS, DEPARTMENT_HISTORY_ACTIONS } = require('../config/constants');
const { generateDepartmentHistoryId } = require('../utils/helpers');

class DepartmentHistoryService {
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
     * Log a department change to history
     */
    async logChange({
        departmentId,
        departmentDocId,
        departmentName,
        actionType,
        changedFields = [],
        previousData = null,
        newData = null,
        performedBy,
        performedByName,
        performedByRole,
        performedByEmployeeId = null,
        reason = null,
        relatedEntityType = null,
        relatedEntityId = null,
        req = null
    }) {
        try {
            const historyId = generateDepartmentHistoryId();
            
            // Generate human-readable description
            const actionDescription = this.getActionDescription(actionType, changedFields);
            
            const historyRecord = {
                historyId,
                departmentId,
                departmentDocId,
                departmentName,
                actionType,
                actionDescription,
                changedFields,
                previousData,
                newData,
                performedBy,
                performedByName,
                performedByRole,
                performedByEmployeeId,
                timestamp: FieldValue.serverTimestamp(),
                reason,
                relatedEntityType,
                relatedEntityId,
                ipAddress: req?.ip || null,
                userAgent: req?.get('user-agent') || null,
                isDeleted: false
            };

            const docRef = await this.getDb()
                .collection(COLLECTIONS.DEPARTMENT_HISTORY)
                .add(historyRecord);

            return {
                id: docRef.id,
                ...historyRecord
            };
        } catch (error) {
            console.error('Error logging department history:', error);
            // Don't throw - history logging should not break main operations
            return null;
        }
    }

    /**
     * Get department history with filters
     */
    async getHistory(departmentId, filters = {}) {
        try {
            let query = this.getDb()
                .collection(COLLECTIONS.DEPARTMENT_HISTORY)
                .where('departmentId', '==', departmentId)
                .where('isDeleted', '==', false);

            // Filter by action type
            if (filters.actionType) {
                query = query.where('actionType', '==', filters.actionType);
            }

            // Filter by date range
            if (filters.startDate) {
                query = query.where('timestamp', '>=', filters.startDate);
            }
            if (filters.endDate) {
                query = query.where('timestamp', '<=', filters.endDate);
            }

            // Order by timestamp (newest first)
            query = query.orderBy('timestamp', 'desc');

            // Pagination
            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const snapshot = await query.get();
            const history = [];

            snapshot.forEach(doc => {
                history.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return history;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get specific history record by historyId
     */
    async getHistoryById(historyId) {
        try {
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.DEPARTMENT_HISTORY)
                .where('historyId', '==', historyId)
                .limit(1)
                .get();

            if (snapshot.empty) {
                throw new Error('History record not found');
            }

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get all history records across departments (for super admin)
     */
    async getAllHistory(filters = {}) {
        try {
            let query = this.getDb()
                .collection(COLLECTIONS.DEPARTMENT_HISTORY)
                .where('isDeleted', '==', false);

            // Filter by action type
            if (filters.actionType) {
                query = query.where('actionType', '==', filters.actionType);
            }

            // Filter by date range
            if (filters.startDate) {
                query = query.where('timestamp', '>=', filters.startDate);
            }
            if (filters.endDate) {
                query = query.where('timestamp', '<=', filters.endDate);
            }

            // Order by timestamp (newest first)
            query = query.orderBy('timestamp', 'desc');

            // Pagination
            const limit = filters.limit || 100;
            query = query.limit(limit);

            const snapshot = await query.get();
            const history = [];

            snapshot.forEach(doc => {
                history.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return history;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Generate human-readable action description
     */
    getActionDescription(actionType, changedFields = []) {
        const descriptions = {
            [DEPARTMENT_HISTORY_ACTIONS.CREATED]: 'Department created',
            [DEPARTMENT_HISTORY_ACTIONS.UPDATED]: changedFields.length > 0 
                ? `Department updated: ${changedFields.join(', ')}`
                : 'Department updated',
            [DEPARTMENT_HISTORY_ACTIONS.DELETED]: 'Department deleted',
            [DEPARTMENT_HISTORY_ACTIONS.ACTIVATED]: 'Department activated',
            [DEPARTMENT_HISTORY_ACTIONS.DEACTIVATED]: 'Department deactivated',
            [DEPARTMENT_HISTORY_ACTIONS.HEAD_ASSIGNED]: 'Department head assigned',
            [DEPARTMENT_HISTORY_ACTIONS.HEAD_CHANGED]: 'Department head changed',
            [DEPARTMENT_HISTORY_ACTIONS.HEAD_REMOVED]: 'Department head removed',
            [DEPARTMENT_HISTORY_ACTIONS.ROLE_ADDED]: 'New role added',
            [DEPARTMENT_HISTORY_ACTIONS.ROLE_UPDATED]: 'Role updated',
            [DEPARTMENT_HISTORY_ACTIONS.ROLE_REMOVED]: 'Role removed',
            [DEPARTMENT_HISTORY_ACTIONS.SHIFTS_CONFIG_CHANGED]: 'Shifts configuration changed'
        };

        return descriptions[actionType] || `Action: ${actionType}`;
    }
}

module.exports = new DepartmentHistoryService();
