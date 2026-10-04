import { setTimeout } from 'node:timers/promises';
import { readEnv } from '../src/config/env.js';
import { createDependencies } from '../src/dependencies.js';
import { NotificationService } from '../src/modules/notifications/service.js';
const env = readEnv();
if (!env.DATABASE_URL)
    throw new Error('DATABASE_URL is required.');
const dependencies = await createDependencies(env), service = new NotificationService(dependencies.notifications, dependencies.notificationTransports), watch = process.argv.includes('--watch'), shutdown = new AbortController();
const stop = () => shutdown.abort();
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
    do {
        let rewarded=0;
        try { rewarded=await dependencies.extras.rewardReferrals(50); }
        catch { console.error('Referral settlement failed. Check pending campaign rewards and wallet limits.'); if(!watch)process.exitCode=1; }
        try {
            const result = await service.process(25, env.NOTIFICATION_REMINDER_MINUTES);
            if (!watch || rewarded || Object.values(result).some(Boolean))
                console.info({ ...result, rewarded });
        }
        catch {
            console.error('Customer processing failed. Check migrations and notification configuration.');
            if (!watch) {
                process.exitCode = 1;
                break;
            }
        }
        if (!watch || shutdown.signal.aborted)
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
    await dependencies.close();
}
