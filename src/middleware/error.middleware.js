/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal server error';

    // Firestore errors
    if (err.code === 'permission-denied') {
        statusCode = 403;
        message = 'Permission denied';
    } else if (err.code === 'not-found') {
        statusCode = 404;
        message = 'Resource not found';
    } else if (err.code === 'already-exists') {
        statusCode = 409;
        message = 'Resource already exists';
    }

    // Send error response
    res.status(statusCode).json({
        success: false,
        message: message,
        ...(process.env.NODE_ENV === 'development' && {
            stack: err.stack,
            error: err,
        }),
    });
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.path} not found`,
    });
};

module.exports = {
    errorHandler,
    notFoundHandler,
};
