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

export function createSupabaseAuth(url: string, publicKey: string): AuthGateway {
  // Auth operations mutate SDK session state. A fresh client per operation prevents
  // one API request from inheriting another customer's session.
  const client = () => createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
  return {
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
