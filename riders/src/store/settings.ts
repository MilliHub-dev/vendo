import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Appearance = 'system' | 'light' | 'dark';

type SettingsState = {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: 'system',
      setAppearance: (appearance) => set({ appearance }),
    }),
    { name: 'vendo-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
