import { timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import type { Profile } from '../users/schema.js';
import type { AccountRepository, Preferences, Verification } from './schema.js';

export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly pool: pg.Pool) {}

  async issueVerification(profileId: string, verification: Verification): Promise<boolean> {
    const result = await this.pool.query(`INSERT INTO vendo_internal.email_verifications (profile_id, id, email, code_hash, expires_at)
      SELECT id, $2, $3, $4, $5 FROM public.profiles WHERE id = $1 AND email = $3 AND status = 'active' AND NOT email_verified
      ON CONFLICT (profile_id) DO UPDATE SET id = EXCLUDED.id, email = EXCLUDED.email, code_hash = EXCLUDED.code_hash,
      expires_at = EXCLUDED.expires_at, attempts = 0, consumed_at = NULL, created_at = now() RETURNING id`,
    [profileId, verification.id, verification.email, verification.hash, verification.expiresAt]);
    return result.rows.length === 1;
  }
  async discardVerification(profileId: string, challengeId: string): Promise<void> {
    await this.pool.query('DELETE FROM vendo_internal.email_verifications WHERE profile_id = $1 AND id = $2', [profileId, challengeId]);
  }
  async verifyEmail(profileId: string, challengeId: string, hash: string): Promise<Profile | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const profile = await client.query<Profile>('SELECT * FROM public.profiles WHERE id = $1 AND status = \'active\' FOR UPDATE', [profileId]);
      const challenge = await client.query<{ code_hash: string; email: string }>(`SELECT code_hash, email FROM vendo_internal.email_verifications
        WHERE profile_id = $1 AND id = $2 AND consumed_at IS NULL AND attempts < 5 AND expires_at > now() FOR UPDATE`, [profileId, challengeId]);
      const row = challenge.rows[0];
      if (!row || !profile.rows[0] || row.email !== profile.rows[0].email) {
        await client.query('COMMIT'); return null;
      }
      await client.query('UPDATE vendo_internal.email_verifications SET attempts = attempts + 1 WHERE profile_id = $1', [profileId]);
      if (!timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(hash, 'hex'))) {
        await client.query('COMMIT'); return null;
      }
      await client.query('UPDATE vendo_internal.email_verifications SET consumed_at = now() WHERE profile_id = $1', [profileId]);
      const updated = await client.query<Profile & { created_at: Date; updated_at: Date }>('UPDATE public.profiles SET email_verified = true WHERE id = $1 RETURNING *', [profileId]);
      await client.query('COMMIT');
      const saved = updated.rows[0]!;
      return { ...saved, created_at: saved.created_at.toISOString(), updated_at: saved.updated_at.toISOString() };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  async getPreferences(profileId: string): Promise<Preferences> {
    await this.pool.query('INSERT INTO public.account_preferences (profile_id) VALUES ($1) ON CONFLICT DO NOTHING', [profileId]);
    const { rows } = await this.pool.query<Preferences>('SELECT theme, push_enabled, email_enabled, whatsapp_opt_in, sms_enabled, reminders_enabled FROM public.account_preferences WHERE profile_id = $1', [profileId]);
    return rows[0]!;
  }
  async updatePreferences(profileId: string, patch: Partial<Preferences>): Promise<Preferences> {
    await this.getPreferences(profileId);
    const { rows } = await this.pool.query<Preferences>(`UPDATE public.account_preferences SET theme = COALESCE($2, theme),
      push_enabled = COALESCE($3, push_enabled), email_enabled = COALESCE($4, email_enabled), whatsapp_opt_in = COALESCE($5, whatsapp_opt_in), sms_enabled=COALESCE($6,sms_enabled), reminders_enabled=COALESCE($7,reminders_enabled)
      WHERE profile_id = $1 AND EXISTS (SELECT 1 FROM public.profiles WHERE id = $1 AND status = 'active')
      RETURNING theme, push_enabled, email_enabled, whatsapp_opt_in, sms_enabled, reminders_enabled`, [profileId, patch.theme ?? null, patch.push_enabled ?? null, patch.email_enabled ?? null, patch.whatsapp_opt_in ?? null, patch.sms_enabled??null, patch.reminders_enabled??null]);
    if (!rows[0]) throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account cannot access this service.');
    return rows[0];
  }
  async requestDeletion(profileId: string, reason: string | null): Promise<string> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialize account deactivation so two remaining store staff cannot both leave.
      await client.query('SELECT pg_advisory_xact_lock(76341004)');
      const profile = await client.query("SELECT id FROM public.profiles WHERE id=$1 AND status='active' FOR UPDATE", [profileId]);
      if (!profile.rows[0]) throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account cannot access this service.');
      const outstanding = await client.query("SELECT id FROM public.orders WHERE (customer_id=$1 OR assigned_rider_id=$1) AND (status NOT IN ('delivered','cancelled') OR refund_status='pending') LIMIT 1", [profileId]);
      if (outstanding.rows[0]) throw new ApiError(409, 'ACCOUNT_HAS_ACTIVE_ORDERS', 'Resolve active orders and pending refunds before deleting this account.');
      const money = await client.query(`SELECT customer_id FROM public.wallets WHERE customer_id=$1 AND balance_kobo>0
        UNION ALL SELECT customer_id FROM vendo_internal.payment_intents WHERE customer_id=$1 AND status<>'succeeded' LIMIT 1`, [profileId]);
      if (money.rows[0]) throw new ApiError(409, 'ACCOUNT_HAS_UNSETTLED_PAYMENTS', 'Resolve your wallet balance and unsettled payments with support before deleting this account.');
      if((await client.query("SELECT id FROM vendo_internal.referrals WHERE (referrer_id=$1 OR referee_id=$1) AND status='pending' LIMIT 1",[profileId])).rows[0])throw new ApiError(409,'ACCOUNT_HAS_PENDING_REFERRALS','Resolve pending referral rewards with support before deleting this account.');
      if ((await client.query(`SELECT id FROM vendo_internal.earnings_accounts WHERE kind='rider' AND entity_id=$1 AND (available_kobo>0 OR held_kobo>0)
        UNION ALL SELECT id FROM vendo_internal.withdrawals WHERE requested_by=$1 AND status IN('requested','approved','submitting','pending','review') LIMIT 1`,[profileId])).rows[0]) throw new ApiError(409,'ACCOUNT_HAS_UNSETTLED_EARNINGS','Resolve earnings and pending withdrawals before deleting this account.');
      if ((await client.query(`SELECT id FROM public.orders o WHERE assigned_rider_id=$1 AND status='delivered' AND payment_status='paid' AND refund_status='none' AND NOT EXISTS(SELECT 1 FROM vendo_internal.settlements WHERE order_id=o.id) LIMIT 1`,[profileId])).rows[0]) throw new ApiError(409,'ACCOUNT_HAS_PENDING_SETTLEMENT','Resolve pending delivery settlement before deleting this account.');
      if ((await client.query("SELECT id FROM vendo_internal.vendor_applications WHERE profile_id=$1 AND status='pending' LIMIT 1",[profileId])).rows[0]) throw new ApiError(409,'ACCOUNT_HAS_PENDING_VENDOR_APPLICATION','Withdraw or resolve your vendor application before deleting this account.');
      if ((await client.query(`SELECT s.vendor_id FROM vendo_internal.vendor_staff s WHERE s.profile_id=$1 AND NOT EXISTS(SELECT 1 FROM vendo_internal.vendor_staff other JOIN public.profiles p ON p.id=other.profile_id WHERE other.vendor_id=s.vendor_id AND other.profile_id<>$1 AND p.role='vendor_staff' AND p.status='active') AND (EXISTS(SELECT 1 FROM public.vendors v WHERE v.id=s.vendor_id AND v.is_active) OR EXISTS(SELECT 1 FROM public.orders o WHERE o.vendor_id=s.vendor_id AND (o.status NOT IN('delivered','cancelled') OR o.refund_status='pending')) OR EXISTS(SELECT 1 FROM vendo_internal.earnings_accounts a WHERE a.kind='vendor' AND a.entity_id=s.vendor_id AND (a.available_kobo>0 OR a.held_kobo>0))) LIMIT 1`,[profileId])).rows[0]) throw new ApiError(409,'VENDOR_STORE_REQUIRES_HANDOVER','Arrange store handover with operations before deleting the last active vendor account.');
      await client.query("UPDATE public.profiles SET status='deactivated' WHERE id=$1", [profileId]);
      const { rows } = await client.query<{ id: string }>(`INSERT INTO vendo_internal.account_deletion_requests (profile_id,reason)
        VALUES ($1,$2) ON CONFLICT (profile_id) DO UPDATE SET profile_id=EXCLUDED.profile_id RETURNING id`, [profileId, reason]);
      await client.query('COMMIT');
      return rows[0]!.id;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async requestRecovery(phone: string, email: string, message: string): Promise<void> {
    await this.pool.query('INSERT INTO vendo_internal.account_recovery_requests (phone, contact_email, message) VALUES ($1, $2, $3)', [phone, email, message]);
  }
}
