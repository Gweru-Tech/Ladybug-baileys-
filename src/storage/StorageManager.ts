/**
 * Storage Manager - Abstracted Storage Interface
 */

import { Logger } from '../utils/Logger';
import { StorageConfig } from '../types';

export interface StorageAdapter {
  initialize(): Promise<void>;
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
  clear(): Promise<void>;
  disconnect(): Promise<void>;
}

export interface StorageStats {
  totalKeys: number;
  memoryUsage?: number;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastActivity: Date;
}

export class StorageManager {
  private config: StorageConfig;
  private adapter: StorageAdapter;
  private logger: Logger;
  private stats: StorageStats;
  private isConnected: boolean = false;

  constructor(config: StorageConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || new Logger('StorageManager');
    this.adapter = this.createAdapter();
    this.stats = {
      totalKeys: 0,
      connectionStatus: 'disconnected',
      lastActivity: new Date()
    };
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info(`Initializing storage with type: ${this.config.type}`);
      
      await this.adapter.initialize();
      this.isConnected = true;
      this.stats.connectionStatus = 'connected';
      
      this.logger.info('Storage initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize storage:', error);
      this.stats.connectionStatus = 'error';
      throw error;
    }
  }

  public async get<T = any>(key: string): Promise<T | null> {
    try {
      this.updateActivity();
      
      const value = await this.adapter.get(key);
      this.logger.trace(`Get operation for key: ${key}`);
      
      return value;
    } catch (error) {
      this.logger.error(`Failed to get key ${key}:`, error);
      throw error;
    }
  }

  public async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      this.updateActivity();
      
      await this.adapter.set(key, value, ttl);
      this.updateStats();
      
      this.logger.trace(`Set operation for key: ${key}${ttl ? ` (TTL: ${ttl}s)` : ''}`);
    } catch (error) {
      this.logger.error(`Failed to set key ${key}:`, error);
      throw error;
    }
  }

  public async delete(key: string): Promise<void> {
    try {
      this.updateActivity();
      
      await this.adapter.delete(key);
      this.updateStats();
      
      this.logger.trace(`Delete operation for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
      throw error;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      this.updateActivity();
      
      return await this.adapter.exists(key);
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}:`, error);
      throw error;
    }
  }

  public async keys(pattern?: string): Promise<string[]> {
    try {
      this.updateActivity();
      
      return await this.adapter.keys(pattern);
    } catch (error) {
      this.logger.error('Failed to get keys:', error);
      throw error;
    }
  }

  public async clear(): Promise<void> {
    try {
      this.updateActivity();
      
      await this.adapter.clear();
      this.stats.totalKeys = 0;
      
      this.logger.info('Storage cleared');
    } catch (error) {
      this.logger.error('Failed to clear storage:', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    try {
      this.isConnected = false;
      this.stats.connectionStatus = 'disconnected';
      
      await this.adapter.disconnect();
      
      this.logger.info('Storage disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect storage:', error);
      throw error;
    }
  }

  // Message-specific storage methods
  public async getMessage(messageId: string): Promise<any> {
    return this.get(`message:${messageId}`);
  }

  public async setMessage(messageId: string, message: any, ttl?: number): Promise<void> {
    return this.set(`message:${messageId}`, message, ttl);
  }

  public async deleteMessage(messageId: string): Promise<void> {
    return this.delete(`message:${messageId}`);
  }

  public async getChat(chatJid: string): Promise<any> {
    return this.get(`chat:${chatJid}`);
  }

  public async setChat(chatJid: string, chat: any): Promise<void> {
    return this.set(`chat:${chatJid}`, chat);
  }

  public async getContact(contactJid: string): Promise<any> {
    return this.get(`contact:${contactJid}`);
  }

  public async setContact(contactJid: string, contact: any): Promise<void> {
    return this.set(`contact:${contactJid}`, contact);
  }

  public async getGroupMetadata(groupId: string): Promise<any> {
    return this.get(`group:${groupId}:metadata`);
  }

  public async setGroupMetadata(groupId: string, metadata: any, ttl?: number): Promise<void> {
    return this.set(`group:${groupId}:metadata`, metadata, ttl);
  }

  public async getScheduledMessages(): Promise<any[]> {
    const messageKeys = await this.keys('scheduled:*');
    const messages = await Promise.all(
      messageKeys.map(key => this.get(key))
    );
    return messages.filter(msg => msg !== null);
  }

  public async setScheduledMessage(messageId: string, message: any): Promise<void> {
    return this.set(`scheduled:${messageId}`, message);
  }

  public async deleteScheduledMessage(messageId: string): Promise<void> {
    return this.delete(`scheduled:${messageId}`);
  }

  // Analytics storage
  public async getAnalytics(period?: string): Promise<any> {
    const key = period ? `analytics:${period}` : 'analytics:current';
    return this.get(key);
  }

  public async setAnalytics(data: any, period?: string): Promise<void> {
    const key = period ? `analytics:${period}` : 'analytics:current';
    return this.set(key, data);
  }

  // User session storage
  public async getUserSession(userId: string): Promise<any> {
    return this.get(`session:${userId}`);
  }

  public async setUserSession(userId: string, session: any, ttl?: number): Promise<void> {
    return this.set(`session:${userId}`, session, ttl);
  }

  public async deleteUserSession(userId: string): Promise<void> {
    return this.delete(`session:${userId}`);
  }

  // Configuration storage
  public async getConfig(key: string): Promise<any> {
    return this.get(`config:${key}`);
  }

  public async setConfig(key: string, value: any): Promise<void> {
    return this.set(`config:${key}`, value);
  }

  // Rate limiting storage
  public async getRateLimit(identifier: string, window: string): Promise<number> {
    const key = `ratelimit:${identifier}:${window}`;
    return (await this.get(key)) || 0;
  }

  public async setRateLimit(identifier: string, window: string, count: number, ttl?: number): Promise<void> {
    const key = `ratelimit:${identifier}:${window}`;
    return this.set(key, count, ttl);
  }

  // Get statistics
  public getStats(): StorageStats {
    return { ...this.stats };
  }

  public async updateStats(): Promise<void> {
    try {
      this.stats.totalKeys = (await this.keys()).length;
      this.stats.lastActivity = new Date();
    } catch (error) {
      this.logger.error('Failed to update stats:', error);
    }
  }

  // Health check
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: any;
  }> {
    try {
      // Test basic operations
      const testKey = `health_check_${Date.now()}`;
      await this.set(testKey, 'test');
      const retrieved = await this.get(testKey);
      await this.delete(testKey);

      const isHealthy = retrieved === 'test' && this.isConnected;

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        details: {
          connected: this.isConnected,
          totalKeys: this.stats.totalKeys,
          lastActivity: this.stats.lastActivity,
          storageType: this.config.type
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          storageType: this.config.type
        }
      };
    }
  }

  // Backup and restore
  public async backup(): Promise<any> {
    const allKeys = await this.keys();
    const backup: Record<string, any> = {};

    for (const key of allKeys) {
      const value = await this.get(key);
      if (value !== null) {
        backup[key] = value;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      storageType: this.config.type,
      data: backup
    };
  }

  public async restore(backup: any): Promise<void> {
    if (!backup.data || typeof backup.data !== 'object') {
      throw new Error('Invalid backup format');
    }

    for (const [key, value] of Object.entries(backup.data)) {
      await this.set(key, value);
    }

    this.logger.info(`Restored ${Object.keys(backup.data).length} keys from backup`);
  }

  // Private methods
  private createAdapter(): StorageAdapter {
    switch (this.config.type) {
      case 'memory':
        return new MemoryAdapter();
      case 'redis':
        return new RedisAdapter(this.config.options?.redis || {});
      case 'file':
        return new FileAdapter(this.config.options?.file || {});
      case 'custom':
        if (!this.config.options?.custom) {
          throw new Error('Custom adapter not provided');
        }
        return this.config.options.custom;
      default:
        throw new Error(`Unsupported storage type: ${this.config.type}`);
    }
  }

  private updateActivity(): void {
    this.stats.lastActivity = new Date();
  }
}

