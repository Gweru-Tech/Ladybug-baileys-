/**
 * Complete Example - Ladybug Baileys with All Features
 */

import { LadybugApp } from '../src/app';
import { Logger } from '../src/utils/Logger';
import { Plugin } from '../src/types';

// Custom Plugin Example
const greetingPlugin: Plugin = {
  name: 'greeting-plugin',
  version: '1.0.0',
  description: 'Automatically responds to greetings',
  author: 'Ladybug Team',
  
  async initialize(context) {
    context.logger.info('🎉 Greeting plugin initialized');
    
    // Register event handler for incoming messages
    context.eventBus.on('message.receive', async (event) => {
      const message = event.message;
      const text = message.message?.conversation?.toLowerCase();
      
      // Check for greetings
      if (text && ['hello', 'hi', 'hey', 'good morning', 'good evening'].includes(text)) {
        await context.eventBus.emit('message.send', {
          id: `greeting_${Date.now()}`,
          jid: message.key.remoteJid!,
          content: { text: 'Hello! 👋 Thanks for reaching out!' },
          status: 'sending',
          timestamp: new Date()
        });
      }
    });
  }
};

async function completeExample() {
  console.log('🚀 Starting Complete Ladybug Baileys Example...');
  
  // Comprehensive configuration
  const config = {
    // Basic WhatsApp settings
    printQRInTerminal: true,
    syncFullHistory: false,
    
    // Feature toggles
    enableScheduling: true,
    enableAnalytics: true,
    enableWebhooks: false,
    enableCaching: true,
    enableRateLimiting: true,
    enablePlugins: true,
    
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
      apiKey: process.env.API_KEY || 'demo-api-key'
    },
    
    // GraphQL API configuration
    enableGraphQL: true,
    graphql: {
      path: '/graphql',
      playground: true,
      introspection: true
    },
    
    // Storage configuration (using memory for demo)
    storage: {
      type: 'memory',
      options: {}
    },
    
    // Monitoring configuration
    monitoring: {
      enabled: true,
      metrics: {
        messageCount: true,
        connectionStatus: true,
        performance: true,
        errors: true
      },
      alerts: {
        connectionLost: true,
        highMemoryUsage: true,
        rateLimitExceeded: true
      }
    },
    
    // Rate limiting
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 messages per minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    },
    
    // Security settings
    security: {
      enableEncryption: false,
      auditLogging: true
    },
    
    // Performance settings
    performance: {
      connectionPooling: false,
      maxConnections: 5,
      caching: true,
      compression: true,
      keepAlive: true
    }
  };
  
  // Create and start the application
  const app = new LadybugApp(config);
  const logger = new Logger('CompleteExample');
  
  try {
    // Set up event listeners before connecting
    const ladybug = app.getLadybug();
    
    // Connection events
    ladybug.getEventBus().on('connection.update', (update) => {
      console.log('📡 Connection update:', update);
      
      if (update.connection === 'open') {
        console.log('✅ Connected to WhatsApp!');
        demonstrateFeatures(ladybug, logger);
      } else if (update.connection === 'close') {
        console.log('❌ Disconnected from WhatsApp');
      }
    });
    
    // Message events
    ladybug.getEventBus().on('message.receive', async (event) => {
      const message = event.message;
      const jid = message.key.remoteJid;
      const text = message.message?.conversation;
      
      console.log(`📨 Message from ${jid}: ${text || '[Media]'}`);
      
      // Update analytics
      await ladybug.getMonitoring().trackMessage('received', message);
    });
    
    ladybug.getEventBus().on('message.send', async (event) => {
      console.log(`📤 Message sent to ${event.jid}: ${event.status}`);
      
      if (event.status === 'sent') {
        await ladybug.getMonitoring().trackMessage('sent', {
          key: { id: event.id },
          message: { conversation: 'Sent message' }
        } as any);
      }
    });
    
    // Initialize plugins
    const pluginManager = ladybug.getPluginManager();
    await pluginManager.registerPlugin(greetingPlugin);
    await pluginManager.enablePlugin('greeting-plugin');
    
    // Start the application
    await app.start();
    
    console.log('\n🎉 Ladybug Baileys Complete Example is running!');
    console.log('📡 REST API: http://localhost:3000');
    console.log('🔍 GraphQL API: http://localhost:3000/graphql');
    console.log('📊 Health Check: http://localhost:3000/health');
    console.log('📚 API Docs: http://localhost:3000/docs');
    console.log('\n🌟 Features demonstrated:');
    console.log('✅ WhatsApp connection and QR code');
    console.log('✅ REST and GraphQL APIs');
    console.log('✅ Message scheduling');
    console.log('✅ Analytics and monitoring');
    console.log('✅ Plugin system');
    console.log('✅ Rate limiting');
    console.log('✅ Storage abstraction');
    console.log('✅ Event handling');
    
  } catch (error) {
    console.error('❌ Failed to start complete example:', error);
    process.exit(1);
  }
}

