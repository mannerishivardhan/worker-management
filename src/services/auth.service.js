const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getFirestore } = require('../config/firebase');
const { COLLECTIONS, JWT_SECRET, JWT_EXPIRY, AUDIT_ACTIONS } = require('../config/constants');
const { sanitizeUser } = require('../utils/helpers');
const auditService = require('./audit.service');

class AuthService {
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
     * Login user with email and password
     * NOTE: Phone/OTP authentication code is commented out for future use
     */
    async login(email, password, req) {
        try {
            // Find user by email
            const usersSnapshot = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .where('email', '==', email)
                .limit(1)
                .get();

            // PHONE AUTH (COMMENTED FOR FUTURE USE):
            // const usersSnapshot = await this.getDb()
            //   .collection(COLLECTIONS.USERS)
            //   .where('phone', '==', phone)
            //   .limit(1)
            //   .get();

            if (usersSnapshot.empty) {
                // Log failed login attempt
                await auditService.log({
                    action: AUDIT_ACTIONS.LOGIN_FAILED,
                    entityType: 'auth',
                    entityId: 'login',
                    performedBy: 'anonymous',
                    performedByName: 'Anonymous',
                    performedByRole: 'none',
                    newData: { email, reason: 'User not found' },
                    // PHONE AUTH: newData: { phone, reason: 'User not found' },
                    req,
                });

                throw new Error('Invalid email or password');
                // PHONE AUTH: throw new Error('Invalid phone number or password');
            }

            const userDoc = usersSnapshot.docs[0];
            const userData = userDoc.data();

            // Check if user is active
            if (!userData.isActive) {
                throw new Error('Account has been deactivated');
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, userData.password);

            if (!isPasswordValid) {
                // Log failed login attempt
                await auditService.log({
                    action: AUDIT_ACTIONS.LOGIN_FAILED,
                    entityType: 'auth',
                    entityId: userDoc.id,
                    performedBy: userDoc.id,
                    performedByName: `${userData.firstName} ${userData.lastName}`,
                    performedByRole: userData.role,
                    newData: { email, reason: 'Invalid password' },
                    // PHONE AUTH: newData: { phone, reason: 'Invalid password' },
                    req,
                });

                throw new Error('Invalid email or password');
                // PHONE AUTH: throw new Error('Invalid phone number or password');
            }

            // Generate JWT token
            const token = jwt.sign(
                {
                    userId: userDoc.id,
                    employeeId: userData.employeeId,
                    role: userData.role,
                    departmentId: userData.departmentId,
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRY }
            );

            // Log successful login
            await auditService.log({
                action: AUDIT_ACTIONS.LOGIN_SUCCESS,
                entityType: 'auth',
                entityId: userDoc.id,
                performedBy: userDoc.id,
                performedByName: `${userData.firstName} ${userData.lastName}`,
                performedByRole: userData.role,
                req,
            });

            // Return user data (without password) and token
            const user = {
                id: userDoc.id,
                ...sanitizeUser(userData),
            };

            return { user, token };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Verify if user exists by ID
     */
    async verifyUser(userId) {
        try {
            const userDoc = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .doc(userId)
                .get();

            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();

            if (!userData.isActive) {
                throw new Error('User account is deactivated');
            }

            return {
                id: userDoc.id,
                ...sanitizeUser(userData),
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Hash password
     */
    async hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
    }
}

module.exports = new AuthService();
