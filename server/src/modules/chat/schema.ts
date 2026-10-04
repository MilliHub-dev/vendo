import { z } from 'zod';
export const cursor = z.string().regex(/^\d{1,18}$/).default('0');
export const messageInput = z.strictObject({ text: z.string().trim().min(1).max(2000).refine(t => !Array.from(t).some(ch => { const n = ch.charCodeAt(0); return n === 127 || (n < 32 && ![9, 10, 13].includes(n)); }), 'Invalid message.') });
export const messageSchema = z.object({ id: z.uuid(), seq: z.string(), sender_id: z.uuid(), rider_id: z.uuid(), text: z.string(), created_at: z.string() });
export type Message = z.infer<typeof messageSchema>;
export const conversationSchema = z.object({ order_id: z.uuid(), can_send: z.boolean(), current_rider_id: z.uuid().nullable(), last_read_seq: z.string(), unread: z.number().int(), messages: z.array(messageSchema) });
export type Conversation = z.infer<typeof conversationSchema>;
export interface ChatRepository {
    list(user: string, order: string, after: string, limit: number): Promise<Conversation>;
    send(user: string, order: string, text: string, key: string): Promise<Message>;
    read(user: string, order: string, seq: string): Promise<void>;
}
