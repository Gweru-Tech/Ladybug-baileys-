/**
 * Ladybug Baileys - Core Implementation
 */

import makeWASocket, { 
  WASocket, 
  ConnectionState, 
  DisconnectReason, 
  useMultiFileAuthState,
  makeInMemoryStore,
  WAMessage,
  WAMessageContent
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { EventEmitter } from 'events';

import { 
  LadybugConfig, 
  LadybugEventMap, 
  EventHandler, 
  APIResponse,
  MessageSendEvent,
  MessageReceiveEvent,
  LadybugError,
  ConnectionError
} from '../types';
import { defaultConfig } from './config';
import { Logger } from '../utils/Logger';
import { EventBus } from '../events/EventBus';
import { StorageManager } from '../storage/StorageManager';
import { AuthenticationManager } from '../auth/AuthenticationManager';
import { MessageScheduler } from '../messaging/MessageScheduler';
import { MonitoringService } from '../monitoring/MonitoringService';
import { RateLimiter } from '../utils/RateLimiter';
import { Validator } from '../utils/Validator';

export class LadybugBaileys extends EventEmitter {
  private config: LadybugConfig;
  private socket?: WASocket;
  private eventBus: EventBus;
  private storage: StorageManager;
  private auth: AuthenticationManager;
  private scheduler: MessageScheduler;
  private monitoring: MonitoringService;
  private rateLimiter: RateLimiter;
  private validator: Validator;
  private logger: Logger;
  private isConnected: boolean = false;

  constructor(config: LadybugConfig = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.logger = new Logger('LadybugBaileys');
    this.eventBus = new EventBus();
    this.storage = new StorageManager(this.config.storage!);
    this.auth = new AuthenticationManager(this.storage, this.logger);
    this.scheduler = new MessageScheduler(this.storage, this.logger);
    this.monitoring = new MonitoringService(this.config.monitoring!, this.logger);
    this.rateLimiter = new RateLimiter(this.config.rateLimiting!);
    this.validator = new Validator();
    
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing Ladybug Baileys...');
      
      // Initialize storage
      await this.storage.initialize();
      
      // Initialize monitoring
      await this.monitoring.initialize();
      
      // Initialize scheduler
      await this.scheduler.initialize(this);
      
      this.logger.info('Ladybug Baileys initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Ladybug Baileys:', error);
      throw new LadybugError('Initialization failed', 'INIT_ERROR', error);
    }
  }

  public async connect(): Promise<void> {
    try {
      this.logger.info('Connecting to WhatsApp...');
      
      // Get authentication state
      const authState = await this.auth.getAuthState();
      
      // Create socket with enhanced configuration
      this.socket = makeWASocket({
        auth: authState,
        printQRInTerminal: this.config.printQRInTerminal,
        syncFullHistory: this.config.syncFullHistory,
        browser: this.config.browser,
        logger: this.logger.getBaileysLogger(),
        
        // Enhanced features
        getMessage: this.config.enableCaching ? this.getMessageFromStore.bind(this) : undefined,
        cachedGroupMetadata: this.getCachedGroupMetadata.bind(this)
      });

      // Set up event handlers
      this.setupEventHandlers();
      
      this.logger.info('Socket connection established');
    } catch (error) {
      this.logger.error('Failed to connect to WhatsApp:', error);
      throw new ConnectionError('Connection failed', error);
    }
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.ev.on('connection.update', async (update: ConnectionState) => {
      const { connection, lastDisconnect } = update;
      
      this.isConnected = connection === 'open';
      
      // Emit to internal event bus
      this.eventBus.emit('connection.update', update);
      
      // Emit to external listeners
      this.emit('connection.update', update);
      
      // Handle connection close
      if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        
        this.logger.info(`Connection closed due to ${lastDisconnect?.error}, reconnecting: ${shouldReconnect}`);
        
        if (shouldReconnect) {
          await this.connect();
        }
      } else if (connection === 'open') {
        this.logger.info('Connection opened successfully');
        
        // Save credentials
        this.socket.ev.on('creds.update', this.auth.saveCreds.bind(this.auth));
        
        // Start scheduled messages
        if (this.config.enableScheduling) {
          await this.scheduler.start();
        }
      }
    });

    // Message events
    this.socket.ev.on('messages.upsert', async (event) => {
      for (const message of event.messages) {
        // Process rate limiting
        if (this.config.enableRateLimiting) {
          await this.rateLimiter.checkLimit('receive', message.key.remoteJid!);
        }
        
        // Create receive event
        const receiveEvent: MessageReceiveEvent = {
          message,
          processed: false,
          timestamp: new Date()
        };
        
        // Emit to internal event bus
        this.eventBus.emit('message.receive', receiveEvent);
        
        // Emit to external listeners
        this.emit('message.receive', receiveEvent);
        
        // Update analytics
        if (this.config.enableAnalytics) {
          await this.monitoring.trackMessage('received', message);
        }
      }
    });

    this.socket.ev.on('messages.update', async (events) => {
      for (const event of events) {
        this.eventBus.emit('messages.update', event);
        this.emit('messages.update', event);
      }
    });

    // Additional events
    this.socket.ev.on('chats.upsert', (chats) => {
      this.eventBus.emit('chats.upsert', chats);
      this.emit('chats.upsert', chats);
    });

    this.socket.ev.on('chats.update', (chats) => {
      this.eventBus.emit('chats.update', chats);
      this.emit('chats.update', chats);
    });

    this.socket.ev.on('contacts.upsert', (contacts) => {
      this.eventBus.emit('contacts.upsert', contacts);
      this.emit('contacts.upsert', contacts);
    });

    this.socket.ev.on('presence.update', (presence) => {
      this.eventBus.emit('presence.update', presence);
      this.emit('presence.update', presence);
    });
  }

  public async sendMessage(
    jid: string, 
    content: WAMessageContent, 
    options: any = {}
  ): Promise<APIResponse> {
    try {
      if (!this.socket || !this.isConnected) {
        throw new ConnectionError('Not connected to WhatsApp');
      }

      // Validate input
      this.validator.validateSendMessage({ jid, content });
      
      // Check rate limiting
      if (this.config.enableRateLimiting) {
        await this.rateLimiter.checkLimit('send', jid);
      }

      // Create send event
      const sendEvent: MessageSendEvent = {
        id: this.generateMessageId(),
        jid,
        content,
        status: 'sending',
        timestamp: new Date()
      };

      // Schedule message if requested
      if (options.schedule) {
        return await this.scheduler.scheduleMessage(jid, content, options);
      }

      // Send message immediately
      const result = await this.socket.sendMessage(jid, content, options);
      
      sendEvent.status = 'sent';
      
      // Emit events
      this.eventBus.emit('message.send', sendEvent);
      this.emit('message.send', sendEvent);
      
      // Update analytics
      if (this.config.enableAnalytics) {
        await this.monitoring.trackMessage('sent', result);
      }

      return {
        success: true,
        data: {
          messageId: result.key.id,
          status: 'sent'
        },
        timestamp: new Date().toISOString(),
        requestId: sendEvent.id
      };
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        requestId: this.generateMessageId()
      };
    }
  }

  private async getMessageFromStore(key: any): Promise<any> {
    return await this.storage.getMessage(key.id);
  }

  private async getCachedGroupMetadata(jid: string): Promise<any> {
    return await this.storage.getGroupMetadata(jid);
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  public getConnectionState(): ConnectionState {
    return {
      connection: this.isConnected ? 'open' : 'close',
      lastDisconnect: undefined,
      isNewLogin: false,
      qr: undefined,
      receivedPendingNotifications: false
    };
  }

  public getEventBus(): EventBus {
    return this.eventBus;
  }

  public getStorage(): StorageManager {
    return this.storage;
  }

  public getScheduler(): MessageScheduler {
    return this.scheduler;
  }

  public getMonitoring(): MonitoringService {
    return this.monitoring;
  }

  public async getAnalytics() {
    return await this.monitoring.getAnalytics();
  }

  public async disconnect(): Promise<void> {
    try {
      this.logger.info('Disconnecting from WhatsApp...');
      
      if (this.scheduler) {
        await this.scheduler.stop();
      }
      
      if (this.socket) {
        this.socket.ws.close();
        this.socket = undefined;
      }
      
      if (this.storage) {
        await this.storage.disconnect();
      }
      
      if (this.monitoring) {
        await this.monitoring.disconnect();
      }
      
      this.isConnected = false;
      this.logger.info('Disconnected successfully');
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }

  // Forward socket methods
  public async profilePictureUrl(jid: string, type?: 'image' | 'preview') {
    if (!this.socket) throw new ConnectionError('Not connected');
    return await this.socket.profilePictureUrl(jid, type);
  }

  public async groupMetadata(jid: string) {
    if (!this.socket) throw new ConnectionError('Not connected');
    return await this.socket.groupMetadata(jid);
  }

  public async onWhatsApp(jid: string) {
    if (!this.socket) throw new ConnectionError('Not connected');
    return await this.socket.onWhatsApp(jid);
  }

  // Additional enhanced methods will be added here
}

// Factory function
export function makeLadybugSocket(config?: LadybugConfig): LadybugBaileys {
  return new LadybugBaileys(config);
}