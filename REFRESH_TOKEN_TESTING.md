# 📝 Refresh Token Implementation - Testing Guide

## ✅ What's Been Built

**New Features:**
1. ✅ TokenService with sliding window
2. ✅ Login returns both tokens (access + refresh)
3. ✅ Refresh endpoint (auto-renewing 30-day tokens)
4. ✅ Logout endpoint (single device)
5. ✅ Logout-all endpoint (all devices)

---

## 🧪 How to Test in Postman

### 1. Login (Updated Response)

**Endpoint:** `POST /api/auth/login`

**Request:**
```json
{
  "email": "admin@yourcompany.com",
  "password": "admin123",
  "deviceId": "my_laptop"
}
```

**NEW Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "accessToken": "eyJhbGc...",        // 15 min
    "refreshToken": "a1b2c3...",        // 30 days
    "expiresIn": 900,                   // 15 minutes in seconds
    "refreshExpiresIn": 2592000         // 30 days in seconds
  }
}
```

**Save these values:**
- Copy `accessToken` → Save as `{{token}}`
- Copy `refreshToken` → Save as `{{refreshToken}}`

---

### 2. Refresh Token (Sliding Window)

**Endpoint:** `POST /api/auth/refresh`

**Request:**
```json
{
  "refreshToken": "{{refreshToken}}",
  "deviceId": "my_laptop"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "accessToken": "NEW_eyJhbGc...",    // NEW 15 min token
    "refreshToken": "NEW_a1b2c3...",    // NEW 30 day token!
    "expiresIn": 900,
    "refreshExpiresIn": 2592000
  }
}
```

**⭐ Key Point:** Old refresh token is INVALIDATED. New token is valid for 30 days from NOW.

**This means:** User never logs out if they use the app regularly!

---

### 3. Logout (Single Device)

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer {{token}}
```

**Request:**
```json
{
  "refreshToken": "{{refreshToken}}"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Result:** Refresh token is invalidated. User must login again.

---

### 4. Logout All Devices

**Endpoint:** `POST /api/auth/logout-all`

**Headers:**
```
Authorization: Bearer {{token}}
```

**Request:** (no body needed)

**Response:**
```json
{
  "success": true,
  "message": "Logged out from 3 device(s) successfully",
  "data": {
    "devicesLoggedOut": 3
  }
}
```

**Result:** All refresh tokens for this user are invalidated.

---

## 🔄 Sliding Window Flow

**Day 1:**
- Login → Get refresh token (expires Day 31)

**Day 15:**
- Use app → Refresh → Get NEW token (expires Day 45)
- Old token invalidated

**Day 40:**
- Use app → Refresh → Get NEW token (expires Day 70)
- Old token invalidated

**Forever:**
- As long as user uses app, they never logout!

**Only logs out if:**
- Not used for 30 consecutive days
- Manual logout
- Admin revokes

---

## 📊 Testing Checklist

**Start your server:**
```bash
npm run dev
```

**Then test in Postman:**

- [ ] Login with email/password
- [ ] Verify both tokens returned
- [ ] Save tokens to Postman variables
- [ ] Wait 1 minute (access token still valid)
- [ ] Call any protected endpoint → Works
- [ ] Wait 16 minutes (access token expired)
- [ ] Call protected endpoint → 401 error
- [ ] Call refresh endpoint → Get NEW tokens
- [ ] Try old refresh token → 401 error (invalidated)
- [ ] Use new tokens → Works
- [ ] Logout → Token invalidated
- [ ] Try to use after logout → Error

---

## 🎯 Next Steps

After testing refresh tokens:
1. ✅ Test login flow
2. ✅ Test refresh flow
3. ✅ Test logout
4. **Continue building:** ID format migration
5. **Then:** Emergency contacts, avatars, etc.

---

## 📝 Notes for Frontend Team

**Flutter Integration:**
```dart
// Save both tokens after login
await storage.write('accessToken', response.accessToken);
await storage.write('refreshToken', response.refreshToken);

// Auto-refresh on 401
if (response.statusCode == 401) {
  final newTokens = await refreshAccessToken();
  // Retry original request
}

// Refresh function
Future refreshAccessToken() async {
  final refreshToken = await storage.read('refreshToken');
  final response = await post('/api/auth/refresh', 
    body: {'refreshToken': refreshToken}
  );
  
  // Save NEW tokens
  await storage.write('accessToken', response.accessToken);
  await storage.write('refreshToken', response.refreshToken);
}
```

---

**Ready to test! 🚀**

**After testing, let me know if it works, then I'll continue with the remaining 10 features!**
