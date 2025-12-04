/**
 * Ladybug Baileys - Main Application Entry Point
 */

import { LadybugBaileys, makeLadybugSocket } from './core/LadybugBaileys';
import { RESTAPI } from './api/RESTAPI';
import { GraphQLAPI } from './api/GraphQLAPI';
import { getConfig } from './core/config';
import { Logger } from './utils/Logger';
import express from 'express';

export class LadybugApp {
  private ladybug: LadybugBaileys;
  private restAPI: RESTAPI | null = null;
  private graphqlAPI: GraphQLAPI | null = null;
  private logger: Logger;
  private config: any;

  constructor(config?: any) {
    this.config = config || getConfig();
    this.logger = new Logger('LadybugApp');
    this.ladybug = makeLadybugSocket(this.config);
  }

  public async start(): Promise<void> {
    try {
      this.logger.info('🚀 Starting Ladybug Baileys Application...');
      
      // Connect to WhatsApp
      await this.ladybug.connect();
      this.logger.info('✅ Connected to WhatsApp');
      
      // Start REST API if enabled
      if (this.config.enableRESTAPI !== false) {
        this.restAPI = new RESTAPI(this.ladybug, this.config.restAPI, this.logger);
        await this.restAPI.start();
        this.logger.info(`✅ REST API started on port ${this.config.restAPI?.port || 3000}`);
      }
      
      // Start GraphQL API if enabled
      if (this.config.enableGraphQL === true) {
        this.graphqlAPI = new GraphQLAPI(this.ladybug, this.config.graphql, this.logger);
        await this.graphqlAPI.initialize();
        
        if (this.restAPI) {
          await this.graphqlAPI.applyMiddleware(this.restAPI.getApp());
          this.logger.info(`✅ GraphQL API started at ${this.config.graphql?.path || '/graphql'}`);
        }
      }
      
      this.logger.info('🎉 Ladybug Baileys Application started successfully!');
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
    } catch (error) {
      this.logger.error('❌ Failed to start Ladybug Baileys Application:', error);
      await this.stop();
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    try {
      this.logger.info('🛑 Stopping Ladybug Baileys Application...');
      
      // Stop APIs
      if (this.restAPI) {
        await this.restAPI.stop();
        this.logger.info('✅ REST API stopped');
      }
      
      if (this.graphqlAPI) {
        await this.graphqlAPI.stop();
        this.logger.info('✅ GraphQL API stopped');
      }
      
      // Disconnect from WhatsApp
      await this.ladybug.disconnect();
      this.logger.info('✅ Disconnected from WhatsApp');
      
      this.logger.info('👋 Ladybug Baileys Application stopped');
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

  public getGraphQLAPI(): GraphQLAPI | null {
    return this.graphqlAPI;
  }
}

// CLI entry point
if (require.main === module) {
  const app = new LadybugApp();
  app.start().catch((error) => {
    console.error('Failed to start application:', error);
    process.exit(1);
  });
}

export default LadybugApp;