import { mockApi } from '..';
import type { QuoteRequest } from '../../types';

const dropoff = { address: 'Ali Akilu Road, Kaduna', lat: 10.5441, lng: 7.4388 };
// 2 × Jollof Rice & Chicken (₦3,000) from Arewa Kitchen, delivery ₦700
const order = (promoCode?: string): QuoteRequest => ({ type: 'food', vendorId: 'v-1', items: [{ menuItemId: 'm-3', quantity: 2 }], dropoff, promoCode });

describe('promo codes', () => {
  it('charges full price without a code', async () => {
    const q = await mockApi.quote(order());
    expect(q).toMatchObject({ subtotalKobo: 600_000, deliveryFeeKobo: 70_000, discountKobo: 0, totalKobo: 670_000 });
  });
  it('takes 10% off the food with VENDO10, whatever the letter case', async () => {
    const q = await mockApi.quote(order('vendo10'));
    expect(q.discountKobo).toBe(60_000);
    expect(q.totalKobo).toBe(610_000);
    expect(q.discountLabel).toBe('Promo VENDO10');
  });
  it('caps VENDO10 at ₦1,000', async () => {
    const big: QuoteRequest = { type: 'food', vendorId: 'v-1', items: [{ menuItemId: 'm-3', quantity: 10 }], dropoff, promoCode: 'VENDO10' };
    expect((await mockApi.quote(big)).discountKobo).toBe(100_000);
  });
  it('removes the delivery fee with FREEDEL', async () => {
    const q = await mockApi.quote(order('FREEDEL'));
    expect(q.discountKobo).toBe(70_000);
    expect(q.totalKobo).toBe(600_000);
  });
  it('rejects unknown codes', async () => {
    await expect(mockApi.checkPromo('NOPE')).rejects.toThrow('isn’t valid');
    await expect(mockApi.quote(order('NOPE'))).rejects.toThrow('isn’t valid');
  });
});

describe('referrals', () => {
  it('rejects your own code and unknown codes', async () => {
    await expect(mockApi.applyReferralCode('AMINA24')).rejects.toThrow('own code');
    await expect(mockApi.applyReferralCode('WHOEVER')).rejects.toThrow('isn’t valid');
  });
  it('gives the welcome discount on the first order only, and a promo code replaces it', async () => {
    const summary = await mockApi.applyReferralCode('vendo2026');
    expect(summary).toMatchObject({ appliedCode: 'VENDO2026', canApply: false });
    await expect(mockApi.applyReferralCode('VENDO2026')).rejects.toThrow('already used');

    const first = await mockApi.quote(order());
    expect(first).toMatchObject({ discountKobo: 50_000, totalKobo: 620_000, discountLabel: 'Referral welcome discount' });
    expect((await mockApi.quote(order('FREEDEL'))).discountLabel).toBe('Promo FREEDEL'); // one discount per order

    await mockApi.createOrder({ ...order(), paymentMethod: 'wallet' });
    expect((await mockApi.quote(order())).discountKobo).toBe(0);
  });
});
