import { create } from 'zustand';

/** One app-wide "are you sure?" sheet. Call `confirm({...})` from anywhere; <ConfirmHost> renders it. */
export type ConfirmOptions = { title: string; message: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => void };

export const useConfirm = create<{ current: ConfirmOptions | null; confirm: (o: ConfirmOptions) => void; close: () => void }>()((set) => ({
  current: null,
  confirm: (current) => set({ current }),
  close: () => set({ current: null }),
}));

export const confirm = (options: ConfirmOptions) => useConfirm.getState().confirm(options);
