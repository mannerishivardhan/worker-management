# Backend Setup Quick Guide

## ✅ Steps Completed
1. ✅ Dependencies installed (npm install)
2. ✅ .env file created

## 🔧 Next Steps

### 1. Configure Firebase Credentials

You need to update the `.env` file with your Firebase project credentials:

**Option A: If you ALREADY have a Firebase project:**
1. Go to Firebase Console: https://console.firebase.google.com
2. Select your project
3. Go to Project Settings (⚙️ icon) → Service Accounts
4. Click "Generate new private key"
5. Download the JSON file
6. Copy values to `.env`:
   ```env
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYourKeyHere\n-----END PRIVATE KEY-----\n"
   ```

**Option B: If you DON'T have a Firebase project yet:**
- Let me know and I'll guide you through creating one (takes ~10 minutes)

### 2. Update JWT Secret (Important!)

In `.env`, change this line:
```env
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

To something secure (at least 32 characters):
```env
JWT_SECRET=MyS3cur3W0rk3rMgmtSyst3mJWTS3cr3t2025Key!@#$
```

### 3. Create Initial Admin User

Once Firebase is configured, you'll need to create the first Super Admin user manually in Firestore.

I can help you with this - it involves:
1. Creating a document in the `users` collection
2. Hashing a password
3. Setting role to `super_admin`

### 4. Start the Server

After configuration:
```bash
npm run dev
```

---

## ❓ What would you like to do next?

**Choose one:**

**A)** "I have Firebase credentials ready" - I'll help you configure .env

**B)** "Create new Firebase project" - I'll guide you step-by-step

**C)** "Just test without Firebase first" - I'll show you how to mock it

**D)** "Something else" - Tell me what you need

Just let me know! 🚀
