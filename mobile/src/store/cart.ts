import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MenuItem, Promo } from '@/api/types';
import type { CartLine } from '@/lib/cart';

type CartState = {
  /** A cart holds items from one vendor at a time (one rider, one pickup). */
  vendorId: string | null;
  vendorName: string | null;
  lines: CartLine[];
  /** promo code accepted by the server; the discount itself is calculated at checkout */
  promo: Promo | null;
  setPromo: (promo: Promo | null) => void;
  /** Adds to the cart. Items from a different vendor replace the cart — ask first with `wouldReplace`. */
  add: (item: MenuItem, vendorName: string, quantity?: number, note?: string) => void;
  wouldReplace: (vendorId: string) => boolean;
  replace: (vendorId: string, vendorName: string, lines: CartLine[]) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      vendorId: null,
      vendorName: null,
      lines: [],
      promo: null,
      setPromo: (promo) => set({ promo }),
      wouldReplace: (vendorId) => get().lines.length > 0 && get().vendorId !== vendorId,
      add: (item, vendorName, quantity = 1, note) =>
        set((state) => {
          const lines = state.vendorId === item.vendorId ? state.lines : [];
          const existing = lines.find((l) => l.menuItemId === item.id);
          return {
            vendorId: item.vendorId,
            vendorName,
            lines: existing
              ? lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity, note: note || l.note } : l))
              : [...lines, { menuItemId: item.id, vendorId: item.vendorId, name: item.name, unitPriceKobo: item.priceKobo, quantity, note, emoji: item.emoji }],
          };
        }),
      replace: (vendorId, vendorName, lines) => set({ vendorId, vendorName, lines }),
      setQuantity: (menuItemId, quantity) =>
        set((state) => {
          const lines = quantity <= 0 ? state.lines.filter((l) => l.menuItemId !== menuItemId) : state.lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity } : l));
          return lines.length ? { lines } : { lines, vendorId: null, vendorName: null, promo: null };
        }),
      clear: () => set({ vendorId: null, vendorName: null, lines: [], promo: null }),
    }),
    { name: 'vendo-cart', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
