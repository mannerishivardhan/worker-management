#!/bin/bash

# Quick Backend Deployment Script for Railway
# Run this from the project root directory

echo "🚀 Deploying Backend to Railway..."
echo ""

# Check if we're in the right directory
if [ ! -d "backend" ]; then
    echo "❌ Error: backend directory not found"
    echo "Please run this script from the project root directory"
    exit 1
fi

# Navigate to backend
cd backend

echo "📦 Checking for changes..."
git status

echo ""
read -p "Do you want to proceed with deployment? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]
then
    echo "🔄 Committing changes..."
    git add .
    git commit -m "Update: Salary calculation with overtime breakdown"
    
    echo "📤 Pushing to Railway..."
    git push railway main
    
    echo ""
    echo "✅ Deployment initiated!"
    echo "📊 Monitor deployment: https://railway.app/dashboard"
    echo ""
    echo "⏰ Wait ~5 minutes for deployment to complete"
    echo "🧪 Then test: https://worker-management-production.up.railway.app/api/health"
else
    echo "❌ Deployment cancelled"
    exit 0
fi
