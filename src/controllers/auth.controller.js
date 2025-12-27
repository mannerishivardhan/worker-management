const authService = require('../services/auth.service');

class AuthController {
    /**
     * Login with email and password
     * NOTE: Phone/OTP authentication commented for future use
     */
    async login(req, res, next) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const result = await authService.login(email, password, req);

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
