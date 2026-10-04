import type pg from 'pg';
import { ApiError } from './errors.js';
export async function transaction<T>(pool: pg.Pool, work: (c: pg.PoolClient) => Promise<T>): Promise<T> { const c = await pool.connect(); try {
    await c.query('BEGIN');
    const result = await work(c);
    await c.query('COMMIT');
    return result;
}
catch (error) {
    await c.query('ROLLBACK');
    throw error;
}
finally {
    c.release();
} }
export async function actor(c: pg.PoolClient, id: string, role?: string) { const row = (await c.query<{
    role: string;
    onboarding_step: string;
}>("SELECT role,onboarding_step FROM public.profiles WHERE id=$1 AND status='active' FOR SHARE", [id])).rows[0]; if (!row || (role && row.role !== role))
    throw new ApiError(403, 'FORBIDDEN', 'Active authorized account required.'); return row; }
export async function audit(c: pg.PoolClient, id: string, action: string, target: string) { await c.query('INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES($1,$2,$3)', [id, action, target]); }
export function serialize(row: Record<string, unknown>) { return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : value])); }
