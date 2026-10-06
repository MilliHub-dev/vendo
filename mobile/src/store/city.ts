import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { City } from '@/api/types';

/** The city the customer is ordering in. Vendors, fares and the service area all depend on it. */
type CityState = { city: Pick<City, 'id' | 'name'> | null; setCity: (city: Pick<City, 'id' | 'name'> | null) => void };

export const useCity = create<CityState>()(persist((set) => ({ city: null, setCity: (city) => set({ city }) }), { name: 'vendo-city', storage: createJSONStorage(() => AsyncStorage) }));
