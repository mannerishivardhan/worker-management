const { getFirestore, FieldValue } = require('../config/firebase');
const { COLLECTIONS } = require('../config/constants');

class HistoryService {
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
     * Log a change to employee history
     * Creates a subcollection under users/{userId}/history
     */
    async logChange(userId, changeType, previousData, newData, changedBy, reason = null) {
        try {
            // Calculate changed fields
            const changedFields = [];
            if (previousData && newData) {
                for (const key in newData) {
                    if (newData[key] !== previousData[key] && key !== 'updatedAt' && key !== 'updatedBy') {
                        changedFields.push(key);
                    }
                }
            }

            const historyEntry = {
                changeType,
                previousData: previousData || null,
                newData: newData || null,
                changedFields,
                changedBy,
                reason,
                timestamp: FieldValue.serverTimestamp(),
            };

            await this.getDb()
                .collection(COLLECTIONS.USERS)
                .doc(userId)
                .collection('history')
                .add(historyEntry);

            return historyEntry;
        } catch (error) {
            console.error('Error logging history:', error);
            throw error;
        }
    }

    /**
     * Get employee history with optional filters
     */
    async getHistory(userId, filters = {}) {
        try {
            let query = this.getDb()
                .collection(COLLECTIONS.USERS)
                .doc(userId)
                .collection('history');

            // Apply filters
            if (filters.changeType) {
                query = query.where('changeType', '==', filters.changeType);
            }
            if (filters.startDate) {
                query = query.where('timestamp', '>=', new Date(filters.startDate));
            }
            if (filters.endDate) {
                query = query.where('timestamp', '<=', new Date(filters.endDate));
            }

            // Pagination
            if (filters.limit) {
                query = query.limit(parseInt(filters.limit));
            }

            // Order by most recent
            query = query.orderBy('timestamp', 'desc');

            const snapshot = await query.get();
            const history = [];

            snapshot.forEach(doc => {
                history.push({
                    id: doc.id,
                    ...doc.data(),
                });
            });

            return history;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new HistoryService();
