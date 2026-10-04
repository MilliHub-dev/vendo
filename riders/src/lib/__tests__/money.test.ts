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

