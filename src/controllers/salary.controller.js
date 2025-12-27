const salaryService = require('../services/salary.service');

class SalaryController {
    /**
     * Calculate salary for a specific employee
     */
    async calculateSalary(req, res, next) {
        try {
            const { id: userId } = req.params;
            const { year, month } = req.query;

            if (!year || !month) {
                return res.status(400).json({
                    success: false,
                    message: 'Year and month are required query parameters',
                });
            }

            const salary = await salaryService.calculateSalary(
                userId,
                parseInt(year),
                parseInt(month)
            );

            res.status(200).json({
                success: true,
                data: salary,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get my salary (for employees)
     */
    async getMySalary(req, res, next) {
        try {
            const { year, month } = req.query;

            if (!year || !month) {
                return res.status(400).json({
                    success: false,
                    message: 'Year and month are required query parameters',
                });
            }

            const salary = await salaryService.calculateSalary(
                req.user.userId,
                parseInt(year),
                parseInt(month)
            );

            res.status(200).json({
                success: true,
                data: salary,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get department salary report
     */
    async getDepartmentReport(req, res, next) {
        try {
            const { departmentId } = req.params;
            const { year, month } = req.query;

            if (!year || !month) {
                return res.status(400).json({
                    success: false,
                    message: 'Year and month are required query parameters',
                });
            }

            const report = await salaryService.calculateDepartmentSalaries(
                departmentId,
                parseInt(year),
                parseInt(month)
            );

            res.status(200).json({
                success: true,
                data: report,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get system-wide salary report
     */
    async getSystemReport(req, res, next) {
        try {
            const { year, month } = req.query;

            if (!year || !month) {
                return res.status(400).json({
                    success: false,
                    message: 'Year and month are required query parameters',
                });
            }

            const report = await salaryService.getSystemWideSalaryReport(
                parseInt(year),
                parseInt(month)
            );

            res.status(200).json({
                success: true,
                data: report,
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new SalaryController();
