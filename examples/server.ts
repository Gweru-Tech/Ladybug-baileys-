/**
 * Server Example - Ladybug Baileys with REST API
 */

import { LadybugApp } from '../src/app';
import express from 'express';

async function serverExample() {
  console.log('🚀 Starting Ladybug Baileys Server Example...');
  
  // Configuration
  const config = {
    printQRInTerminal: true,
    enableScheduling: true,
    enableAnalytics: true,
    enableWebhooks: false,
    enableCaching: true,
    enableRateLimiting: true,
    
    // REST API configuration
    enableRESTAPI: true,
    restAPI: {
      port: 3000,
      enableCors: true,
      enableRateLimit: true,
      enableCompression: true,
      enableSecurity: true,
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100,
      apiKey: process.env.API_KEY || 'your-api-key-here'
    },
    
    // GraphQL API configuration
    enableGraphQL: true,
    graphql: {
      path: '/graphql',
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production'
    },
    
    storage: {
      type: 'redis',
      options: {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0')
        }
      }
    }
  };
  
  // Create and start the application
  const app = new LadybugApp(config);
  
  try {
    await app.start();
    
    console.log('\n🎉 Ladybug Baileys Server is running!');
    console.log('📡 REST API: http://localhost:3000');
    console.log('🔍 GraphQL API: http://localhost:3000/graphql');
    console.log('📊 Health Check: http://localhost:3000/health');
    console.log('📚 API Docs: http://localhost:3000/docs');
    console.log('\n📝 Example API calls:');
    console.log('curl -X GET http://localhost:3000/health');
    console.log('curl -X GET http://localhost:3000/connection');
    console.log('curl -X GET http://localhost:3000/analytics');
    
    // Example of using the API programmatically
    setTimeout(() => {
      demonstrateAPIUsage();
    }, 10000);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

async function demonstrateAPIUsage() {
  console.log('\n📡 Demonstrating API usage...');
  
  try {
    const response = await fetch('http://localhost:3000/health');
    const health = await response.json();
    console.log('✅ Health check:', health);
    
    const connectionResponse = await fetch('http://localhost:3000/connection');
    const connection = await connectionResponse.json();
    console.log('✅ Connection status:', connection);
    
    const analyticsResponse = await fetch('http://localhost:3000/analytics');
    const analytics = await analyticsResponse.json();
    console.log('✅ Analytics:', analytics.data?.messages);
    
  } catch (error) {
    console.error('❌ API demo failed:', error);
  }
}

// Run the example
if (require.main === module) {
  serverExample();
}

export { serverExample };