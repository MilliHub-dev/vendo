import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { MenuItem, Promo } from '@/api/types';
import { lineKey, type CartLine } from '@/lib/cart';

/** What the customer picked on the item sheet. */
export type ItemChoice = { quantity?: number; note?: string; optionIds?: string[] };

type CartState = {
  /** A cart holds items from one vendor at a time (one rider, one pickup). */
  vendorId: string | null;
  vendorName: string | null;
  lines: CartLine[];
  /** promo code to try; the server checks it and works out the discount at checkout */
  promo: Promo | null;
  setPromo: (promo: Promo | null) => void;
  /** Adds to the cart. Items from a different vendor replace the cart — ask first with `wouldReplace`. */
  add: (item: MenuItem, vendorName: string, choice?: ItemChoice) => void;
  wouldReplace: (vendorId: string) => boolean;
  replace: (vendorId: string, vendorName: string, lines: CartLine[]) => void;
  setQuantity: (key: string, quantity: number) => void;
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
      add: (item, vendorName, { quantity = 1, note, optionIds = [] } = {}) =>
        set((state) => {
          const lines = state.vendorId === item.vendorId ? state.lines : [];
          const key = lineKey(item.id, optionIds);
          const existing = lines.find((l) => l.key === key);
          const chosen = (item.optionGroups ?? []).flatMap((g) => g.options).filter((o) => optionIds.includes(o.id));
          const line: CartLine = {
            key,
            menuItemId: item.id,
            vendorId: item.vendorId,
            name: item.name,
            unitPriceKobo: item.priceKobo + chosen.reduce((sum, o) => sum + o.priceKobo, 0),
            quantity,
            note,
            emoji: item.emoji,
            imageUrl: item.imageUrl,
            optionIds: optionIds.length ? optionIds : undefined,
            options: chosen.map((o) => o.name).join(', ') || undefined,
          };
          return {
            vendorId: item.vendorId,
            vendorName,
            lines: existing ? lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity, note: note || l.note } : l)) : [...lines, line],
          };
        }),
      replace: (vendorId, vendorName, lines) => set({ vendorId, vendorName, lines }),
      setQuantity: (key, quantity) =>
        set((state) => {
          const lines = quantity <= 0 ? state.lines.filter((l) => l.key !== key) : state.lines.map((l) => (l.key === key ? { ...l, quantity } : l));
          return lines.length ? { lines } : { lines, vendorId: null, vendorName: null, promo: null };
        }),
      clear: () => set({ vendorId: null, vendorName: null, lines: [], promo: null }),
    }),
    {
      name: 'vendo-cart',
      storage: createJSONStorage(() => AsyncStorage),
      version: 2,
      // carts saved before lines had keys can't be priced reliably, so they start empty
      migrate: (saved, version) => (version < 2 ? { vendorId: null, vendorName: null, lines: [], promo: null } : (saved as CartState)),
    },
  ),
);
