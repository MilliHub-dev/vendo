import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import type { Profile, ProfileRepository } from './schema.js';

type ProfileRow = Omit<Profile, 'created_at' | 'updated_at'> & { created_at: Date; updated_at: Date };
const columns = 'id, phone, name, email, email_verified, role, status, onboarding_step, created_at, updated_at';
function result(row: ProfileRow | undefined): Profile {
  if (!row) throw new ApiError(409, 'PROFILE_CONFLICT', 'The profile could not be updated.');
  return { ...row, created_at: row.created_at.toISOString(), updated_at: row.updated_at.toISOString() };
}

export class PostgresProfileRepository implements ProfileRepository {
  constructor(private readonly pool: pg.Pool) {}

  async bootstrap(id: string, phone: string): Promise<Profile> {
    try {
      // DO UPDATE returns the existing row atomically even on concurrent bootstrap.
      // Never derive a role, name or email from client-controlled auth metadata.
      const { rows } = await this.pool.query<ProfileRow>(
        `INSERT INTO public.profiles (id, phone) VALUES ($1, $2)
         ON CONFLICT (id) DO UPDATE SET phone = EXCLUDED.phone
         RETURNING ${columns}`, [id, phone],
      );
      return result(rows[0]);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === '23505') {
        throw new ApiError(409, 'PHONE_CONFLICT', 'Contact support to resolve this account.');
      }
      throw error;
    }
  }

  async setName(id: string, name: string): Promise<Profile> {
    const { rows } = await this.pool.query<ProfileRow>(
      `UPDATE public.profiles SET name = $2 WHERE id = $1 AND status = 'active' RETURNING ${columns}`, [id, name],
    );
    return result(rows[0]);
  }

  async setEmail(id: string, email: string): Promise<Profile> {
    const { rows } = await this.pool.query<ProfileRow>(
      `UPDATE public.profiles SET email_verified = CASE WHEN email = $2 THEN email_verified ELSE false END,
       email = $2 WHERE id = $1 AND status = 'active' AND name IS NOT NULL RETURNING ${columns}`, [id, email],
    );
    return result(rows[0]);
  }
}
