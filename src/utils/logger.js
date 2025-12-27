const morgan = require('morgan');

/**
 * Custom logger format
 */
const loggerFormat = morgan((tokens, req, res) => {
    return [
        new Date().toISOString(),
        tokens.method(req, res),
        tokens.url(req, res),
        tokens.status(req, res),
        tokens.res(req, res, 'content-length'), '-',
        tokens['response-time'](req, res), 'ms',
        '| User:', req.user?.employeeId || 'anonymous',
    ].join(' ');
});

/**
 * Log info message
 */
const logInfo = (message, data = {}) => {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
};

/**
 * Log error message
 */
const logError = (message, error = {}) => {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
};

/**
 * Log warning message
 */
const logWarn = (message, data = {}) => {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
};

module.exports = {
    loggerFormat,
    logInfo,
    logError,
    logWarn,
};
