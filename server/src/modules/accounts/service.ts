import { createHmac, randomInt, randomUUID } from 'node:crypto';
import type { AuthGateway, Identity } from '../auth/schema.js';
import type { ProfileService } from '../users/service.js';
import type { EmailSender } from '../../integrations/brevo.js';
import type { Limits } from '../../integrations/limits.js';
import { phoneKey } from '../../integrations/limits.js';
import { ApiError } from '../../lib/errors.js';
import type { AccountRepository, Preferences } from './schema.js';

export class AccountService {
  constructor(private readonly repository: AccountRepository, private readonly profiles: ProfileService,
    private readonly auth: AuthGateway, private readonly email: EmailSender, private readonly limits: Limits,
    private readonly verificationSecret: string | undefined) {}

  private hash(id: string, userId: string, code: string): string {
    if (!this.verificationSecret) throw new ApiError(503, 'EMAIL_VERIFICATION_NOT_CONFIGURED', 'Email verification is not configured yet.');
    return createHmac('sha256', this.verificationSecret).update(`${id}:${userId}:${code}`).digest('hex');
  }
  async requestEmailVerification(identity: Identity) {
    const profile = await this.profiles.get(identity);
    if (!profile.email) throw new ApiError(409, 'EMAIL_REQUIRED', 'Add your email before verifying it.');
    if (profile.email_verified) throw new ApiError(409, 'EMAIL_ALREADY_VERIFIED', 'Your email is already verified.');
    const id = randomUUID();
    const code = randomInt(0, 1000000).toString().padStart(6, '0');
    const hash = this.hash(id, identity.id, code);
    if (!await this.limits.consume(`vendo:email:cooldown:${identity.id}`, 1, 60)
      || !await this.limits.consume(`vendo:email:send:${identity.id}`, 5, 3600)) throw new ApiError(429, 'EMAIL_RATE_LIMITED', 'Please wait before requesting another email.');
    const expiresAt = new Date(Date.now() + 600000);
    if (!await this.repository.issueVerification(identity.id, { id, email: profile.email, hash, expiresAt })) throw new ApiError(409, 'EMAIL_CHANGED', 'Reload your profile and try again.');
    try { await this.email.send({ to: profile.email, subject: 'Verify your Vendo email', text: `Your Vendo email verification code is ${code}. It expires in 10 minutes. Do not share it with anyone.` }); }
    catch (error) { await this.repository.discardVerification(identity.id, id); throw error; }
    return { challenge_id: id, expires_at: expiresAt.toISOString(), retry_after_seconds: 60 };
  }
  async verifyEmail(identity: Identity, id: string, code: string) {
    await this.profiles.get(identity);
    if (!await this.limits.consume(`vendo:email:verify:${identity.id}`, 20, 300)) throw new ApiError(429, 'EMAIL_RATE_LIMITED', 'Please try again later.');
    const profile = await this.repository.verifyEmail(identity.id, id, this.hash(id, identity.id, code));
    if (!profile) throw new ApiError(400, 'INVALID_VERIFICATION_CODE', 'The code is invalid, expired or already used.');
    return profile;
  }
  async preferences(identity: Identity) { await this.profiles.get(identity); return this.repository.getPreferences(identity.id); }
  async updatePreferences(identity: Identity, patch: Partial<Preferences>) { await this.profiles.get(identity); return this.repository.updatePreferences(identity.id, patch); }
  async requestDeletion(identity: Identity, otp: string, reason: string | undefined) {
    await this.profiles.get(identity);
    if (!await this.limits.consume(phoneKey('verify', identity.phone), 5, 300)) throw new ApiError(429, 'OTP_RATE_LIMITED', 'Please try again later.');
    const proof = await this.auth.verifyOtp(identity.phone, otp);
    try {
      const verified = await this.auth.authenticate(proof.access_token);
      if (verified.id !== identity.id) throw new ApiError(401, 'REAUTHENTICATION_FAILED', 'Verify your account phone to continue.');
      return await this.repository.requestDeletion(identity.id, reason ?? null);
    } finally { await this.auth.logout(proof.access_token).catch(() => {}); }
  }
  async requestRecovery(phone: string, email: string, message: string) {
    if (!await this.limits.consume(phoneKey('recovery', phone), 2, 86400)) throw new ApiError(429, 'RECOVERY_RATE_LIMITED', 'Please try again later.');
    // No account lookup, email sign-in, or automatic phone replacement.
    await this.repository.requestRecovery(phone, email, message);
  }
}
