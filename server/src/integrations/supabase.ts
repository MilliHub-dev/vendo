import { createClient, type Session, type AuthError } from '@supabase/supabase-js';
import { ApiError } from '../lib/errors.js';
import { normalizePhone, type AuthGateway, type AuthSession, type Identity } from '../modules/auth/schema.js';

function providerError(error: AuthError, fallback: string): ApiError {
  if (error.status === 429) return new ApiError(429, 'AUTH_RATE_LIMITED', 'Too many attempts. Please try again later.');
  if (!error.status || error.status >= 500) return new ApiError(503, 'AUTH_UNAVAILABLE', 'Authentication is temporarily unavailable.');
  return new ApiError(401, 'AUTH_FAILED', fallback);
}

function sessionResponse(session: Session | null): AuthSession {
  if (!session) throw new ApiError(401, 'AUTH_FAILED', 'Unable to create a session.');
  return { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, token_type: 'bearer' };
}

/**
 * `direct`: with the service key and our own email sender, the server asks Supabase to generate
 * the sign-in code without emailing it, and sends the code itself. Without it, Supabase's own
 * mail service sends the email (rate-limited, and unreliable without custom SMTP).
 */
export type DirectEmail = { serviceRoleKey: string; send(email: string, code: string): Promise<void> };

export function createSupabaseAuth(url: string, publicKey: string, direct?: DirectEmail): AuthGateway {
  // Privileged client: used only to generate sign-in codes. Never used to act as a customer.
  const admin = () => createClient(url, direct!.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  /** A one-time code for this address, created by Supabase but not emailed. New addresses get an (unconfirmed) account first. */
  const generateCode = async (email: string): Promise<string> => {
    let result = await admin().auth.admin.generateLink({ type: 'magiclink', email });
    if (result.error && result.error.status !== undefined && result.error.status < 500 && result.error.status !== 429) {
      const created = await admin().auth.admin.createUser({ email, email_confirm: false });
      if (created.error && created.error.status !== 422) throw providerError(created.error, 'Unable to request a verification code.');
      result = await admin().auth.admin.generateLink({ type: 'magiclink', email });
    }
    if (result.error) throw providerError(result.error, 'Unable to request a verification code.');
    const code = result.data.properties?.email_otp;
    // the apps and the verify endpoint use six digits; any other length is a Supabase setting to correct
    if (!code || !/^\d{6}$/.test(code)) throw new ApiError(503, 'AUTH_MISCONFIGURED', 'Email sign-in is not configured correctly.');
    return code;
  };
  // Auth operations mutate SDK session state. A fresh client per operation prevents
  // one API request from inheriting another customer's session.
  const client = () => createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  return {
    async requestEmailOtp(email) {
      if (direct) return direct.send(email, await generateCode(email));
      const { error } = await client().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw providerError(error, 'Unable to request a verification code.');
    },
    async verifyEmailOtp(email, token) {
      const { data, error } = await client().auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw providerError(error, 'The verification code is invalid or expired.');
      return sessionResponse(data.session);
    },
    async requestOtp(phone) {
      const { error } = await client().auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
      if (error) throw providerError(error, 'Unable to request a verification code.');
    },
    async verifyOtp(phone, token) {
      const { data, error } = await client().auth.verifyOtp({ phone, token, type: 'sms' });
      if (error) throw providerError(error, 'The verification code is invalid or expired.');
      return sessionResponse(data.session);
    },
    async refresh(refreshToken) {
      const { data, error } = await client().auth.refreshSession({ refresh_token: refreshToken });
      if (error) throw providerError(error, 'Your session has expired. Sign in again.');
      return sessionResponse(data.session);
    },
    async authenticate(accessToken): Promise<Identity> {
      const { data, error } = await client().auth.getUser(accessToken);
      if (error) throw providerError(error, 'Your session is invalid or expired.');
      if (data.user?.email && data.user.email_confirmed_at && !data.user.is_anonymous) {
        return { id: data.user.id, phone: data.user.phone_confirmed_at && data.user.phone ? normalizePhone(data.user.phone) : '', email: data.user.email.toLowerCase() };
      }
      if (!data.user?.phone || !data.user.phone_confirmed_at || data.user.is_anonymous) {
        throw new ApiError(401, 'PHONE_NOT_VERIFIED', 'Verify your phone number to continue.');
      }
      try { return { id: data.user.id, phone: normalizePhone(data.user.phone) }; }
      catch { throw new ApiError(403, 'UNSUPPORTED_PHONE', 'This phone number is outside the supported region.'); }
    },
    async logout(accessToken, scope = 'local') {
      const { error } = await client().auth.admin.signOut(accessToken, scope);
      if (error) throw providerError(error, 'Unable to end the session.');
    },
  };
}
