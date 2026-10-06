import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { api } from '@/api/client';
import { setAuthLostHandler } from '@/api/http/request';
import type { User } from '@/api/types';

import { useAddresses } from './addresses';
import { useCart } from './cart';

/**
 * Who is signed in. Set by the sign-in screens: email → code → (new users) name + phone.
 * `token` here only marks "signed in"; the tokens that matter are kept in the device
 * keychain by src/api/http/tokens.ts.
 */
type SessionState = {
  token: string | null;
  user: User | null;
  /** email verified, profile not completed yet (new users between the code and details steps) */
  pendingEmail: string | null;
  setPendingEmail: (email: string | null) => void;
  setToken: (token: string) => void;
  signIn: (token: string, user: User) => void;
  setUser: (user: User) => void;
  signOut: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      pendingEmail: null,
      setPendingEmail: (pendingEmail) => set({ pendingEmail }),
      setToken: (token) => set({ token }),
      signIn: (token, user) => set({ token, user, pendingEmail: null }),
      setUser: (user) => set({ user }),
      signOut: () => {
        void api.signOut();
        useAddresses.getState().clear();
        useCart.getState().clear();
        set({ token: null, user: null, pendingEmail: null });
      },
    }),
    {
      name: 'vendo-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ token, user }) => ({ token, user }),
      onRehydrateStorage: () => (state) => {
        useSessionReady.setState(true);
      },
    },
  ),
);

/** false until the saved session has been read from the device. Kept outside the persisted store so setting it never writes to storage. */
export const useSessionReady = create<boolean>()(() => false);

export const useIsSignedIn = () => useSession((s) => !!s.token && !!s.user);

// the server refused to renew the session (signed out elsewhere, or expired): back to the sign-in screens
setAuthLostHandler(() => useSession.setState({ token: null, user: null, pendingEmail: null }));
