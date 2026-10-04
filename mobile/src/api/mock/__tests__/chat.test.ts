import { mockApi } from '..';

jest.setTimeout(20_000);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const place = { address: 'Ali Akilu Road, Kaduna', lat: 10.5441, lng: 7.4388 };

describe('chat with the rider', () => {
  it('opens once a rider is assigned, delivers messages both ways, and closes when the order ends', async () => {
    const order = await mockApi.createOrder({ type: 'food', vendorId: 'v-1', items: [{ menuItemId: 'm-3', quantity: 1 }], dropoff: place, paymentMethod: 'wallet' });

    // no rider yet: nothing to read, nothing can be sent
    expect(await mockApi.listMessages(order.id)).toEqual([]);
    await expect(mockApi.sendMessage(order.id, 'Hello?')).rejects.toThrow('closed');

    await wait(6_500); // the mock assigns a rider after 6s
    const greeting = await mockApi.listMessages(order.id);
    expect(greeting).toHaveLength(1);
    expect(greeting[0].from).toBe('rider');

    await expect(mockApi.sendMessage(order.id, '   ')).rejects.toThrow('Type a message');
    const sent = await mockApi.sendMessage(order.id, '  I’m at the gate  ');
    expect(sent).toMatchObject({ from: 'customer', text: 'I’m at the gate' });

    await wait(3_000); // the rider replies
    const thread = await mockApi.listMessages(order.id);
    expect(thread.map((m) => m.from)).toEqual(['rider', 'customer', 'rider']);

    await mockApi.cancelOrder(order.id);
    await expect(mockApi.sendMessage(order.id, 'Still there?')).rejects.toThrow('closed');
    expect(await mockApi.listMessages(order.id)).toHaveLength(3); // history stays readable
  });
});
