# Railway Deployment Guide

## Production URL

🚀 **Backend URL**: `https://worker-management-production.up.railway.app`

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- Firebase project with Firestore enabled
- GitHub repository (recommended for automatic deployments)

## Deployment Steps

### 1. Railway Project Setup

1. **Login to Railway**

   ```bash
   npm install -g @railway/cli
   railway login
   ```

2. **Link or Create Project**
   ```bash
   railway link
   # or create new
   railway init
   ```

### 2. Environment Variables Configuration

In your Railway dashboard, add the following environment variables:

#### Required Variables:

```env
NODE_ENV=production
PORT=3000

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-for-production
JWT_EXPIRY=24h

# Firebase Configuration (choose one option)

# Option 1: Individual Fields (Recommended for Railway)
FIREBASE_PROJECT_ID=worker-management-a5e96
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@worker-management-a5e96.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"

# Option 2: Complete JSON (alternative)
# FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Production URLs
PRODUCTION_URL=https://worker-management-production.up.railway.app

# CORS Configuration - Add your frontend URL
ALLOWED_ORIGINS=https://your-frontend-url.com,https://worker-management-production.up.railway.app

# Rate Limiting (Production tuned)
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

#### Important Notes for Railway:

- For `FIREBASE_PRIVATE_KEY`, ensure the `\n` characters are preserved
- In Railway dashboard, paste the entire private key with quotes
- For multiple allowed origins, use comma separation

### 3. Deploy to Railway

#### Option A: GitHub Integration (Recommended)

1. Push your code to GitHub
2. In Railway dashboard, connect your GitHub repository
3. Select the branch to deploy (e.g., `main`)
4. Railway will automatically deploy on every push

#### Option B: CLI Deployment

```bash
# From backend directory
railway up
```

### 4. Verify Deployment

1. **Check Deployment Logs**

   ```bash
   railway logs
   ```

2. **Expected Output:**

   ```
   ✅ Firebase Admin initialized successfully
   📊 Firestore connected to project: worker-management-a5e96
   🚀 Worker Management System - Backend Server
   📍 Server running on: http://localhost:3000
   ```

3. **Test Health Endpoint**
   ```bash
   curl https://worker-management-production.up.railway.app/
   ```

### 5. Configure Custom Domain (Optional)

1. Go to Railway dashboard > Settings > Domains
2. Add custom domain or use Railway's generated domain
3. Update `PRODUCTION_URL` and `ALLOWED_ORIGINS` environment variables

## Common Issues & Solutions

### Issue: CORS Errors

**Solution**: Ensure your frontend URL is in `ALLOWED_ORIGINS`:

```env
ALLOWED_ORIGINS=https://your-frontend.com,http://localhost:3000
```

### Issue: Firebase Connection Failed

**Solution**:

1. Verify all Firebase environment variables are set correctly
2. Check private key has proper `\n` line breaks
3. Ensure Firebase service account has Firestore permissions

### Issue: Port Already in Use

**Solution**: Railway automatically assigns the PORT. Don't override it in your app.

### Issue: Build Failures

**Solution**:

1. Check `package.json` has all dependencies
2. Verify Node.js version compatibility
3. Check Railway build logs for specific errors

## Monitoring & Maintenance

### View Logs

```bash
railway logs --follow
```

### Check Service Status

- Visit Railway dashboard
- Monitor CPU, Memory, and Network usage

### Restart Service

```bash
railway restart
```

### Update Environment Variables

- Use Railway dashboard or CLI:
  ```bash
  railway variables set KEY=value
  ```

## Security Best Practices

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Use strong JWT_SECRET** - Generate with: `openssl rand -base64 64`
3. **Rotate secrets regularly** - Update JWT_SECRET and Firebase keys periodically
4. **Monitor logs** - Check for suspicious activity
5. **Rate limiting** - Adjust based on traffic patterns
6. **HTTPS only** - Railway provides this by default

## API Documentation

Your API is now available at:

- **Base URL**: `https://worker-management-production.up.railway.app`
- **Health Check**: `GET /`
- **API Routes**: `GET /api/*`

## Support & Troubleshooting

- **Railway Docs**: https://docs.railway.app
- **Firebase Docs**: https://firebase.google.com/docs
- **Check logs**: `railway logs`
- **Environment variables**: `railway variables`

---

**Deployment Date**: January 5, 2026  
**Backend URL**: https://worker-management-production.up.railway.app
