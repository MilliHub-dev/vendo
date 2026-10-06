/** Normalise what people type (0803…, 234803…, +234803…) to +234XXXXXXXXXX, or null if invalid. */
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  const local = digits.startsWith('234') ? digits.slice(3) : digits.startsWith('0') ? digits.slice(1) : digits;
  return /^[789]\d{9}$/.test(local) ? `+234${local}` : null;
}
