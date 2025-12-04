/**
 * Enhanced Event Bus System
 */

import { EventEmitter } from 'events';
import { Logger } from '../utils/Logger';
import { LadybugEventMap, EventHandler } from '../types';

export interface EventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  once: boolean;
  priority: number;
  createdAt: Date;
}

export interface EventMetrics {
  totalEvents: number;
  eventsByType: Record<string, number>;
  averageProcessingTime: number;
  failedEvents: number;
  activeSubscriptions: number;
}

export class EventBus extends EventEmitter {
  private logger: Logger;
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private metrics: EventMetrics;
  private middlewares: Array<(event: string, data: any) => Promise<any>> = [];
  private isProcessing: boolean = false;
  private eventQueue: Array<{ event: string; data: any; timestamp: number }> = [];

  constructor(logger?: Logger) {
    super();
    this.logger = logger || new Logger('EventBus');
    this.metrics = {
      totalEvents: 0,
      eventsByType: {},
      averageProcessingTime: 0,
      failedEvents: 0,
      activeSubscriptions: 0
    };
    
    // Set max listeners to prevent memory leak warnings
    this.setMaxListeners(100);
  }

  // Enhanced emit method with metrics and error handling
  public emit<K extends keyof LadybugEventMap>(
    event: K,
    data: LadybugEventMap[K]
  ): boolean {
    try {
      const startTime = Date.now();
      
      // Add to queue for processing
      this.eventQueue.push({
        event: event as string,
        data,
        timestamp: startTime
      });

      // Process queue if not already processing
      if (!this.isProcessing) {
        this.processQueue();
      }

      // Update metrics
      this.updateMetrics(event as string, Date.now() - startTime);

      return super.emit(event as string, data);
    } catch (error) {
      this.logger.error(`Failed to emit event ${String(event)}:`, error);
      this.metrics.failedEvents++;
      return false;
    }
  }

  // Enhanced on method with priority and metadata
  public on<K extends keyof LadybugEventMap>(
    event: K,
    handler: EventHandler<LadybugEventMap[K]>,
    options: {
      priority?: number;
      id?: string;
    } = {}
  ): this {
    const subscriptionId = options.id || this.generateSubscriptionId();
    const priority = options.priority || 0;

    const subscription: EventSubscription = {
      id: subscriptionId,
      event: event as string,
      handler: handler as EventHandler,
      once: false,
      priority,
      createdAt: new Date()
    };

    this.addSubscription(subscription);
    
    // Register with EventEmitter
    super.on(event as string, handler as any);

    this.logger.debug(`Added subscription for event ${String(event)} with id ${subscriptionId}`);
    return this;
  }

  // Enhanced once method with priority
  public once<K extends keyof LadybugEventMap>(
    event: K,
    handler: EventHandler<LadybugEventMap[K]>,
    options: {
      priority?: number;
      id?: string;
    } = {}
  ): this {
    const subscriptionId = options.id || this.generateSubscriptionId();
    const priority = options.priority || 0;

    const subscription: EventSubscription = {
      id: subscriptionId,
      event: event as string,
      handler: handler as EventHandler,
      once: true,
      priority,
      createdAt: new Date()
    };

    this.addSubscription(subscription);
    
    // Register with EventEmitter
    super.once(event as string, handler as any);

    this.logger.debug(`Added once subscription for event ${String(event)} with id ${subscriptionId}`);
    return this;
  }

  // Add middleware for event processing
  public use(middleware: (event: string, data: any) => Promise<any>): void {
    this.middlewares.push(middleware);
    this.logger.debug('Added event middleware');
  }

  // Remove subscription by ID
  public off(subscriptionId: string): boolean {
    for (const [event, subscriptions] of this.subscriptions.entries()) {
      const index = subscriptions.findIndex(sub => sub.id === subscriptionId);
      if (index !== -1) {
        const subscription = subscriptions[index];
        subscriptions.splice(index, 1);
        
        // Remove from EventEmitter
        super.removeListener(event, subscription.handler as any);
        
        this.logger.debug(`Removed subscription ${subscriptionId} for event ${event}`);
        return true;
      }
    }
    return false;
  }

  // Remove all listeners for an event
  public removeAllListeners<K extends keyof LadybugEventMap>(event?: K): this {
    if (event) {
      this.subscriptions.delete(event as string);
    } else {
      this.subscriptions.clear();
    }
    
    super.removeAllListeners(event as any);
    this.logger.debug(`Removed all listeners${event ? ` for event ${String(event)}` : ''}`);
    return this;
  }

  // Get all subscriptions
  public getSubscriptions(): EventSubscription[] {
    const allSubscriptions: EventSubscription[] = [];
    for (const subscriptions of this.subscriptions.values()) {
      allSubscriptions.push(...subscriptions);
    }
    return allSubscriptions;
  }

  // Get subscriptions for a specific event
  public getEventSubscriptions(event: string): EventSubscription[] {
    return this.subscriptions.get(event) || [];
  }

  // Get metrics
  public getMetrics(): EventMetrics {
    return {
      ...this.metrics,
      activeSubscriptions: this.getSubscriptions().length
    };
  }

