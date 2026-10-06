/**
 * Seeds test vendors, menus and photos so the apps have something to show.
 *
 *   npm run db:seed                      vendors, products and photos (safe to re-run; it updates in place)
 *   npm run db:seed -- --activate-cities also switches the four cities on with TEST service areas and fares
 *   npm run db:seed -- --remove          takes the seeded vendors, products and photos out again
 *
 * Seeded rows have fixed IDs derived from their names, so re-running never duplicates
 * and --remove only touches what this script created.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/integrations/database.js';
import { cities, products, vendors } from './seed/catalog.js';

const BUCKET = 'vendo-public';
const FOLDER = 'seed';
const args = new Set(process.argv.slice(2));

/** Stable UUID from a name, so the same vendor or product always gets the same ID. */
function seedId(name: string): string {
  const h = createHash('sha1').update(`vendo-seed:${name}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
/** Deterministic 0–1 number from a name, used to scatter vendors inside a city. */
const spread = (name: string) => createHash('sha1').update(name).digest().readUInt32BE(0) / 0xffffffff;
const slug = (s: string) => s.toLowerCase();

async function main() {
  const env = readEnv();
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: the photos are stored in Supabase Storage.');
  const storage = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }).storage;
  const pool = createPool(env);
  const imageKeys = [...new Set(vendors.flatMap((v) => [v.cover, ...v.menu]))];
  const vendorIds = Object.keys(cities).flatMap((city) => vendors.map((v) => seedId(`vendor:${slug(city)}:${v.key}`)));
  console.info(`Database: ${new URL(env.DATABASE_URL!).host} · Storage: ${new URL(env.SUPABASE_URL).host}`);

  try {
    if (args.has('--remove')) {
      const inUse = await pool.query<{ n: number }>('SELECT count(*)::int AS n FROM public.orders WHERE vendor_id = ANY($1)', [vendorIds]);
      if (inUse.rows[0]!.n > 0) {
        // orders keep a reference to their vendor, so hide the stores rather than break order history
        await pool.query('UPDATE public.vendors SET is_active = false, is_open = false WHERE id = ANY($1)', [vendorIds]);
        console.info(`${inUse.rows[0]!.n} orders were placed with seeded vendors, so they were switched off instead of deleted.`);
        return;
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const items = await client.query('DELETE FROM public.menu_items WHERE vendor_id = ANY($1)', [vendorIds]);
        const stores = await client.query('DELETE FROM public.vendors WHERE id = ANY($1)', [vendorIds]);
        await client.query('COMMIT');
        console.info(`Removed ${stores.rowCount} vendors and ${items.rowCount} products.`);
      } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
      const { error } = await storage.from(BUCKET).remove(imageKeys.map((k) => `${FOLDER}/${k}.jpg`));
      console.info(error ? 'Photos could not be removed from Storage; delete the seed/ folder by hand.' : 'Removed the seeded photos.');
      console.info('Cities were left as they are.');
      return;
    }

    // ---- photos ----
    const bucket = await storage.getBucket(BUCKET);
    if (!bucket.data) {
      const created = await storage.createBucket(BUCKET, { public: true, fileSizeLimit: 2097152, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
      if (created.error) throw new Error(`Could not create the ${BUCKET} bucket: ${created.error.message}`);
      console.info(`Created the public ${BUCKET} bucket.`);
    } else if (!bucket.data.public) throw new Error(`The ${BUCKET} bucket exists but is private.`);
    const url: Record<string, string> = {};
    for (const key of imageKeys) {
      const path = `${FOLDER}/${key}.jpg`;
      const file = await readFile(new URL(`./seed/images/${key}.jpg`, import.meta.url));
      const { error } = await storage.from(BUCKET).upload(path, file, { contentType: 'image/jpeg', upsert: true, cacheControl: '86400' });
      if (error) throw new Error(`Upload failed for ${key}: ${error.message}`);
      url[key] = storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    }
    console.info(`Uploaded ${imageKeys.length} photos.`);

    // ---- cities ----
    const cityRows = (await pool.query<{ id: string; name: string; is_active: boolean; has_area: boolean }>('SELECT id, name, is_active, service_polygon IS NOT NULL AS has_area FROM public.cities')).rows;
    if (args.has('--activate-cities')) {
      for (const row of cityRows) {
        const c = cities[row.name];
        if (!c) continue;
        const polygon = [{ lat: c.south, lng: c.west }, { lat: c.south, lng: c.east }, { lat: c.north, lng: c.east }, { lat: c.north, lng: c.west }];
        // only fills what is empty: an area or fare someone has already set is never overwritten
        await pool.query(`UPDATE public.cities SET is_active = true, service_polygon = COALESCE(service_polygon, $2::jsonb),
          base_fare_kobo = COALESCE(base_fare_kobo, 50000), per_km_rate_kobo = COALESCE(per_km_rate_kobo, 15000) WHERE id = $1`, [row.id, JSON.stringify(polygon)]);
      }
      console.info('Cities switched on with TEST service areas and fares (₦500 base, ₦150 per km). Set the real ones before launch.');
    }

    // ---- vendors and products ----
    const client = await pool.connect();
    let stores = 0, items = 0;
    try {
      await client.query('BEGIN');
      for (const row of cityRows) {
        const c = cities[row.name];
        if (!c) continue;
        for (const [index, v] of vendors.entries()) {
          const id = seedId(`vendor:${slug(row.name)}:${v.key}`);
          // keep 20% clear of the edges so every vendor is well inside the service area
          const lat = c.south + (c.north - c.south) * (0.2 + 0.6 * spread(`${id}:lat`));
          const lng = c.west + (c.east - c.west) * (0.2 + 0.6 * spread(`${id}:lng`));
          const address = `${3 + Math.floor(spread(`${id}:no`) * 90)} ${c.streets[index % c.streets.length]}, ${row.name}`;
          await client.query(`INSERT INTO public.vendors (id, name, category, cuisine, description, city_id, address, latitude, longitude, is_open, is_active, image_url, prep_minutes, rating)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,true,$10,$11,$12)
            ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category, cuisine=EXCLUDED.cuisine, description=EXCLUDED.description, address=EXCLUDED.address,
              latitude=EXCLUDED.latitude, longitude=EXCLUDED.longitude, is_active=true, image_url=EXCLUDED.image_url, prep_minutes=EXCLUDED.prep_minutes, rating=EXCLUDED.rating`,
            [id, v.name, v.category, v.cuisine, v.description, row.id, address, lat, lng, url[v.cover], v.prepMinutes, v.rating]);
          stores++;
          for (const key of v.menu) {
            const p = products[key]!;
            const itemId = seedId(`item:${id}:${key}`);
            const groups = p.options ? [{ id: seedId(`group:${itemId}`), name: p.options.name, min: p.options.min, max: p.options.max,
              options: p.options.choices.map(([name, naira]) => ({ id: seedId(`option:${itemId}:${name}`), name, price_kobo: naira * 100 })) }] : [];
            await client.query(`INSERT INTO public.menu_items (id, vendor_id, name, description, price_kobo, category, is_available, image_url, option_groups)
              VALUES ($1,$2,$3,$4,$5,$6,true,$7,$8)
              ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, price_kobo=EXCLUDED.price_kobo, category=EXCLUDED.category, image_url=EXCLUDED.image_url, option_groups=EXCLUDED.option_groups`,
              [itemId, id, p.name, p.description, p.naira * 100, p.section, url[key], JSON.stringify(groups)]);
            items++;
          }
        }
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    console.info(`Seeded ${stores} vendors and ${items} products across ${cityRows.filter((r) => cities[r.name]).length} cities.`);
    const off = (await pool.query<{ name: string }>('SELECT name FROM public.cities WHERE NOT is_active OR service_polygon IS NULL ORDER BY name')).rows.map((r) => r.name);
    if (off.length) console.info(`Not visible to customers yet in: ${off.join(', ')} (city is off or has no service area). Run again with --activate-cities to switch them on for testing.`);
  } finally { await pool.end(); }
}

main().catch((error: unknown) => {
  // database errors can carry the connection string, so only print messages this script wrote itself
  const safe = error instanceof Error && /^(Set SUPABASE|Could not create|The vendo-public|Upload failed|Invalid configuration)/.test(error.message);
  console.error(safe ? (error as Error).message : `Seeding failed${error instanceof Error && 'code' in error ? ` (${String(error.code)})` : ''}. Nothing was half-saved in the database.`);
  process.exitCode = 1;
});
