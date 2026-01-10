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

// ==================== NEW HYBRID ID GENERATION SYSTEM ====================

/**
 * Generate random alphanumeric ID (excludes confusing characters)
 * Used for departments, shifts, attendance
 * Format: PREFIX_XXXX (4 chars) or PREFIX_XXXXXX (6 chars)
 */
const generateRandomId = (prefix, length = 4) => {
    // Exclude confusing characters: O, 0, I, 1, l
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let id = prefix + '_';

    for (let i = 0; i < length; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }

    return id;
};

/**
 * Check if ID exists in collection
 */
const checkIdExists = async (db, collectionName, fieldName, id) => {
    const snapshot = await db.collection(collectionName)
        .where(fieldName, '==', id)
        .limit(1)
        .get();

    return !snapshot.empty;
};

/**
 * Generate unique department ID
 * Format: DEPT_XXXX (random 4-char alphanumeric)
 * Example: DEPT_A2F9, DEPT_K7X3
 */
const generateDepartmentId = async (db) => {
    let id;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (exists && attempts < maxAttempts) {
        id = generateRandomId('DEPT', 4);
        exists = await checkIdExists(db, 'departments', 'departmentId', id);
        attempts++;
    }

    if (attempts >= maxAttempts) {
        // Fallback to 6 chars if collision persists
        id = generateRandomId('DEPT', 6);
    }

    return id;
};

/**
 * Generate sequential employee ID
 * Format: EMP_XXXXX (sequential 5-digit)
 * Example: EMP_00001, EMP_00002, EMP_00003
 * Supports up to 99,999 employees
 */
const generateEmployeeId = async (db) => {
    const counterRef = db.collection('counters').doc('employee');

    try {
        // Use Firestore transaction for atomic counter increment
        const newCount = await db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let currentCount = 0;
            if (counterDoc.exists) {
                currentCount = counterDoc.data().count || 0;
            }

            const newCount = currentCount + 1;

            transaction.set(counterRef, {
                count: newCount,
                lastUpdated: new Date().toISOString()
            });

            return newCount;
        });

        // Format: EMP_00001
        return `EMP_${String(newCount).padStart(5, '0')}`;
    } catch (error) {
        console.error('Error generating employee ID:', error);
        // Fallback to random if counter fails
        return generateRandomId('EMP', 5);
    }
};

/**
 * Generate unique shift ID
 * Format: SHFT_XXXX (random 4-char alphanumeric)
 * Example: SHFT_B3Q8, SHFT_M9P2
 */
const generateShiftId = async (db) => {
    let id;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (exists && attempts < maxAttempts) {
        id = generateRandomId('SHFT', 4);
        exists = await checkIdExists(db, 'shifts', 'shiftId', id);
        attempts++;
    }

    if (attempts >= maxAttempts) {
        id = generateRandomId('SHFT', 6);
    }

    return id;
};

/**
 * Generate unique attendance ID
 * Format: ATT_XXXXXX (random 6-char alphanumeric)
 * Example: ATT_K3X7M9, ATT_R5Q8P4
 * 6 chars for high volume (more unique combinations)
 */
const generateAttendanceId = async (db) => {
    let id;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 10;

    while (exists && attempts < maxAttempts) {
        id = generateRandomId('ATT', 6);
        exists = await checkIdExists(db, 'attendance', 'attendanceId', id);
        attempts++;
    }

    if (attempts >= maxAttempts) {
        // Fallback to timestamp if collision
        id = `ATT_${Date.now().toString(36).toUpperCase()}`;
    }

    return id;
};

/**
 * Generate department history ID
 * Format: DHIST_XXXXXX (random 6-char alphanumeric)
 * Example: DHIST_K3X7M9
 */
const generateDepartmentHistoryId = () => {
    return generateRandomId('DHIST', 6);
};

// ==================== OLD FUNCTION (BACKWARD COMPATIBILITY) ====================

