import { createClient } from '@supabase/supabase-js';
import { readEnv } from '../src/config/env.js';
const env = readEnv();
if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Configure Supabase URL and server-only service role key.');
const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10000) }) } });
try {
    for (const [id, publicBucket, mimes] of [['vendo-public', true, ['image/jpeg', 'image/png', 'image/webp']], ['vendo-documents', false, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']]] as const) {
        const { data, error } = await client.storage.getBucket(id);
        if (data) {
            if (data.public !== publicBucket)
                throw new Error('Existing bucket has incompatible visibility.');
            const result = await client.storage.updateBucket(id, { public: publicBucket, fileSizeLimit: 2097152, allowedMimeTypes: [...mimes] });
            if (result.error)
                throw new Error();
        }
        else {
            if (!error || !('statusCode' in error) || String(error.statusCode) !== '404')
                throw new Error();
            const result = await client.storage.createBucket(id, { public: publicBucket, fileSizeLimit: 2097152, allowedMimeTypes: [...mimes] });
            if (result.error)
                throw new Error();
        }
        console.info(`Configured ${id}.`);
    }
}
catch {
    console.error('Storage setup failed. Check credentials, permissions and existing bucket visibility.');
    process.exitCode = 1;
}
