import { cartCount, cartSubtotal, estimateTotal, type CartLine } from '../cart';
import { formatNaira, nairaToKobo } from '../money';

describe('formatNaira', () => {
  it('formats whole naira with thousands separators', () => {
    expect(formatNaira(0)).toBe('₦0');
    expect(formatNaira(150_000)).toBe('₦1,500');
    expect(formatNaira(139_900_000)).toBe('₦1,399,000');
  });
  it('shows kobo only when there are some', () => {
    expect(formatNaira(150_050)).toBe('₦1,500.50');
    expect(formatNaira(5)).toBe('₦0.05');
  });
  it('handles negatives (refunds, discounts)', () => {
    expect(formatNaira(-20_000)).toBe('-₦200');
  });
});

describe('nairaToKobo', () => {
  it('avoids floating-point drift', () => {
    expect(nairaToKobo(19.99)).toBe(1999);
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
  });
});

describe('cart totals', () => {
  const line = (unitPriceKobo: number, quantity: number): CartLine => ({ menuItemId: `m-${unitPriceKobo}`, vendorId: 'v-1', name: 'Item', unitPriceKobo, quantity });
  const lines = [line(250_000, 2), line(70_000, 1)];

  it('counts items and sums the subtotal in kobo', () => {
    expect(cartCount(lines)).toBe(3);
    expect(cartSubtotal(lines)).toBe(570_000);
    expect(cartSubtotal([])).toBe(0);
  });
  it('adds delivery, subtracts discount and never goes below zero', () => {
    expect(estimateTotal(lines, 70_000)).toBe(640_000);
    expect(estimateTotal(lines, 70_000, 100_000)).toBe(540_000);
    expect(estimateTotal(lines, 0, 9_999_999)).toBe(0);
  });
});
