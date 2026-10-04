import type { Kobo } from './money';

export type CartLine = {
  menuItemId: string;
  vendorId: string;
  name: string;
  unitPriceKobo: Kobo;
  quantity: number;
  note?: string;
  emoji?: string;
};

export const cartCount = (lines: CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

export const cartSubtotal = (lines: CartLine[]): Kobo => lines.reduce((sum, l) => sum + l.unitPriceKobo * l.quantity, 0);

/** Display-only estimate. The server re-prices every order; its total is what gets charged. */
export function estimateTotal(lines: CartLine[], deliveryFeeKobo: Kobo, discountKobo: Kobo = 0): Kobo {
  return Math.max(0, cartSubtotal(lines) + deliveryFeeKobo - discountKobo);
}
