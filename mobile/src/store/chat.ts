import { create } from 'zustand';

/** How many of the rider's messages the customer has seen, per order — drives the unread badge. */
export const useChatSeen = create<{ seen: Record<string, number>; markSeen: (orderId: string, count: number) => void }>()((set) => ({
  seen: {},
  markSeen: (orderId, count) => set((s) => (s.seen[orderId] === count ? s : { seen: { ...s.seen, [orderId]: count } })),
}));
