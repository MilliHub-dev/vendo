import { create } from "zustand";
import { persist } from "zustand/middleware";

import { hydrateMock } from "@/api/mock/index.ts";
import type { Admin } from "@/api/types";

/**
 * The signed-in admin.
 * TODO(real backend): use an httpOnly session cookie with a short lifetime and two-factor
 * sign-in — an admin token must not sit in localStorage.
 */
type SessionState = { token: string | null; admin: Admin | null; signIn: (token: string, admin: Admin) => void; signOut: () => void };

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      admin: null,
      signIn: (token, admin) => set({ token, admin }),
      signOut: () => {
        hydrateMock(null);
        set({ token: null, admin: null });
      },
    }),
    { name: "vendo-admin-session", onRehydrateStorage: () => (state) => hydrateMock(state?.admin ?? null) },
  ),
);
