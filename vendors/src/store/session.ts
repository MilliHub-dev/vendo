import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Store, User } from '@/api/types';
import type { Tokens } from '@/api/transport';
type SessionState = {
 selectedStoreId: string | null; token: string | null; refreshToken: string | null; user: User | null; store: Store | null;
 setTokens: (tokens: Tokens) => void; setToken: (token: string) => void; signIn: (token: string, user: User) => void;
 setStore: (store: Store | null) => void; signOut: () => void;
};
export const useSession = create<SessionState>()(persist(set => ({
 selectedStoreId: null, token: null, refreshToken: null, user: null, store: null,
 setTokens: tokens => set({ token: tokens.access_token, refreshToken: tokens.refresh_token }),
 setToken: token => set({ token }), signIn: (token, user) => set({ token, user }),
 setStore: store => set(s => JSON.stringify(s.store) === JSON.stringify(store) ? s : { store, ...(store?.approval==='approved' ? {selectedStoreId:store.id} : {}) }),
 signOut: () => set({ selectedStoreId: null, token: null, refreshToken: null, user: null, store: null }),
}), { name: 'vendo-vendor-live-session', // The store is saved too. Without it a reload has no store for a moment, the app thinks the vendor is still
 // registering, and they are bounced to the dashboard from whatever page they were on. It is refreshed from the server straight after load.
 partialize: s => ({ token: s.token, refreshToken: s.refreshToken, user: s.user, selectedStoreId:s.selectedStoreId, store: s.store }) }));
export type Stage = 'signed_out' | 'registering' | 'working';
export const stageOf = (s: Pick<SessionState, 'token' | 'user' | 'store'>): Stage => !s.token || !s.user ? 'signed_out' : s.store?.approval === 'approved' ? 'working' : 'registering';
export const useStage = (): Stage => useSession(stageOf);