// Memory Adapter
class MemoryAdapter implements StorageAdapter {
  private storage: Map<string, { value: any; expiry?: number }> = new Map();
  private logger: Logger;

  constructor() {
    this.logger = new Logger('MemoryAdapter');
  }

  async initialize(): Promise<void> {
    this.logger.info('Memory storage initialized');
  }

  async get(key: string): Promise<any> {
    const item = this.storage.get(key);
    if (!item) return null;

    if (item.expiry && Date.now() > item.expiry) {
      this.storage.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const item: any = { value };
    if (ttl) {
      item.expiry = Date.now() + (ttl * 1000);
    }
    this.storage.set(key, item);
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const item = this.storage.get(key);
    if (!item) return false;
    
    if (item.expiry && Date.now() > item.expiry) {
      this.storage.delete(key);
      return false;
    }
    
    return true;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.storage.keys());
    
    if (!pattern) return allKeys;
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async disconnect(): Promise<void> {
    this.storage.clear();
    this.logger.info('Memory storage disconnected');
  }
}

// Redis Adapter (simplified)
class RedisAdapter implements StorageAdapter {
  private redis: any;
  private config: any;
  private logger: Logger;

  constructor(config: any) {
    this.config = config;
    this.logger = new Logger('RedisAdapter');
  }

