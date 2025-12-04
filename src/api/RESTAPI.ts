/**
 * REST API - Enhanced REST API Interface
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Logger } from '../utils/Logger';
import { LadybugBaileys } from '../core/LadybugBaileys';
import { APIResponse, SendMessageRequest } from '../types';

export interface APIConfig {
  port: number;
  enableCors: boolean;
  enableRateLimit: boolean;
  enableCompression: boolean;
  enableSecurity: boolean;
  rateLimitWindow: number;
  rateLimitMax: number;
  apiKey?: string;
}

export interface RouteHandler {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  handler: (req: Request, res: Response) => Promise<void>;
  middleware?: Array<(req: Request, res: Response, next: NextFunction) => void>;
}

export class RESTAPI {
  private app: Express;
  private config: APIConfig;
  private logger: Logger;
  private ladybug: LadybugBaileys;
  private server: any;
  private isRunning: boolean = false;

  constructor(ladybug: LadybugBaileys, config?: Partial<APIConfig>, logger?: Logger) {
    this.ladybug = ladybug;
    this.logger = logger || new Logger('RESTAPI');
    
    this.config = {
      port: 3000,
      enableCors: true,
      enableRateLimit: true,
      enableCompression: true,
      enableSecurity: true,
      rateLimitWindow: 15 * 60 * 1000, // 15 minutes
      rateLimitMax: 100,
      ...config
    };
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  public async start(): Promise<void> {
    try {
      this.logger.info(`Starting REST API server on port ${this.config.port}...`);
      
      this.server = this.app.listen(this.config.port, () => {
        this.isRunning = true;
        this.logger.info(`REST API server started on port ${this.config.port}`);
      });
      
      return new Promise((resolve, reject) => {
        this.server.on('listening', resolve);
        this.server.on('error', reject);
      });
    } catch (error) {
      this.logger.error('Failed to start REST API server:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      if (!this.isRunning) {
        this.logger.warn('REST API server is not running');
        return;
      }
      
      this.logger.info('Stopping REST API server...');
      
      return new Promise((resolve, reject) => {
        this.server.close((err: any) => {
          if (err) {
            reject(err);
          } else {
            this.isRunning = false;
            this.logger.info('REST API server stopped');
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error('Failed to stop REST API server:', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // Security middleware
    if (this.config.enableSecurity) {
      this.app.use(helmet());
    }
    
    // CORS middleware
    if (this.config.enableCors) {
      this.app.use(cors({
        origin: (origin, callback) => {
          // Allow specific origins or all in development
          if (!origin || process.env.NODE_ENV === 'development') {
            callback(null, true);
          } else {
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true
      }));
    }
    
    // Compression middleware
    if (this.config.enableCompression) {
      this.app.use(compression());
    }
    
    // Rate limiting middleware
    if (this.config.enableRateLimit) {
      const limiter = rateLimit({
        windowMs: this.config.rateLimitWindow,
        max: this.config.rateLimitMax,
        message: {
          success: false,
          error: 'Too many requests from this IP, please try again later.',
          timestamp: new Date().toISOString(),
          requestId: this.generateRequestId()
        },
        standardHeaders: true,
        legacyHeaders: false
      });
      this.app.use(limiter);
    }
    
    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging middleware
    this.app.use((req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.logger.logRequest(req.method, req.url, req.headers, req.body);
        this.logger.logResponse(res.statusCode, duration);
      });
      
      next();
    });
    
    // API key middleware
    if (this.config.apiKey) {
      this.app.use((req, res, next) => {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey || apiKey !== this.config.apiKey) {
          return res.status(401).json(this.createErrorResponse('Invalid or missing API key', 401));
        }
        
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.ladybug.getMonitoring().getHealthCheck();
        res.json(this.createSuccessResponse(health));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Health check failed', 500));
      }
    });
    
    // Connection status endpoint
    this.app.get('/connection', async (req, res) => {
      try {
        const state = this.ladybug.getConnectionState();
        res.json(this.createSuccessResponse(state));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get connection status', 500));
      }
    });
    
    // Send message endpoint
    this.app.post('/messages/send', async (req, res) => {
      try {
        const { jid, content, options } = req.body as SendMessageRequest;
        
        if (!jid || !content) {
          return res.status(400).json(this.createErrorResponse('Missing required fields: jid, content', 400));
        }
        
        const result = await this.ladybug.sendMessage(jid, content, options);
        res.json(this.createSuccessResponse(result.data, result.requestId));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to send message', 500));
      }
    });
    
    // Schedule message endpoint
    this.app.post('/messages/schedule', async (req, res) => {
      try {
        const { jid, content, scheduleTime, options } = req.body;
        
        if (!jid || !content || !scheduleTime) {
          return res.status(400).json(this.createErrorResponse('Missing required fields: jid, content, scheduleTime', 400));
        }
        
        const messageId = await this.ladybug.getScheduler().scheduleMessage(
          jid, 
          content, 
          new Date(scheduleTime), 
          options
        );
        
        res.json(this.createSuccessResponse({ messageId, status: 'scheduled' }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to schedule message', 500));
      }
    });
    
    // Get scheduled messages endpoint
    this.app.get('/messages/scheduled', async (req, res) => {
      try {
        const { status } = req.query;
        const messages = await this.ladybug.getScheduler().getScheduledMessages(status as any);
        res.json(this.createSuccessResponse(messages));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get scheduled messages', 500));
      }
    });
    
    // Cancel scheduled message endpoint
    this.app.delete('/messages/scheduled/:messageId', async (req, res) => {
      try {
        const { messageId } = req.params;
        const success = await this.ladybug.getScheduler().cancelScheduledMessage(messageId);
        
        if (success) {
          res.json(this.createSuccessResponse({ cancelled: true }));
        } else {
          res.status(404).json(this.createErrorResponse('Scheduled message not found', 404));
        }
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to cancel scheduled message', 500));
      }
    });
    
    // Get analytics endpoint
    this.app.get('/analytics', async (req, res) => {
      try {
        const analytics = await this.ladybug.getAnalytics();
        res.json(this.createSuccessResponse(analytics));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get analytics', 500));
      }
    });
    
    // Get metrics endpoint
    this.app.get('/metrics', async (req, res) => {
      try {
        const analytics = await this.ladybug.getAnalytics();
        res.json(this.createSuccessResponse(analytics.performance));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get metrics', 500));
      }
    });
    
    // Get alerts endpoint
    this.app.get('/alerts', async (req, res) => {
      try {
        const { severity } = req.query;
        const alerts = this.ladybug.getMonitoring().getAlerts(severity as any);
        res.json(this.createSuccessResponse(alerts));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get alerts', 500));
      }
    });
    
    // Resolve alert endpoint
    this.app.post('/alerts/:alertId/resolve', async (req, res) => {
      try {
        const { alertId } = req.params;
        const success = await this.ladybug.getMonitoring().resolveAlert(alertId);
        
        if (success) {
          res.json(this.createSuccessResponse({ resolved: true }));
        } else {
          res.status(404).json(this.createErrorResponse('Alert not found', 404));
        }
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to resolve alert', 500));
      }
    });
    
    // Profile picture endpoint
    this.app.get('/profile-picture/:jid', async (req, res) => {
      try {
        const { jid } = req.params;
        const { type } = req.query;
        
        const url = await this.ladybug.profilePictureUrl(jid, type as any);
        res.json(this.createSuccessResponse({ url }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get profile picture', 500));
      }
    });
    
    // Group metadata endpoint
    this.app.get('/groups/:jid/metadata', async (req, res) => {
      try {
        const { jid } = req.params;
        const metadata = await this.ladybug.groupMetadata(jid);
        res.json(this.createSuccessResponse(metadata));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get group metadata', 500));
      }
    });
    
    // Check if number exists on WhatsApp
    this.app.get('/whatsapp/:jid', async (req, res) => {
      try {
        const { jid } = req.params;
        const result = await this.ladybug.onWhatsApp(jid);
        res.json(this.createSuccessResponse(result));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to check WhatsApp number', 500));
      }
    });
    
    // Get storage stats
    this.app.get('/storage/stats', async (req, res) => {
      try {
        const stats = this.ladybug.getStorage().getStats();
        res.json(this.createSuccessResponse(stats));
      } catch (error) {
        res.status(500).json(this.createErrorResponse('Failed to get storage stats', 500));
      }
    });
    
    // API documentation endpoint
    this.app.get('/docs', (req, res) => {
      res.json(this.createSuccessResponse({
        title: 'Ladybug Baileys REST API',
        version: '1.0.0',
        endpoints: [
          { method: 'GET', path: '/health', description: 'Health check' },
          { method: 'GET', path: '/connection', description: 'Get connection status' },
          { method: 'POST', path: '/messages/send', description: 'Send a message' },
          { method: 'POST', path: '/messages/schedule', description: 'Schedule a message' },
          { method: 'GET', path: '/messages/scheduled', description: 'Get scheduled messages' },
          { method: 'DELETE', path: '/messages/scheduled/:messageId', description: 'Cancel scheduled message' },
          { method: 'GET', path: '/analytics', description: 'Get analytics data' },
          { method: 'GET', path: '/metrics', description: 'Get performance metrics' },
          { method: 'GET', path: '/alerts', description: 'Get alerts' },
          { method: 'POST', path: '/alerts/:alertId/resolve', description: 'Resolve alert' },
          { method: 'GET', path: '/profile-picture/:jid', description: 'Get profile picture' },
          { method: 'GET', path: '/groups/:jid/metadata', description: 'Get group metadata' },
          { method: 'GET', path: '/whatsapp/:jid', description: 'Check if number exists on WhatsApp' },
          { method: 'GET', path: '/storage/stats', description: 'Get storage statistics' }
        ]
      }));
    });
    
    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json(this.createSuccessResponse({
        message: 'Ladybug Baileys REST API',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
      }));
    });
  }

  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json(this.createErrorResponse('Endpoint not found', 404));
    });
    
    // Global error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      this.logger.error('Unhandled API error:', err);
      
      res.status(500).json(this.createErrorResponse('Internal server error', 500));
    });
  }

  private createSuccessResponse(data?: any, requestId?: string): APIResponse {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      requestId: requestId || this.generateRequestId()
    };
  }

  private createErrorResponse(error: string, statusCode: number = 500, requestId?: string): APIResponse {
    return {
      success: false,
      error,
      timestamp: new Date().toISOString(),
      requestId: requestId || this.generateRequestId()
    };
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Advanced API features
  public addRoute(route: RouteHandler): void {
    const middleware = route.middleware || [];
    
    switch (route.method) {
      case 'GET':
        this.app.get(route.path, ...middleware, route.handler);
        break;
      case 'POST':
        this.app.post(route.path, ...middleware, route.handler);
        break;
      case 'PUT':
        this.app.put(route.path, ...middleware, route.handler);
        break;
      case 'DELETE':
        this.app.delete(route.path, ...middleware, route.handler);
        break;
    }
    
    this.logger.info(`Added ${route.method} route: ${route.path}`);
  }

  public getApp(): Express {
    return this.app;
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  public getServerInfo(): {
    isRunning: boolean;
    port: number;
    uptime: number;
    config: APIConfig;
  } {
    return {
      isRunning: this.isRunning,
      port: this.config.port,
      uptime: this.isRunning ? process.uptime() : 0,
      config: { ...this.config }
    };
  }
}

export default RESTAPI;