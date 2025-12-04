/**
 * Authentication Manager - Enhanced Authentication System
 */

import { AuthenticationState, BufferJSON, initAuthCreds, proto } from '@whiskeysockets/baileys';
import { Logger } from '../utils/Logger';
import { StorageManager } from '../storage/StorageManager';
import { AuthenticationError } from '../types';

export interface AuthCredentials {
  creds: AuthenticationState['creds'];
  keys: AuthenticationState['keys'];
}

export interface AuthBackup {
  timestamp: string;
  creds: any;
  keys: any;
  version: string;
}

export class AuthenticationManager {
  private storage: StorageManager;
  private logger: Logger;
  private currentAuthState: AuthCredentials | null = null;
  private authPath: string;

  constructor(storage: StorageManager, logger?: Logger, authPath: string = 'auth') {
    this.storage = storage;
    this.logger = logger || new Logger('AuthenticationManager');
    this.authPath = authPath;
  }

  public async getAuthState(): Promise<AuthenticationState> {
    try {
      this.logger.info('Loading authentication state...');
      
      // Try to load existing credentials
      const creds = await this.loadCreds();
      const keys = await this.loadKeys();
      
      if (creds && keys) {
        this.currentAuthState = { creds, keys };
        this.logger.info('Authentication state loaded successfully');
        
        return {
          creds: creds as any,
          keys: keys as any
        };
      }
      
      // If no existing credentials, initialize new ones
      this.logger.info('No existing credentials found, initializing new auth state');
      return initAuthCreds();
    } catch (error) {
      this.logger.error('Failed to get authentication state:', error);
      throw new AuthenticationError('Failed to load authentication state', error);
    }
  }

  public async saveCreds(newCreds: any): Promise<void> {
    try {
      this.logger.info('Saving authentication credentials...');
      
      // Save credentials to storage
      await this.storage.set(`${this.authPath}:creds`, JSON.stringify(newCreds, BufferJSON.replacer));
      
      // Update current auth state
      if (this.currentAuthState) {
        this.currentAuthState.creds = newCreds;
      }
      
      this.logger.info('Authentication credentials saved successfully');
    } catch (error) {
      this.logger.error('Failed to save credentials:', error);
      throw new AuthenticationError('Failed to save credentials', error);
    }
  }

  public async saveKeys(key: string, value: any, update?: (key: string, value: any) => void): Promise<void> {
    try {
      const keysKey = `${this.authPath}:keys:${key}`;
      const serializedValue = JSON.stringify(value, BufferJSON.replacer);
      
      await this.storage.set(keysKey, serializedValue);
      
      // Update current auth state if available
      if (this.currentAuthState && update) {
        update(key, value);
      }
      
      this.logger.trace(`Saved key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to save key ${key}:`, error);
      throw new AuthenticationError(`Failed to save key: ${key}`, error);
    }
  }

  public async fetchKeys(key: string): Promise<any> {
    try {
      const keysKey = `${this.authPath}:keys:${key}`;
      const serializedValue = await this.storage.get(keysKey);
      
      if (!serializedValue) return null;
      
      return JSON.parse(serializedValue, BufferJSON.reviver);
    } catch (error) {
      this.logger.error(`Failed to fetch key ${key}:`, error);
      return null;
    }
  }

  public async deleteKeys(key: string): Promise<void> {
    try {
      const keysKey = `${this.authPath}:keys:${key}`;
      await this.storage.delete(keysKey);
      
      this.logger.trace(`Deleted key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}:`, error);
      throw new AuthenticationError(`Failed to delete key: ${key}`, error);
    }
  }

  // Enhanced authentication methods
  public async backupAuthentication(password?: string): Promise<AuthBackup> {
    try {
      this.logger.info('Creating authentication backup...');
      
      const creds = await this.loadCreds();
      const keys = await this.loadAllKeys();
      
      const backup: AuthBackup = {
        timestamp: new Date().toISOString(),
        creds: creds,
        keys: keys,
        version: '1.0.0'
      };
      
      // Encrypt backup if password provided
      const backupData = password ? await this.encryptBackup(backup, password) : backup;
      
      // Store backup
      await this.storage.set(`${this.authPath}:backup:${Date.now()}`, backupData);
      
      this.logger.info('Authentication backup created successfully');
      return backup;
    } catch (error) {
      this.logger.error('Failed to create authentication backup:', error);
      throw new AuthenticationError('Failed to create backup', error);
    }
  }

