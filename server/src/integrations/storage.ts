import { createClient } from '@supabase/supabase-js';
import { ApiError } from '../lib/errors.js';
import type { ObjectStorage } from '../modules/media/schema.js';
export function createObjectStorage(url: string, key: string, publicBucket: string, privateBucket: string): ObjectStorage {
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) }) } });
    const failed = () => new ApiError(503, 'STORAGE_UNAVAILABLE', 'File storage is temporarily unavailable.');
    const visibility = async (privateFile: boolean) => { const { data, error } = await client.storage.getBucket(privateFile ? privateBucket : publicBucket); if (error || !data || typeof data.public !== 'boolean' || data.public === privateFile)
        throw failed(); };
    return { configured: true, async put(path, data, mime, privateFile) { try {
            await visibility(privateFile);
            const { error } = await client.storage.from(privateFile ? privateBucket : publicBucket).upload(path, data, { contentType: mime, upsert: false, cacheControl: privateFile ? '0' : '3600' });
            if (error)
                throw failed();
        }
        catch {
            throw failed();
        } }, async download(path) { try {
            await visibility(true);
            const { data, error } = await client.storage.from(privateBucket).download(path);
            if (error || !data || data.size > 2097152)
                throw failed();
            return Buffer.from(await data.arrayBuffer());
        }
        catch {
            throw failed();
        } }, async signed(path) { try {
            await visibility(true);
            const { data, error } = await client.storage.from(privateBucket).createSignedUrl(path, 60, { download: true });
            if (error || !data)
                throw failed();
            return data.signedUrl;
        }
        catch {
            throw failed();
        } }, publicUrl(path) { return client.storage.from(publicBucket).getPublicUrl(path).data.publicUrl; } };
}
export const unavailableStorage: ObjectStorage = { configured: false, async put() { throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured.'); }, async download() { throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured.'); }, async signed() { throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured.'); }, publicUrl() { throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'File storage is not configured.'); } };
