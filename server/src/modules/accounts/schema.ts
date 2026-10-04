import { z } from 'zod';
import { phoneSchema } from '../auth/schema.js';
import type { Profile } from '../users/schema.js';

export const preferencesSchema = z.object({ theme: z.enum(['system', 'light', 'dark']), push_enabled: z.boolean(), sms_enabled:z.boolean(), reminders_enabled:z.boolean(), email_enabled: z.boolean(), whatsapp_opt_in: z.boolean() });
export const updatePreferencesSchema = preferencesSchema.partial().strict().refine((value) => Object.keys(value).length > 0, 'Provide at least one preference.');
export type Preferences = z.infer<typeof preferencesSchema>;
export const verificationSchema = z.strictObject({ challenge_id: z.uuid(), code: z.string().regex(/^\d{6}$/) });
export const recoverySchema = z.strictObject({ phone: phoneSchema, contact_email: z.string().trim().toLowerCase().pipe(z.email().max(254)), message: z.string().trim().min(10).max(1000) });
export const deletionSchema = z.strictObject({ otp: z.string().regex(/^\d{6}$/), confirmation: z.literal('DELETE'), reason: z.string().trim().max(500).optional() });
export type Verification = { id: string; email: string; hash: string; expiresAt: Date };

export interface AccountRepository {
  issueVerification(profileId: string, verification: Verification): Promise<boolean>;
  discardVerification(profileId: string, challengeId: string): Promise<void>;
  verifyEmail(profileId: string, challengeId: string, hash: string): Promise<Profile | null>;
  getPreferences(profileId: string): Promise<Preferences>;
  updatePreferences(profileId: string, patch: Partial<Preferences>): Promise<Preferences>;
  requestDeletion(profileId: string, reason: string | null): Promise<string>;
  requestRecovery(phone: string, email: string, message: string): Promise<void>;
}
