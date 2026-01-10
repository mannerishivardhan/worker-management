const { getDaysInMonth } = require('../utils/helpers');
const employeeService = require('./employee.service');
const attendanceService = require('./attendance.service');
const departmentService = require('./department.service');

class SalaryService {
    constructor() { }

    /**
     * Calculate salary for an employee for a specific month
     * Salary is calculated on-demand, not stored
     * NOW INCLUDES: Overtime hours and overtime pay
     */
    async calculateSalary(userId, year, month) {
        try {
            // Get employee details
            const employee = await employeeService.getEmployeeById(userId);

            // Get monthly attendance summary with overtime
            const attendanceSummary = await attendanceService.getMonthlyAttendanceSummary(userId, year, month);

            // Calculate base salary
            const daysInMonth = getDaysInMonth(year, month);
            const monthlySalary = employee.monthlySalary;
            const daysPresent = attendanceSummary.daysPresent;
            const dailyRate = monthlySalary / daysInMonth;
            const baseSalary = dailyRate * daysPresent;

            // Calculate overtime pay (if applicable)
            const overtimeHours = attendanceSummary.overtimeHours || 0;
            const hourlyRate = employee.hourlyRate || (monthlySalary / (daysInMonth * 8));
            const overtimeRate = employee.overtimeRate || (hourlyRate * 1.5);
            const overtimePay = overtimeHours * overtimeRate;

            // Calculate total salary
            const calculatedSalary = baseSalary + overtimePay;

            return {
                userId,
                employeeId: employee.employeeId,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                departmentId: employee.departmentId,
                departmentName: employee.departmentName,
                jobRole: employee.jobRole || null,  // NEW: Job role
                month: `${year}-${String(month).padStart(2, '0')}`,
                year,
                monthNumber: month,
                
                // Base salary calculation
                monthlySalary: parseFloat(monthlySalary.toFixed(2)),
                daysInMonth,
                daysPresent,
                daysAbsent: attendanceSummary.daysAbsent,
                daysPending: attendanceSummary.daysPending,
                dailyRate: parseFloat(dailyRate.toFixed(2)),
                baseSalary: parseFloat(baseSalary.toFixed(2)),
                
                // Overtime calculation
                overtimeHours: parseFloat(overtimeHours.toFixed(2)),
                hourlyRate: parseFloat(hourlyRate.toFixed(2)),
                overtimeRate: parseFloat(overtimeRate.toFixed(2)),
                overtimePay: parseFloat(overtimePay.toFixed(2)),
                
                // Total salary
                calculatedSalary: parseFloat(calculatedSalary.toFixed(2)),
                
                // Breakdown for transparency
                breakdown: {
                    regularPay: parseFloat(baseSalary.toFixed(2)),
                    overtimePay: parseFloat(overtimePay.toFixed(2)),
                    totalHours: parseFloat(((daysPresent * 8) + overtimeHours).toFixed(2)),
                    deductions: 0,  // Placeholder for future
                    bonuses: 0  // Placeholder for future
                }
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Calculate salary for multiple employees (department-wide)
     */
    async calculateDepartmentSalaries(departmentId, year, month, filters = {}) {
        try {
            // Get all active employees in department
            const employees = await employeeService.getEmployees({
                departmentId,
                isActive: true,
                ...filters,
            });

            const salaries = await Promise.all(
                employees.map(async (employee) => {
                    try {
                        return await this.calculateSalary(employee.id, year, month);
                    } catch (error) {
                        console.error(`Error calculating salary for ${employee.employeeId}:`, error);
                        return null;
                    }
                })
            );

            // Filter out failed calculations
            const validSalaries = salaries.filter(s => s !== null);

            // Calculate totals
            const totalMonthlySalary = validSalaries.reduce((sum, s) => sum + s.monthlySalary, 0);
            const totalCalculatedSalary = validSalaries.reduce((sum, s) => sum + s.calculatedSalary, 0);

            return {
                departmentId,
                month: `${year}-${String(month).padStart(2, '0')}`,
                employeeCount: validSalaries.length,
                salaries: validSalaries,
                summary: {
                    totalMonthlySalary: parseFloat(totalMonthlySalary.toFixed(2)),
                    totalCalculatedSalary: parseFloat(totalCalculatedSalary.toFixed(2)),
                    averageDaysPresent: parseFloat((validSalaries.reduce((sum, s) => sum + s.daysPresent, 0) / validSalaries.length).toFixed(2)),
                },
            };
        } catch (error) {
            throw error;
        }
    }

    /**
     * Get salary report for all departments (system-wide)
     */
    async getSystemWideSalaryReport(year, month) {
        try {
            const departmentService = require('./department.service');

            const departments = await departmentService.getDepartments({ isActive: true });

            const reports = await Promise.all(
                departments.map(async (dept) => {
                    try {
                        return await this.calculateDepartmentSalaries(dept.id, year, month);
                    } catch (error) {
                        console.error(`Error calculating salaries for department ${dept.departmentId}:`, error);
                        return null;
                    }
                })
            );

            const validReports = reports.filter(r => r !== null);

            // Calculate system-wide totals
            const systemTotal = {
                totalEmployees: validReports.reduce((sum, r) => sum + r.employeeCount, 0),
                totalMonthlySalary: validReports.reduce((sum, r) => sum + r.summary.totalMonthlySalary, 0),
                totalCalculatedSalary: validReports.reduce((sum, r) => sum + r.summary.totalCalculatedSalary, 0),
            };

            return {
                month: `${year}-${String(month).padStart(2, '0')}`,
                departmentCount: validReports.length,
                departments: validReports,
                systemTotal: {
                    ...systemTotal,
                    totalMonthlySalary: parseFloat(systemTotal.totalMonthlySalary.toFixed(2)),
                    totalCalculatedSalary: parseFloat(systemTotal.totalCalculatedSalary.toFixed(2)),
                },
            };
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new SalaryService();
