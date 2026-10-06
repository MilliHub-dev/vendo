import type { Kobo } from './money';

export type CartLine = {
  /** identifies the line: the same dish with different options is a separate line */
  key: string;
  menuItemId: string;
  vendorId: string;
  name: string;
  unitPriceKobo: Kobo;
  quantity: number;
  note?: string;
  emoji?: string;
  imageUrl?: string;
  optionIds?: string[];
  /** chosen options as text, e.g. "Chicken, Large" */
  options?: string;
};

export const lineKey = (menuItemId: string, optionIds: string[] = []) => [menuItemId, ...[...optionIds].sort()].join('|');

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

export const cartSubtotal = (lines: CartLine[]): Kobo => lines.reduce((sum, l) => sum + l.unitPriceKobo * l.quantity, 0);

/** Display-only estimate. The server re-prices every order; its total is what gets charged. */
export function estimateTotal(lines: CartLine[], deliveryFeeKobo: Kobo, discountKobo: Kobo = 0): Kobo {
  return Math.max(0, cartSubtotal(lines) + deliveryFeeKobo - discountKobo);
}
