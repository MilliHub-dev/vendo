import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import type { Place, PlaceAutocomplete } from '../modules/addresses/schema.js';

const BASE = 'https://places.googleapis.com/v1';
const suggestionsSchema = z.object({ suggestions: z.array(z.object({ placePrediction: z.object({ placeId: z.string().max(500), text: z.object({ text: z.string() }), structuredFormat: z.object({ mainText: z.object({ text: z.string() }), secondaryText: z.object({ text: z.string() }).optional() }).optional() }).optional() })).max(20).optional() });
const placeSchema = z.object({ id: z.string(), displayName: z.object({ text: z.string() }).optional(), formattedAddress: z.string().optional(), location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }) });

/**
 * Address search on Google Places (New): suggestions while the customer types, then the chosen place's
 * position. Both calls carry the same session token, so Google bills them as one search session.
 * The key stays on the server; the apps never see it.
 */
export function createGooglePlaces(key: string): PlaceAutocomplete {
  const call = async (url: string, init: RequestInit, fieldMask: string) => {
    try {
      const response = await fetch(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(8000), headers: { 'content-type': 'application/json', 'x-goog-api-key': key, 'x-goog-fieldmask': fieldMask } });
      if (!response.ok) throw new Error(`Google Places answered HTTP ${response.status}`);
      return await response.json() as unknown;
    } catch (error) {
      // the reason only, never what was typed
      console.error(`Google Places failed: ${error instanceof Error ? `${error.name}: ${error.message}`.slice(0, 200) : 'unknown'}`);
      throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Address lookup is temporarily unavailable.');
    }
  };
  return {
    async suggest({ q, bias, bbox, session }) {
      const body = {
        input: q, sessionToken: session, languageCode: 'en', includedRegionCodes: ['ng'],
        origin: { latitude: bias.lat, longitude: bias.lng },
        // only places inside the city's delivery area
        locationRestriction: { rectangle: { low: { latitude: bbox[1], longitude: bbox[0] }, high: { latitude: bbox[3], longitude: bbox[2] } } },
      };
      const data = suggestionsSchema.safeParse(await call(`${BASE}/places:autocomplete`, { method: 'POST', body: JSON.stringify(body) }, 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat'));
      if (!data.success) throw new ApiError(503, 'GEOCODING_UNAVAILABLE', 'Address lookup is temporarily unavailable.');
      return (data.data.suggestions ?? []).flatMap((s) => {
        const p = s.placePrediction; if (!p) return [];
        const name = p.structuredFormat?.mainText.text ?? p.text.text.split(',')[0]!;
        return [{ id: p.placeId, name, address: p.text.text }];
      });
    },
    async place(id, session) {
      const url = `${BASE}/places/${encodeURIComponent(id)}?languageCode=en&sessionToken=${encodeURIComponent(session)}`;
      const data = placeSchema.safeParse(await call(url, { method: 'GET' }, 'id,displayName,formattedAddress,location'));
      if (!data.success) throw new ApiError(404, 'PLACE_NOT_FOUND', 'That place could not be found. Search again.');
      const p = data.data, name = p.displayName?.text ?? p.formattedAddress?.split(',')[0] ?? 'Selected place';
      const address = p.formattedAddress && !p.formattedAddress.toLowerCase().startsWith(name.toLowerCase()) ? `${name}, ${p.formattedAddress}` : (p.formattedAddress ?? name);
      return { id: `google:${p.id}`, name, address, location: { lat: p.location.latitude, lng: p.location.longitude } } satisfies Place;
    },
  };
}
