import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/integrations/database.js';
import { PostgresOrderRepository } from '../src/modules/orders/repository.js';
const env = readEnv();
if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
const pool = createPool(env);
try { console.info(await new PostgresOrderRepository(pool).processDue(100)); }
catch { console.error('Order processing failed. Check database configuration and migrations.'); process.exitCode=1; }
finally { await pool.end(); }
