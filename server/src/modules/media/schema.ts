import { z } from 'zod';
export const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const mimeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', docxMime]);
export const uploadSchema = z.strictObject({ purpose: z.enum(['logo', 'image', 'document']), vendor_id: z.uuid().optional(), mime: mimeSchema, data_base64: z.string().min(4).max(2796204) }).refine(v => v.purpose === 'document' ? !v.vendor_id : v.mime.startsWith('image/'), 'Invalid media purpose.');
export type MediaInput = z.infer<typeof uploadSchema>;
export const assetSchema = z.object({ id: z.uuid(), owner_id: z.uuid(), vendor_id: z.uuid().nullable(), purpose: z.enum(['logo', 'image', 'document']), mime: mimeSchema, bytes: z.number().int(), created_at: z.string(), public_url: z.url().nullable() });
export type Asset = z.infer<typeof assetSchema>;
export interface ObjectStorage {
    configured: boolean;
    put(path: string, data: Buffer, mime: string, privateFile: boolean): Promise<void>;
    download(path: string): Promise<Buffer>;
    signed(path: string): Promise<string>;
    publicUrl(path: string): string;
}
export interface MediaRepository {
    upload(user: string, input: MediaInput): Promise<Asset>;
    get(user: string, id: string): Promise<Asset>;
    download(user: string, id: string): Promise<{
        url: string;
        expires_in: number;
    }>;
}
