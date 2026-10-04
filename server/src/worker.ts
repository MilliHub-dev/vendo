import { setTimeout } from 'node:timers/promises';
import { readEnv } from './config/env.js';
import { createDependencies } from './dependencies.js';
import { PaymentService } from './modules/payments/service.js';
import { NotificationService } from './modules/notifications/service.js';
import { FinanceService } from './modules/finance/service.js';
async function main() {
    const env = readEnv();
    if (!env.DATABASE_URL)
        throw new Error('Database configuration required.');
    const d = await createDependencies(env), shutdown = new AbortController(), stop = () => shutdown.abort();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const jobs = { matching: () => d.matching.process(100), orders: () => d.orders.processDue(100), payments: () => new PaymentService(d.payments, d.paymentGateway).process(), notifications: () => new NotificationService(d.notifications, d.notificationTransports).process(25, env.NOTIFICATION_REMINDER_MINUTES), referrals: async () => ({ referral_rewards: await d.extras.rewardReferrals(50) }), finance: () => new FinanceService(d.finance, d.transferGateway, env.PAYSTACK_TRANSFERS_ENABLED === 'true').process(20) };
    try {
        do {
            for (const [kind, run] of Object.entries(jobs)) {
                if (shutdown.signal.aborted)
                    break;
                if (env.WORKER_KIND !== 'all' && env.WORKER_KIND !== kind && !(env.WORKER_KIND === 'finance' && kind === 'referrals'))
                    continue;
                const started = Date.now();
                try {
                    const result = await run();
                    await d.operations.heartbeat(kind, true, Date.now() - started);
                    if (Object.values(result).some(Boolean))
                        console.info({ worker: kind, ...result });
                }
                catch {
                    console.error({ worker: kind, error_code: 'WORKER_FAILED' });
                    try {
                        await d.operations.heartbeat(kind, false, Date.now() - started);
                    }
                    catch { /* Database unavailable; next iteration retries. */ }
                }
            }
            if (shutdown.signal.aborted)
                break;
            try {
                await setTimeout(5000, undefined, { signal: shutdown.signal });
            }
            catch {
                break;
            }
        } while (!shutdown.signal.aborted);
    }
    finally {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        await d.close();
    }
}
main().catch(() => { console.error('Worker startup failed. Check configuration and dependencies.'); process.exitCode = 1; });
