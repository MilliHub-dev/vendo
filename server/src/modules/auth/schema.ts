import { z } from 'zod';

export function normalizePhone(input: string): string {
  const compact = input.replace(/[\s()-]/g, '');
  const international = compact.startsWith('0') ? `+234${compact.slice(1)}`
    : compact.startsWith('234') ? `+${compact}` : compact;
  if (!/^\+234[789]\d{9}$/.test(international)) {
    throw new Error('Enter a valid Nigerian mobile phone number.');
  }
  return international;
}

export const phoneSchema = z.string().min(1).max(32).transform((value, ctx) => {
  try { return normalizePhone(value); }
  catch { ctx.addIssue({ code: 'custom', message: 'Enter a valid Nigerian mobile phone number.' }); return z.NEVER; }
});
export const requestOtpSchema = z.strictObject({ phone: phoneSchema });
export const verifyOtpSchema = z.strictObject({ phone: phoneSchema, token: z.string().regex(/^\d{6}$/) });
export const refreshSchema = z.strictObject({ refresh_token: z.string().min(1).max(4096) });
export const sessionSchema = z.object({
  access_token: z.string(), refresh_token: z.string(), expires_in: z.number().int(), token_type: z.literal('bearer'),
});
export type AuthSession = z.infer<typeof sessionSchema>;
export type Identity = { id: string; phone: string };

export interface AuthGateway {
  requestOtp(phone: string): Promise<void>;
  verifyOtp(phone: string, token: string): Promise<AuthSession>;
  refresh(refreshToken: string): Promise<AuthSession>;
  authenticate(accessToken: string): Promise<Identity>;
  logout(accessToken: string, scope?: 'local' | 'global'): Promise<void>;
}
