/**
 * Minimal Ladybug Baileys Server for Render.com Deployment
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { makeWASocket } = require('@whiskeysockets/baileys');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// WhatsApp socket
let sock = null;
let isConnected = false;

// Initialize WhatsApp connection
async function initializeWhatsApp() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info_baileys');
    
    sock = makeWASocket({
      auth: state,
      printQRInTerminal: false
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error?.output?.statusCode) !== 401;
        console.log('Connection closed, reconnecting:', shouldReconnect);
        
        if (shouldReconnect) {
          setTimeout(() => initializeWhatsApp(), 5000);
        }
      } else if (connection === 'open') {
        console.log('✅ Connected to WhatsApp!');
        isConnected = true;
      }
    });

    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('messages.upsert', (event) => {
      console.log('📨 Received messages:', event.messages.length);
    });

  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp:', error);
    setTimeout(() => initializeWhatsApp(), 5000);
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({
    message: '🐞 Ladybug Baileys API',
    status: 'running',
    connected: isConnected,
    timestamp: new Date().toISOString(),
    endpoints: [
      'GET /health',
      'GET /status',
      'POST /send-message'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    connected: isConnected,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    socket: sock ? 'initialized' : 'not initialized',
    timestamp: new Date().toISOString()
  });
});

app.post('/send-message', async (req, res) => {
  try {
    const { jid, message } = req.body;
    
    if (!jid || !message) {
      return res.status(400).json({
        success: false,
        error: 'Missing jid or message'
      });
    }

    if (!sock || !isConnected) {
      return res.status(503).json({
        success: false,
        error: 'WhatsApp not connected'
      });
    }

    const result = await sock.sendMessage(jid, { text: message });
    
    res.json({
      success: true,
      messageId: result.key.id,
      status: 'sent',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Ladybug Baileys server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Status: http://localhost:${PORT}/status`);
  
  // Initialize WhatsApp connection
  initializeWhatsApp();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (sock) sock.ws.close();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  if (sock) sock.ws.close();
  process.exit(0);
});

module.exports = app;