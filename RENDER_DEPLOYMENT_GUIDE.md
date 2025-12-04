# 🚀 Render.com Deployment Guide

## 🛠️ Fixing Common Deployment Issues

The error you encountered (`failed to solve: process "/bin/sh -c npm ci --only=production"`) is common when deploying complex TypeScript projects to Render.com. Here are the solutions:

## 📋 Option 1: Use the Simplified Dockerfile (Recommended)

1. **Replace your Dockerfile** with the simplified version:
   ```bash
   cp Dockerfile.render Dockerfile
   ```

2. **Update your Render.com service settings**:
   - Build Command: `docker build -t ladybug-baileys .`
   - Start Command: `docker run -p 3000:3000 ladybug-baileys`

## 📋 Option 2: Use Direct Node.js Deployment (Easiest)

### Step 1: Update package.json Scripts

Make sure your package.json has these scripts:

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node lib/app.js",
    "postinstall": "npm run build"
  }
}
```

### Step 2: Render.com Service Settings

**Build Command:**
```bash
npm install
```

**Start Command:**
```bash
npm start
```

**Environment Variables:**
```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

## 📋 Option 3: Fix Multi-stage Dockerfile

If you want to use the original Dockerfile, make these changes:

### 1. Fix package.json

Remove problematic dependencies from production and move them to devDependencies:

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^7.0.0-rc.9",
    "ws": "^8.14.2",
    "pino": "^8.16.2",
    "node-cache": "^5.1.2",
    "ioredis": "^5.3.2",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "compression": "^1.7.4",
    "joi": "^17.11.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.1",
    "node-cron": "^3.0.3",
    "sharp": "^0.33.1",
    "axios": "^1.6.2"
  },
  "devDependencies": {
    "ffmpeg-static": "^5.2.0",
    "graphql": "^16.8.1",
    "apollo-server-express": "^3.12.1",
    "type-graphql": "^1.1.1",
    "reflect-metadata": "^0.1.13",
    "bull": "^4.12.2"
  }
}
```

### 2. Update Dockerfile

Use the updated Dockerfile I provided above.

## 🔧 Quick Fix Steps

### Step 1: Update Dockerfile
```bash
# Replace your Dockerfile with the render-optimized version
cp Dockerfile.render Dockerfile
```

### Step 2: Update Render.com Settings

In your Render.com service settings:

**Runtime:**
- Environment: `Docker`

**Build Command:**
```bash
docker build -t app .
```

**Start Command:**
```bash
docker run -p $PORT:3000 app
```

**Environment Variables:**
```
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
```

### Step 3: Add Health Check

Add a health check path to your service:
- Health Check Path: `/health`

## 🚀 Alternative: Simple Node.js Deployment (No Docker)

If Docker is causing issues, deploy as a Node.js service:

### 1. Create a Simple Start Script

Create `server.js` in your root:

```javascript
// Simple server start
const { LadybugApp } = require('./lib/app');

const app = new LadybugApp({
  port: process.env.PORT || 3000,
  enableRESTAPI: true,
  restAPI: {
    port: process.env.PORT || 3000
  }
});

app.start().catch(console.error);
```

### 2. Update package.json

```json
{
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "postinstall": "npm run build"
  }
}
```

### 3. Render.com Settings

- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: `18`

## 🐛 Troubleshooting Common Issues

### Issue 1: "npm ci --only=production" fails

**Solution**: Use `npm install` instead of `npm ci --only=production`

### Issue 2: TypeScript compilation errors

**Solution**: Make sure TypeScript and build tools are installed

### Issue 3: Module not found errors

**Solution**: Check the `main` field in package.json points to the correct file

### Issue 4: Port binding issues

**Solution**: Use `$PORT` environment variable instead of hardcoded port

### Issue 5: Health check failures

**Solution**: Make sure the `/health` endpoint returns proper JSON response

## ✅ Recommended Setup

For the smoothest deployment, I recommend:

1. **Use Node.js Runtime** (not Docker)
2. **Simplified Dependencies** (remove complex optional ones)
3. **Basic Configuration** (disable GraphQL if not needed)

### Final package.json for Render.com:

```json
{
  "name": "@ladybug/baileys",
  "version": "1.0.0",
  "main": "lib/app.js",
  "scripts": {
    "build": "tsc",
    "start": "node lib/app.js",
    "postinstall": "npm run build"
  },
  "dependencies": {
    "@whiskeysockets/baileys": "^7.0.0-rc.9",
    "ws": "^8.14.2",
    "pino": "^8.16.2",
    "node-cache": "^5.1.2",
    "ioredis": "^5.3.2",
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "compression": "^1.7.4",
    "joi": "^17.11.0",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "uuid": "^9.0.1",
    "node-cron": "^3.0.3",
    "sharp": "^0.33.1",
    "axios": "^1.6.2"
  },
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

### Render.com Service Configuration:

- **Name**: `ladybug-baileys`
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`
- **Node Version**: `18`
- **Plan**: `Starter` (or higher)

This should resolve the deployment issues and get your Ladybug Baileys running on Render.com! 🚀