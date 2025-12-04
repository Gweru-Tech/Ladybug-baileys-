#!/bin/bash

# Quick deployment script for Render.com

echo "🚀 Preparing Ladybug Baileys for Render.com deployment..."

# Step 1: Use simplified package.json
echo "📦 Using simplified package.json..."
cp package.simple.json package.json

# Step 2: Use simplified app.ts
echo "📝 Using simplified app.ts..."
cp src/app.simple.ts src/app.ts

# Step 3: Update main entry point
echo "🔧 Updating main entry point..."
npm pkg set main="lib/app.js"

# Step 4: Clean and build
echo "🧹 Cleaning and building..."
npm run clean
npm run build

# Step 5: Instructions for Render.com
echo "✅ Preparation complete!"
echo ""
echo "📋 Render.com Deployment Instructions:"
echo "1. Push this code to your GitHub repository"
echo "2. Create a new Web Service on Render.com"
echo "3. Use these settings:"
echo "   - Runtime: Node"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo "   - Node Version: 18"
echo "   - Environment Variables:"
echo "     * NODE_ENV=production"
echo "     * PORT=3000"
echo "     * LOG_LEVEL=info"
echo ""
echo "🎉 Your app should deploy successfully!"

# Step 6: Show what files changed
echo ""
echo "📁 Files created/modified for deployment:"
echo "✅ package.json (simplified)"
echo "✅ src/app.ts (simplified, no GraphQL)"
echo "✅ Dockerfile.render (alternative Docker option)"
echo "✅ RENDER_DEPLOYMENT_GUIDE.md (detailed guide)"
echo ""
echo "📚 See RENDER_DEPLOYMENT_GUIDE.md for troubleshooting!"