import { canCancel, isActive, trackingProgress } from '../order-status';

describe('order status helpers', () => {
  it('tracks progress through the four customer-facing steps', () => {
    expect(trackingProgress('searching_rider')).toBe(0);
    expect(trackingProgress('rider_assigned')).toBe(1);
    expect(trackingProgress('on_the_way')).toBe(3);
    expect(trackingProgress('delivered')).toBe(4);
  });
  it('allows cancelling only before pickup', () => {
    expect(canCancel('searching_rider')).toBe(true);
    expect(canCancel('rider_assigned')).toBe(true);
    expect(canCancel('picked_up')).toBe(false);
    expect(canCancel('delivered')).toBe(false);
  });
  it('separates active from finished orders', () => {
    expect(isActive('on_the_way')).toBe(true);
    expect(isActive('scheduled')).toBe(true);
    expect(isActive('delivered')).toBe(false);
    expect(isActive('cancelled')).toBe(false);
  });
});
