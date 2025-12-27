require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { initializeFirebase } = require('./config/firebase');
const { loggerFormat } = require('./utils/logger');
const { generalLimiter } = require('./middleware/rateLimiter.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');
const routes = require('./routes');

// Initialize Express app
const app = express();

// Initialize Firebase
initializeFirebase();

// Security middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(loggerFormat);

// Rate limiting
app.use(generalLimiter);

// API routes
app.use('/api', routes);

// Root route
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Worker Management System API',
        version: '1.0.0',
        documentation: '/api/health',
    });
});

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
