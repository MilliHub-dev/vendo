import type { Place } from '@/api/types';

/**
 * Address search with Photon (OpenStreetMap data).
 * Development uses the public demo server; before launch this must go through our own
 * API to a hosted Photon (see plan.md section 7) — set EXPO_PUBLIC_PHOTON_URL then.
 */
const PHOTON = process.env.EXPO_PUBLIC_PHOTON_URL ?? 'https://photon.komoot.io';
const NIGERIA_BBOX = '2.6,4.2,14.7,13.9';

type Feature = { geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> };

function describe(p: Feature['properties']): string {
  const first = p.name ?? [p.housenumber, p.street].filter(Boolean).join(' ');
  const rest = [p.name ? p.street : undefined, p.district ?? p.locality, p.city ?? p.county, p.state];
  return [first, ...rest].filter((part, i, all) => part && all.indexOf(part) === i).join(', ');
}

export async function searchPlaces(query: string, near?: { lat: number; lng: number }, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ q, limit: '7', lang: 'en', bbox: NIGERIA_BBOX });
  if (near) {
    params.set('lat', String(near.lat));
    params.set('lon', String(near.lng));
  }
  const res = await fetch(`${PHOTON}/api/?${params}`, { signal });
  if (!res.ok) throw new Error('Address search is unavailable right now');
  const json = (await res.json()) as { features: Feature[] };
  return json.features
    .map((f) => ({ address: describe(f.properties), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }))
    .filter((p) => p.address);
}

/** Normalise what people type (0803…, 234803…, +234803…) to +234XXXXXXXXXX, or null if invalid. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('234') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[789]\d{9}$/.test(local) ? `+234${local}` : null;
}
