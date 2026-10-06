/**
 * Gives every city TEST rider-matching and rider-pay rules, so riders can go online and be
 * paid while the real rules are being decided. It only fills what is missing: a policy someone
 * has already set is never overwritten.
 *
 *   npm run db:test-policies            shows what would be added, changes nothing
 *   npm run db:test-policies -- --apply adds the missing policies
 *
 * These numbers are placeholders, not business decisions. Replace them from the admin
 * dashboard (or the admin API) before launch.
 */
import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/integrations/database.js';
import { financePolicy } from '../src/modules/finance/schema.js';
import { matchingPolicySchema } from '../src/modules/matching/schema.js';

// Offer the nearest rider first (within 2 km), widen by 1 km every 30 s up to 8 km; a rider has 30 s to answer;
// give up after 5 minutes. A rider's position must be under 2 minutes old and accurate to 100 m.
const matching = matchingPolicySchema.parse({ initial_radius_m: 2000, max_radius_m: 8000, radius_step_m: 1000, expansion_seconds: 30, offer_seconds: 30, search_seconds: 300, location_max_age_seconds: 120, max_accuracy_m: 100 });
// Vendo keeps 15% of food sales; the rider gets 80% of the delivery fee; earnings are held for 1 hour; minimum withdrawal ₦1,000.
const finance = financePolicy.parse({ enabled: true, vendor_commission_bps: 1500, rider_delivery_bps: 8000, rider_fixed_kobo: 0, settlement_hold_hours: 1, minimum_withdrawal_kobo: 100_000 });

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = createPool(readEnv());
  try {
    const cities = (await pool.query<{ id: string; name: string; has_matching: boolean; has_finance: boolean }>(`SELECT c.id, c.name,
      EXISTS (SELECT 1 FROM vendo_internal.matching_policies m WHERE m.city_id = c.id) AS has_matching,
      EXISTS (SELECT 1 FROM vendo_internal.finance_policies f WHERE f.city_id = c.id) AS has_finance FROM public.cities c ORDER BY c.name`)).rows;
    const keys = Object.keys(matching) as (keyof typeof matching)[];
    for (const city of cities) {
      const missing = [!city.has_matching && 'rider matching', !city.has_finance && 'rider pay'].filter(Boolean);
      console.info(`${city.name}: ${missing.length ? `${apply ? 'adding' : 'would add'} TEST ${missing.join(' and ')} rules` : 'already configured, left alone'}`);
      if (!apply) continue;
      if (!city.has_matching) await pool.query(`INSERT INTO vendo_internal.matching_policies(city_id,${keys.join(',')}) VALUES($1,${keys.map((_, i) => `$${i + 2}`).join(',')}) ON CONFLICT (city_id) DO NOTHING`, [city.id, ...keys.map((k) => matching[k])]);
      if (!city.has_finance) await pool.query('INSERT INTO vendo_internal.finance_policies(city_id, enabled, config) SELECT $1, true, $2::jsonb WHERE NOT EXISTS (SELECT 1 FROM vendo_internal.finance_policies WHERE city_id = $1)', [city.id, JSON.stringify(finance)]);
    }
    console.info(apply ? 'Done. These are test values: set the real ones before launch.' : 'Nothing was changed. Run again with --apply to add them.');
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  console.error(`Failed${error instanceof Error && 'code' in error ? ` (${String(error.code)})` : ''}. Check the database connection.`);
  process.exitCode = 1;
});