async function demonstrateFeatures(ladybug: any, logger: Logger) {
  // Wait a bit before demonstrating features
  setTimeout(async () => {
    try {
      console.log('\n🌟 Demonstrating Ladybug Baileys Features...');
      
      // 1. Send a basic message
      console.log('📤 1. Sending a basic message...');
      const result = await ladybug.sendMessage(
        '1234567890@s.whatsapp.net', // Replace with actual number
        { text: 'Hello from Ladybug Baileys Complete Example! 🐞✨' }
      );
      console.log('✅ Basic message result:', result);
      
      // 2. Schedule a message
      console.log('⏰ 2. Scheduling a message for 10 seconds from now...');
      const scheduleTime = new Date(Date.now() + 10000);
      const scheduledId = await ladybug.getScheduler().scheduleMessage(
        '1234567890@s.whatsapp.net', // Replace with actual number
        { text: 'This is a scheduled message! ⏰' },
        scheduleTime,
        { priority: 'high' }
      );
      console.log('✅ Message scheduled with ID:', scheduledId);
      
      // 3. Send media message
      console.log('🖼️ 3. Sending an image message...');
      const imageResult = await ladybug.sendMessage(
        '1234567890@s.whatsapp.net', // Replace with actual number
        {
          image: { url: 'https://picsum.photos/800/600?random=1' },
          caption: 'Random image from Ladybug Baileys 🎨'
        }
      );
      console.log('✅ Image message result:', imageResult);
      
      // 4. Get analytics
      console.log('📊 4. Getting analytics...');
      const analytics = await ladybug.getAnalytics();
      console.log('✅ Analytics:', {
        messagesSent: analytics.messages.totalSent,
        messagesReceived: analytics.messages.totalReceived,
        connectionUptime: analytics.connection.uptime,
        memoryUsage: `${Math.round(analytics.performance.memoryUsage.heapUsed / 1024 / 1024)}MB`
      });
      
      // 5. Get health status
      console.log('🏥 5. Checking health status...');
      const health = await ladybug.getMonitoring().getHealthCheck();
      console.log('✅ Health status:', health.status);
      console.log('📈 Health checks:', health.checks);
      
      // 6. Get scheduled messages
      console.log('📅 6. Getting scheduled messages...');
      const scheduledMessages = await ladybug.getScheduler().getScheduledMessages();
      console.log('✅ Scheduled messages:', scheduledMessages.length);
      
      // 7. Get storage stats
      console.log('💾 7. Getting storage statistics...');
      const storageStats = ladybug.getStorage().getStats();
      console.log('✅ Storage stats:', storageStats);
      
      // 8. Get plugin metrics
      console.log('🔌 8. Getting plugin metrics...');
      const pluginMetrics = ladybug.getPluginManager().getPluginMetrics();
      console.log('✅ Plugin metrics:', pluginMetrics);
      
      console.log('\n🎊 All features demonstrated successfully!');
      console.log('\n💡 Try these API endpoints:');
      console.log('curl -X GET http://localhost:3000/health');
      console.log('curl -X GET http://localhost:3000/analytics');
      console.log('curl -X GET http://localhost:3000/messages/scheduled');
      
    } catch (error) {
      console.error('❌ Feature demonstration failed:', error);
    }
  }, 5000);
}

// Run the complete example
if (require.main === module) {
  completeExample();
}

export { completeExample };