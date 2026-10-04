import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { hydrateMock } from '@/api/mock';
import type { Rider, User } from '@/api/types';

/**
 * Who is signed in, and how far their rider application has got — this decides which
 * part of the app they see (sign-in, application, or the working app).
 * TODO(real backend): keep the token in the device keychain (expo-secure-store).
 */
type SessionState = {
  token: string | null;
  user: User | null;
  /** latest rider profile, mirrored from the API so the right screens show immediately on launch */
  rider: Rider | null;
  setToken: (token: string) => void;
  signIn: (token: string, user: User) => void;
  setRider: (rider: Rider | null) => void;
  signOut: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      rider: null,
      setToken: (token) => set({ token }),
      signIn: (token, user) => set({ token, user }),
      setRider: (rider) => set((s) => (JSON.stringify(s.rider) === JSON.stringify(rider) ? s : { rider })),
      signOut: () => set({ token: null, user: null, rider: null }),
    }),
    {
      name: 'vendo-rider-session',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.user) hydrateMock(state.user, state.rider);
        useSessionReady.setState(true);
      },
    },
  ),
);

/** false until the saved session has been read from the device (kept outside the persisted store). */
export const useSessionReady = create<boolean>()(() => false);

export type Stage = 'signed_out' | 'applying' | 'working';
export const useStage = (): Stage => useSession((s) => (!s.token || !s.user ? 'signed_out' : s.rider?.approval === 'approved' ? 'working' : 'applying'));
