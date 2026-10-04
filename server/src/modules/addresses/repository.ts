import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { insidePolygon } from '../food/pricing.js';
import { addressInputSchema, addressSchema, polygonSchema, type AddressInput, type AddressPatch, type AddressRepository, type SavedAddress, type ServiceCity } from './schema.js';
import type { Point } from '../../lib/geo.js';
const cityColumns = 'id,name,country,is_active,opens_at,closes_at,service_polygon';
function address(row: Record<string, unknown>): SavedAddress {
  return addressSchema.strip().parse({ ...row, landmark: row.landmark ?? '', location: { lat: row.latitude, lng: row.longitude }, created_at: (row.created_at as Date).toISOString(), updated_at: (row.updated_at as Date).toISOString() });
}
export class PostgresAddressRepository implements AddressRepository {
  constructor(private readonly pool: pg.Pool) {}
  private async transaction<T>(work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try { await client.query('BEGIN'); const result = await work(client); await client.query('COMMIT'); return result; }
    catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async active(client: pg.PoolClient, userId: string) {
    if (!(await client.query("SELECT id FROM public.profiles WHERE id=$1 AND status='active' FOR UPDATE", [userId])).rows[0]) throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account cannot access this service.');
  }
  async cities() { return (await this.pool.query<ServiceCity>(`SELECT ${cityColumns} FROM public.cities WHERE is_active ORDER BY name,id`)).rows; }
  async city(id: string) { return (await this.pool.query<ServiceCity>(`SELECT ${cityColumns} FROM public.cities WHERE id=$1`, [id])).rows[0] ?? null; }
  async saveBoundary(actorId: string, cityId: string, polygon: Point[]) {
    return this.transaction(async (client) => {
      if (!(await client.query("SELECT id FROM public.profiles WHERE id=$1 AND status='active' AND role='admin' FOR SHARE", [actorId])).rows[0]) throw new ApiError(403, 'FORBIDDEN', 'Administrator access is required.');
      polygonSchema.parse(polygon);
      const { rows } = await client.query<ServiceCity>(`UPDATE public.cities SET service_polygon=$2 WHERE id=$1 RETURNING ${cityColumns}`, [cityId, JSON.stringify(polygon)]);
      if (!rows[0]) throw new ApiError(404, 'CITY_NOT_FOUND', 'City not found.');
      await client.query("INSERT INTO vendo_internal.catalog_audit (actor_id,action,target_id) VALUES ($1,'city_boundary_updated',$2)", [actorId, cityId]);
      return rows[0];
    });
  }
  async list(userId: string) {
    const { rows } = await this.pool.query("SELECT a.* FROM public.saved_addresses a JOIN public.profiles p ON p.id=a.profile_id WHERE a.profile_id=$1 AND p.status='active' ORDER BY a.is_default DESC,a.created_at DESC,a.id", [userId]);
    return rows.map(address);
  }
  async get(userId: string, id: string) {
    const { rows } = await this.pool.query("SELECT a.* FROM public.saved_addresses a JOIN public.profiles p ON p.id=a.profile_id WHERE a.id=$1 AND a.profile_id=$2 AND p.status='active'", [id, userId]);
    return rows[0] ? address(rows[0]) : null;
  }
  async save(userId: string, input: AddressInput | AddressPatch, id?: string) {
    return this.transaction(async (client) => {
      await this.active(client, userId);
      let merged: AddressInput;
      if (id) {
        const existing = await client.query('SELECT * FROM public.saved_addresses WHERE id=$1 AND profile_id=$2 FOR UPDATE', [id, userId]);
        if (!existing.rows[0]) throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Address not found.');
        const current = address(existing.rows[0]);
        const parsed = addressInputSchema.safeParse({ city_id: current.city_id, label: current.label, address: current.address, location: current.location, landmark: current.landmark, note: current.note, is_default: current.is_default, ...input });
        if (!parsed.success) throw new ApiError(400, 'INVALID_ADDRESS', 'Choose a service city and valid address details.');
        merged = parsed.data;
      } else {
        if ((await client.query<{ count: number }>('SELECT count(*)::int AS count FROM public.saved_addresses WHERE profile_id=$1', [userId])).rows[0]!.count >= 50) throw new ApiError(409, 'ADDRESS_LIMIT_REACHED', 'You can save up to 50 addresses.');
        merged = addressInputSchema.parse(input);
      }
      const city = (await client.query<ServiceCity>(`SELECT ${cityColumns} FROM public.cities WHERE id=$1 AND is_active FOR SHARE`, [merged.city_id])).rows[0];
      if (!city) throw new ApiError(409, 'CITY_UNAVAILABLE', 'Choose an active service city.');
      const boundary = polygonSchema.safeParse(city.service_polygon);
      if (!boundary.success) throw new ApiError(503, 'SERVICE_AREA_NOT_CONFIGURED', 'City service boundaries are not configured.');
      if (!insidePolygon(merged.location, boundary.data)) throw new ApiError(400, 'OUTSIDE_SERVICE_AREA', 'This address is outside the selected city service area.');
      if (merged.is_default) await client.query('UPDATE public.saved_addresses SET is_default=false WHERE profile_id=$1 AND is_default', [userId]);
      const values = [userId, merged.city_id, merged.label, merged.address, merged.location.lat, merged.location.lng, merged.landmark, merged.note, merged.is_default];
      const { rows } = id ? await client.query('UPDATE public.saved_addresses SET city_id=$2,label=$3,address=$4,latitude=$5,longitude=$6,landmark=$7,note=$8,is_default=$9 WHERE profile_id=$1 AND id=$10 RETURNING *', [...values, id])
        : await client.query('INSERT INTO public.saved_addresses (profile_id,city_id,label,address,latitude,longitude,landmark,note,is_default) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', values);
      return address(rows[0]!);
    });
  }
  async delete(userId: string, id: string) {
    await this.transaction(async (client) => {
      await this.active(client, userId);
      if (!(await client.query('DELETE FROM public.saved_addresses WHERE id=$1 AND profile_id=$2 RETURNING id', [id, userId])).rows[0]) throw new ApiError(404, 'ADDRESS_NOT_FOUND', 'Address not found.');
    });
  }
  async preferredCity(userId: string) { return (await this.pool.query<{ city_id: string | null }>("SELECT city_id FROM public.profiles WHERE id=$1 AND status='active'", [userId])).rows[0]?.city_id ?? null; }
  async setCity(userId: string, cityId: string | null) {
    await this.transaction(async (client) => {
      await this.active(client, userId);
      if (cityId && !(await client.query('SELECT id FROM public.cities WHERE id=$1 AND is_active FOR SHARE', [cityId])).rows[0]) throw new ApiError(409, 'CITY_UNAVAILABLE', 'Choose an active service city.');
      await client.query('UPDATE public.profiles SET city_id=$2 WHERE id=$1', [userId, cityId]);
    });
  }
}
