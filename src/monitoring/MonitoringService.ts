/**
 * Monitoring Service - Comprehensive Monitoring and Analytics
 */

import { Logger } from '../utils/Logger';
import { MonitoringConfig, MessageAnalytics, ConnectionAnalytics, PerformanceMetrics } from '../types';
import { WAMessage } from '@whiskeysockets/baileys';

export interface MonitoringAlert {
  id: string;
  type: 'connection_lost' | 'high_memory' | 'rate_limit' | 'error_threshold';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    connection: boolean;
    memory: boolean;
    storage: boolean;
    performance: boolean;
  };
  metrics: PerformanceMetrics;
  timestamp: Date;
}

export class MonitoringService {
  private config: MonitoringConfig;
  private logger: Logger;
  private metrics: PerformanceMetrics;
  private messageAnalytics: MessageAnalytics;
  private connectionAnalytics: ConnectionAnalytics;
  private alerts: MonitoringAlert[] = [];
  private isMonitoring: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number = Date.now();

  constructor(config: MonitoringConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || new Logger('MonitoringService');
    this.metrics = this.initializeMetrics();
    this.messageAnalytics = this.initializeMessageAnalytics();
    this.connectionAnalytics = this.initializeConnectionAnalytics();
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing monitoring service...');
      
      if (this.config.enabled) {
        this.startMonitoring();
      }
      
      this.logger.info('Monitoring service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize monitoring service:', error);
      throw error;
    }
  }

  public async trackMessage(type: 'sent' | 'received', message: WAMessage): Promise<void> {
    if (!this.config.metrics?.messageCount) return;
    
    try {
      if (type === 'sent') {
        this.messageAnalytics.totalSent++;
      } else {
        this.messageAnalytics.totalReceived++;
      }
      
      // Update hourly activity
      const hour = new Date().getHours();
      this.messageAnalytics.hourlyActivity[hour]++;
      
      // Update message type distribution
      const contentType = this.getContentType(message);
      this.messageAnalytics.messageTypeDistribution[contentType] =
        (this.messageAnalytics.messageTypeDistribution[contentType] || 0) + 1;
      
      // Update top contacts
      const jid = message.key.remoteJid!;
      const contactIndex = this.messageAnalytics.topContacts.findIndex(c => c.jid === jid);
      
      if (contactIndex >= 0) {
        this.messageAnalytics.topContacts[contactIndex].count++;
      } else {
        this.messageAnalytics.topContacts.push({ jid, count: 1 });
        this.messageAnalytics.topContacts.sort((a, b) => b.count - a.count);
        
        // Keep only top 10
        if (this.messageAnalytics.topContacts.length > 10) {
          this.messageAnalytics.topContacts = this.messageAnalytics.topContacts.slice(0, 10);
        }
      }
      
      this.logger.trace(`Tracked ${type} message: ${jid}`);
    } catch (error) {
      this.logger.error('Failed to track message:', error);
    }
  }

  public async trackConnection(status: 'connected' | 'disconnected' | 'reconnecting'): Promise<void> {
    if (!this.config.metrics?.connectionStatus) return;
    
    try {
      const now = Date.now();
      
      if (status === 'connected') {
        if (this.connectionAnalytics.downtime > 0) {
          const downtime = now - this.connectionAnalytics.downtime;
          this.connectionAnalytics.downtime += downtime;
          this.logger.info(`Connection restored after ${downtime}ms downtime`);
        }
      } else if (status === 'disconnected') {
        this.connectionAnalytics.downtime = now;
        
        // Trigger alert if configured
        if (this.config.alerts?.connectionLost) {
          this.createAlert('connection_lost', 'high', 'WhatsApp connection lost');
        }
      } else if (status === 'reconnecting') {
        this.connectionAnalytics.reconnectCount++;
      }
      
      // Update connection quality
      this.updateConnectionQuality();
      
      this.logger.trace(`Tracked connection status: ${status}`);
    } catch (error) {
      this.logger.error('Failed to track connection:', error);
    }
  }

  public async trackError(error: Error, context?: string): Promise<void> {
    if (!this.config.metrics?.errors) return;
    
    try {
      this.messageAnalytics.failedMessages++;
      
      // Trigger alert if error threshold exceeded
      const errorRate = this.getErrorRate();
      if (errorRate > 0.1 && this.config.alerts?.rateLimitExceeded) { // 10% error rate
        this.createAlert('error_threshold', 'medium', `High error rate: ${(errorRate * 100).toFixed(1)}%`);
      }
      
      this.logger.error(`Tracked error in ${context}: ${error.message}`);
    } catch (error) {
      this.logger.error('Failed to track error:', error);
    }
  }

  public async trackPerformance(operation: string, duration: number): Promise<void> {
    if (!this.config.metrics?.performance) return;
    
    try {
      // Update average response time
      const totalOperations = this.messageAnalytics.totalSent + this.messageAnalytics.totalReceived;
      const currentAverage = this.messageAnalytics.averageResponseTime;
      
      this.messageAnalytics.averageResponseTime =
        (currentAverage * (totalOperations - 1) + duration) / totalOperations;
      
      this.logger.trace(`Tracked performance: ${operation} took ${duration}ms`);
    } catch (error) {
      this.logger.error('Failed to track performance:', error);
    }
  }

  public async getAnalytics(): Promise<{
    messages: MessageAnalytics;
    connection: ConnectionAnalytics;
    performance: PerformanceMetrics;
  }> {
    try {
      this.updateMetrics();
      
      return {
        messages: { ...this.messageAnalytics },
        connection: { ...this.connectionAnalytics },
        performance: { ...this.metrics }
      };
    } catch (error) {
      this.logger.error('Failed to get analytics:', error);
      throw error;
    }
  }

  public async getHealthCheck(): Promise<HealthCheckResult> {
    try {
      this.updateMetrics();
      
      const checks = {
        connection: this.checkConnectionHealth(),
        memory: this.checkMemoryHealth(),
        storage: await this.checkStorageHealth(),
        performance: this.checkPerformanceHealth()
      };
      
      const allHealthy = Object.values(checks).every(check => check);
      const someHealthy = Object.values(checks).some(check => check);
      
      const status = allHealthy ? 'healthy' : someHealthy ? 'degraded' : 'unhealthy';
      
      return {
        status,
        checks,
        metrics: { ...this.metrics },
        timestamp: new Date()
      };
    } catch (error) {
      this.logger.error('Failed to perform health check:', error);
      return {
        status: 'unhealthy',
        checks: {
          connection: false,
          memory: false,
          storage: false,
          performance: false
        },
        metrics: { ...this.metrics },
        timestamp: new Date()
      };
    }
  }

  public getAlerts(severity?: 'low' | 'medium' | 'high' | 'critical'): MonitoringAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity && !alert.resolved);
    }
    return this.alerts.filter(alert => !alert.resolved);
  }

  public async resolveAlert(alertId: string): Promise<boolean> {
    try {
      const alert = this.alerts.find(a => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        alert.resolvedAt = new Date();
        this.logger.info(`Alert ${alertId} resolved`);
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}:`, error);
      return false;
    }
  }

  public startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger.warn('Monitoring is already active');
      return;
    }
    
    this.isMonitoring = true;
    
    // Update metrics every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      await this.updateMetrics();
      await this.checkThresholds();
    }, 30 * 1000);
    
    this.logger.info('Monitoring started');
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      this.logger.warn('Monitoring is not active');
      return;
    }
    
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.logger.info('Monitoring stopped');
  }

  public async disconnect(): Promise<void> {
    this.stopMonitoring();
    this.logger.info('Monitoring service disconnected');
  }

  // Private methods
  private initializeMetrics(): PerformanceMetrics {
    return {
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
      uptime: 0,
      activeConnections: 0,
      messagesPerSecond: 0,
      responseTime: 0
    };
  }

  private initializeMessageAnalytics(): MessageAnalytics {
    return {
      totalSent: 0,
      totalReceived: 0,
      failedMessages: 0,
      averageResponseTime: 0,
      topContacts: [],
      messageTypeDistribution: {},
      hourlyActivity: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }))
    };
  }

  private initializeConnectionAnalytics(): ConnectionAnalytics {
    return {
      uptime: 0,
      downtime: 0,
      reconnectCount: 0,
      averageReconnectTime: 0,
      connectionQuality: 'good'
    };
  }

  private async updateMetrics(): Promise<void> {
    try {
      this.metrics.memoryUsage = process.memoryUsage();
      this.metrics.cpuUsage = process.cpuUsage();
      this.metrics.uptime = Date.now() - this.startTime;
      
      // Calculate messages per second (last minute)
      const totalMessages = this.messageAnalytics.totalSent + this.messageAnalytics.totalReceived;
      this.metrics.messagesPerSecond = totalMessages / (this.metrics.uptime / 1000);
      
      // Check memory usage
      if (this.config.alerts?.highMemoryUsage) {
        const memoryUsageMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024;
        if (memoryUsageMB > 500) { // 500MB threshold
          this.createAlert('high_memory', 'medium', `High memory usage: ${memoryUsageMB.toFixed(1)}MB`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to update metrics:', error);
    }
  }

  private async checkThresholds(): Promise<void> {
    try {
      // Check error rate
      const errorRate = this.getErrorRate();
      if (errorRate > 0.1 && this.config.alerts?.rateLimitExceeded) {
        this.createAlert('rate_limit', 'high', `High error rate: ${(errorRate * 100).toFixed(1)}%`);
      }
      
      // Check memory usage
      const memoryUsageMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024;
      if (memoryUsageMB > 1000 && this.config.alerts?.highMemoryUsage) { // 1GB threshold
        this.createAlert('high_memory', 'high', `Critical memory usage: ${memoryUsageMB.toFixed(1)}MB`);
      }
    } catch (error) {
      this.logger.error('Failed to check thresholds:', error);
    }
  }

  private checkConnectionHealth(): boolean {
    // Simple health check based on uptime vs downtime
    const totalTime = this.connectionAnalytics.uptime + this.connectionAnalytics.downtime;
    if (totalTime === 0) return true;
    
    const uptimePercentage = this.connectionAnalytics.uptime / totalTime;
    return uptimePercentage > 0.95; // 95% uptime threshold
  }

  private checkMemoryHealth(): boolean {
    const memoryUsageMB = this.metrics.memoryUsage.heapUsed / 1024 / 1024;
    return memoryUsageMB < 500; // 500MB threshold
  }

  private async checkStorageHealth(): Promise<boolean> {
    // This would check storage availability
    // For now, return true
    return true;
  }

  private checkPerformanceHealth(): boolean {
    return this.metrics.messagesPerSecond < 100 && this.metrics.responseTime < 1000;
  }

  private updateConnectionQuality(): void {
    const totalTime = this.connectionAnalytics.uptime + this.connectionAnalytics.downtime;
    if (totalTime === 0) {
      this.connectionAnalytics.connectionQuality = 'excellent';
      return;
    }
    
    const uptimePercentage = this.connectionAnalytics.uptime / totalTime;
    
    if (uptimePercentage > 0.99) {
      this.connectionAnalytics.connectionQuality = 'excellent';
    } else if (uptimePercentage > 0.95) {
      this.connectionAnalytics.connectionQuality = 'good';
    } else if (uptimePercentage > 0.90) {
      this.connectionAnalytics.connectionQuality = 'fair';
    } else {
      this.connectionAnalytics.connectionQuality = 'poor';
    }
  }

  private getErrorRate(): number {
    const totalMessages = this.messageAnalytics.totalSent + this.messageAnalytics.totalReceived;
    if (totalMessages === 0) return 0;
    
    return this.messageAnalytics.failedMessages / totalMessages;
  }

  private getContentType(message: WAMessage): string {
    if (!message.message) return 'unknown';
    
    const content = message.message;
    
    if ('conversation' in content) return 'text';
    if ('imageMessage' in content) return 'image';
    if ('videoMessage' in content) return 'video';
    if ('audioMessage' in content) return 'audio';
    if ('documentMessage' in content) return 'document';
    if ('locationMessage' in content) return 'location';
    if ('contactMessage' in content) return 'contact';
    if ('pollCreationMessage' in content) return 'poll';
    if ('reactionMessage' in content) return 'reaction';
    if ('stickerMessage' in content) return 'sticker';
    
    return 'unknown';
  }

  private createAlert(type: string, severity: 'low' | 'medium' | 'high' | 'critical', message: string): void {
    const alert: MonitoringAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: type as any,
      severity,
      message,
      timestamp: new Date(),
      resolved: false
    };
    
    this.alerts.push(alert);
    this.logger.warn(`Alert created: ${message}`, { alertId: alert.id, severity });
  }

  // Advanced monitoring methods
  public async getMetricsHistory(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<any[]> {
    // This would return historical metrics data
    // For now, return current metrics
    return [this.metrics];
  }

  public async exportAnalytics(format: 'json' | 'csv' = 'json'): Promise<string> {
    const analytics = await this.getAnalytics();
    
    if (format === 'json') {
      return JSON.stringify(analytics, null, 2);
    } else {
      // Convert to CSV (simplified)
      const csvLines = [
        'Metric,Value',
        `Total Sent,${analytics.messages.totalSent}`,
        `Total Received,${analytics.messages.totalReceived}`,
        `Failed Messages,${analytics.messages.failedMessages}`,
        `Average Response Time,${analytics.messages.averageResponseTime}`,
        `Uptime,${analytics.connection.uptime}`,
        `Downtime,${analytics.connection.downtime}`,
        `Reconnect Count,${analytics.connection.reconnectCount}`,
        `Messages Per Second,${analytics.performance.messagesPerSecond}`
      ];
      
      return csvLines.join('\\n');
    }
  }

  public async resetAnalytics(): Promise<void> {
    this.messageAnalytics = this.initializeMessageAnalytics();
    this.connectionAnalytics = this.initializeConnectionAnalytics();
    this.metrics = this.initializeMetrics();
    this.startTime = Date.now();
    
    this.logger.info('Analytics reset');
  }
}

export default MonitoringService;