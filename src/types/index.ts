/**
 * Ladybug Baileys Type Definitions
 */

import { ConnectionState, WAMessage, WAMessageContent, AuthenticationState } from '@whiskeysockets/baileys';

// Enhanced Configuration Types
export interface LadybugConfig {
  // Base Baileys config
  auth?: AuthenticationState;
  printQRInTerminal?: boolean;
  browser?: any;
  syncFullHistory?: boolean;
  
  // Enhanced features
  enableScheduling?: boolean;
  enableAnalytics?: boolean;
  enableWebhooks?: boolean;
  enableCaching?: boolean;
  enableRateLimiting?: boolean;
  
  // Storage configuration
  storage?: StorageConfig;
  
  // Monitoring configuration
  monitoring?: MonitoringConfig;
  
  // Webhook configuration
  webhooks?: WebhookConfig[];
  
  // Rate limiting
  rateLimiting?: RateLimitConfig;
  
  // Security
  security?: SecurityConfig;
  
  // Performance
  performance?: PerformanceConfig;
}

export interface StorageConfig {
  type: 'memory' | 'redis' | 'file' | 'custom';
  options?: {
    redis?: {
      host: string;
      port: number;
      password?: string;
      db?: number;
    };
    file?: {
      path: string;
      encryption?: boolean;
    };
    custom?: any;
  };
}

export interface MonitoringConfig {
  enabled: boolean;
  metrics?: {
    messageCount: boolean;
    connectionStatus: boolean;
    performance: boolean;
    errors: boolean;
  };
  alerts?: {
    connectionLost: boolean;
    highMemoryUsage: boolean;
    rateLimitExceeded: boolean;
  };
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  retries?: number;
  timeout?: number;
}

export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface SecurityConfig {
  enableEncryption: boolean;
  apiKey?: string;
  allowedOrigins?: string[];
  rateLimiting?: RateLimitConfig;
  auditLogging?: boolean;
}

export interface PerformanceConfig {
  connectionPooling: boolean;
  maxConnections: number;
  caching: boolean;
  compression: boolean;
  keepAlive: boolean;
}

// Enhanced Event Types
export interface LadybugEventMap {
  'connection.update': ConnectionState;
  'messages.upsert': { messages: WAMessage[]; type: 'notify' | 'append' | 'history' };
  'messages.update': { key: any; update: any }[];
  'message.schedule': ScheduledMessage;
  'message.send': MessageSendEvent;
  'message.receive': MessageReceiveEvent;
  'webhook.triggered': WebhookEvent;
  'analytics.update': AnalyticsEvent;
  'security.alert': SecurityAlert;
  'performance.metrics': PerformanceMetrics;
}

export interface ScheduledMessage {
  id: string;
  jid: string;
  content: WAMessageContent;
  scheduledTime: Date;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  retryCount?: number;
  maxRetries?: number;
}

export interface MessageSendEvent {
  id: string;
  jid: string;
  content: WAMessageContent;
  status: 'sending' | 'sent' | 'failed';
  timestamp: Date;
  error?: Error;
}

export interface MessageReceiveEvent {
  message: WAMessage;
  processed: boolean;
  timestamp: Date;
}

export interface WebhookEvent {
  url: string;
  event: string;
  data: any;
  status: 'triggered' | 'success' | 'failed';
  timestamp: Date;
  attempt: number;
}

export interface AnalyticsEvent {
  type: 'message_sent' | 'message_received' | 'connection_change' | 'error_occurred';
  data: any;
  timestamp: Date;
}

export interface SecurityAlert {
  type: 'unauthorized_access' | 'rate_limit_exceeded' | 'suspicious_activity';
  details: any;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface PerformanceMetrics {
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  uptime: number;
  activeConnections: number;
  messagesPerSecond: number;
  responseTime: number;
}

// Plugin System Types
export interface Plugin {
  name: string;
  version: string;
  description: string;
  author: string;
  initialize: (context: PluginContext) => Promise<void>;
  destroy?: () => Promise<void>;
}

export interface PluginContext {
  config: LadybugConfig;
  logger: any;
  eventBus: any;
  storage: any;
}

// API Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
  requestId: string;
}

export interface SendMessageRequest {
  jid: string;
  content: WAMessageContent;
  options?: {
    schedule?: Date;
    priority?: 'low' | 'normal' | 'high';
    webhook?: string;
  };
}

export interface SendMessageResponse extends APIResponse {
  data?: {
    messageId: string;
    status: 'sent' | 'queued' | 'failed';
    scheduledAt?: string;
  };
}

// Analytics Types
export interface MessageAnalytics {
  totalSent: number;
  totalReceived: number;
  failedMessages: number;
  averageResponseTime: number;
  topContacts: Array<{ jid: string; count: number }>;
  messageTypeDistribution: Record<string, number>;
  hourlyActivity: Array<{ hour: number; count: number }>;
}

export interface ConnectionAnalytics {
  uptime: number;
  downtime: number;
  reconnectCount: number;
  averageReconnectTime: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
}

// Error Types
export class LadybugError extends Error {
  public code: string;
  public details?: any;
  
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'LadybugError';
    this.code = code;
    this.details = details;
  }
}

export class AuthenticationError extends LadybugError {
  constructor(message: string, details?: any) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthenticationError';
  }
}

export class ConnectionError extends LadybugError {
  constructor(message: string, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

export class MessageError extends LadybugError {
  constructor(message: string, details?: any) {
    super(message, 'MESSAGE_ERROR', details);
    this.name = 'MessageError';
  }
}

export class ValidationError extends LadybugError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type EventHandler<T = any> = (event: T) => void | Promise<void>;

export type MiddlewareFunction = (req: any, res: any, next: any) => void | Promise<void>;

// Re-export Baileys types for convenience
export * from '@whiskeysockets/baileys';