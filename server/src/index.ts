import { buildApp } from './app.js';
import { readEnv } from './config/env.js';
import { createDependencies } from './dependencies.js';

async function main() {
  const env = readEnv();
  const dependencies = await createDependencies(env);
  const app = await buildApp(env, dependencies);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => { void app.close().catch(() => { process.exitCode = 1; }); });
  }
  try { await app.listen({ host: env.HOST, port: env.PORT }); }
  catch (error) { await app.close(); throw error; }
}

main().catch((error: unknown) => {
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code) ? error.code : 'STARTUP_FAILED';
  // Configuration errors list variable names and safe messages only (never values), so they can be logged.
  const detail = error instanceof Error && error.message.startsWith('Invalid configuration:') ? ` ${error.message}` : '';
  console.error(`Server startup failed (${code}).${detail || ' Check configuration and provider connectivity.'}`);
  process.exitCode = 1;
});
