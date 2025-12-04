/**
 * Plugin Manager - Extensible Plugin System
 */

import { Logger } from '../utils/Logger';
import { Plugin, PluginContext } from '../types';
import { LadybugConfig } from '../core/config';

export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  enabled: boolean;
  loaded: boolean;
  dependencies: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginHook {
  name: string;
  handler: (...args: any[]) => any;
  priority: number;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginInfo: Map<string, PluginInfo> = new Map();
  private hooks: Map<string, PluginHook[]> = new Map();
  private context: PluginContext;
  private logger: Logger;

  constructor(config: LadybugConfig, logger?: Logger) {
    this.logger = logger || new Logger('PluginManager');
    this.context = {
      config,
      logger: this.logger.child('Plugin'),
      eventBus: null as any, // Will be set by LadybugBaileys
      storage: null as any   // Will be set by LadybugBaileys
    };
  }

  public setEventBus(eventBus: any): void {
    this.context.eventBus = eventBus;
  }

  public setStorage(storage: any): void {
    this.context.storage = storage;
  }

  public async registerPlugin(plugin: Plugin): Promise<void> {
    try {
      // Validate plugin
      this.validatePlugin(plugin);
      
      // Check if plugin already exists
      if (this.plugins.has(plugin.name)) {
        throw new Error(`Plugin ${plugin.name} is already registered`);
      }
      
      // Check dependencies
      await this.checkDependencies(plugin);
      
      // Store plugin
      this.plugins.set(plugin.name, plugin);
      
      // Store plugin info
      const info: PluginInfo = {
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
        author: plugin.author,
        enabled: false,
        loaded: false,
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      this.pluginInfo.set(plugin.name, info);
      
      this.logger.info(`Plugin ${plugin.name} registered successfully`);
    } catch (error) {
      this.logger.error(`Failed to register plugin ${plugin.name}:`, error);
      throw error;
    }
  }

  public async enablePlugin(name: string): Promise<void> {
    try {
      const plugin = this.plugins.get(name);
      const info = this.pluginInfo.get(name);
      
      if (!plugin) {
        throw new Error(`Plugin ${name} not found`);
      }
      
      if (info.enabled) {
        this.logger.warn(`Plugin ${name} is already enabled`);
        return;
      }
      
      // Initialize plugin
      await plugin.initialize(this.context);
      
      // Update info
      info.enabled = true;
      info.loaded = true;
      info.updatedAt = new Date();
      
      this.logger.info(`Plugin ${name} enabled successfully`);
    } catch (error) {
      this.logger.error(`Failed to enable plugin ${name}:`, error);
      throw error;
    }
  }

  public async disablePlugin(name: string): Promise<void> {
    try {
      const plugin = this.plugins.get(name);
      const info = this.pluginInfo.get(name);
      
      if (!plugin) {
        throw new Error(`Plugin ${name} not found`);
      }
      
      if (!info.enabled) {
        this.logger.warn(`Plugin ${name} is already disabled`);
        return;
      }
      
      // Destroy plugin if destroy method exists
      if (plugin.destroy) {
        await plugin.destroy();
      }
      
      // Remove hooks
      this.removePluginHooks(name);
      
      // Update info
      info.enabled = false;
      info.loaded = false;
      info.updatedAt = new Date();
      
      this.logger.info(`Plugin ${name} disabled successfully`);
    } catch (error) {
      this.logger.error(`Failed to disable plugin ${name}:`, error);
      throw error;
    }
  }

  public async unregisterPlugin(name: string): Promise<void> {
    try {
      // Disable plugin first
      if (this.isPluginEnabled(name)) {
        await this.disablePlugin(name);
      }
      
      // Remove plugin
      this.plugins.delete(name);
      this.pluginInfo.delete(name);
      
      this.logger.info(`Plugin ${name} unregistered successfully`);
    } catch (error) {
      this.logger.error(`Failed to unregister plugin ${name}:`, error);
      throw error;
    }
  }

  public getPlugin(name: string): Plugin | null {
    return this.plugins.get(name) || null;
  }

  public getPluginInfo(name: string): PluginInfo | null {
    return this.pluginInfo.get(name) || null;
  }

  public getAllPlugins(): Map<string, PluginInfo> {
    return new Map(this.pluginInfo);
  }

  public getEnabledPlugins(): PluginInfo[] {
    return Array.from(this.pluginInfo.values()).filter(info => info.enabled);
  }

  public isPluginEnabled(name: string): boolean {
    const info = this.pluginInfo.get(name);
    return info ? info.enabled : false;
  }

  public async loadPluginFromModule(modulePath: string): Promise<void> {
    try {
      // Dynamic import of plugin module
      const pluginModule = await import(modulePath);
      const plugin = pluginModule.default || pluginModule.plugin;
      
      if (!plugin) {
        throw new Error(`No plugin found in module ${modulePath}`);
      }
      
      await this.registerPlugin(plugin);
    } catch (error) {
      this.logger.error(`Failed to load plugin from ${modulePath}:`, error);
      throw error;
    }
  }

  // Hook system
  public registerHook(name: string, handler: (...args: any[]) => any, priority: number = 0): void {
    if (!this.hooks.has(name)) {
      this.hooks.set(name, []);
    }
    
    const hooks = this.hooks.get(name)!;
    hooks.push({ name, handler, priority });
    
    // Sort by priority (higher priority first)
    hooks.sort((a, b) => b.priority - a.priority);
    
    this.logger.debug(`Registered hook: ${name} with priority ${priority}`);
  }

  public async executeHook(name: string, ...args: any[]): Promise<any[]> {
    const hooks = this.hooks.get(name) || [];
    const results: any[] = [];
    
    for (const hook of hooks) {
      try {
        const result = await hook.handler(...args);
        results.push(result);
      } catch (error) {
        this.logger.error(`Hook ${name} failed:`, error);
      }
    }
    
    return results;
  }

  public removeHook(name: string, handler: (...args: any[]) => any): void {
    const hooks = this.hooks.get(name) || [];
    const index = hooks.findIndex(h => h.handler === handler);
    
    if (index !== -1) {
      hooks.splice(index, 1);
      this.logger.debug(`Removed hook: ${name}`);
    }
  }

  private removePluginHooks(pluginName: string): void {
    // This would require tracking which plugin owns which hooks
    // For now, we'll implement a basic version
    for (const [hookName, hooks] of this.hooks.entries()) {
      const filteredHooks = hooks.filter(hook => !hook.name.includes(pluginName));
      this.hooks.set(hookName, filteredHooks);
    }
  }

  // Plugin lifecycle management
  public async enableAllPlugins(): Promise<void> {
    const plugins = Array.from(this.plugins.keys());
    
    for (const pluginName of plugins) {
      try {
        await this.enablePlugin(pluginName);
      } catch (error) {
        this.logger.error(`Failed to enable plugin ${pluginName}:`, error);
      }
    }
  }

  public async disableAllPlugins(): Promise<void> {
    const enabledPlugins = this.getEnabledPlugins();
    
    for (const info of enabledPlugins) {
      try {
        await this.disablePlugin(info.name);
      } catch (error) {
        this.logger.error(`Failed to disable plugin ${info.name}:`, error);
      }
    }
  }

  // Plugin validation
  private validatePlugin(plugin: Plugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a valid name');
    }
    
    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error('Plugin must have a valid version');
    }
    
    if (!plugin.description || typeof plugin.description !== 'string') {
      throw new Error('Plugin must have a valid description');
    }
    
    if (!plugin.author || typeof plugin.author !== 'string') {
      throw new Error('Plugin must have a valid author');
    }
    
    if (!plugin.initialize || typeof plugin.initialize !== 'function') {
      throw new Error('Plugin must have an initialize method');
    }
  }

  private async checkDependencies(plugin: Plugin): Promise<void> {
    // For now, we'll implement basic dependency checking
    // This could be enhanced to support actual dependency resolution
    const dependencies = plugin.dependencies || [];
    
    for (const dependency of dependencies) {
      if (!this.plugins.has(dependency)) {
        throw new Error(`Plugin ${plugin.name} requires ${dependency} but it's not available`);
      }
    }
  }

  // Plugin discovery
  public async discoverPlugins(directory: string): Promise<void> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const files = await fs.readdir(directory);
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isDirectory()) {
          // Check for package.json or index.js/ts
          const pluginFile = path.join(filePath, 'index.js');
          const packageFile = path.join(filePath, 'package.json');
          
          try {
            await fs.access(pluginFile);
            await this.loadPluginFromModule(pluginFile);
          } catch {
            try {
              await fs.access(packageFile);
              const packageContent = JSON.parse(await fs.readFile(packageFile, 'utf-8'));
              const mainFile = packageContent.main || 'index.js';
              const mainPath = path.join(filePath, mainFile);
              await this.loadPluginFromModule(mainPath);
            } catch {
              // Not a plugin directory, skip
            }
          }
        }
      }
      
      this.logger.info(`Plugin discovery completed in directory: ${directory}`);
    } catch (error) {
      this.logger.error(`Plugin discovery failed in directory ${directory}:`, error);
      throw error;
    }
  }

  // Plugin hot-reloading
  public async reloadPlugin(name: string): Promise<void> {
    try {
      const wasEnabled = this.isPluginEnabled(name);
      
      if (wasEnabled) {
        await this.disablePlugin(name);
      }
      
      // Clear module cache (for hot reloading)
      const modulePath = require.resolve(name);
      delete require.cache[modulePath];
      
      // Reload plugin
      await this.loadPluginFromModule(modulePath);
      
      if (wasEnabled) {
        await this.enablePlugin(name);
      }
      
      this.logger.info(`Plugin ${name} reloaded successfully`);
    } catch (error) {
      this.logger.error(`Failed to reload plugin ${name}:`, error);
      throw error;
    }
  }

  // Plugin metrics
  public getPluginMetrics(): {
    totalPlugins: number;
    enabledPlugins: number;
    disabledPlugins: number;
    totalHooks: number;
    pluginsByAuthor: Record<string, number>;
  } {
    const plugins = Array.from(this.pluginInfo.values());
    const enabled = plugins.filter(p => p.enabled).length;
    const disabled = plugins.filter(p => !p.enabled).length;
    
    const pluginsByAuthor: Record<string, number> = {};
    plugins.forEach(plugin => {
      pluginsByAuthor[plugin.author] = (pluginsByAuthor[plugin.author] || 0) + 1;
    });
    
    let totalHooks = 0;
    for (const hooks of this.hooks.values()) {
      totalHooks += hooks.length;
    }
    
    return {
      totalPlugins: plugins.length,
      enabledPlugins: enabled,
      disabledPlugins: disabled,
      totalHooks,
      pluginsByAuthor
    };
  }

  // Plugin configuration
  public async configurePlugin(name: string, config: any): Promise<void> {
    const plugin = this.plugins.get(name);
    
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }
    
    // Store configuration in plugin context
    (this.context as any)[`${name}Config`] = config;
    
    this.logger.info(`Plugin ${name} configured successfully`);
  }

  public getPluginConfig(name: string): any {
    return (this.context as any)[`${name}Config`];
  }

  // Cleanup
  public async cleanup(): Promise<void> {
    try {
      await this.disableAllPlugins();
      
      this.plugins.clear();
      this.pluginInfo.clear();
      this.hooks.clear();
      
      this.logger.info('Plugin manager cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup plugin manager:', error);
      throw error;
    }
  }
}

export default PluginManager;