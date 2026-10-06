import { z } from 'zod';

export const profileSchema = z.object({
  id: z.uuid(), phone: z.string().nullable(), name: z.string().nullable(), email: z.email().nullable(),
  email_verified: z.boolean(), role: z.enum(['customer', 'rider', 'admin', 'vendor_staff']),
  status: z.enum(['active', 'suspended', 'deactivated']),
  onboarding_step: z.enum(['name_required', 'email_required', 'phone_required', 'complete']),
  created_at: z.string(), updated_at: z.string(),
});
export type Profile = z.infer<typeof profileSchema>;

export const nameSchema = z.strictObject({ name: z.string().trim().min(2).max(100).refine((value) => !Array.from(value).some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127), 'Name cannot contain control characters.') });
export const emailSchema = z.strictObject({ email: z.string().trim().toLowerCase().pipe(z.email().max(254)) });

export interface ProfileRepository {
  bootstrap(id: string, phone: string, verifiedEmail?: string): Promise<Profile>;
  setPhone?(id: string, phone: string): Promise<Profile>;
  setName(id: string, name: string): Promise<Profile>;
  setEmail(id: string, email: string): Promise<Profile>;
}
