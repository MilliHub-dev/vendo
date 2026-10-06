import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api } from '@/api/client';
import type { Place, SavedAddress } from '@/api/types';

/**
 * Saved places. They belong to the customer's account on the server; this store is the
 * copy the screens read, kept on the device so the list shows instantly and offline.
 */
type AddressState = {
  addresses: SavedAddress[];
  /** Replaces the list with the account's addresses. Called after sign-in and when the app opens. */
  load: () => Promise<void>;
  /** Shows the address straight away, then saves it to the account. Throws if the server refuses it (e.g. outside the delivery area). */
  add: (label: string, place: Place) => Promise<SavedAddress>;
  remove: (id: string) => Promise<void>;
  clear: () => void;
};

export const useAddresses = create<AddressState>()(
  persist(
    (set, get) => ({
      addresses: [],
      load: async () => {
        set({ addresses: await api.listAddresses() });
      },
      add: async (label, place) => {
        const pending: SavedAddress = { ...place, id: `pending-${Date.now()}`, label };
        set((s) => ({ addresses: [...s.addresses, pending] }));
        try {
          const saved = await api.saveAddress(label, place);
          set((s) => ({ addresses: s.addresses.map((a) => (a.id === pending.id ? saved : a)) }));
          return saved;
        } catch (error) {
          set((s) => ({ addresses: s.addresses.filter((a) => a.id !== pending.id) }));
          throw error;
        }
      },
      remove: async (id) => {
        const before = get().addresses;
        set({ addresses: before.filter((a) => a.id !== id) });
        try {
          if (!id.startsWith('pending-')) await api.deleteAddress(id);
        } catch (error) {
          set({ addresses: before }); // put it back: it is still on the account
          throw error;
        }
      },
      clear: () => set({ addresses: [] }),
    }),
    { name: 'vendo-addresses-v2', storage: createJSONStorage(() => AsyncStorage), partialize: ({ addresses }) => ({ addresses }) },
  ),
);
