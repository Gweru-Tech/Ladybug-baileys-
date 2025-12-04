/**
 * Message Scheduler - Advanced Message Scheduling System
 */

import * as cron from 'node-cron';
import { Logger } from '../utils/Logger';
import { StorageManager } from '../storage/StorageManager';
import { LadybugBaileys } from '../core/LadybugBaileys';
import { ScheduledMessage, WAMessageContent } from '../types';

export interface ScheduleOptions {
  priority?: 'low' | 'normal' | 'high';
  retries?: number;
  retryDelay?: number;
  timezone?: string;
  metadata?: Record<string, any>;
}

export interface RecurringSchedule {
  id: string;
  pattern: string; // Cron pattern
  jid: string;
  content: WAMessageContent;
  options: ScheduleOptions;
  nextRun: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface ScheduleStats {
  totalScheduled: number;
  pendingToday: number;
  failedToday: number;
  sentToday: number;
  recurringSchedules: number;
}

export class MessageScheduler {
  private storage: StorageManager;
  private logger: Logger;
  private ladybug: LadybugBaileys | null = null;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();
  private recurringTasks: Map<string, cron.ScheduledTask> = new Map();
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor(storage: StorageManager, logger?: Logger) {
    this.storage = storage;
    this.logger = logger || new Logger('MessageScheduler');
  }

  public async initialize(ladybug: LadybugBaileys): Promise<void> {
    try {
      this.ladybug = ladybug;
      this.logger.info('Initializing message scheduler...');
      
      // Load existing scheduled messages
      await this.loadScheduledMessages();
      
      // Load recurring schedules
      await this.loadRecurringSchedules();
      
      // Start processing
      this.start();
      
      this.logger.info('Message scheduler initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize message scheduler:', error);
      throw error;
    }
  }

  public async scheduleMessage(
    jid: string,
    content: WAMessageContent,
    scheduleTime: Date,
    options: ScheduleOptions = {}
  ): Promise<string> {
    try {
      const messageId = this.generateMessageId();
      const now = new Date();
      
      // Validate schedule time
      if (scheduleTime <= now) {
        throw new Error('Schedule time must be in the future');
      }
      
      const scheduledMessage: ScheduledMessage = {
        id: messageId,
        jid,
        content,
        scheduledTime,
        status: 'pending',
        retryCount: 0,
        maxRetries: options.retries || 3
      };
      
      // Save to storage
      await this.storage.setScheduledMessage(messageId, scheduledMessage);
      
      // Schedule the message
      this.scheduleSingleMessage(messageId, scheduledMessage);
      
      this.logger.info(`Message scheduled for ${scheduleTime.toISOString()} with ID: ${messageId}`);
      
      return messageId;
    } catch (error) {
      this.logger.error('Failed to schedule message:', error);
      throw error;
    }
  }

  public async scheduleRecurringMessage(
    jid: string,
    content: WAMessageContent,
    pattern: string, // Cron pattern
    options: ScheduleOptions = {}
  ): Promise<string> {
    try {
      const scheduleId = this.generateScheduleId();
      
      // Validate cron pattern
      if (!cron.validate(pattern)) {
        throw new Error('Invalid cron pattern');
      }
      
      const nextRun = this.getNextRunTime(pattern);
      
      const recurringSchedule: RecurringSchedule = {
        id: scheduleId,
        pattern,
        jid,
        content,
        options,
        nextRun,
        isActive: true,
        createdAt: new Date()
      };
      
      // Save to storage
      await this.storage.set(`recurring:${scheduleId}`, recurringSchedule);
      
      // Schedule the recurring task
      this.scheduleRecurringTask(scheduleId, recurringSchedule);
      
      this.logger.info(`Recurring message scheduled with pattern ${pattern} and ID: ${scheduleId}`);
      
      return scheduleId;
    } catch (error) {
      this.logger.error('Failed to schedule recurring message:', error);
      throw error;
    }
  }

  public async getScheduledMessage(messageId: string): Promise<ScheduledMessage | null> {
    try {
      return await this.storage.getScheduledMessages().then(messages => 
        messages.find(msg => msg.id === messageId) || null
      );
    } catch (error) {
      this.logger.error(`Failed to get scheduled message ${messageId}:`, error);
      return null;
    }
  }

