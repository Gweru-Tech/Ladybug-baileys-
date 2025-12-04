/**
 * Enhanced Logger Utility
 */

import pino from 'pino';

export interface LoggerConfig {
  level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  prettyPrint: boolean;
  timestamp: boolean;
  colorize: boolean;
}

export class Logger {
  private logger: pino.Logger;
  private context: string;

  constructor(context: string = 'LadybugBaileys', config?: Partial<LoggerConfig>) {
    this.context = context;
    
    const defaultConfig: LoggerConfig = {
      level: process.env.LOG_LEVEL as any || 'info',
      prettyPrint: process.env.NODE_ENV !== 'production',
      timestamp: true,
      colorize: process.env.NODE_ENV !== 'production'
    };

    const finalConfig = { ...defaultConfig, ...config };

    this.logger = pino({
      level: finalConfig.level,
      timestamp: finalConfig.timestamp,
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => ({
          ...object,
          context: this.context,
          timestamp: new Date().toISOString()
        })
      },
      transport: finalConfig.prettyPrint ? {
        target: 'pino-pretty',
        options: {
          colorize: finalConfig.colorize,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      } : undefined
    });
  }

  // Standard logging methods
  public fatal(message: string, ...args: any[]): void {
    this.logger.fatal(message, ...args);
  }

  public error(message: string, ...args: any[]): void {
    this.logger.error(message, ...args);
  }

  public warn(message: string, ...args: any[]): void {
    this.logger.warn(message, ...args);
  }

  public info(message: string, ...args: any[]): void {
    this.logger.info(message, ...args);
  }

  public debug(message: string, ...args: any[]): void {
    this.logger.debug(message, ...args);
  }

  public trace(message: string, ...args: any[]): void {
    this.logger.trace(message, ...args);
  }

  // Structured logging methods
  public logEvent(event: string, data?: any): void {
    this.logger.info({ event, data }, `Event: ${event}`);
  }

  public logError(error: Error, context?: string): void {
    this.logger.error({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    }, `${context ? `${context}: ` : ''}${error.message}`);
  }

  public logPerformance(operation: string, duration: number, details?: any): void {
    this.logger.info({
      operation,
      duration,
      details,
      type: 'performance'
    }, `Performance: ${operation} took ${duration}ms`);
  }

  public logSecurity(event: string, details: any): void {
    this.logger.warn({
      securityEvent: event,
      details,
      timestamp: new Date().toISOString()
    }, `Security Event: ${event}`);
  }

  public logMetric(name: string, value: number, unit?: string): void {
    this.logger.info({
      metric: name,
      value,
      unit,
      type: 'metric'
    }, `Metric: ${name} = ${value}${unit ? ` ${unit}` : ''}`);
  }

  // Get Baileys compatible logger
  public getBaileysLogger(): any {
    return {
      level: this.logger.level,
      child: (bindings: any) => new Logger(`${this.context}:${bindings.module || 'unknown'}`),
      debug: this.debug.bind(this),
      info: this.info.bind(this),
      warn: this.warn.bind(this),
      error: this.error.bind(this),
      fatal: this.fatal.bind(this),
      trace: this.trace.bind(this)
    };
  }

  // Create child logger with additional context
  public child(context: string): Logger {
    return new Logger(`${this.context}:${context}`);
  }

  // Log request/response for API calls
  public logRequest(method: string, url: string, headers?: any, body?: any): void {
    this.logger.info({
      type: 'request',
      method,
      url,
      headers: this.sanitizeHeaders(headers),
      body: body ? this.sanitizeBody(body) : undefined
    }, `API Request: ${method} ${url}`);
  }

  public logResponse(statusCode: number, duration: number, body?: any): void {
    this.logger.info({
      type: 'response',
      statusCode,
      duration,
      body: body ? this.sanitizeBody(body) : undefined
    }, `API Response: ${statusCode} in ${duration}ms`);
  }

  // Log WhatsApp events
  public logWhatsAppEvent(event: string, data?: any): void {
    this.logger.info({
      type: 'whatsapp_event',
      event,
      data: this.sanitizeWhatsAppData(data)
    }, `WhatsApp Event: ${event}`);
  }

  // Log message events
  public logMessageEvent(type: 'sent' | 'received' | 'failed', jid: string, messageId?: string): void {
    this.logger.info({
      type: 'message_event',
      messageType: type,
      jid: this.sanitizeJID(jid),
      messageId,
      timestamp: new Date().toISOString()
    }, `Message ${type}: ${this.sanitizeJID(jid)}`);
  }

  // Log connection events
  public logConnectionEvent(status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting', details?: any): void {
    this.logger.info({
      type: 'connection_event',
      status,
      details,
      timestamp: new Date().toISOString()
    }, `Connection ${status}`);
  }

  // Helper methods for data sanitization
  private sanitizeHeaders(headers?: any): any {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'set-cookie'];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private sanitizeBody(body?: any): any {
    if (!body) return body;
    
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = JSON.parse(JSON.stringify(body));
    
    const sanitizeObject = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
      }
      
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
            result[key] = '[REDACTED]';
          } else if (typeof value === 'object') {
            result[key] = sanitizeObject(value);
          } else {
            result[key] = value;
          }
        }
        return result;
      }
      
      return obj;
    };
    
    return sanitizeObject(sanitized);
  }

  private sanitizeWhatsAppData(data?: any): any {
    if (!data) return data;
    
    // Remove sensitive WhatsApp data
    const sanitized = JSON.parse(JSON.stringify(data));
    
    // Remove actual message content for privacy
    if (sanitized.message) {
      delete sanitized.message;
    }
    
    return sanitized;
  }

  private sanitizeJID(jid: string): string {
    // Show partial JID for privacy
    if (jid.includes('@')) {
      const [number, domain] = jid.split('@');
      const visiblePart = number.slice(-4);
      return `****${visiblePart}@${domain}`;
    }
    return '****';
  }

  // Performance monitoring
  public startTimer(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.logPerformance(label, duration);
    };
  }

  // Health check logging
  public logHealthCheck(status: 'healthy' | 'unhealthy', details: any): void {
    if (status === 'healthy') {
      this.logger.info({
        type: 'health_check',
        status,
        details
      }, `Health Check: ${status}`);
    } else {
      this.logger.error({
        type: 'health_check',
        status,
        details
      }, `Health Check: ${status}`);
    }
  }

  // Export logs
  public async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    // This would integrate with your logging storage system
    // For now, return a placeholder
    return JSON.stringify({
      context: this.context,
      exportedAt: new Date().toISOString(),
      format
    });
  }
}

export default Logger;