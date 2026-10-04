import { create } from "zustand";

/** Small bits of UI state shared across the dashboard. */
type UiState = {
  /** new orders the vendor has already looked at, so the alert doesn't pop up again for them */
  seen: Record<string, true>;
  markSeen: (id: string) => void;
  /** the order open in the side panel, if any */
  openOrderId: string | null;
  openOrder: (id: string | null) => void;
};

export const useUi = create<UiState>()((set) => ({
  seen: {},
  markSeen: (id) => set((s) => (s.seen[id] ? s : { seen: { ...s.seen, [id]: true } })),
  openOrderId: null,
  openOrder: (openOrderId) => set({ openOrderId }),
}));