  public async restoreAuthentication(backup: AuthBackup, password?: string): Promise<void> {
    try {
      this.logger.info('Restoring authentication from backup...');
      
      // Decrypt backup if password provided
      const backupData = password ? await this.decryptBackup(backup, password) : backup;
      
      // Validate backup
      if (!this.validateBackup(backupData)) {
        throw new AuthenticationError('Invalid backup format');
      }
      
      // Restore credentials
      await this.saveCreds(backupData.creds);
      
      // Restore keys
      for (const [key, value] of Object.entries(backupData.keys)) {
        await this.saveKeys(key, value);
      }
      
      this.logger.info('Authentication restored successfully');
    } catch (error) {
      this.logger.error('Failed to restore authentication:', error);
      throw new AuthenticationError('Failed to restore authentication', error);
    }
  }

  public async clearAuthentication(): Promise<void> {
    try {
      this.logger.info('Clearing authentication data...');
      
      // Clear all auth-related data
      const authKeys = await this.storage.keys(`${this.authPath}:*`);
      
      for (const key of authKeys) {
        await this.storage.delete(key);
      }
      
      this.currentAuthState = null;
      
      this.logger.info('Authentication data cleared successfully');
    } catch (error) {
      this.logger.error('Failed to clear authentication:', error);
      throw new AuthenticationError('Failed to clear authentication', error);
    }
  }

  public async isValidAuthentication(): Promise<boolean> {
    try {
      const creds = await this.loadCreds();
      
      if (!creds) return false;
      
      // Check if credentials are expired or invalid
      if (creds.me && creds.me.id) {
        // Basic validation - could be enhanced
        return true;
      }
      
      return false;
    } catch (error) {
      this.logger.error('Failed to validate authentication:', error);
      return false;
    }
  }

  public async getAuthenticationInfo(): Promise<{
    isLoggedIn: boolean;
    userId?: string;
    phoneNumber?: string;
    deviceName?: string;
    lastLogin?: Date;
    expiresAt?: Date;
  }> {
    try {
      const creds = await this.loadCreds();
      
      if (!creds || !creds.me) {
        return { isLoggedIn: false };
      }
      
      return {
        isLoggedIn: true,
        userId: creds.me.id,
        phoneNumber: creds.me.id?.split(':')[0],
        deviceName: creds.me.name,
        lastLogin: creds.lastAccountSyncTimestamp ? new Date(creds.lastAccountSyncTimestamp * 1000) : undefined,
        expiresAt: creds.me.lastKnownBusinessAccountLink ? new Date(creds.me.lastKnownBusinessAccountLink * 1000) : undefined
      };
    } catch (error) {
      this.logger.error('Failed to get authentication info:', error);
      return { isLoggedIn: false };
    }
  }

  public async getBackups(): Promise<AuthBackup[]> {
    try {
      const backupKeys = await this.storage.keys(`${this.authPath}:backup:*`);
      const backups: AuthBackup[] = [];
      
      for (const key of backupKeys) {
        const backup = await this.storage.get(key);
        if (backup) {
          backups.push(backup);
        }
      }
      
      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      this.logger.error('Failed to get backups:', error);
      return [];
    }
  }

  public async deleteBackup(timestamp: string): Promise<void> {
    try {
      const backupKey = `${this.authPath}:backup:${timestamp}`;
      await this.storage.delete(backupKey);
      
      this.logger.info(`Backup ${timestamp} deleted successfully`);
    } catch (error) {
      this.logger.error(`Failed to delete backup ${timestamp}:`, error);
      throw new AuthenticationError('Failed to delete backup', error);
    }
  }

  // Multi-device management
  public async getLinkedDevices(): Promise<any[]> {
    try {
      // This would interact with WhatsApp's linked devices API
      // For now, return a placeholder
      this.logger.warn('Linked devices management not fully implemented');
      return [];
    } catch (error) {
      this.logger.error('Failed to get linked devices:', error);
      return [];
    }
  }

