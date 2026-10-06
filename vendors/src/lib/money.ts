/**
 * Money is always an integer number of kobo (₦1 = 100 kobo) — in the API, in state
 * and in arithmetic. Format only at the moment of display. Never use floats for money.
 */

export type Kobo = number;

export const nairaToKobo = (naira: number): Kobo => Math.round(naira * 100);

/** ₦1,500 for whole naira, ₦1,500.50 when there are kobo. */
export function formatNaira(kobo: Kobo | null): string {
  if (kobo === null) return '—';
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(kobo));
  const naira = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = String(naira).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₦${grouped}${rest ? '.' + String(rest).padStart(2, '0') : ''}`;
}
