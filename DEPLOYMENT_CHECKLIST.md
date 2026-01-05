# Railway Deployment Checklist ✅

## Pre-Deployment

- [x] Firebase configuration fixed (getFirestore, FieldValue, Timestamp exported)
- [x] CORS configuration added for production
- [x] Production URL configured: `worker-management-production.up.railway.app`
- [x] railway.json configuration file exists
- [ ] All environment variables documented in `.env.example`
- [ ] Frontend URL known and added to ALLOWED_ORIGINS

## Railway Dashboard Setup

- [ ] Railway account created and logged in
- [ ] New project created or existing project linked
- [ ] GitHub repository connected (recommended) OR CLI deployment ready

## Environment Variables to Set in Railway

Copy these to your Railway dashboard (Settings > Variables):

### 1. Basic Configuration

```
NODE_ENV=production
PORT=3000
```

### 2. JWT Security

```
JWT_SECRET=[Generate a strong secret: openssl rand -base64 64]
JWT_EXPIRY=24h
```

### 3. Firebase Configuration (Already have these from local .env)

```
FIREBASE_PROJECT_ID=worker-management-a5e96
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@worker-management-a5e96.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[Your key here]\n-----END PRIVATE KEY-----\n"
```

### 4. Production URLs

```
PRODUCTION_URL=https://worker-management-production.up.railway.app
ALLOWED_ORIGINS=[Your-Frontend-URL],https://worker-management-production.up.railway.app
```

### 5. Rate Limiting

```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

## Deployment Steps

- [ ] Push code to GitHub (if using GitHub integration)
- [ ] Connect Railway to GitHub repository
- [ ] Set all environment variables in Railway dashboard
- [ ] Deploy manually or wait for automatic deployment
- [ ] Check deployment logs for errors

## Post-Deployment Verification

- [ ] Visit: `https://worker-management-production.up.railway.app/`
- [ ] Check logs: `railway logs` or in Railway dashboard
- [ ] Verify Firebase connection in logs:
  ```
  ✅ Firebase Admin initialized successfully
  📊 Firestore connected to project: worker-management-a5e96
  ```
- [ ] Test API endpoints with Postman or curl
- [ ] Verify CORS works from frontend

## Frontend Configuration

- [ ] Update frontend API base URL to: `https://worker-management-production.up.railway.app`
- [ ] Test frontend-backend communication
- [ ] Verify authentication flow works

## Security Checklist

- [ ] Strong JWT_SECRET set (not the default!)
- [ ] CORS restricted to specific origins (not `*`)
- [ ] Rate limiting configured
- [ ] HTTPS enabled (Railway provides this automatically)
- [ ] Firebase credentials secure and not exposed

## Monitoring

- [ ] Check Railway dashboard for metrics
- [ ] Monitor logs for errors: `railway logs --follow`
- [ ] Set up alerts in Railway (optional)

## Troubleshooting

### If you see Firebase errors:

1. Check environment variables are set correctly
2. Verify FIREBASE_PRIVATE_KEY has proper line breaks (`\n`)
3. Ensure Firebase service account has Firestore permissions

### If you see CORS errors:

1. Add frontend URL to ALLOWED_ORIGINS
2. Format: `https://frontend.com,https://other.com` (comma-separated)
3. Redeploy after changing environment variables

### If build fails:

1. Check `package.json` has all dependencies
2. Verify `npm start` script exists
3. Check Railway build logs for specific error

## Quick Commands

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up

# View logs
railway logs --follow

# Set environment variable
railway variables set KEY=value

# Restart service
railway restart
```

## Documentation References

- Railway Deployment Guide: `RAILWAY_DEPLOYMENT.md`
- Environment Variables: `.env.example`
- API Documentation: `README.md`

---

**Production URL**: https://worker-management-production.up.railway.app  
**Status**: Ready for deployment ✅
