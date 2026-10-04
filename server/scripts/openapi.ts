import { writeFile, mkdir } from 'node:fs/promises';
import { buildApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
import { createDependencies } from '../src/dependencies.js';

const env = readEnv({ NODE_ENV: 'test' });
const app = await buildApp(env, await createDependencies(env));
try {
  await app.ready();
  await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
  await writeFile(new URL('../docs/openapi.json', import.meta.url), `${JSON.stringify(app.swagger(), null, 2)}\n`);
  console.info('Generated docs/openapi.json');
} finally { await app.close(); }