  async initialize(): Promise<void> {
    try {
      // This would use actual Redis client
      // For now, we'll use a mock implementation
      this.redis = new MemoryAdapter(); // Mock
      this.logger.info('Redis storage initialized (mock)');
    } catch (error) {
      this.logger.error('Failed to initialize Redis:', error);
      throw error;
    }
  }

  async get(key: string): Promise<any> {
    return this.redis.get(key);
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    return this.redis.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    return this.redis.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    return this.redis.exists(key);
  }

  async keys(pattern?: string): Promise<string[]> {
    return this.redis.keys(pattern);
  }

  async clear(): Promise<void> {
    return this.redis.clear();
  }

  async disconnect(): Promise<void> {
    return this.redis.disconnect();
  }
}

// File Adapter (simplified)
class FileAdapter implements StorageAdapter {
  private filePath: string;
  private logger: Logger;
  private data: Record<string, any> = {};

  constructor(config: any) {
    this.filePath = config.path || './storage.json';
    this.logger = new Logger('FileAdapter');
  }

  async initialize(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      try {
        const content = await fs.readFile(this.filePath, 'utf-8');
        this.data = JSON.parse(content);
      } catch (error) {
        // File doesn't exist, start with empty data
        this.data = {};
      }
      this.logger.info('File storage initialized');
    } catch (error) {
      this.logger.error('Failed to initialize file storage:', error);
      throw error;
    }
  }

  async get(key: string): Promise<any> {
    return this.data[key] || null;
  }

  async set(key: string, value: any): Promise<void> {
    this.data[key] = value;
    await this.saveToFile();
  }

  async delete(key: string): Promise<void> {
    delete this.data[key];
    await this.saveToFile();
  }

  async exists(key: string): Promise<boolean> {
    return key in this.data;
  }

  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Object.keys(this.data);
    
    if (!pattern) return allKeys;
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return allKeys.filter(key => regex.test(key));
  }

  async clear(): Promise<void> {
    this.data = {};
    await this.saveToFile();
  }

  async disconnect(): Promise<void> {
    await this.saveToFile();
    this.logger.info('File storage disconnected');
  }

  private async saveToFile(): Promise<void> {
    try {
      const fs = await import('fs/promises');
      await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      this.logger.error('Failed to save to file:', error);
      throw error;
    }
  }
}

export default StorageManager;