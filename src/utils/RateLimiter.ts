/**
 * Rate Limiting Utility
 */

import NodeCache from 'node-cache';
import { RateLimitConfig } from '../types';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
}

export class RateLimiter {
  private config: RateLimitConfig;
  private cache: NodeCache;
  private messageCounts: Map<string, { count: number; resetTime: number }>;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.cache = new NodeCache({ stdTTL: 0, checkperiod: 0 });
    this.messageCounts = new Map();
  }

  public async checkLimit(type: 'send' | 'receive', identifier: string): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: new Date(Date.now() + this.config.windowMs)
      };
    }

    const key = `${type}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get current count from cache or memory
    let currentCount = this.cache.get(key) as number || 0;
    let resetTime = this.getResetTime(key);

    // Reset if window has expired
    if (now > resetTime) {
      currentCount = 0;
      resetTime = now + this.config.windowMs;
      this.cache.set(key, currentCount, this.config.windowMs / 1000);
    }

    const remaining = Math.max(0, this.config.maxRequests - currentCount);
    const allowed = currentCount < this.config.maxRequests;

    if (allowed) {
      // Increment count
      currentCount++;
      this.cache.set(key, currentCount, this.config.windowMs / 1000);
    }

    const result: RateLimitResult = {
      allowed,
      remaining,
      resetTime: new Date(resetTime)
    };

    if (!allowed) {
      result.retryAfter = Math.ceil((resetTime - now) / 1000);
    }

    return result;
  }

  public async checkMultipleLimits(
    requests: Array<{ type: 'send' | 'receive'; identifier: string }>
  ): Promise<RateLimitResult[]> {
    return Promise.all(requests.map(req => this.checkLimit(req.type, req.identifier)));
  }

  public getStats(identifier: string): {
    currentCount: number;
    maxRequests: number;
    windowMs: number;
    resetTime: Date;
    remaining: number;
  } {
    const key = `send:${identifier}`; // Default to send stats
    const currentCount = this.cache.get(key) as number || 0;
    const resetTime = this.getResetTime(key);

    return {
      currentCount,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
      resetTime: new Date(resetTime),
      remaining: Math.max(0, this.config.maxRequests - currentCount)
    };
  }

  public getAllStats(): Array<{
    identifier: string;
    currentCount: number;
    maxRequests: number;
    remaining: number;
    resetTime: Date;
  }> {
    const keys = this.cache.keys();
    return keys.map(key => {
      const identifier = key.replace(/^(send|receive):/, '');
      const stats = this.getStats(identifier);
      return {
        identifier,
        ...stats
      };
    });
  }

  public reset(identifier: string, type?: 'send' | 'receive'): void {
    if (type) {
      const key = `${type}:${identifier}`;
      this.cache.del(key);
    } else {
      this.cache.del(`send:${identifier}`);
      this.cache.del(`receive:${identifier}`);
    }
  }

  public resetAll(): void {
    this.cache.flushAll();
  }

  private getResetTime(key: string): number {
    const cached = this.cache.getTtl(key);
    return cached > 0 ? cached : Date.now() + this.config.windowMs;
  }

  // Advanced rate limiting strategies
  public async checkSlidingWindowLimit(
    type: 'send' | 'receive',
    identifier: string
  ): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: new Date(Date.now() + this.config.windowMs)
      };
    }

    const key = `${type}:sliding:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get timestamps from cache
    let timestamps = this.cache.get(key) as number[] || [];

    // Remove old timestamps outside the window
    timestamps = timestamps.filter(timestamp => timestamp > windowStart);

    const allowed = timestamps.length < this.config.maxRequests;

    if (allowed) {
      // Add current timestamp
      timestamps.push(now);
      this.cache.set(key, timestamps, this.config.windowMs / 1000);
    } else {
      // Update cache with filtered timestamps
      this.cache.set(key, timestamps, this.config.windowMs / 1000);
    }

    const remaining = Math.max(0, this.config.maxRequests - timestamps.length);
    const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : now;
    const resetTime = oldestTimestamp + this.config.windowMs;

    return {
      allowed,
      remaining,
      resetTime: new Date(resetTime),
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
  }

  // Token bucket algorithm
  public async checkTokenBucketLimit(
    type: 'send' | 'receive',
    identifier: string,
    tokens: number = 1
  ): Promise<RateLimitResult> {
    if (!this.config.enabled) {
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetTime: new Date(Date.now() + this.config.windowMs)
      };
    }

    const key = `${type}:bucket:${identifier}`;
    const now = Date.now();
    
    // Get bucket state
    let bucket = this.cache.get(key) as {
      tokens: number;
      lastRefill: number;
    } || {
      tokens: this.config.maxRequests,
      lastRefill: now
    };

    // Calculate tokens to add based on time passed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / this.config.windowMs) * this.config.maxRequests);
    
    if (tokensToAdd > 0) {
      bucket.tokens = Math.min(this.config.maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    const allowed = bucket.tokens >= tokens;
    const remaining = bucket.tokens;

    if (allowed) {
      bucket.tokens -= tokens;
    }

    // Save bucket state
    this.cache.set(key, bucket, Math.ceil(this.config.windowMs / 1000));

    const resetTime = bucket.lastRefill + this.config.windowMs;

    return {
      allowed,
      remaining,
      resetTime: new Date(resetTime),
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
  }

  // Custom rate limiting with different configurations per identifier
  public async checkCustomLimit(
    identifier: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const key = `custom:${identifier}`;
    const now = Date.now();
    const windowStart = now - windowMs;

    let currentCount = this.cache.get(key) as number || 0;
    let resetTime = this.getCustomResetTime(key, windowMs);

    if (now > resetTime) {
      currentCount = 0;
      resetTime = now + windowMs;
      this.cache.set(key, currentCount, windowMs / 1000);
    }

    const remaining = Math.max(0, maxRequests - currentCount);
    const allowed = currentCount < maxRequests;

    if (allowed) {
      currentCount++;
      this.cache.set(key, currentCount, windowMs / 1000);
    }

    return {
      allowed,
      remaining,
      resetTime: new Date(resetTime),
      retryAfter: allowed ? undefined : Math.ceil((resetTime - now) / 1000)
    };
  }

  private getCustomResetTime(key: string, windowMs: number): number {
    const cached = this.cache.getTtl(key);
    return cached > 0 ? cached : Date.now() + windowMs;
  }

  // Priority queue for important messages
  public async checkPriorityLimit(
    type: 'send' | 'receive',
    identifier: string,
    priority: 'low' | 'normal' | 'high' = 'normal'
  ): Promise<RateLimitResult> {
    // Different limits based on priority
    const priorityMultiplier = {
      low: 0.5,      // 50% of normal limit
      normal: 1,     // Normal limit
      high: 2        // 200% of normal limit
    };

    const adjustedMaxRequests = Math.ceil(this.config.maxRequests * priorityMultiplier[priority]);
    
    return this.checkCustomLimit(identifier, adjustedMaxRequests, this.config.windowMs);
  }

  // Get rate limit metrics
  public getMetrics(): {
    totalRequests: number;
    blockedRequests: number;
    averageRequestsPerWindow: number;
    topConsumers: Array<{
      identifier: string;
      requests: number;
      percentage: number;
    }>;
  } {
    const keys = this.cache.keys();
    let totalRequests = 0;
    let blockedRequests = 0;
    const consumerStats = new Map<string, number>();

    keys.forEach(key => {
      const count = this.cache.get(key) as number || 0;
      const identifier = key.replace(/^(send|receive)(?::(sliding|bucket|custom))?:/, '');
      
      totalRequests += count;
      
      if (count > this.config.maxRequests) {
        blockedRequests += count - this.config.maxRequests;
      }

      consumerStats.set(identifier, (consumerStats.get(identifier) || 0) + count);
    });

    // Calculate top consumers
    const topConsumers = Array.from(consumerStats.entries())
      .map(([identifier, requests]) => ({
        identifier,
        requests,
        percentage: totalRequests > 0 ? (requests / totalRequests) * 100 : 0
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);

    return {
      totalRequests,
      blockedRequests,
      averageRequestsPerWindow: keys.length > 0 ? totalRequests / keys.length : 0,
      topConsumers
    };
  }

  // Cleanup expired entries
  public cleanup(): void {
    this.cache.keys().forEach(key => {
      const ttl = this.cache.getTtl(key);
      if (ttl > 0 && ttl < Date.now()) {
        this.cache.del(key);
      }
    });
  }

  // Export rate limit data
  public exportData(): {
    config: RateLimitConfig;
    entries: Array<{
      key: string;
      count: number;
      ttl: number;
    }>;
    metrics: any;
  } {
    const entries = this.cache.keys().map(key => ({
      key,
      count: this.cache.get(key) as number || 0,
      ttl: this.cache.getTtl(key)
    }));

    return {
      config: this.config,
      entries,
      metrics: this.getMetrics()
    };
  }
}

export default RateLimiter;