const admin = require('firebase-admin');

let firebaseInitialized = false;
let db = null;

const initializeFirebase = () => {
  if (firebaseInitialized) return;

  try {
    let serviceAccount;

    // Support both formats: JSON string or individual environment variables
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Format 1: Complete JSON service account
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else if (
      process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY
    ) {
      // Format 2: Individual environment variables
      serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      };
    } else {
      throw new Error(
        'Firebase configuration missing. Provide either FIREBASE_SERVICE_ACCOUNT or individual Firebase credentials.'
      );
    }

    // Initialize Firebase Admin
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`,
    });

    // Initialize Firestore
    db = admin.firestore();
    
    // Configure Firestore settings for better performance
    db.settings({
      ignoreUndefinedProperties: true,
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
    console.log(`📊 Firestore connected to project: ${serviceAccount.projectId}`);

  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
    console.error('💡 Check your Firebase configuration in .env file');
    throw error;
  }
};

/**
 * Get Firestore database instance
 * @returns {FirebaseFirestore.Firestore} Firestore database
 */
const getFirestore = () => {
  if (!firebaseInitialized) {
    throw new Error('Firebase not initialized. Call initializeFirebase() first.');
  }
  if (!db) {
    db = admin.firestore();
  }
  return db;
};

// Export Firestore utilities
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

module.exports = {
  initializeFirebase,
  getFirestore,
  admin,
  FieldValue,
  Timestamp,
};
