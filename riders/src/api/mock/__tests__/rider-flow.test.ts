import { MOCK_DELIVERY_CODE, MOCK_SMS_CODE, mockApi } from '..';

jest.setTimeout(40_000);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits for the next offer the mock sends to an online rider. */
async function nextOffer() {
  for (let i = 0; i < 40; i++) {
    const offer = await mockApi.getCurrentOffer();
    if (offer) return offer;
    await wait(500);
  }
  throw new Error('no offer arrived');
}

describe('rider application', () => {
  it('goes vehicle → documents → review → approved, and blocks going online until then', async () => {
    await mockApi.requestCode('+2348039990000');
    await expect(mockApi.verifyCode('+2348039990000', '000000')).rejects.toThrow('not correct');
    expect((await mockApi.verifyCode('+2348039990000', MOCK_SMS_CODE)).user).toBeNull(); // new number → sign-up
    await mockApi.completeSignUp({ name: 'Test Rider', email: 'rider@example.com' });
    expect(await mockApi.getRider()).toBeNull();

    const registered = await mockApi.registerRider({ cityId: 'kaduna', vehicleType: 'motorcycle', plateNumber: 'kad 111 aa' });
    expect(registered).toMatchObject({ approval: 'pending', plateNumber: 'KAD 111 AA' });
    await expect(mockApi.submitApplication()).rejects.toThrow('all three documents');
    await expect(mockApi.setOnline(true)).rejects.toThrow('approved');

    for (const kind of ['gov_id', 'bike_registration', 'photo'] as const) await mockApi.uploadDocument(kind);
    expect((await mockApi.submitApplication()).approval).toBe('under_review');
    await wait(9_500); // the mock reviewer approves
    expect((await mockApi.getRider())?.approval).toBe('approved');
  });
});

describe('working as a rider', () => {
  beforeAll(async () => {
    // the demo rider is already approved
    await mockApi.requestCode('+2348031111111');
    await mockApi.verifyCode('+2348031111111', MOCK_SMS_CODE);
  });

  it('receives no offers while offline', async () => {
    expect(await mockApi.getCurrentOffer()).toBeNull();
  });

  it('delivers a food order and is paid for it', async () => {
    const before = await mockApi.getEarnings();
    await mockApi.setOnline(true);
    const offer = await nextOffer();
    expect(offer.type).toBe('food');

    const job = await mockApi.respondToOffer(offer.id, 'accept');
    expect(job).toMatchObject({ status: 'rider_assigned', requiresCode: false });
    expect((await mockApi.getRider())?.presence).toBe('on_trip');
    expect(await mockApi.getCurrentOffer()).toBeNull(); // no new offers mid-delivery
    await expect(mockApi.setOnline(false)).rejects.toThrow('Finish your current delivery');

    await expect(mockApi.updateJob('delivered')).rejects.toThrow('isn’t available yet'); // steps can't be skipped
    await mockApi.updateJob('picked_up');
    await mockApi.updateJob('on_the_way');
    expect((await mockApi.updateJob('delivered')).status).toBe('delivered');

    expect(await mockApi.getJob()).toBeNull();
    const after = await mockApi.getEarnings();
    expect(after.balanceKobo).toBe(before.balanceKobo + offer.earningKobo);
    expect(after.today).toEqual({ trips: 1, earnedKobo: offer.earningKobo });
    expect((await mockApi.listTrips())[0].code).toBe(job!.code);
  });

  it('completes a dispatch only with the receiver’s code', async () => {
    const offer = await nextOffer();
    expect(offer.type).toBe('dispatch');
    await mockApi.respondToOffer(offer.id, 'accept');
    await mockApi.updateJob('picked_up');
    await mockApi.updateJob('on_the_way');

    await expect(mockApi.updateJob('delivered')).rejects.toThrow('delivery code');
    await expect(mockApi.confirmDelivery('0000')).rejects.toThrow('2 attempts left');
    expect((await mockApi.getJob())?.codeAttemptsLeft).toBe(2);
    expect((await mockApi.confirmDelivery(MOCK_DELIVERY_CODE)).status).toBe('delivered');
  });

  it('locks a dispatch after three wrong codes', async () => {
    await nextOffer().then((o) => mockApi.respondToOffer(o.id, 'reject')); // skip the food order
    const offer = await nextOffer();
    expect(offer.type).toBe('dispatch');
    await mockApi.respondToOffer(offer.id, 'accept');
    await mockApi.updateJob('picked_up');
    await mockApi.updateJob('on_the_way');
    await expect(mockApi.confirmDelivery('1111')).rejects.toThrow('2 attempts left');
    await expect(mockApi.confirmDelivery('2222')).rejects.toThrow('1 attempt left');
    await expect(mockApi.confirmDelivery('3333')).rejects.toThrow('Too many wrong codes');
    await expect(mockApi.confirmDelivery(MOCK_DELIVERY_CODE)).rejects.toThrow('Too many wrong codes'); // even the right code is refused now
  });
});

describe('withdrawals', () => {
  it('enforces the minimum and the balance, and holds the money at request time', async () => {
    const { balanceKobo } = await mockApi.getEarnings();
    const base = { bankCode: '058', accountNumber: '0123456789', accountName: 'Musa Ibrahim' };
    await expect(mockApi.requestWithdrawal({ ...base, amountKobo: 50_000 })).rejects.toThrow('minimum');
    await expect(mockApi.requestWithdrawal({ ...base, amountKobo: balanceKobo + 100 })).rejects.toThrow('more than your balance');
    await expect(mockApi.requestWithdrawal({ ...base, accountNumber: '123', amountKobo: 200_000 })).rejects.toThrow('10 digits');

    const w = await mockApi.requestWithdrawal({ ...base, amountKobo: 200_000 });
    expect(w).toMatchObject({ status: 'pending', accountNumber: '••••••6789', bankName: 'GTBank' });
    expect((await mockApi.getEarnings()).balanceKobo).toBe(balanceKobo - 200_000);
  });
});
