import { createHash } from 'node:crypto';
import { Redis } from 'ioredis';
import { ApiError } from '../lib/errors.js';

export interface Limits {
  consume(key: string, max: number, windowSeconds: number): Promise<boolean>;
}

export function phoneKey(purpose: string, phone: string): string {
  return `vendo:auth:${purpose}:${createHash('sha256').update(phone).digest('hex')}`;
}

export class MemoryLimits implements Limits {
  private readonly entries = new Map<string, { count: number; expiresAt: number }>();
  async consume(key: string, max: number, windowSeconds: number): Promise<boolean> {
    const now = Date.now();
    for (const [entryKey, entry] of this.entries) if (entry.expiresAt <= now) this.entries.delete(entryKey);
    let entry = this.entries.get(key);
    if (!entry) {
      if (this.entries.size >= 10000) throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Please try again later.');
      entry = { count: 0, expiresAt: now + windowSeconds * 1000 };
      this.entries.set(key, entry);
    }
    entry.count += 1;
    return entry.count <= max;
  }
}

export class RedisLimits implements Limits {
  constructor(private readonly redis: Redis) {}
  async consume(key: string, max: number, windowSeconds: number): Promise<boolean> {
    try {
      const count = await this.redis.eval(
        `local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end; return n`,
        1, key, windowSeconds,
      );
      return Number(count) <= max;
    } catch { throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Please try again later.'); }
  }
}

export function createRedis(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false,
    connectTimeout: 5000, commandTimeout: 500,
  });
}
