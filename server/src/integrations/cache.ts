import { createHash } from 'node:crypto';
import type { Routing } from '../modules/food/schema.js';

export class BoundedCache<T> {
  private readonly entries = new Map<string, { expires: number; value: T }>();
  private readonly pending = new Map<string, Promise<T>>();
  constructor(private readonly ttlMs: number, private readonly capacity = 500, private readonly now = () => Date.now()) {}
  async load(input: unknown, fetchValue: () => Promise<T>): Promise<T> {
    const key = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const now = this.now();
    for (const [id, entry] of this.entries) if (entry.expires <= now) this.entries.delete(id);
    const hit = this.entries.get(key);
    if (hit) return structuredClone(hit.value);
    const inFlight = this.pending.get(key);
    if (inFlight) return structuredClone(await inFlight);
    // Keep in-flight memory bounded too; normal per-user/IP limits apply at the API.
    if (this.pending.size >= this.capacity) return fetchValue();
    const request = Promise.resolve().then(fetchValue);
    this.pending.set(key, request);
    try {
      const value = await request;
      if (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
      this.entries.set(key, { expires: this.now() + this.ttlMs, value: structuredClone(value) });
      return structuredClone(value);
    } finally { this.pending.delete(key); }
  }
}
export function cachedRouting(provider: Routing): Routing {
  const cache = new BoundedCache<Awaited<ReturnType<Routing['route']>>>(120000);
  return { route: (pickup, dropoff) => cache.load([pickup.lat, pickup.lng, dropoff.lat, dropoff.lng], () => provider.route(pickup, dropoff)) };
}
