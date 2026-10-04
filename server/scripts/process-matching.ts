import { setTimeout } from 'node:timers/promises';
import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/integrations/database.js';
import { PostgresMatchingRepository } from '../src/modules/matching/repository.js';
const env=readEnv();
if(!env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const pool=createPool(env),repository=new PostgresMatchingRepository(pool),watch=process.argv.includes('--watch'),shutdown=new AbortController();
const stop=()=>shutdown.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
try {
  do {
    try {
      const result=await repository.process(100);
      if(!watch||Object.values(result).some(Boolean))console.info(result);
    } catch {
      console.error('Matching processing failed. Check migrations, city policies and rider availability.');
      if(!watch){process.exitCode=1;break;}
    }
    if(!watch||shutdown.signal.aborted)break;
    try {await setTimeout(5000,undefined,{signal:shutdown.signal});}catch {break;}
  } while(!shutdown.signal.aborted);
} finally {process.off('SIGINT',stop);process.off('SIGTERM',stop);await pool.end();}
