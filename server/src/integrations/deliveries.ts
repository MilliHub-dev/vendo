import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { ApiError } from '../lib/errors.js';

export type Claim = { state: 'acquired'; token: string } | { state: 'busy' } | { state: 'done' };
export interface Deliveries {
  claim(key: string): Promise<Claim>;
  complete(key: string, token: string): Promise<void>;
  release(key: string, token: string): Promise<void>;
}

export class MemoryDeliveries implements Deliveries {
  private readonly entries = new Map<string, { value: string; expiresAt: number }>();
  async claim(key: string): Promise<Claim> {
    for (const [entryKey, entry] of this.entries) if (entry.expiresAt <= Date.now()) this.entries.delete(entryKey);
    const entry = this.entries.get(key);
    if (entry) return { state: entry.value === 'done' ? 'done' : 'busy' };
    if (this.entries.size >= 10000) throw new ApiError(503, 'SMS_UNAVAILABLE', 'Please try again later.');
    const token = randomUUID();
    this.entries.set(key, { value: token, expiresAt: Date.now() + 30000 });
    return { state: 'acquired', token };
  }
  async complete(key: string, token: string): Promise<void> {
    if (this.entries.get(key)?.value === token) this.entries.set(key, { value: 'done', expiresAt: Date.now() + 600000 });
  }
  async release(key: string, token: string): Promise<void> {
    if (this.entries.get(key)?.value === token) this.entries.delete(key);
  }
}

export class RedisDeliveries implements Deliveries {
  constructor(private readonly redis: Redis) {}
  async claim(key: string): Promise<Claim> {
    const token = randomUUID();
    const state = await this.redis.eval(
      `local v = redis.call('GET', KEYS[1]); if v == 'done' then return 'done' end;
       if v then return 'busy' end; redis.call('SET', KEYS[1], ARGV[1], 'EX', 30); return 'acquired'`, 1, key, token,
    );
    if (state === 'done' || state === 'busy') return { state };
    return { state: 'acquired', token };
  }
  async complete(key: string, token: string): Promise<void> {
    await this.redis.eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('SET', KEYS[1], 'done', 'EX', 600) end`, 1, key, token);
  }
  async release(key: string, token: string): Promise<void> {
    await this.redis.eval(`if redis.call('GET', KEYS[1]) == ARGV[1] then redis.call('DEL', KEYS[1]) end`, 1, key, token);
  }
}
