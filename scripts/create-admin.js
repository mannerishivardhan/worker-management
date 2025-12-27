const admin = require('firebase-admin');
const bcrypt = require('bcrypt');

// Initialize Firebase (uses environment variables)
require('dotenv').config();

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
});

const db = admin.firestore();

async function createAdminUser() {
    try {
        console.log('🔧 Creating admin user...\n');

        // Hash password
        const hashedPassword = await bcrypt.hash('admin123', 10);

        // Create admin user document
        const adminUser = {
            employeeId: 'ADMIN001',
            firstName: 'Super',
            lastName: 'Admin',
            email: 'admin@company.com',
            password: hashedPassword,
            role: 'super_admin',
            departmentId: null,
            departmentName: null,
            shiftId: null,
            shiftName: null,
            monthlySalary: 0,
            joiningDate: admin.firestore.Timestamp.fromDate(new Date('2025-12-27')),
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: 'system',
            updatedBy: 'system',
        };

        // Add to Firestore
        const docRef = await db.collection('users').add(adminUser);

        console.log('✅ Admin user created successfully!');
        console.log('📄 Document ID:', docRef.id);
        console.log('\n📧 Login Credentials:');
        console.log('   Email: admin@company.com');
        console.log('   Password: admin123');
        console.log('\n🚀 You can now login via Postman or API!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
        process.exit(1);
    }
}

createAdminUser();
