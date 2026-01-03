const authService = require('../services/auth.service');

class AuthController {
    /**
     * Login with email and password
     * Returns access token (15 min) and refresh token (30 days)
     */
    async login(req, res, next) {
        try {
            const { email, password, deviceId } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const result = await authService.login(email, password, deviceId || 'default', req);

            res.status(200).json({
                success: true,
                message: 'Login successful',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Refresh access token using refresh token
     * Sliding Window: Returns NEW access token AND NEW refresh token
     */
    async refresh(req, res, next) {
        try {
            const { refreshToken, deviceId } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
            }

            const result = await authService.refreshAccessToken(refreshToken, deviceId || 'default');

            res.status(200).json({
                success: true,
                message: 'Token refreshed successfully',
                data: result,
            });
        } catch (error) {
            // Handle token errors specifically
            if (error.message.includes('Invalid') || error.message.includes('expired')) {
                return res.status(401).json({
                    success: false,
                    message: error.message,
                    code: 'TOKEN_INVALID'
                });
            }
            next(error);
        }
    }

    /**
     * Logout - invalidate refresh token
     */
    async logout(req, res, next) {
        try {
            const { refreshToken } = req.body;

            if (!refreshToken) {
                return res.status(400).json({
                    success: false,
                    message: 'Refresh token is required'
                });
            }

            await authService.logout(refreshToken, req.user.userId, req);

            res.status(200).json({
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Logout from all devices - revoke all refresh tokens
     */
    async logoutAll(req, res, next) {
        try {
            const devicesLoggedOut = await authService.logoutAllDevices(req.user.userId, req);

            res.status(200).json({
                success: true,
                message: `Logged out from ${devicesLoggedOut} device(s) successfully`,
                data: { devicesLoggedOut }
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Verify current user
     */
    async verifyUser(req, res, next) {
        try {
            const user = await authService.verifyUser(req.user.userId);

            res.status(200).json({
                success: true,
                data: user,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AuthController();
