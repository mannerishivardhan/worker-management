/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * Get number of days in a month
 */
const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
};

/**
 * Generate unique ID with prefix
 * Format: PREFIX + YYYYMMDD + auto-increment number
 */
const generateId = async (db, collectionName, prefix, dateStr) => {
    const date = dateStr.replace(/-/g, '');
    const prefixPattern = `${prefix}${date}`;

    try {
        // Query for existing IDs with the same prefix
        const snapshot = await db.collection(collectionName)
            .where('id', '>=', prefixPattern)
            .where('id', '<=', prefixPattern + '\uf8ff')
            .orderBy('id', 'desc')
            .limit(1)
            .get();

        let counter = 1;

        if (!snapshot.empty) {
            const lastId = snapshot.docs[0].data().id || snapshot.docs[0].id;
            const lastCounter = parseInt(lastId.slice(-3));
            counter = lastCounter + 1;
        }

        return `${prefixPattern}${String(counter).padStart(3, '0')}`;
    } catch (error) {
        console.error('Error generating ID:', error);
        // Fallback: use timestamp
        return `${prefixPattern}${Date.now().toString().slice(-3)}`;
    }
};

/**
 * Calculate work duration in minutes
 */
const calculateWorkDuration = (entryTime, exitTime) => {
    if (!entryTime || !exitTime) return null;

    const entry = new Date(entryTime);
    const exit = new Date(exitTime);

    const durationMs = exit - entry;
    return Math.floor(durationMs / (1000 * 60)); // Convert to minutes
};

/**
 * Sanitize user object (remove sensitive data)
 */
const sanitizeUser = (user) => {
    const { password, ...sanitized } = user;
    return sanitized;
};

/**
 * Check if date is in the future
 */
const isFutureDate = (date) => {
    return new Date(date) > new Date();
};

/**
 * Get client IP address
 */
const getClientIp = (req) => {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        'unknown';
};

module.exports = {
    formatDate,
    getDaysInMonth,
    generateId,
    calculateWorkDuration,
    sanitizeUser,
    isFutureDate,
    getClientIp,
};