  // Emit event with retry capability
  public async emitWithRetry<K extends keyof LadybugEventMap>(
    event: K,
    data: LadybugEventMap[K],
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<boolean> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = this.emit(event, data);
        if (result) {
          this.logger.debug(`Event ${String(event)} emitted successfully on attempt ${attempt}`);
          return true;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Failed to emit event ${String(event)} on attempt ${attempt}:`, error);
        
        if (attempt < maxRetries) {
          await this.delay(retryDelay * attempt);
        }
      }
    }

    this.logger.error(`Failed to emit event ${String(event)} after ${maxRetries} attempts:`, lastError);
    return false;
  }

  // Batch emit multiple events
  public emitBatch(events: Array<{ event: string; data: any }>): void {
    const batchId = this.generateBatchId();
    this.logger.debug(`Emitting batch of ${events.length} events (batch: ${batchId})`);

    events.forEach(({ event, data }) => {
      this.emit(event as any, data);
    });
  }

  // Wait for an event to occur
  public waitForEvent<K extends keyof LadybugEventMap>(
    event: K,
    timeout: number = 30000
  ): Promise<LadybugEventMap[K]> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.off(subscriptionId);
        reject(new Error(`Timeout waiting for event ${String(event)}`));
      }, timeout);

      const subscriptionId = this.generateSubscriptionId();
      
      this.once(event, (data) => {
        clearTimeout(timeoutId);
        resolve(data);
      }, { id: subscriptionId });
    });
  }

  // Create event pattern matching
  public onPattern(
    pattern: RegExp,
    handler: EventHandler,
    options: { priority?: number; id?: string } = {}
  ): () => void {
    const subscriptionId = options.id || this.generateSubscriptionId();
    
    // Intercept all events and check pattern
    const patternHandler = (event: string, data: any) => {
      if (pattern.test(event)) {
        handler({ event, data });
      }
    };

    super.on('*', patternHandler);
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      event: pattern.toString(),
      handler: patternHandler,
      once: false,
      priority: options.priority || 0,
      createdAt: new Date()
    };

    this.addSubscription(subscription);

    // Return unsubscribe function
    return () => {
      super.removeListener('*', patternHandler);
      this.off(subscriptionId);
    };
  }

  // Throttle events
  public throttle<K extends keyof LadybugEventMap>(
    event: K,
    delay: number
  ): (data: LadybugEventMap[K]) => void {
    let lastEmit = 0;
    
    return (data: LadybugEventMap[K]) => {
      const now = Date.now();
      if (now - lastEmit >= delay) {
        this.emit(event, data);
        lastEmit = now;
      }
    };
  }

  // Debounce events
  public debounce<K extends keyof LadybugEventMap>(
    event: K,
    delay: number
  ): (data: LadybugEventMap[K]) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    
    return (data: LadybugEventMap[K]) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      timeoutId = setTimeout(() => {
        this.emit(event, data);
        timeoutId = null;
      }, delay);
    };
  }

  // Cache events for replay
  public cacheEvents(cacheSize: number = 100): void {
    const eventCache: Array<{ event: string; data: any; timestamp: number }> = [];
    
    this.use(async (event, data) => {
      eventCache.push({ event, data, timestamp: Date.now() });
      
      if (eventCache.length > cacheSize) {
        eventCache.shift();
      }
    });

    // Store cache for potential replay
    (this as any)._eventCache = eventCache;
  }

  // Replay cached events
  public replayCachedEvents(handler: EventHandler): void {
    const cache = (this as any)._eventCache as Array<{ event: string; data: any; timestamp: number }> | undefined;
    
    if (cache) {
      this.logger.info(`Replaying ${cache.length} cached events`);
      cache.forEach(({ event, data, timestamp }) => {
        handler({ event, data, timestamp });
      });
    }
  }

  // Private methods
  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    while (this.eventQueue.length > 0) {
      const { event, data, timestamp } = this.eventQueue.shift()!;
      
      try {
        // Apply middlewares
        let processedData = data;
        for (const middleware of this.middlewares) {
          processedData = await middleware(event, processedData);
        }

        // Process the event
        super.emit(event, processedData);
      } catch (error) {
        this.logger.error(`Failed to process queued event ${event}:`, error);
        this.metrics.failedEvents++;
      }
    }

    this.isProcessing = false;
  }

  private addSubscription(subscription: EventSubscription): void {
    const event = subscription.event;
    const subscriptions = this.subscriptions.get(event) || [];
    
    // Insert based on priority (higher priority first)
    const insertIndex = subscriptions.findIndex(sub => sub.priority < subscription.priority);
    if (insertIndex === -1) {
      subscriptions.push(subscription);
    } else {
      subscriptions.splice(insertIndex, 0, subscription);
    }
    
    this.subscriptions.set(event, subscriptions);
  }

  private updateMetrics(event: string, processingTime: number): void {
    this.metrics.totalEvents++;
    this.metrics.eventsByType[event] = (this.metrics.eventsByType[event] || 0) + 1;
    
    // Update average processing time
    const totalTime = this.metrics.averageProcessingTime * (this.metrics.totalEvents - 1) + processingTime;
    this.metrics.averageProcessingTime = totalTime / this.metrics.totalEvents;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup old subscriptions
  public cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [event, subscriptions] of this.subscriptions.entries()) {
      const validSubscriptions = subscriptions.filter(sub => {
        const age = now - sub.createdAt.getTime();
        if (age > maxAge && sub.once) {
          cleanedCount++;
          return false;
        }
        return true;
      });

      if (validSubscriptions.length === 0) {
        this.subscriptions.delete(event);
      } else {
        this.subscriptions.set(event, validSubscriptions);
      }
    }

    if (cleanedCount > 0) {
      this.logger.info(`Cleaned up ${cleanedCount} old subscriptions`);
    }
  }

  // Export event data
  public exportData(): {
    subscriptions: EventSubscription[];
    metrics: EventMetrics;
    queueSize: number;
    middlewareCount: number;
  } {
    return {
      subscriptions: this.getSubscriptions(),
      metrics: this.getMetrics(),
      queueSize: this.eventQueue.length,
      middlewareCount: this.middlewares.length
    };
  }
}

export default EventBus;