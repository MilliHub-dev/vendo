import { create } from 'zustand';
import { persist,createJSONStorage } from 'zustand/middleware';
import type {Admin} from '@/api/types';
import type {Tokens} from '@/api/transport';
type Session={token:string|null;refreshToken:string|null;admin:Admin|null;setTokens:(tokens:Tokens)=>void;signIn:(admin:Admin)=>void;signOut:()=>void};
export const useSession=create<Session>()(persist(set=>({token:null,refreshToken:null,admin:null,
 setTokens:tokens=>set({token:tokens.access_token,refreshToken:tokens.refresh_token}),
 signIn:admin=>set({admin}),signOut:()=>set({token:null,refreshToken:null,admin:null})}),
 {name:'vendo-admin-live-session',storage:createJSONStorage(()=>sessionStorage)}));
