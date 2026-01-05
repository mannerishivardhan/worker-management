# Railway Variables Setup Guide

## ✅ Variables You Already Have (7)

1. ✅ `FIREBASE_SERVICE_ACCOUNT` - Complete Firebase config
2. ✅ `HOST`
3. ✅ `JWT_EXPIRY`
4. ✅ `JWT_SECRET`
5. ✅ `NODE_ENV`
6. ✅ `RATE_LIMIT_MAX_REQUESTS`
7. ✅ `RATE_LIMIT_WINDOW_MS`

## ⚠️ MISSING - Add This NOW

### **ALLOWED_ORIGINS** (Critical for CORS!)

**Click "New Variable" in Railway dashboard and add:**

**Variable Name:**

```
ALLOWED_ORIGINS
```

**Variable Value (Update with your frontend URL):**

```
http://localhost:3000,https://your-frontend-url.com
```

**Examples:**

- If your Flutter web is at `myapp.web.app`: `http://localhost:3000,https://myapp.web.app`
- If you have multiple frontends: `http://localhost:3000,https://app1.com,https://app2.com`

**Important:**

- Use comma-separated values (no spaces after commas are fine)
- Include `http://localhost:3000` for local testing
- Your Railway backend URL (`worker-management-production.up.railway.app`) is automatically added

## 🎯 Railway System Variables (Automatically Added)

Railway provides 8 system variables that you can use:

### Most Useful Ones:

1. **`RAILWAY_PUBLIC_DOMAIN`** - Your public URL

   - Example: `worker-management-production.up.railway.app`
   - ✅ Now automatically added to CORS allowed origins!

2. **`RAILWAY_ENVIRONMENT_NAME`** - Environment name (production, staging, etc.)

   - Use this to check if you're in production

3. **`RAILWAY_PROJECT_NAME`** - Your project name
   - Useful for logging

### How to Use Railway Variables in Code:

```javascript
// Check if running on Railway
if (process.env.RAILWAY_PUBLIC_DOMAIN) {
  console.log("Running on Railway:", process.env.RAILWAY_PUBLIC_DOMAIN);
}

// Get environment
const isProduction = process.env.RAILWAY_ENVIRONMENT_NAME === "production";
```

## 📋 After Adding ALLOWED_ORIGINS

### 1. Save the Variable

Click "Add" or "Save" in Railway dashboard

### 2. Redeploy (if needed)

Railway should automatically redeploy. If not:

- Click "Deploy" button
- Or push a new commit to trigger deployment

### 3. Check Logs

Look for this line in your deployment logs:

```
🔒 CORS allowed origins: [...]
```

This confirms CORS is configured correctly.

### 4. Test Your API

```bash
# Test from terminal
curl https://worker-management-production.up.railway.app/

# Should return:
{
  "success": true,
  "message": "Worker Management System API",
  "version": "1.0.0",
  "documentation": "/api/health"
}
```

### 5. Test CORS from Frontend

Once deployed, your Flutter app should be able to connect to:

```
https://worker-management-production.up.railway.app
```

## 🔍 Troubleshooting

### If you see CORS errors:

1. Check `ALLOWED_ORIGINS` is set in Railway
2. Verify your frontend URL is included
3. Check deployment logs for: `🔒 CORS allowed origins:`
4. Make sure you're making requests from an allowed origin

### If Firebase doesn't connect:

- Your `FIREBASE_SERVICE_ACCOUNT` should be the complete JSON
- Check logs for: `✅ Firebase Admin initialized successfully`
- Verify JSON is valid (no missing quotes or commas)

### If nothing works:

1. Check Railway logs: Dashboard → Your Service → Deployments → Click latest → Logs
2. Look for errors during startup
3. Verify all 7 variables are set correctly

## ⚡ Quick Deploy Checklist

- [x] 7 service variables already set ✅
- [ ] Add `ALLOWED_ORIGINS` variable with your frontend URL
- [ ] Click "Save" or "Add"
- [ ] Wait for automatic redeployment
- [ ] Check logs for successful startup
- [ ] Test API endpoint
- [ ] Test from your frontend

## 🚀 Next Steps

1. **Add ALLOWED_ORIGINS now** (see above)
2. **Wait for deployment** (Railway will auto-deploy)
3. **Check logs** for CORS configuration
4. **Update your Flutter app** to use: `https://worker-management-production.up.railway.app`
5. **Test the connection** from your app

---

**Your Backend URL:** `https://worker-management-production.up.railway.app`  
**Status:** Almost ready - just add ALLOWED_ORIGINS! 🎯
