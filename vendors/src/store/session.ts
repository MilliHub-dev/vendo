import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hydrateMock } from "@/api/mock";
import type { Store, User } from "@/api/types";

/**
 * Who is signed in, and whether their store is approved — this decides which part of the
 * dashboard they see (login, store registration, or the working dashboard).
 * TODO(real backend): use an httpOnly session cookie instead of keeping the token in localStorage.
 */
type SessionState = {
  token: string | null;
  user: User | null;
  /** latest store, mirrored from the API so the right pages show immediately on load */
  store: Store | null;
  setToken: (token: string) => void;
  signIn: (token: string, user: User) => void;
  setStore: (store: Store | null) => void;
  signOut: () => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      store: null,
      setToken: (token) => set({ token }),
      signIn: (token, user) => set({ token, user }),
      setStore: (store) => set((s) => (JSON.stringify(s.store) === JSON.stringify(store) ? s : { store })),
      signOut: () => set({ token: null, user: null, store: null }),
    }),
    {
      name: "vendo-vendor-session",
      onRehydrateStorage: () => (state) => {
        if (state?.user) hydrateMock(state.user, state.store);
      },
    },
  ),
);

export type Stage = "signed_out" | "registering" | "working";
export const stageOf = (s: Pick<SessionState, "token" | "user" | "store">): Stage => (!s.token || !s.user ? "signed_out" : s.store?.approval === "approved" ? "working" : "registering");
export const useStage = (): Stage => useSession(stageOf);
