const bcrypt = require('bcrypt');
const { getFirestore } = require('../config/firebase');
const { COLLECTIONS, AUDIT_ACTIONS } = require('../config/constants');
const { sanitizeUser } = require('../utils/helpers');
const auditService = require('./audit.service');
const tokenService = require('./token.service');

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
     * Returns both access token (15 min) and refresh token (30 days with sliding window)
     */
    async login(email, password, deviceId, req) {
        try {
            // Find user by email
            const usersSnapshot = await this.getDb()
                .collection(COLLECTIONS.USERS)
                .where('email', '==', email)
                .limit(1)
                .get();

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
                    req,
                });

                throw new Error('Invalid email or password');
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
                    req,
                });

                throw new Error('Invalid email or password');
            }

            // Prepare user object
            const user = {
                id: userDoc.id,
                ...sanitizeUser(userData),
            };

            // Generate tokens
            const accessToken = tokenService.generateAccessToken(user);
            const refreshToken = await tokenService.generateRefreshToken(userDoc.id, deviceId);

            // Log successful login
            await auditService.log({
                action: AUDIT_ACTIONS.LOGIN_SUCCESS,
                entityType: 'auth',
                entityId: userDoc.id,
                performedBy: userDoc.id,
                performedByName: `${userData.firstName} ${userData.lastName}`,
                performedByRole: userData.role,
                newData: { deviceId },
                req,
            });

            return {
                user,
                accessToken,
                refreshToken: refreshToken.token,
                expiresIn: 900, // 15 minutes in seconds
                refreshExpiresIn: refreshToken.expiresIn,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Refresh access token using refresh token (Sliding Window)
     * Returns new access token AND new refresh token (30 days from now)
     */
    async refreshAccessToken(refreshToken, deviceId = 'default') {
        try {
            // Verify refresh token
            const tokenData = await tokenService.verifyRefreshToken(refreshToken);

            // Get user
            const userDoc = await this.getDb().collection(COLLECTIONS.USERS).doc(tokenData.userId).get();

            if (!userDoc.exists) {
                throw new Error('User not found');
            }

            const userData = userDoc.data();

            if (!userData.isActive) {
                throw new Error('Account has been deactivated');
            }

            const user = {
                id: userDoc.id,
                ...sanitizeUser(userData),
            };

            // Generate new access token
            const accessToken = tokenService.generateAccessToken(user);

            // SLIDING WINDOW: Generate NEW refresh token (30 days from now)
            // This keeps users logged in forever as long as they use the app
            const newRefreshToken = await tokenService.rotateRefreshToken(
                refreshToken,
                tokenData.userId,
                deviceId
            );

            return {
                accessToken,
                refreshToken: newRefreshToken.token,
                expiresIn: 900, // 15 minutes in seconds
                refreshExpiresIn: newRefreshToken.expiresIn,
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Logout user - invalidate refresh token
     */
    async logout(refreshToken, userId, req) {
        try {
            // Revoke refresh token
            await tokenService.revokeRefreshToken(refreshToken);

            // Log logout
            await auditService.log({
                action: AUDIT_ACTIONS.LOGOUT,
                entityType: 'auth',
                entityId: userId,
                performedBy: userId,
                performedByName: req.user?.firstName ? `${req.user.firstName} ${req.user.lastName}` : 'User',
                performedByRole: req.user?.role || 'employee',
                req,
            });

            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Logout from all devices - revoke all refresh tokens
     */
    async logoutAllDevices(userId, req) {
        try {
            // Revoke all refresh tokens
            const revokedCount = await tokenService.revokeAllUserTokens(userId);

            // Log logout from all devices
            await auditService.log({
                action: AUDIT_ACTIONS.LOGOUT,
                entityType: 'auth',
                entityId: userId,
                performedBy: userId,
                performedByName: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'User',
                performedByRole: req.user?.role || 'employee',
                newData: { devicesLoggedOut: revokedCount },
                req,
            });

            return revokedCount;
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
