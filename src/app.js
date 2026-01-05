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

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000'];

// Add Railway public domain automatically if available
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    const railwayDomain = `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`;
    if (!allowedOrigins.includes(railwayDomain)) {
        allowedOrigins.push(railwayDomain);
    }
}

console.log('🔒 CORS allowed origins:', allowedOrigins);

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

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