/**
 * OLD FUNCTION - Keep for backward compatibility with existing data
 * @deprecated Use new specific ID generators instead
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

// ==================== OTHER UTILITIES ====================

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

/**
 * Generate deterministic avatar URL using DiceBear API
 * Same input = same avatar (perfect for consistency)
 * Format: https://api.dicebear.com/7.x/style/svg?seed=value
 */
const generateAvatarUrl = (employeeId, firstName, lastName) => {
    // Use employee ID as seed for deterministic generation
    const seed = employeeId || `${firstName}${lastName}`;

    // DiceBear avatar styles (choose one):
    // avataaars, bottts, fun-emoji, identicon, lorelei, micah, personas
    const style = 'avataaars'; // Professional human avatars

    // Generate URL with customization
    const baseUrl = `https://api.dicebear.com/7.x/${style}/svg`;
    const params = new URLSearchParams({
        seed: seed,
        backgroundColor: 'b6e3f4,c0aede,d1d4f9', // Soft pastel colors
        radius: '50', // Rounded corners
    });

    return `${baseUrl}?${params.toString()}`;
};

// ==================== SHIFT SCHEDULING HELPERS ====================

/**
 * Generate shift schedule assignment ID
 * Format: SCHD_XXXXXX (random 6-char)
 */
const generateScheduleId = async (db) => {
    const { COLLECTIONS } = require('../config/constants');
    let scheduleId;
    let exists = true;

    while (exists) {
        scheduleId = generateRandomId('SCHD', 6);
        exists = await checkIdExists(db, COLLECTIONS.SHIFT_ASSIGNMENTS, 'assignmentId', scheduleId);
    }

    return scheduleId;
};

/**
 * Get ISO week number from date
 * Returns format: "2025-W52"
 */
const getISOWeek = (date) => {
    const d = new Date(date);

    // Set to nearest Thursday: current date + 4 - current day number
    // Make Sunday's day number 7
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));

    // Get first day of year
    const yearStart = new Date(d.getFullYear(), 0, 1);

    // Calculate full weeks to nearest Thursday
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);

    // Return ISO week number in format: YYYY-WNN
    return `${d.getFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

/**
 * Get start and end dates from ISO week number
 * Input: "2025-W52"
 * Output: { startDate: "2025-12-22", endDate: "2025-12-28" }
 */
const getWeekDates = (isoWeek) => {
    const [year, week] = isoWeek.split('-W');

    // January 4th is always in week 1
    const jan4 = new Date(parseInt(year), 0, 4);

    // Get Monday of week 1
    const week1Monday = new Date(jan4);
    week1Monday.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));

    // Calculate Monday of target week
    const targetMonday = new Date(week1Monday);
    targetMonday.setDate(week1Monday.getDate() + (parseInt(week) - 1) * 7);

    // Calculate Sunday of target week
    const targetSunday = new Date(targetMonday);
    targetSunday.setDate(targetMonday.getDate() + 6);

    return {
        startDate: formatDate(targetMonday),
        endDate: formatDate(targetSunday)
    };
};

/**
 * Get day of week from date
 * Returns 1-7 (1=Monday, 7=Sunday)
 */
const getDayOfWeek = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    // Convert Sunday (0) to 7, others stay same
    return day === 0 ? 7 : day;
};

module.exports = {
    formatDate,
    getDaysInMonth,

    // New hybrid ID generators
    generateDepartmentId,
    generateEmployeeId,
    generateShiftId,
    generateAttendanceId,
    generateScheduleId,  // NEW: For shift scheduling
    generateDepartmentHistoryId, // NEW: For department history

    // Old generator (backward compatibility)
    generateId,

    // Avatar generation
    generateAvatarUrl,

    // Shift scheduling helpers
    getISOWeek,
    getWeekDates,
    getDayOfWeek,

    // Other utilities
    calculateWorkDuration,
    sanitizeUser,
    isFutureDate,
    getClientIp,
};
