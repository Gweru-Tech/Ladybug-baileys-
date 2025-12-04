# 🐞 Ladybug Baileys

> Enhanced WhatsApp Web API library with advanced features, better performance, and production-ready deployment

[![npm version](https://badge.fury.io/js/%40ladybug%2Fbaileys.svg)](https://badge.fury.io/js/%40ladybug%2Fbaileys)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

Ladybug Baileys is a feature-rich, production-ready WhatsApp automation library built on top of whiskeysockets/baileys with enhanced capabilities including message scheduling, analytics, monitoring, webhooks, and comprehensive APIs.

## ✨ Key Features

### 🚀 Core Features
- **Enhanced WhatsApp Integration** - Built on top of whiskeysockets/baileys v7
- **Message Scheduling** - Schedule messages for future delivery with retry logic
- **Advanced Analytics** - Comprehensive message and connection analytics
- **Real-time Monitoring** - Health checks, alerts, and performance metrics
- **Rate Limiting** - Built-in rate limiting to prevent spam
- **Storage Abstraction** - Support for memory, Redis, file, and custom storage

### 🌐 API Features
- **REST API** - Complete REST API with authentication and rate limiting
- **GraphQL API** - Flexible GraphQL interface for complex queries
- **Webhook Support** - Real-time webhook notifications
- **Plugin System** - Extensible plugin architecture
- **Middleware Support** - Custom middleware for request processing

### 🛠️ Developer Experience
- **TypeScript Support** - Full TypeScript definitions and examples
- **Comprehensive Documentation** - Detailed API documentation and guides
- **Error Handling** - Robust error handling and logging
- **Debugging Tools** - Built-in debugging and monitoring tools
- **CLI Tools** - Command-line interface for management

### 🏗️ Production Ready
- **Docker Support** - Containerized deployment with Docker and Docker Compose
- **Render.com Ready** - Optimized for Render.com deployment
- **Horizontal Scaling** - Support for horizontal scaling and load balancing
- **Security Features** - Authentication, encryption, and audit logging
- **Health Checks** - Comprehensive health monitoring and alerts

## 📦 Installation

```bash
# Using npm
npm install @ladybug/baileys

# Using yarn
yarn add @ladybug/baileys

# Using pnpm
pnpm add @ladybug/baileys
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { makeLadybugSocket } from '@ladybug/baileys';

// Create Ladybug Baileys instance
const ladybug = makeLadybugSocket({
  printQRInTerminal: true,
  enableScheduling: true,
  enableAnalytics: true,
  enableCaching: true,
  enableRateLimiting: true
});

// Set up event listeners
ladybug.getEventBus().on('connection.update', (update) => {
  if (update.connection === 'open') {
    console.log('✅ Connected to WhatsApp!');
  }
});

ladybug.getEventBus().on('message.receive', (event) => {
  console.log('📨 Received message:', event.message.message?.conversation);
});

// Connect to WhatsApp
await ladybug.connect();

// Send a message
const result = await ladybug.sendMessage(
  '1234567890@s.whatsapp.net',
  { text: 'Hello from Ladybug Baileys! 🐞' }
);

console.log('Message sent:', result);
```

### Server with APIs

```typescript
import { LadybugApp } from '@ladybug/baileys';

const app = new LadybugApp({
  printQRInTerminal: true,
  enableRESTAPI: true,
  enableGraphQL: true,
  restAPI: {
    port: 3000,
    apiKey: 'your-api-key-here'
  },
  storage: {
    type: 'redis',
    options: {
      redis: {
        host: 'localhost',
        port: 6379
      }
    }
  }
});

await app.start();

// APIs are now available:
// REST API: http://localhost:3000
// GraphQL API: http://localhost:3000/graphql
// Health Check: http://localhost:3000/health
```

## 📚 API Examples

### REST API

```bash
# Health check
curl http://localhost:3000/health

# Send message
curl -X POST http://localhost:3000/messages/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "jid": "1234567890@s.whatsapp.net",
    "content": {
      "text": "Hello from API!"
    }
  }'

# Schedule message
curl -X POST http://localhost:3000/messages/schedule \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "jid": "1234567890@s.whatsapp.net",
    "content": {
      "text": "Scheduled message!"
    },
    "scheduleTime": "2024-12-31T23:59:59Z"
  }'

# Get analytics
curl http://localhost:3000/analytics
```

### GraphQL API

```graphql
# Query connection status
query {
  connectionStatus {
    isConnected
    state
    lastUpdate
  }
}

# Send message
mutation {
  sendMessage(input: {
    jid: "1234567890@s.whatsapp.net"
    content: {
      text: "Hello from GraphQL!"
    }
  }) {
    success
    messageId
    status
  }
}

# Get analytics
query {
  analytics {
    messages {
      totalSent
      totalReceived
      failedMessages
    }
    connection {
      uptime
      connectionQuality
    }
    performance {
      messagesPerSecond
      memoryUsage {
        heapUsed
        heapTotal
      }
    }
  }
}
```

## 🛠️ Advanced Features

### Message Scheduling

```typescript
// Schedule a message for future delivery
const messageId = await ladybug.getScheduler().scheduleMessage(
  '1234567890@s.whatsapp.net',
  { text: 'Happy New Year! 🎉' },
  new Date('2024-12-31T23:59:59Z'),
  {
    retries: 3,
    retryDelay: 5000
  }
);

// Schedule recurring messages
const scheduleId = await ladybug.getScheduler().scheduleRecurringMessage(
  '1234567890@s.whatsapp.net',
  { text: 'Daily reminder! ⏰' },
  '0 9 * * *', // Daily at 9 AM
  { priority: 'normal' }
);
```

### Analytics and Monitoring

```typescript
// Get comprehensive analytics
const analytics = await ladybug.getAnalytics();
console.log('Messages sent:', analytics.messages.totalSent);
console.log('Connection uptime:', analytics.connection.uptime);

// Get real-time metrics
const metrics = await ladybug.getMonitoring().getMetrics();
console.log('Memory usage:', metrics.memoryUsage);
console.log('Messages per second:', metrics.messagesPerSecond);

// Get health status
const health = await ladybug.getMonitoring().getHealthCheck();
console.log('Health status:', health.status);
```

### Plugin Development

```typescript
import { Plugin, PluginContext } from '@ladybug/baileys';

const myPlugin: Plugin = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My custom plugin',
  author: 'Your Name',
  
  async initialize(context: PluginContext) {
    // Initialize your plugin
    context.logger.info('Plugin initialized');
    
    // Register event handlers
    context.eventBus.on('message.receive', (event) => {
      // Handle incoming messages
    });
  },
  
  async destroy() {
    // Cleanup resources
  }
};

// Register the plugin
ladybug.getPluginManager().registerPlugin(myPlugin);
await ladybug.getPluginManager().enablePlugin('my-plugin');
```

## 🐳 Docker Deployment

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/ladybug/baileys.git
cd baileys

# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start with Docker Compose
docker-compose up -d

# Check logs
docker-compose logs -f ladybug-baileys

# Scale services
docker-compose up -d --scale ladybug-baileys=3
```

### Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["node", "lib/index.js"]
```

## 🌐 Render.com Deployment

Ladybug Baileys is optimized for deployment on Render.com:

1. **Connect your GitHub repository** to Render.com
2. **Create a new Web Service** with the following settings:
   - Build Command: `npm run build`
   - Start Command: `npm run start:prod`
   - Environment: `Node`
3. **Add environment variables**:
   - `NODE_ENV=production`
   - `REDIS_URL` (connect to Redis addon)
   - `API_KEY` (your API key)
4. **Deploy!** 🚀

The included `render.yaml` file provides a pre-configured deployment template.

## 📊 Monitoring and Observability

### Health Checks

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed health status
{
  "status": "healthy",
  "checks": {
    "connection": true,
    "memory": true,
    "storage": true,
    "performance": true
  },
  "metrics": {
    "memoryUsage": { "heapUsed": 50123456 },
    "uptime": 3600000,
    "messagesPerSecond": 2.5
  }
}
```

### Metrics and Analytics

```bash
# Get analytics
curl http://localhost:3000/analytics

# Get performance metrics
curl http://localhost:3000/metrics

# Get alerts
curl http://localhost:3000/alerts
```

### Prometheus Integration

Ladybug Baileys includes built-in Prometheus metrics for monitoring:

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'ladybug-baileys'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## 🔧 Configuration

### Configuration Options

```typescript
interface LadybugConfig {
  // Basic WhatsApp connection
  auth?: AuthenticationState;
  printQRInTerminal?: boolean;
  browser?: any;
  syncFullHistory?: boolean;
  
  // Feature toggles
  enableScheduling?: boolean;
  enableAnalytics?: boolean;
  enableWebhooks?: boolean;
  enableCaching?: boolean;
  enableRateLimiting?: boolean;
  
  // Storage configuration
  storage?: {
    type: 'memory' | 'redis' | 'file' | 'custom';
    options?: any;
  };
  
  // Monitoring configuration
  monitoring?: {
    enabled: boolean;
    metrics?: any;
    alerts?: any;
  };
  
  // Rate limiting
  rateLimiting?: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  
  // Security
  security?: {
    enableEncryption: boolean;
    apiKey?: string;
    auditLogging: boolean;
  };
}
```

### Environment Variables

```bash
# General
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Authentication
API_KEY=your-secret-api-key

# Storage
REDIS_URL=redis://user:pass@host:port
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your-password

# Features
ENABLE_SCHEDULING=true
ENABLE_ANALYTICS=true
ENABLE_WEBHOOKS=true
ENABLE_RATE_LIMITING=true

# Monitoring
ENABLE_METRICS=true
HEALTH_CHECK_INTERVAL=30
```

## 🧪 Examples and Templates

Check out the `examples/` directory for complete examples:

- `basic-usage.ts` - Simple WhatsApp bot
- `server.ts` - Full server with REST and GraphQL APIs
- `plugin-example.ts` - Custom plugin development
- `middleware-example.ts` - Custom middleware implementation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/ladybug/baileys.git
cd baileys

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build the project
npm run build

# Run examples
npm run example:basic
npm run example:server
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This project is not affiliated, associated, authorized, endorsed by, or in any way officially connected with WhatsApp or any of its subsidiaries or its affiliates. The official WhatsApp website can be found at whatsapp.com. "WhatsApp" as well as related names, marks, emblems and images are registered trademarks of their respective owners.

The maintainers of Ladybug Baileys do not in any way condone the use of this application in practices that violate the Terms of Service of WhatsApp. Use at your own discretion.

## 🙏 Acknowledgments

- Built on top of [whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)
- Inspired by the WhatsApp Web protocol research
- Thanks to all contributors and the open-source community

## 📞 Support

- 📖 [Documentation](https://ladybug-baileys.github.io)
- 🐛 [Issues](https://github.com/ladybug/baileys/issues)
- 💬 [Discussions](https://github.com/ladybug/baileys/discussions)
- 🎯 [Roadmap](https://github.com/ladybug/baileys/projects)

---

Made with ❤️ by the Ladybug Development Team