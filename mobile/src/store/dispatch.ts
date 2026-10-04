import { create } from 'zustand';

import type { PackageSize, Place } from '@/api/types';

/** The dispatch being booked, handed from the Send tab to the review screen. */
export type DispatchDraft = {
  pickup: Place;
  dropoff: Place;
  packageSize: PackageSize;
  packageNote: string;
  fragile: boolean;
  receiver: { name: string; phone: string };
  scheduledFor: string | null;
};

type State = {
  draft: DispatchDraft | null;
  setDraft: (d: DispatchDraft | null) => void;
  /** "Send again": values the Send form starts with */
  prefill: Partial<DispatchDraft> | null;
  /** changes whenever the Send form should start over (new prefill, or reset after booking) */
  formId: number;
  resetForm: (prefill?: Partial<DispatchDraft> | null) => void;
};

export const useDispatchDraft = create<State>()((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  prefill: null,
  formId: 0,
  resetForm: (prefill = null) => set((s) => ({ prefill, formId: s.formId + 1 })),
}));

export const packageSizes: { value: PackageSize; label: string; hint: string; emoji: string }[] = [
  { value: 'document', label: 'Document', hint: 'Envelopes, papers', emoji: '📄' },
  { value: 'small', label: 'Small parcel', hint: 'Up to a shoe box', emoji: '📦' },
  { value: 'large', label: 'Large parcel', hint: 'Fits the bike box', emoji: '🧳' },
];
