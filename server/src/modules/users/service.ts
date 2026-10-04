import { ApiError } from '../../lib/errors.js';
import type { Identity } from '../auth/schema.js';
import type { Profile, ProfileRepository } from './schema.js';

export function assertActive(profile: Profile): void {
  if (profile.status !== 'active') throw new ApiError(403, 'ACCOUNT_INACTIVE', 'This account cannot access this service.');
}

export function requireCompleteProfile(profile: Profile): void {
  assertActive(profile);
  if (profile.onboarding_step !== 'complete') throw new ApiError(403, 'ONBOARDING_REQUIRED', 'Complete your name and email before continuing.');
}

export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  async get(identity: Identity): Promise<Profile> {
    const profile = await this.repository.bootstrap(identity.id, identity.phone);
    assertActive(profile);
    return profile;
  }

  async addName(identity: Identity, name: string): Promise<Profile> {
    await this.get(identity);
    return this.repository.setName(identity.id, name);
  }

  async addEmail(identity: Identity, email: string): Promise<Profile> {
    const profile = await this.get(identity);
    if (!profile.name) throw new ApiError(409, 'NAME_REQUIRED', 'Add your name before adding your email.');
    return this.repository.setEmail(identity.id, email);
  }
}
