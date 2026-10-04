import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { savedAddresses } from '@/api/mock';
import type { Place, SavedAddress } from '@/api/types';

/** Saved places, kept on the device for now. TODO(real backend): sync through the API. */
type AddressState = {
  addresses: SavedAddress[];
  add: (label: string, place: Place) => SavedAddress;
  remove: (id: string) => void;
};

export const useAddresses = create<AddressState>()(
  persist(
    (set) => ({
      addresses: savedAddresses,
      add: (label, place) => {
        const address = { ...place, id: `addr-${Date.now()}`, label };
        set((s) => ({ addresses: [...s.addresses, address] }));
        return address;
      },
      remove: (id) => set((s) => ({ addresses: s.addresses.filter((a) => a.id !== id) })),
    }),
    { name: 'vendo-addresses', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
