const admin = require('firebase-admin');

/**
 * Token Service - Handles JWT and Refresh Tokens with Sliding Window
 * 
 * Sliding Window Strategy:
 * - Every refresh generates a NEW 30-day refresh token
 * - Old refresh token is invalidated
 * - Users never log out if they use the app regularly
 */

const jwt = require('jsonwebtoken');
const { getFirestore, FieldValue, Timestamp } = require('../config/firebase');
const { COLLECTIONS, JWT_SECRET } = require('../config/constants');
const crypto = require('crypto');

class TokenService {
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
     * Generate short-lived access token (15 minutes)
     */
    generateAccessToken(user) {
        const payload = {
            userId: user.id,
            employeeId: user.employeeId,
            role: user.role,
            departmentId: user.departmentId,
        };

        return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    }

    /**
     * Generate long-lived refresh token (30 days) with sliding window
     * Each use of refresh token generates a NEW 30-day token
     */
    async generateRefreshToken(userId, deviceId = 'default') {
        try {
            // Generate cryptographically secure random token
            const token = crypto.randomBytes(64).toString('hex');

            // Calculate expiry (30 days from now)
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 30);

            // Store in Firestore
            const refreshTokenData = {
                token,
                userId,
                deviceId,
                expiresAt: Timestamp.fromDate(expiresAt),
                isActive: true,
                createdAt: FieldValue.serverTimestamp(),
                lastUsedAt: null
            };

            await this.getDb().collection(COLLECTIONS.REFRESH_TOKENS).add(refreshTokenData);

            return {
                token,
                expiresAt,
                expiresIn: 30 * 24 * 60 * 60 // 30 days in seconds
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Verify refresh token and check if it's valid
     */
    async verifyRefreshToken(token) {
        try {
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.REFRESH_TOKENS)
                .where('token', '==', token)
                .where('isActive', '==', true)
                .limit(1)
                .get();

            if (snapshot.empty) {
                throw new Error('Invalid or expired refresh token');
            }

            const tokenDoc = snapshot.docs[0];
            const tokenData = tokenDoc.data();

            // Check if token has expired
            const now = new Date();
            const expiresAt = tokenData.expiresAt.toDate();

            if (now > expiresAt) {
                // Mark as inactive
                await tokenDoc.ref.update({
                    isActive: false,
                    invalidatedAt: FieldValue.serverTimestamp()
                });
                throw new Error('Refresh token has expired');
            }

            // Update last used timestamp
            await tokenDoc.ref.update({
                lastUsedAt: FieldValue.serverTimestamp()
            });

            return {
                id: tokenDoc.id,
                userId: tokenData.userId,
                deviceId: tokenData.deviceId,
                expiresAt
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Rotate refresh token (Sliding Window Implementation)
     * - Invalidate old token
     * - Generate new 30-day token
     * - Return new token
     */
    async rotateRefreshToken(oldToken, userId, deviceId) {
        try {
            // Invalidate old token
            await this.revokeRefreshToken(oldToken);

            // Generate new 30-day token (sliding window)
            const newRefreshToken = await this.generateRefreshToken(userId, deviceId);

            return newRefreshToken;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Revoke refresh token (logout or security)
     */
    async revokeRefreshToken(token) {
        try {
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.REFRESH_TOKENS)
                .where('token', '==', token)
                .limit(1)
                .get();

            if (!snapshot.empty) {
                const tokenDoc = snapshot.docs[0];
                await tokenDoc.ref.update({
                    isActive: false,
                    invalidatedAt: FieldValue.serverTimestamp()
                });
            }

            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Revoke all refresh tokens for a user (security measure)
     */
    async revokeAllUserTokens(userId) {
        try {
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.REFRESH_TOKENS)
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .get();

            const batch = this.getDb().batch();

            snapshot.forEach(doc => {
                batch.update(doc.ref, {
                    isActive: false,
                    invalidatedAt: FieldValue.serverTimestamp()
                });
            });

            await batch.commit();

            return snapshot.size;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Cleanup expired tokens (run as cron job)
     */
    async cleanupExpiredTokens() {
        try {
            const now = new Date();

            // Find all expired tokens
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.REFRESH_TOKENS)
                .where('expiresAt', '<', Timestamp.fromDate(now))
                .get();

            const batch = this.getDb().batch();

            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            return snapshot.size;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get active refresh tokens for a user (for monitoring)
     */
    async getUserActiveTokens(userId) {
        try {
            const snapshot = await this.getDb()
                .collection(COLLECTIONS.REFRESH_TOKENS)
                .where('userId', '==', userId)
                .where('isActive', '==', true)
                .get();

            const tokens = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                tokens.push({
                    id: doc.id,
                    deviceId: data.deviceId,
                    createdAt: data.createdAt,
                    expiresAt: data.expiresAt,
                    lastUsedAt: data.lastUsedAt
                });
            });

            return tokens;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new TokenService();
