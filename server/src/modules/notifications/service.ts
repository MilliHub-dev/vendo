import type { NotificationRepository, NotificationTransports } from './schema.js';
export class NotificationService {
    constructor(private readonly repository: NotificationRepository, private readonly transports: NotificationTransports) { }
    async process(limit = 25, reminderMinutes = 30) {
        const reminders = await this.repository.reminders(limit, reminderMinutes);
        let sent = 0, skipped = 0, failed = 0;
        // Each lease is refreshed by claim immediately before its send, avoiding batch lease expiry.
        for (let i = 0; i < limit; i++) {
            const job = (await this.repository.claim(1))[0];
            if (!job)
                break;
            try {
                const target = await this.repository.target(job), sender = this.transports[job.channel];
                if (!target || !sender) {
                    await this.repository.finish(job, 'skipped');
                    skipped++;
                    continue;
                }
                if (job.channel === 'push') {
                    const result = await this.transports.push!.send(target);
                    if(result==='expired'){await this.repository.finish(job,'skipped','expired');skipped++;continue;}
                    if (result === 'invalid') {
                        if (target.device_id)
                            await this.repository.invalidateDevice(target.device_id, target.destination);
                        await this.repository.finish(job, 'skipped', 'invalid_device');
                        skipped++;
                        continue;
                    }
                }
                else if (job.channel === 'email')
                    await this.transports.email!.send({ to: target.destination, subject: target.notification.title, text: target.notification.body });
                else
                    await this.transports[job.channel]!.sendText(target.destination, target.notification.body);
                await this.repository.finish(job, 'sent');
                sent++;
            }
            catch {
                await this.repository.finish(job, 'failed', 'delivery_unavailable');
                failed++;
            }
        }
        return { reminders, sent, skipped, failed };
    }
}
