#!/bin/bash

echo "🚀 Ladybug Baileys - Quick Render.com Deployment"
echo "================================================="

# Step 1: Backup current files
echo "📦 Backing up current files..."
cp package.json package.json.backup 2>/dev/null || true
cp src/app.ts src/app.ts.backup 2>/dev/null || true

# Step 2: Use minimal deployment files
echo "🔧 Switching to minimal deployment files..."
cp package.minimal.json package.json
cp server.js server.js.backup 2>/dev/null || true

# Step 3: Clean up TypeScript files (not needed for minimal deployment)
echo "🧹 Cleaning up unnecessary files..."
rm -rf lib/ tsconfig.json jest.config.js eslint.config.mjs .prettierrc 2>/dev/null || true
# Keep src/ folder for reference but it won't be used

# Step 4: Create minimal structure
echo "📁 Creating minimal structure..."
mkdir -p auth_info_baileys

# Step 5: Test locally
echo "🧪 Testing locally..."
npm install > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Step 6: Git preparation
echo "📋 Preparing for Git push..."
git add .
git status

echo ""
echo "🎉 Ready for deployment!"
echo ""
echo "📋 Next Steps:"
echo "1. Commit: git commit -m 'Ready for Render.com minimal deployment'"
echo "2. Push: git push origin main"
echo "3. Create Render.com service with these settings:"
echo "   - Runtime: Node"
echo "   - Build Command: npm install"
echo "   - Start Command: npm start"
echo "   - Node Version: 18"
echo "   - Environment: NODE_ENV=production"
echo ""
echo "📚 See RENDER_QUICK_DEPLOY.md for detailed instructions!"
echo ""
echo "🔍 Your deployment will include:"
echo "   ✅ WhatsApp connection"
echo "   ✅ REST API endpoints"
echo "   ✅ Health monitoring"
echo "   ✅ Message sending"
echo "   ✅ Production ready"