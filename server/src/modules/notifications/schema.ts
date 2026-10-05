import { z } from 'zod';
export const notificationSchema = z.object({ id: z.uuid(), kind: z.string(), title: z.string(), body: z.string(), order_id: z.uuid().nullable(), expires_at: z.string().nullable(), read_at: z.string().nullable(), created_at: z.string() });
export const deviceInput = z.strictObject({ token: z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:.-]+$/), platform: z.enum(['android', 'ios','web']) });
export const deviceSchema = z.object({ id: z.uuid(), platform: deviceInput.shape.platform, created_at: z.string(), updated_at: z.string() });
export type Notification = z.infer<typeof notificationSchema>;
export type Device = z.infer<typeof deviceSchema>;
export const adminPushInput = z.strictObject({ profile_ids: z.array(z.uuid()).min(1).max(100), title: z.string().trim().min(1).max(120), body: z.string().trim().min(1).max(1000) }).refine(v => new Set(v.profile_ids.map(id => id.toLowerCase())).size === v.profile_ids.length, 'Duplicate recipients.');
export const adminPushResult = z.object({ notification_ids: z.array(z.uuid()), recipients: z.number().int(), queued_pushes: z.number().int() });
export type DeliveryJob = {
    id: string;
    lease_id: string;
    notification_id: string;
    channel: 'push' | 'email' | 'sms' | 'whatsapp';
    attempts: number;
};
export type DeliveryTarget = {
    notification: Notification;
    destination: string;
    device_id: string | null;
    urgent: boolean;
};
export interface NotificationRepository {
    sendAdminPush(admin: string, input: z.infer<typeof adminPushInput>, key: string): Promise<z.infer<typeof adminPushResult>>;
    inbox(user: string, limit: number, offset: number): Promise<{
        items: Notification[];
        unread: number;
    }>;
    read(user: string, id?: string): Promise<void>;
    devices(user: string): Promise<Device[]>;
    register(user: string, input: z.infer<typeof deviceInput>): Promise<Device>;
    remove(user: string, id: string): Promise<void>;
    reminders(limit: number, minutes: number): Promise<number>;
    claim(limit: number): Promise<DeliveryJob[]>;
    target(job: DeliveryJob): Promise<DeliveryTarget | null>;
    finish(job: DeliveryJob, status: 'sent' | 'skipped' | 'failed', error?: string): Promise<void>;
    invalidateDevice(id: string, destination: string): Promise<void>;
}
export interface NotificationTransports {
    push?: {
        send(target: DeliveryTarget): Promise<'sent' | 'invalid' | 'expired'>;
    };
    sms?: {
        sendText(phone: string, text: string): Promise<void>;
    };
    email?: {
        send(message: {
            to: string;
            subject: string;
            text: string;
            html?: string;
        }): Promise<void>;
    };
    whatsapp?: {
        sendText(phone: string, text: string): Promise<void>;
    };
}
