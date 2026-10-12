/**
 * Creates the account that the review sign-in opens (TEST_LOGIN_EMAIL / TEST_LOGIN_CODE), for
 * app-store reviewers. One account serves both apps: it can order in the Vendo app and is an
 * approved rider in Vendo Rider, so it lands on the home screen in each.
 *
 *   npm run db:review-account                          shows what would be done, changes nothing
 *   npm run db:review-account -- --apply               creates or repairs the account
 *
 * The address comes from TEST_LOGIN_EMAIL (default review@vendoltd.com). Safe to run again.
 */
import { createClient } from '@supabase/supabase-js';
import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/integrations/database.js';

const NAME = 'Vendo Reviewer', PHONE = '+2348123445566';

async function main() {
  const apply = process.argv.includes('--apply');
  const env = readEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  const email = (env.TEST_LOGIN_EMAIL ?? 'review@vendoltd.com').trim().toLowerCase();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const pool = createPool(env);
  // run from a laptop, where opening the connection can take longer than the server allows itself
  (pool as unknown as { options: { connectionTimeoutMillis: number } }).options.connectionTimeoutMillis = 45000;
  try {
    const city = (await pool.query<{ id: string; name: string }>("SELECT id, name FROM public.cities WHERE is_active ORDER BY (name = 'Abuja') DESC, name LIMIT 1")).rows[0];
    if (!city) throw new Error('No active city to place the review account in.');
    const existing = (await pool.query<{ id: string; role: string; onboarding_step: string }>('SELECT id, role, onboarding_step FROM public.profiles WHERE email = $1', [email])).rows[0];
    console.info(`${email} — ${existing ? `exists (${existing.role}, ${existing.onboarding_step})` : 'missing'}${apply ? ', setting up' : ''}`);
    if (!apply) return console.info('Nothing was changed. Run again with --apply to create it.');
    // the sign-in account, with the address already confirmed so no email is ever needed
    let id = existing?.id;
    if (!id) {
      const created = await supabase.auth.admin.createUser({ email, email_confirm: true });
      id = created.data.user?.id;
      // already in Supabase Auth from an earlier run that stopped half-way
      for (let page = 1; !id && page <= 20; page++) {
        const list = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (list.error) throw new Error(`Supabase: ${list.error.message}`);
        id = list.data.users.find((u) => u.email?.toLowerCase() === email)?.id;
        if (list.data.users.length < 200) break;
      }
      if (!id) throw new Error(`Could not create ${email}: ${created.error?.message ?? 'unknown error'}`);
    }
    await supabase.auth.admin.updateUserById(id, { email_confirm: true });
    await pool.query(
      `INSERT INTO public.profiles (id, email, email_verified, name, phone, city_id) VALUES ($1, $2, true, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, email_verified = true, name = EXCLUDED.name, phone = EXCLUDED.phone, city_id = EXCLUDED.city_id, status = 'active'`,
      [id, email, NAME, PHONE, city.id],
    );
    await pool.query(
      `INSERT INTO vendo_internal.riders (profile_id, city_id, vehicle_type, plate_number, approval, approval_note) VALUES ($1, $2, 'motorcycle', 'TEST 001', 'approved', 'Review account for the app stores')
       ON CONFLICT (profile_id) DO UPDATE SET approval = 'approved', approval_note = EXCLUDED.approval_note, updated_at = now()`,
      [id, city.id],
    );
    await pool.query("UPDATE public.profiles SET role = 'rider' WHERE id = $1", [id]);
    console.info(`Done. ${email} is ready in ${city.name}: a customer in the Vendo app and an approved rider in Vendo Rider.`);
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  console.error(`Failed: ${error instanceof Error ? error.message.slice(0, 200) : 'unknown error'}`);
  process.exitCode = 1;
});
