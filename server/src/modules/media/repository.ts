import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { actor, audit, serialize, transaction } from '../../lib/postgres.js';
import { assetSchema, type ObjectStorage, type MediaInput, type MediaRepository } from './schema.js';
import { validateFile, extension } from './validation.js';
export class PostgresMediaRepository implements MediaRepository {
    constructor(private readonly pool: pg.Pool, private readonly storage: ObjectStorage) { }
    private async access(c: pg.PoolClient, user: string, vendor: string | null, owner?: string) { const p = await actor(c, user); if (p.role === 'admin')
        return; if (vendor && p.role === 'vendor_staff' && (await c.query('SELECT 1 FROM vendo_internal.vendor_staff WHERE vendor_id=$1 AND profile_id=$2 FOR SHARE', [vendor, user])).rows[0])
        return; if (!vendor && owner === user)
        return; throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.'); }
    private response(r: Record<string, unknown>) { return assetSchema.parse({ ...serialize(r), public_url: r.purpose === 'document' ? null : this.storage.publicUrl(String(r.object_path)) }); }
    async upload(user: string, input: MediaInput) { const bytes = validateFile(input.data_base64, input.mime); return transaction(this.pool, async (c) => { await this.access(c, user, input.vendor_id ?? null, input.purpose === 'document' ? user : undefined); if (input.vendor_id && !(await c.query('SELECT id FROM public.vendors WHERE id=$1', [input.vendor_id])).rows[0])
        throw new ApiError(404, 'VENDOR_NOT_FOUND', 'Vendor not found.'); const id = randomUUID(), path = `${input.purpose}/${input.vendor_id ?? user}/${id}.${extension(input.mime)}`; await this.storage.put(path, bytes, input.mime, input.purpose === 'document'); const r = (await c.query('INSERT INTO vendo_internal.media_assets(id,owner_id,vendor_id,purpose,mime,bytes,object_path) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [id, user, input.vendor_id ?? null, input.purpose, input.mime, bytes.length, path])).rows[0]!; await audit(c, user, 'media_uploaded', id); return this.response(r); }); }
    async get(user: string, id: string) { return transaction(this.pool, async (c) => { const r = (await c.query('SELECT * FROM vendo_internal.media_assets WHERE id=$1', [id])).rows[0]; if (!r)
        throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.'); await this.access(c, user, r.vendor_id, r.owner_id); return this.response(r); }); }
    async download(user: string, id: string) { return transaction(this.pool, async (c) => { const r = (await c.query("SELECT * FROM vendo_internal.media_assets WHERE id=$1 AND purpose='document'", [id])).rows[0]; if (!r)
        throw new ApiError(404, 'FILE_NOT_FOUND', 'File not found.'); await this.access(c, user, null, r.owner_id); await audit(c, user, 'private_file_downloaded', id); return { url: await this.storage.signed(r.object_path), expires_in: 60 }; }); }
}
