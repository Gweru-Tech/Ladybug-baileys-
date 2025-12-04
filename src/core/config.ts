/**
 * Ladybug Baileys Default Configuration
 */

import { LadybugConfig } from '../types';

export const defaultConfig: LadybugConfig = {
  // Base Baileys configuration
  printQRInTerminal: true,
  syncFullHistory: false,
  
  // Enhanced features - enabled by default
  enableScheduling: true,
  enableAnalytics: true,
  enableCaching: true,
  enableRateLimiting: true,
  enableWebhooks: false,
  
  // Storage configuration - memory storage by default
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
  
  // Rate limiting configuration
  rateLimiting: {
    enabled: true,
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 messages per minute
    skipSuccessfulRequests: false,
    skipFailedRequests: false
  },
  
  // Security configuration
  security: {
    enableEncryption: false,
    auditLogging: true,
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 1000,
      maxRequests: 100
    }
  },
  
  // Performance configuration
  performance: {
    connectionPooling: false,
    maxConnections: 5,
    caching: true,
    compression: true,
    keepAlive: true
  }
};

export const productionConfig: LadybugConfig = {
  ...defaultConfig,
  enableWebhooks: true,
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
  security: {
    enableEncryption: true,
    apiKey: process.env.API_KEY,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
    auditLogging: true,
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 1000,
      maxRequests: 50,
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    }
  },
  performance: {
    connectionPooling: true,
    maxConnections: 10,
    caching: true,
    compression: true,
    keepAlive: true
  }
};

export const developmentConfig: LadybugConfig = {
  ...defaultConfig,
  printQRInTerminal: true,
  enableAnalytics: false,
  monitoring: {
    enabled: false,
    metrics: {
      messageCount: false,
      connectionStatus: false,
      performance: false,
      errors: false
    },
    alerts: {
      connectionLost: false,
      highMemoryUsage: false,
      rateLimitExceeded: false
    }
  },
  security: {
    enableEncryption: false,
    auditLogging: false,
    rateLimiting: {
      enabled: false,
      windowMs: 60 * 1000,
      maxRequests: 1000
    }
  }
};

export const getConfig = (env: string = process.env.NODE_ENV || 'development'): LadybugConfig => {
  switch (env) {
    case 'production':
      return productionConfig;
    case 'development':
      return developmentConfig;
    default:
      return defaultConfig;
  }
};