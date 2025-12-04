/**
 * Ladybug Baileys - Enhanced WhatsApp Web API Library
 * 
 * A feature-rich, production-ready WhatsApp automation library
 * built on top of whiskeysockets/baileys with enhanced capabilities.
 * 
 * @author Ladybug Development Team
 * @version 1.0.0
 */

// Core exports
export { LadybugBaileys, makeLadybugSocket } from './core/LadybugBaileys';
export { AuthenticationManager } from './auth/AuthenticationManager';
export { MessageScheduler } from './messaging/MessageScheduler';
export { EventBus } from './events/EventBus';
export { StorageManager } from './storage/StorageManager';
export { MonitoringService } from './monitoring/MonitoringService';

// API exports
export { RESTAPI } from './api/RESTAPI';
export { GraphQLAPI } from './api/GraphQLAPI';

// Utils exports
export { Logger } from './utils/Logger';
export { Validator } from './utils/Validator';
export { MediaProcessor } from './utils/MediaProcessor';
export { RateLimiter } from './utils/RateLimiter';

// Types exports
export * from './types';

// Plugin system
export { PluginManager } from './plugins/PluginManager';

// Configuration
export { defaultConfig } from './core/config';

// Re-export base Baileys functionality
export * from '@whiskeysockets/baileys';