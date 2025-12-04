/**
 * Ladybug Baileys Core Tests
 */

import { LadybugBaileys, makeLadybugSocket } from '../core/LadybugBaileys';
import { LadybugConfig } from '../types';

describe('LadybugBaileys', () => {
  let ladybug: LadybugBaileys;
  let config: LadybugConfig;

  beforeEach(() => {
    config = {
      printQRInTerminal: false,
      enableScheduling: false,
      enableAnalytics: false,
      enableWebhooks: false,
      enableCaching: false,
      enableRateLimiting: false,
      storage: {
        type: 'memory',
        options: {}
      },
      monitoring: {
        enabled: false,
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
    
    ladybug = makeLadybugSocket(config);
  });

  describe('Initialization', () => {
    it('should create Ladybug Baileys instance', () => {
      expect(ladybug).toBeInstanceOf(LadybugBaileys);
    });

    it('should have default configuration merged', () => {
      expect(ladybug.getEventBus()).toBeDefined();
      expect(ladybug.getStorage()).toBeDefined();
      expect(ladybug.getScheduler()).toBeDefined();
      expect(ladybug.getMonitoring()).toBeDefined();
    });
  });

  describe('Connection State', () => {
    it('should return initial connection state', () => {
      const state = ladybug.getConnectionState();
      
      expect(state).toHaveProperty('connection');
      expect(state).toHaveProperty('lastDisconnect');
      expect(state).toHaveProperty('isNewLogin');
      expect(['open', 'close', 'connecting', 'connecting'].includes(state.connection!)).toBe(true);
    });
  });

  describe('Event System', () => {
    it('should emit and receive events', async () => {
      const mockHandler = jest.fn();
      
      ladybug.getEventBus().on('connection.update', mockHandler);
      
      const testEvent = {
        connection: 'open',
        lastDisconnect: undefined,
        isNewLogin: false
      };
      
      ladybug.getEventBus().emit('connection.update', testEvent);
      
      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockHandler).toHaveBeenCalledWith(testEvent);
    });

    it('should handle message events', async () => {
      const mockHandler = jest.fn();
      
      ladybug.getEventBus().on('message.receive', mockHandler);
      
      const testMessage = {
        message: {
          conversation: 'Hello World'
        },
        key: {
          remoteJid: '1234567890@s.whatsapp.net',
          id: 'test-message-id',
          fromMe: false
        }
      };
      
      const testEvent = {
        message: testMessage,
        processed: false,
        timestamp: new Date()
      };
      
      ladybug.getEventBus().emit('message.receive', testEvent);
      
      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockHandler).toHaveBeenCalledWith(testEvent);
    });
  });

  describe('Storage Operations', () => {
    it('should perform basic storage operations', async () => {
      const storage = ladybug.getStorage();
      
      // Test set and get
      await storage.set('test-key', { data: 'test-value' });
      const retrieved = await storage.get('test-key');
      
      expect(retrieved).toEqual({ data: 'test-value' });
      
      // Test exists
      const exists = await storage.exists('test-key');
      expect(exists).toBe(true);
      
      // Test delete
      await storage.delete('test-key');
      const deletedExists = await storage.exists('test-key');
      expect(deletedExists).toBe(false);
    });

    it('should handle message storage', async () => {
      const storage = ladybug.getStorage();
      
      const testMessage = {
        key: { id: 'test-msg-id' },
        message: { conversation: 'Test message' }
      };
      
      await storage.setMessage('test-msg-id', testMessage);
      const retrieved = await storage.getMessage('test-msg-id');
      
      expect(retrieved).toEqual(testMessage);
    });
  });

  describe('Configuration', () => {
    it('should use custom configuration', () => {
      const customConfig = {
        ...config,
        enableScheduling: true,
        enableAnalytics: true
      };
      
      const customLadybug = makeLadybugSocket(customConfig);
      
      expect(customLadybug).toBeInstanceOf(LadybugBaileys);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid operations gracefully', async () => {
      // Test without connection
      await expect(
        ladybug.sendMessage('invalid@s.whatsapp.net', { text: 'test' })
      ).rejects.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create instance using factory function', () => {
      const instance = makeLadybugSocket();
      
      expect(instance).toBeInstanceOf(LadybugBaileys);
      expect(instance.getEventBus()).toBeDefined();
    });
  });

  describe('Component Integration', () => {
    it('should have all required components', () => {
      expect(ladybug.getEventBus()).toBeDefined();
      expect(ladybug.getStorage()).toBeDefined();
      expect(ladybug.getScheduler()).toBeDefined();
      expect(ladybug.getMonitoring()).toBeDefined();
    });
  });
});

// Integration tests (would require actual WhatsApp connection)
describe('LadybugBaileys Integration', () => {
  // These tests would be skipped in CI and require manual testing
  it.skip('should connect to WhatsApp with QR code', async () => {
    // Integration test would go here
  });

  it.skip('should send and receive messages', async () => {
    // Integration test would go here
  });
});