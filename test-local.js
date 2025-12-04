#!/usr/bin/env node

/**
 * Quick local test for the minimal deployment
 */

console.log('🧪 Testing Ladybug Baileys minimal setup...');

// Test if we can require the dependencies
try {
  console.log('📦 Testing dependencies...');
  const express = require('express');
  const { makeWASocket } = require('@whiskeysockets/baileys');
  const cors = require('cors');
  const helmet = require('helmet');
  const compression = require('compression');
  
  console.log('✅ All dependencies loaded successfully');
  
  // Test if we can create an Express app
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json());
  
  console.log('✅ Express app created successfully');
  
  // Test basic routes
  app.get('/test', (req, res) => {
    res.json({ message: 'Test successful!', timestamp: new Date().toISOString() });
  });
  
  // Try to start server briefly
  const server = app.listen(0, () => {
    const port = server.address().port;
    console.log(`✅ Test server started on port ${port}`);
    
    // Quick test
    const http = require('http');
    http.get(`http://localhost:${port}/test`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log('✅ API test passed:', response.message);
          server.close();
          console.log('🎉 All tests passed! Ready for deployment!');
        } catch (error) {
          console.log('❌ API test failed:', error.message);
          server.close();
        }
      });
    }).on('error', (err) => {
      console.log('❌ API test failed:', err.message);
      server.close();
    });
  });
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.log('\n🔧 Try running: npm install');
  process.exit(1);
}