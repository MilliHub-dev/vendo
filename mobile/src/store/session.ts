import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { hydrateMockUser } from '@/api/mock';
import type { User } from '@/api/types';

/**
 * Who is signed in. Set by the sign-in screens: phone → code → (new users) name + email.
 * TODO(real backend): keep the token in the device keychain (expo-secure-store) instead
 * of AsyncStorage, and drop hydrateMockUser.
 */
type SessionState = {
  token: string | null;
  user: User | null;
  /** phone verified, profile not completed yet (new users between the code and details steps) */
  pendingPhone: string | null;
  setPendingPhone: (phone: string | null) => void;
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
      pendingPhone: null,
      setPendingPhone: (pendingPhone) => set({ pendingPhone }),
      setToken: (token) => set({ token }),
      signIn: (token, user) => set({ token, user, pendingPhone: null }),
      setUser: (user) => set({ user }),
      signOut: () => set({ token: null, user: null, pendingPhone: null }),
    }),
    {
      name: 'vendo-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ token, user }) => ({ token, user }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) hydrateMockUser(state.user);
        useSessionReady.setState(true);
      },
    },
  ),
);

/** false until the saved session has been read from the device. Kept outside the persisted store so setting it never writes to storage. */
export const useSessionReady = create<boolean>()(() => false);

export const useIsSignedIn = () => useSession((s) => !!s.token && !!s.user);