  public async cancelScheduledMessage(messageId: string): Promise<boolean> {
    try {
      const message = await this.getScheduledMessage(messageId);
      
      if (!message) {
        return false;
      }
      
      // Cancel the scheduled task
      const task = this.scheduledTasks.get(messageId);
      if (task) {
        task.stop();
        this.scheduledTasks.delete(messageId);
      }
      
      // Update status
      message.status = 'cancelled';
      await this.storage.setScheduledMessage(messageId, message);
      
      this.logger.info(`Scheduled message ${messageId} cancelled`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel scheduled message ${messageId}:`, error);
      return false;
    }
  }

  public async updateScheduledMessage(
    messageId: string,
    updates: Partial<ScheduledMessage>
  ): Promise<boolean> {
    try {
      const message = await this.getScheduledMessage(messageId);
      
      if (!message) {
        return false;
      }
      
      // Cancel existing task if time is being updated
      if (updates.scheduledTime && updates.scheduledTime !== message.scheduledTime) {
        const task = this.scheduledTasks.get(messageId);
        if (task) {
          task.stop();
          this.scheduledTasks.delete(messageId);
        }
      }
      
      // Update message
      const updatedMessage = { ...message, ...updates };
      await this.storage.setScheduledMessage(messageId, updatedMessage);
      
      // Reschedule if time was updated
      if (updates.scheduledTime && updates.scheduledTime !== message.scheduledTime) {
        this.scheduleSingleMessage(messageId, updatedMessage);
      }
      
      this.logger.info(`Scheduled message ${messageId} updated`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to update scheduled message ${messageId}:`, error);
      return false;
    }
  }

  public async getScheduledMessages(
    status?: 'pending' | 'sent' | 'failed' | 'cancelled'
  ): Promise<ScheduledMessage[]> {
    try {
      const messages = await this.storage.getScheduledMessages();
      
      if (status) {
        return messages.filter(msg => msg.status === status);
      }
      
      return messages;
    } catch (error) {
      this.logger.error('Failed to get scheduled messages:', error);
      return [];
    }
  }

  public async getRecurringSchedules(): Promise<RecurringSchedule[]> {
    try {
      const scheduleKeys = await this.storage.keys('recurring:*');
      const schedules: RecurringSchedule[] = [];
      
      for (const key of scheduleKeys) {
        const schedule = await this.storage.get(key);
        if (schedule) {
          schedules.push(schedule);
        }
      }
      
      return schedules;
    } catch (error) {
      this.logger.error('Failed to get recurring schedules:', error);
      return [];
    }
  }

