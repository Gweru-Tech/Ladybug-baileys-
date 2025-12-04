/**
 * GraphQL API - Enhanced GraphQL Interface
 */

import { ApolloServer } from 'apollo-server-express';
import { buildSchema } from 'type-graphql';
import express from 'express';
import { Logger } from '../utils/Logger';
import { LadybugBaileys } from '../core/LadybugBaileys';

export interface GraphQLConfig {
  path: string;
  playground: boolean;
  introspection: boolean;
  enableMetrics: boolean;
}

// GraphQL Type Definitions
@Resolver()
class MessageResolver {
  private ladybug: LadybugBaileys;

  constructor(ladybug: LadybugBaileys) {
    this.ladybug = ladybug;
  }

  @Query(() => String)
  async hello(): Promise<string> {
    return 'Hello from Ladybug Baileys GraphQL API!';
  }

  @Query(() => ConnectionStatus)
  async connectionStatus(): Promise<ConnectionStatus> {
    const state = this.ladybug.getConnectionState();
    return {
      isConnected: state.connection === 'open',
      state: state.connection,
      lastUpdate: new Date().toISOString()
    };
  }

  @Mutation(() => SendMessageResponse)
  async sendMessage(
    @Arg('input') input: SendMessageInput
  ): Promise<SendMessageResponse> {
    try {
      const result = await this.ladybug.sendMessage(input.jid, input.content, input.options);
      
      if (result.success) {
        return {
          success: true,
          messageId: result.data?.messageId,
          status: result.data?.status || 'sent'
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  @Mutation(() => ScheduleMessageResponse)
  async scheduleMessage(
    @Arg('input') input: ScheduleMessageInput
  ): Promise<ScheduleMessageResponse> {
    try {
      const messageId = await this.ladybug.getScheduler().scheduleMessage(
        input.jid,
        input.content,
        new Date(input.scheduleTime),
        input.options
      );
      
      return {
        success: true,
        messageId,
        status: 'scheduled',
        scheduledAt: input.scheduleTime
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  @Query(() => [ScheduledMessage])
  async scheduledMessages(
    @Arg('status', () => String, { nullable: true }) status?: string
  ): Promise<ScheduledMessage[]> {
    const messages = await this.ladybug.getScheduler().getScheduledMessages(status as any);
    return messages.map(msg => ({
      id: msg.id,
      jid: msg.jid,
      content: msg.content,
      scheduledTime: msg.scheduledTime.toISOString(),
      status: msg.status,
      retryCount: msg.retryCount,
      maxRetries: msg.maxRetries
    }));
  }

  @Mutation(() => Boolean)
  async cancelScheduledMessage(@Arg('messageId') messageId: string): Promise<boolean> {
    return await this.ladybug.getScheduler().cancelScheduledMessage(messageId);
  }

  @Query(() => Analytics)
  async analytics(): Promise<Analytics> {
    const analytics = await this.ladybug.getAnalytics();
    
    return {
      messages: {
        totalSent: analytics.messages.totalSent,
        totalReceived: analytics.messages.totalReceived,
        failedMessages: analytics.messages.failedMessages,
        averageResponseTime: analytics.messages.averageResponseTime
      },
      connection: {
        uptime: analytics.connection.uptime,
        downtime: analytics.connection.downtime,
        reconnectCount: analytics.connection.reconnectCount,
        connectionQuality: analytics.connection.connectionQuality
      },
      performance: {
        memoryUsage: {
          heapUsed: analytics.performance.memoryUsage.heapUsed,
          heapTotal: analytics.performance.memoryUsage.heapTotal,
          external: analytics.performance.memoryUsage.external,
          rss: analytics.performance.memoryUsage.rss
        },
        uptime: analytics.performance.uptime,
        messagesPerSecond: analytics.performance.messagesPerSecond,
        responseTime: analytics.performance.responseTime
      }
    };
  }

  @Query(() => HealthStatus)
  async health(): Promise<HealthStatus> {
    const health = await this.ladybug.getMonitoring().getHealthCheck();
    
    return {
      status: health.status,
      checks: health.checks,
      timestamp: health.timestamp.toISOString()
    };
  }

  @Query(() => [Alert])
  async alerts(@Arg('severity', () => String, { nullable: true }) severity?: string): Promise<Alert[]> {
    const alerts = this.ladybug.getMonitoring().getAlerts(severity as any);
    return alerts.map(alert => ({
      id: alert.id,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp.toISOString(),
      resolved: alert.resolved,
      resolvedAt: alert.resolvedAt?.toISOString()
    }));
  }

  @Mutation(() => Boolean)
  async resolveAlert(@Arg('alertId') alertId: string): Promise<boolean> {
    return await this.ladybug.getMonitoring().resolveAlert(alertId);
  }

  @Query(() => ProfilePicture)
  async profilePicture(
    @Arg('jid') jid: string,
    @Arg('type', () => String, { nullable: true }) type?: string
  ): Promise<ProfilePicture> {
    try {
      const url = await this.ladybug.profilePictureUrl(jid, type as any);
      return { url };
    } catch (error) {
      return { url: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  @Query(() => GroupMetadata)
  async groupMetadata(@Arg('jid') jid: string): Promise<GroupMetadata> {
    try {
      const metadata = await this.ladybug.groupMetadata(jid);
      return {
        id: metadata.id,
        subject: metadata.subject,
        desc: metadata.desc,
        owner: metadata.owner,
        creation: metadata.creation,
        participants: metadata.participants.map(p => ({
          id: p.id,
          admin: p.admin
        }))
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  @Query(() => [WhatsAppCheck])
  async onWhatsApp(@Arg('jid') jid: string): Promise<WhatsAppCheck[]> {
    try {
      const result = await this.ladybug.onWhatsApp(jid);
      return result.map(r => ({
        jid: r.jid,
        exists: r.exists,
        isWA: r.isWA,
        isBusiness: r.isBusiness
      }));
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Unknown error');
    }
  }
}

// GraphQL Types
@ObjectType()
class ConnectionStatus {
  @Field()
  isConnected: boolean;

  @Field()
  state: string;

  @Field()
  lastUpdate: string;
}

@InputType()
class MessageContent {
  @Field()
  text?: string;

  @Field()
  image?: string;

  @Field()
  video?: string;

  @Field()
  audio?: string;

  @Field()
  document?: string;
}

@InputType()
class SendMessageInput {
  @Field()
  jid: string;

  @Field()
  content: MessageContent;

  @Field({ nullable: true })
  options?: any;
}

@ObjectType()
class SendMessageResponse {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  messageId?: string;

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  error?: string;
}

@InputType()
class ScheduleMessageInput {
  @Field()
  jid: string;

  @Field()
  content: MessageContent;

  @Field()
  scheduleTime: string;

  @Field({ nullable: true })
  options?: any;
}

@ObjectType()
class ScheduleMessageResponse {
  @Field()
  success: boolean;

  @Field({ nullable: true })
  messageId?: string;

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  scheduledAt?: string;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType()
class ScheduledMessage {
  @Field()
  id: string;

  @Field()
  jid: string;

  @Field()
  content: MessageContent;

  @Field()
  scheduledTime: string;

  @Field()
  status: string;

  @Field({ nullable: true })
  retryCount?: number;

  @Field({ nullable: true })
  maxRetries?: number;
}

@ObjectType()
class MessageAnalytics {
  @Field()
  totalSent: number;

  @Field()
  totalReceived: number;

  @Field()
  failedMessages: number;

  @Field()
  averageResponseTime: number;
}

@ObjectType()
class ConnectionAnalytics {
  @Field()
  uptime: number;

  @Field()
  downtime: number;

  @Field()
  reconnectCount: number;

  @Field()
  connectionQuality: string;
}

@ObjectType()
class MemoryUsage {
  @Field()
  heapUsed: number;

  @Field()
  heapTotal: number;

  @Field()
  external: number;

  @Field()
  rss: number;
}

@ObjectType()
class PerformanceMetrics {
  @Field()
  memoryUsage: MemoryUsage;

  @Field()
  uptime: number;

  @Field()
  messagesPerSecond: number;

  @Field()
  responseTime: number;
}

@ObjectType()
class Analytics {
  @Field()
  messages: MessageAnalytics;

  @Field()
  connection: ConnectionAnalytics;

  @Field()
  performance: PerformanceMetrics;
}

@ObjectType()
class HealthChecks {
  @Field()
  connection: boolean;

  @Field()
  memory: boolean;

  @Field()
  storage: boolean;

  @Field()
  performance: boolean;
}

@ObjectType()
class HealthStatus {
  @Field()
  status: string;

  @Field()
  checks: HealthChecks;

  @Field()
  timestamp: string;
}

@ObjectType()
class Alert {
  @Field()
  id: string;

  @Field()
  type: string;

  @Field()
  severity: string;

  @Field()
  message: string;

  @Field()
  timestamp: string;

  @Field()
  resolved: boolean;

  @Field({ nullable: true })
  resolvedAt?: string;
}

@ObjectType()
class ProfilePicture {
  @Field({ nullable: true })
  url: string;

  @Field({ nullable: true })
  error?: string;
}

@ObjectType()
class GroupParticipant {
  @Field()
  id: string;

  @Field({ nullable: true })
  admin?: string;
}

@ObjectType()
class GroupMetadata {
  @Field()
  id: string;

  @Field()
  subject: string;

  @Field({ nullable: true })
  desc?: string;

  @Field({ nullable: true })
  owner?: string;

  @Field({ nullable: true })
  creation?: number;

  @Field(() => [GroupParticipant])
  participants: GroupParticipant[];
}

@ObjectType()
class WhatsAppCheck {
  @Field()
  jid: string;

  @Field()
  exists: boolean;

  @Field({ nullable: true })
  isWA?: boolean;

  @Field({ nullable: true })
  isBusiness?: boolean;
}

export class GraphQLAPI {
  private server: ApolloServer | null = null;
  private config: GraphQLConfig;
  private logger: Logger;
  private ladybug: LadybugBaileys;

  constructor(ladybug: LadybugBaileys, config?: Partial<GraphQLConfig>, logger?: Logger) {
    this.ladybug = ladybug;
    this.logger = logger || new Logger('GraphQLAPI');
    
    this.config = {
      path: '/graphql',
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      enableMetrics: true,
      ...config
    };
  }

  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing GraphQL API...');
      
      // Build schema
      const schema = await buildSchema({
        resolvers: [MessageResolver],
        validate: false
      });
      
      // Create Apollo Server
      this.server = new ApolloServer({
        schema,
        introspection: this.config.introspection,
        playground: this.config.playground,
        context: () => ({
          ladybug: this.ladybug,
          logger: this.logger
        }),
        plugins: this.config.enableMetrics ? [
          // Add metrics plugins here
        ] : undefined
      });
      
      this.logger.info('GraphQL API initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize GraphQL API:', error);
      throw error;
    }
  }

  public async applyMiddleware(app: express.Express): Promise<void> {
    if (!this.server) {
      throw new Error('GraphQL server not initialized. Call initialize() first.');
    }
    
    try {
      await this.server.start();
      
      this.server.applyMiddleware({
        app,
        path: this.config.path,
        cors: true
      });
      
      this.logger.info(`GraphQL middleware applied to path: ${this.config.path}`);
    } catch (error) {
      this.logger.error('Failed to apply GraphQL middleware:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      if (this.server) {
        await this.server.stop();
        this.server = null;
        this.logger.info('GraphQL API stopped');
      }
    } catch (error) {
      this.logger.error('Failed to stop GraphQL API:', error);
      throw error;
    }
  }

  public getServer(): ApolloServer | null {
    return this.server;
  }

  public getConfig(): GraphQLConfig {
    return { ...this.config };
  }
}

export default GraphQLAPI;