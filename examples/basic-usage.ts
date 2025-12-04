/**
 * Basic Usage Example - Ladybug Baileys
 */

import { LadybugBaileys, makeLadybugSocket } from '../src';
import { LadybugConfig } from '../src/types';

async function basicExample() {
  console.log('🚀 Starting Basic Ladybug Baileys Example...');
  
  // Configuration
  const config: LadybugConfig = {
    printQRInTerminal: true,
    enableScheduling: true,
    enableAnalytics: true,
    enableWebhooks: false,
    enableCaching: true,
    enableRateLimiting: true,
    
    storage: {
      type: 'file',
      options: {
        path: './auth-folder',
        encryption: false
      }
    },
    
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
    
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 10, // 10 messages per minute
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }
  };
  
  // Create Ladybug Baileys instance
  const ladybug = makeLadybugSocket(config);
  
  // Set up event listeners
  ladybug.getEventBus().on('connection.update', (update) => {
    console.log('📡 Connection update:', update);
    
    if (update.connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      sendMessageExample(ladybug);
    }
  });
  
  ladybug.getEventBus().on('message.receive', (event) => {
    console.log('📨 Received message:', {
      from: event.message.key.remoteJid,
      message: event.message.message?.conversation || 'Non-text message',
      timestamp: event.timestamp
    });
  });
  
  ladybug.getEventBus().on('message.send', (event) => {
    console.log('📤 Message send event:', {
      id: event.id,
      jid: event.jid,
      status: event.status,
      timestamp: event.timestamp
    });
  });
  
  try {
    // Connect to WhatsApp
    await ladybug.connect();
    
    console.log('🔄 Waiting for QR code scan...');
    
    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down...');
      await ladybug.disconnect();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

async function sendMessageExample(ladybug: LadybugBaileys) {
  // Wait a bit before sending messages
  setTimeout(async () => {
    try {
      console.log('📤 Sending a test message...');
      
      // Send a text message
      const result = await ladybug.sendMessage(
        '1234567890@s.whatsapp.net', // Replace with actual phone number
        { text: 'Hello from Ladybug Baileys! 🐞' }
      );
      
      console.log('✅ Message sent result:', result);
      
      // Send an image message
      const imageResult = await ladybug.sendMessage(
        '1234567890@s.whatsapp.net', // Replace with actual phone number
        {
          image: { url: 'https://picsum.photos/800/600' },
          caption: 'Random image from Ladybug Baileys'
        }
      );
      
      console.log('✅ Image sent result:', imageResult);
      
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  }, 5000);
}

// Run the example
if (require.main === module) {
  basicExample();
}

export { basicExample };