  public async cancelRecurringSchedule(scheduleId: string): Promise<boolean> {
    try {
      const schedule = await this.storage.get(`recurring:${scheduleId}`);
      
      if (!schedule) {
        return false;
      }
      
      // Cancel the recurring task
      const task = this.recurringTasks.get(scheduleId);
      if (task) {
        task.stop();
        this.recurringTasks.delete(scheduleId);
      }
      
      // Update status
      schedule.isActive = false;
      await this.storage.set(`recurring:${scheduleId}`, schedule);
      
      this.logger.info(`Recurring schedule ${scheduleId} cancelled`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to cancel recurring schedule ${scheduleId}:`, error);
      return false;
    }
  }

  public async getStats(): Promise<ScheduleStats> {
    try {
      const allMessages = await this.getScheduledMessages();
      const recurringSchedules = await this.getRecurringSchedules();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayMessages = allMessages.filter(msg => 
        msg.scheduledTime >= today && msg.scheduledTime < tomorrow
      );
      
      return {
        totalScheduled: allMessages.length,
        pendingToday: todayMessages.filter(msg => msg.status === 'pending').length,
        failedToday: todayMessages.filter(msg => msg.status === 'failed').length,
        sentToday: todayMessages.filter(msg => msg.status === 'sent').length,
        recurringSchedules: recurringSchedules.filter(schedule => schedule.isActive).length
      };
    } catch (error) {
      this.logger.error('Failed to get scheduler stats:', error);
      return {
        totalScheduled: 0,
        pendingToday: 0,
        failedToday: 0,
        sentToday: 0,
        recurringSchedules: 0
      };
    }
  }

  public start(): void {
    if (this.isRunning) {
      this.logger.warn('Scheduler is already running');
      return;
    }
    
    this.isRunning = true;
    
    // Start processing interval (check every minute)
    this.processingInterval = setInterval(async () => {
      await this.processPendingMessages();
    }, 60 * 1000);
    
    this.logger.info('Message scheduler started');
  }

  public stop(): void {
    if (!this.isRunning) {
      this.logger.warn('Scheduler is not running');
      return;
    }
    
    this.isRunning = false;
    
    // Clear processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    // Stop all scheduled tasks
    for (const [id, task] of this.scheduledTasks) {
      task.stop();
    }
    this.scheduledTasks.clear();
    
    // Stop all recurring tasks
    for (const [id, task] of this.recurringTasks) {
      task.stop();
    }
    this.recurringTasks.clear();
    
    this.logger.info('Message scheduler stopped');
  }

  // Private methods
  private async loadScheduledMessages(): Promise<void> {
    try {
      const messages = await this.getScheduledMessages('pending');
      
      for (const message of messages) {
        if (message.scheduledTime > new Date()) {
          this.scheduleSingleMessage(message.id, message);
        }
      }
      
      this.logger.info(`Loaded ${messages.length} pending scheduled messages`);
    } catch (error) {
      this.logger.error('Failed to load scheduled messages:', error);
    }
  }

  private async loadRecurringSchedules(): Promise<void> {
    try {
      const schedules = await this.getRecurringSchedules();
      
      for (const schedule of schedules) {
        if (schedule.isActive) {
          this.scheduleRecurringTask(schedule.id, schedule);
        }
      }
      
      this.logger.info(`Loaded ${schedules.length} recurring schedules`);
    } catch (error) {
      this.logger.error('Failed to load recurring schedules:', error);
    }
  }

  private scheduleSingleMessage(messageId: string, message: ScheduledMessage): void {
    const now = new Date();
    const delay = message.scheduledTime.getTime() - now.getTime();
    
    if (delay <= 0) {
      // Schedule for immediate processing
      setTimeout(() => this.processScheduledMessage(messageId), 0);
    } else {
      // Schedule for future execution
      const timeoutId = setTimeout(() => this.processScheduledMessage(messageId), delay);
      
      // Store timeout reference (in a Map for easier cleanup)
      this.scheduledTasks.set(messageId, {
        stop: () => clearTimeout(timeoutId)
      } as any);
    }
  }

  private scheduleRecurringTask(scheduleId: string, schedule: RecurringSchedule): void {
    try {
      const task = cron.schedule(schedule.pattern, async () => {
        await this.executeRecurringMessage(scheduleId, schedule);
      }, {
        scheduled: true,
        timezone: schedule.options.timezone || 'UTC'
      });
      
      this.recurringTasks.set(scheduleId, task);
    } catch (error) {
      this.logger.error(`Failed to schedule recurring task ${scheduleId}:`, error);
    }
  }

  private async processScheduledMessage(messageId: string): Promise<void> {
    try {
      const message = await this.getScheduledMessage(messageId);
      
      if (!message || message.status !== 'pending') {
        return;
      }
      
      const now = new Date();
      if (message.scheduledTime > now) {
        // Reschedule if time has changed
        this.scheduleSingleMessage(messageId, message);
        return;
      }
      
      // Send the message
      await this.sendScheduledMessage(messageId, message);
    } catch (error) {
      this.logger.error(`Failed to process scheduled message ${messageId}:`, error);
    }
  }

  private async sendScheduledMessage(messageId: string, message: ScheduledMessage): Promise<void> {
    try {
      if (!this.ladybug) {
        throw new Error('Ladybug instance not available');
      }
      
      const result = await this.ladybug.sendMessage(message.jid, message.content);
      
      if (result.success) {
        // Mark as sent
        message.status = 'sent';
        this.logger.info(`Scheduled message ${messageId} sent successfully`);
      } else {
        // Mark as failed and retry if possible
        message.status = 'failed';
        message.retryCount = (message.retryCount || 0) + 1;
        
        if (message.retryCount < (message.maxRetries || 3)) {
          // Schedule retry
          const retryDelay = (message.retryCount || 1) * 5 * 60 * 1000; // 5, 10, 15 minutes
          message.scheduledTime = new Date(Date.now() + retryDelay);
          message.status = 'pending';
          
          this.scheduleSingleMessage(messageId, message);
          this.logger.info(`Scheduled message ${messageId} failed, retry ${message.retryCount} scheduled`);
        } else {
          this.logger.error(`Scheduled message ${messageId} failed after ${message.retryCount} retries`);
        }
      }
      
      await this.storage.setScheduledMessage(messageId, message);
      
      // Clean up task
      this.scheduledTasks.delete(messageId);
    } catch (error) {
      this.logger.error(`Failed to send scheduled message ${messageId}:`, error);
      
      // Mark as failed
      message.status = 'failed';
      message.retryCount = (message.retryCount || 0) + 1;
      await this.storage.setScheduledMessage(messageId, message);
    }
  }

  private async executeRecurringMessage(scheduleId: string, schedule: RecurringSchedule): Promise<void> {
    try {
      if (!this.ladybug || !schedule.isActive) {
        return;
      }
      
      const result = await this.ladybug.sendMessage(schedule.jid, schedule.content);
      
      if (result.success) {
        this.logger.info(`Recurring message ${scheduleId} sent successfully`);
      } else {
        this.logger.error(`Recurring message ${scheduleId} failed:`, result.error);
      }
      
      // Update next run time
      schedule.nextRun = this.getNextRunTime(schedule.pattern);
      await this.storage.set(`recurring:${scheduleId}`, schedule);
    } catch (error) {
      this.logger.error(`Failed to execute recurring message ${scheduleId}:`, error);
    }
  }

  private async processPendingMessages(): Promise<void> {
    try {
      const messages = await this.getScheduledMessages('pending');
      const now = new Date();
      
      for (const message of messages) {
        if (message.scheduledTime <= now) {
          await this.processScheduledMessage(message.id);
        }
      }
    } catch (error) {
      this.logger.error('Failed to process pending messages:', error);
    }
  }

  private getNextRunTime(pattern: string): Date {
    try {
      const task = cron.schedule(pattern, () => {}, { scheduled: false });
      // This is a simplified approach - actual implementation would be more complex
      return new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now as placeholder
    } catch (error) {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now as fallback
    }
  }

  private generateMessageId(): string {
    return `sched_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateScheduleId(): string {
    return `recurring_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Advanced scheduling features
  public async scheduleBulkMessages(
    messages: Array<{
      jid: string;
      content: WAMessageContent;
      scheduleTime: Date;
    }>,
    options: ScheduleOptions = {}
  ): Promise<string[]> {
    const messageIds: string[] = [];
    
    for (const messageData of messages) {
      try {
        const messageId = await this.scheduleMessage(
          messageData.jid,
          messageData.content,
          messageData.scheduleTime,
          options
        );
        messageIds.push(messageId);
      } catch (error) {
        this.logger.error('Failed to schedule bulk message:', error);
      }
    }
    
    return messageIds;
  }

  public async scheduleMessageWithConditions(
    jid: string,
    content: WAMessageContent,
    condition: () => Promise<boolean>,
    options: ScheduleOptions = {}
  ): Promise<string> {
    const messageId = this.generateMessageId();
    
    // Check condition periodically and schedule message when condition is met
    const checkInterval = setInterval(async () => {
      try {
        const shouldSend = await condition();
        
        if (shouldSend) {
          clearInterval(checkInterval);
          await this.scheduleMessage(jid, content, new Date(), options);
        }
      } catch (error) {
        this.logger.error('Failed to check scheduling condition:', error);
      }
    }, 60 * 1000); // Check every minute
    
    // Store interval reference for cleanup
    this.scheduledTasks.set(messageId, {
      stop: () => clearInterval(checkInterval)
    } as any);
    
    return messageId;
  }
}

export default MessageScheduler;