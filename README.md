# Worker Management System - Backend

Production-grade Node.js + Express backend for Worker Management, Attendance, and Salary Calculation System.

## Features

- ✅ **JWT Authentication** with bcrypt password hashing
- ✅ **Role-Based Access Control** (Tenant, Super Admin, Admin, Employee)
- ✅ **Firebase/Firestore** integration
- ✅ **Complete Audit Logging** for compliance
- ✅ **Department Management** with employee tracking
- ✅ **Employee Management** with department transfer history
- ✅ **Shift Management** for departments
- ✅ **Attendance Tracking** with entry/exit and corrections
- ✅ **On-Demand Salary Calculation** based on attendance
- ✅ **Comprehensive API Documentation**
- ✅ **Security** with Helmet, CORS, Rate Limiting
- ✅ **Input Validation** with express-validator

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: Firebase Firestore
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Security**: Helmet, CORS, Rate Limiting

## Prerequisites

- Node.js >= 14.x
- Firebase Project with Firestore enabled
- Firebase Service Account credentials

## Installation

1. **Install dependencies**:
```bash
cd backend
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
```

3. **Update `.env` with your Firebase credentials**:
```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="your-private-key"
JWT_SECRET=your-super-secret-key
```

## Running the Server

### Development Mode (with auto-restart)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with email + password
- `GET /api/auth/verify` - Verify current user token

### Departments
- `POST /api/departments` - Create department (Admin, Super Admin)
- `GET /api/departments` - Get all departments
- `GET /api/departments/:id` - Get department by ID
- `PUT /api/departments/:id` - Update department
- `DELETE /api/departments/:id` - Soft delete department

### Employees
- `POST /api/employees` - Register employee (Admin, Super Admin)
- `GET /api/employees` - Get all employees
- `GET /api/employees/:id` - Get employee by ID
- `PUT /api/employees/:id` - Update employee
- `POST /api/employees/:id/transfer` - Transfer employee to another department
- `POST /api/employees/:id/deactivate` - Deactivate employee
- `GET /api/employees/:id/history` - Get transfer history

### Shifts
- `POST /api/shifts` - Create shift (Admin, Super Admin)
- `GET /api/shifts` - Get all shifts
- `GET /api/shifts/:id` - Get shift by ID
- `PUT /api/shifts/:id` - Update shift
- `DELETE /api/shifts/:id` - Soft delete shift

### Attendance
- `POST /api/attendance/entry` - Mark entry/check-in (Admin, Super Admin)
- `POST /api/attendance/exit` - Mark exit/check-out (Admin, Super Admin)
- `POST /api/attendance/:id/correct` - Correct attendance (Admin, Super Admin)
- `GET /api/attendance` - Get attendance records
- `GET /api/attendance/my` - Get my attendance (All users)

### Salary
- `GET /api/salary/calculate/:id?year=2025&month=1` - Calculate salary for employee
- `GET /api/salary/my?year=2025&month=1` - Get my salary (All users)
- `GET /api/salary/reports/department/:departmentId?year=2025&month=1` - Department report
- `GET /api/salary/reports/system?year=2025&month=1` - System-wide report

## Role-Based Access

### Tenant (Read-Only)
- View all data across the system
- No create/update/delete permissions

### Super Admin (Full Access)
- All CRUD operations across all departments
- Can manage users, departments, shifts, attendance
- System-wide reports

### Admin (Department-Scoped)
- Manage own department only
- Register employees in own department
- Mark attendance for own department employees
- Department-level reports

### Employee (Self-Service)
- View own attendance
- View own salary
- View own shift schedule

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── middleware/      # Express middleware
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── .env                 # Environment variables
├── package.json         # Dependencies
└── README.md           # This file
```

## Security Features

- **JWT Authentication** - Secure token-based auth
- **Password Hashing** - bcrypt with salt rounds
- **Rate Limiting** - Prevent brute force attacks
- **Helmet** - Security headers
- **CORS** - Cross-origin configuration
- **Input Validation** - Request validation middleware
- **Audit Logging** - Complete audit trail

## Error Handling

All errors return standardized JSON responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

## Development

### Running Tests
```bash
npm test
```

### Code Formatting
Follow Node.js best practices and use consistent code style.

## License

MIT

## Support

For issues or questions, please contact the development team.
