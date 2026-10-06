import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api } from '@/api/client';
import { setAuthLostHandler } from '@/api/http/request';
import type { Rider, User } from '@/api/types';

/**
 * Who is signed in, and how far their rider application has got — this decides which
 * part of the app they see (sign-in, application, or the working app).
 * `token` here only marks "signed in"; the tokens that matter are kept in the device keychain
 * by src/api/http/tokens.ts.
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
      signOut: () => {
        void api.signOut();
        set({ token: null, user: null, rider: null });
      },
    }),
    {
      name: 'vendo-rider-session',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        useSessionReady.setState(true);
      },
    },
  ),
);

/** false until the saved session has been read from the device (kept outside the persisted store). */
export const useSessionReady = create<boolean>()(() => false);

export type Stage = 'signed_out' | 'applying' | 'working';
export const useStage = (): Stage => useSession((s) => (!s.token || !s.user ? 'signed_out' : s.rider?.approval === 'approved' ? 'working' : 'applying'));

// the server refused to renew the session (signed out elsewhere, or expired): back to the sign-in screens
setAuthLostHandler(() => useSession.setState({ token: null, user: null, rider: null }));
