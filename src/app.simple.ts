/**
 * Ladybug Baileys - Simple Application Entry Point (Render.com Ready)
 */

import { LadybugBaileys, makeLadybugSocket } from './core/LadybugBaileys';
import { RESTAPI } from './api/RESTAPI';
import { getConfig } from './core/config';
import { Logger } from './utils/Logger';

export class SimpleLadybugApp {
  private ladybug: LadybugBaileys;
  private restAPI: RESTAPI | null = null;
  private logger: Logger;
  private config: any;

  constructor(config?: any) {
    this.config = config || {
      ...getConfig(),
      enableGraphQL: false, // Disable GraphQL for simpler deployment
      enableRESTAPI: true,
      restAPI: {
        port: process.env.PORT || 3000,
        enableCors: true,
        enableRateLimit: true,
        enableCompression: true,
        enableSecurity: true,
        rateLimitWindow: 15 * 60 * 1000,
        rateLimitMax: 100,
        apiKey: process.env.API_KEY
      },
      storage: {
        type: 'memory',
        options: {}
      },
      monitoring: {
        enabled: false, // Disable monitoring for simpler deployment
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
      }
    };
    
    this.logger = new Logger('SimpleLadybugApp');
    this.ladybug = makeLadybugSocket(this.config);
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Simple Ladybug Baileys Application...');
      
      // Connect to WhatsApp
      await this.ladybug.connect();
      this.logger.info('✅ Connected to WhatsApp');
      
      // Start REST API
      this.restAPI = new RESTAPI(this.ladybug, this.config.restAPI, this.logger);
      await this.restAPI.start();
      this.logger.info(`✅ REST API started on port ${this.config.restAPI?.port || 3000}`);
      
      this.logger.info('🎉 Simple Ladybug Baileys Application started successfully!');
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      this.logger.error('❌ Failed to start Simple Ladybug Baileys Application:', error);
      await this.stop();
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      this.logger.info('🛑 Stopping Simple Ladybug Baileys Application...');
      
      // Stop API
      if (this.restAPI) {
        await this.restAPI.stop();
        this.logger.info('✅ REST API stopped');
      }
      
      // Disconnect from WhatsApp
      await this.ladybug.disconnect();
      this.logger.info('✅ Disconnected from WhatsApp');
      
      this.logger.info('👋 Simple Ladybug Baileys Application stopped');
    } catch (error) {
      this.logger.error('❌ Error during shutdown:', error);
    }
  }

  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      this.logger.info(`\n📡 Received ${signal}, shutting down gracefully...`);
      await this.stop();
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    process.on('uncaughtException', (error) => {
      this.logger.error('💥 Uncaught Exception:', error);
      shutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });
  }

  public getLadybug(): LadybugBaileys {
    return this.ladybug;
  }

  public getRESTAPI(): RESTAPI | null {
    return this.restAPI;
  }
}

// CLI entry point
if (require.main === module) {
  const app = new SimpleLadybugApp();
  app.start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default SimpleLadybugApp;