  public async linkDevice(pairingCode: string): Promise<void> {
    try {
      // This would implement device linking
      this.logger.warn('Device linking not fully implemented');
    } catch (error) {
      this.logger.error('Failed to link device:', error);
      throw new AuthenticationError('Failed to link device', error);
    }
  }

  public async unlinkDevice(deviceId: string): Promise<void> {
    try {
      // This would implement device unlinking
      this.logger.warn('Device unlinking not fully implemented');
    } catch (error) {
      this.logger.error('Failed to unlink device:', error);
      throw new AuthenticationError('Failed to unlink device', error);
    }
  }

  // Private methods
  private async loadCreds(): Promise<any> {
    try {
      const serializedCreds = await this.storage.get(`${this.authPath}:creds`);
      
      if (!serializedCreds) return null;
      
      return JSON.parse(serializedCreds, BufferJSON.reviver);
    } catch (error) {
      this.logger.error('Failed to load credentials:', error);
      return null;
    }
  }

  private async loadKeys(): Promise<any> {
    try {
      const keyIds = await this.storage.keys(`${this.authPath}:keys:*`);
      const keys: any = {};
      
      for (const keyId of keyIds) {
        const key = keyId.replace(`${this.authPath}:keys:`, '');
        const value = await this.fetchKeys(key);
        if (value) {
          keys[key] = value;
        }
      }
      
      return keys;
    } catch (error) {
      this.logger.error('Failed to load keys:', error);
      return {};
    }
  }

  private async loadAllKeys(): Promise<any> {
    return await this.loadKeys();
  }

  private async encryptBackup(backup: AuthBackup, password: string): Promise<string> {
    // This would implement encryption using crypto module
    // For now, return JSON string
    return JSON.stringify(backup);
  }

  private async decryptBackup(encryptedBackup: string, password: string): Promise<AuthBackup> {
    // This would implement decryption using crypto module
    // For now, parse JSON
    return JSON.parse(encryptedBackup);
  }

  private validateBackup(backup: any): backup is AuthBackup {
    return (
      backup &&
      typeof backup === 'object' &&
      backup.timestamp &&
      backup.creds &&
      backup.keys &&
      backup.version
    );
  }

  // Session management
  public async extendSession(): Promise<void> {
    try {
      this.logger.info('Extending session...');
      
      // This would implement session extension logic
      const creds = await this.loadCreds();
      if (creds) {
        creds.lastAccountSyncTimestamp = Math.floor(Date.now() / 1000);
        await this.saveCreds(creds);
      }
      
      this.logger.info('Session extended successfully');
    } catch (error) {
      this.logger.error('Failed to extend session:', error);
      throw new AuthenticationError('Failed to extend session', error);
    }
  }

  public async isSessionExpired(): Promise<boolean> {
    try {
      const creds = await this.loadCreds();
      
      if (!creds || !creds.lastAccountSyncTimestamp) {
        return true;
      }
      
      const lastSync = creds.lastAccountSyncTimestamp * 1000;
      const now = Date.now();
      const sessionTimeout = 30 * 24 * 60 * 60 * 1000; // 30 days
      
      return (now - lastSync) > sessionTimeout;
    } catch (error) {
      this.logger.error('Failed to check session expiration:', error);
      return true;
    }
  }

  // Utility methods
  public getAuthPath(): string {
    return this.authPath;
  }

  public async getAuthStats(): Promise<{
    totalKeys: number;
    lastUpdated: Date;
    backupCount: number;
    isValid: boolean;
  }> {
    try {
      const keys = await this.loadKeys();
      const backups = await this.getBackups();
      const isValid = await this.isValidAuthentication();
      
      return {
        totalKeys: Object.keys(keys).length,
        lastUpdated: new Date(),
        backupCount: backups.length,
        isValid
      };
    } catch (error) {
      this.logger.error('Failed to get auth stats:', error);
      return {
        totalKeys: 0,
        lastUpdated: new Date(),
        backupCount: 0,
        isValid: false
      };
    }
  }
}

export default AuthenticationManager;