import {createTransport,type Tokens} from './transport';
import type {Admin,Page,Row} from './types';
import {useSession} from '@/store/session';
export const baseUrl=process.env.NEXT_PUBLIC_API_URL??'https://api.vendoltd.com';
export const request=createTransport(baseUrl,{get:()=>({...useSession.getState(),accountId:useSession.getState().admin?.id}),save:t=>useSession.getState().setTokens(t),clear:()=>useSession.getState().signOut()});
export const api={
 async requestCode(email:string){await request('/v1/auth/email/otp/request','POST',{email},false);},
 async verifyCode(email:string,code:string){const tokens=await request<Tokens>('/v1/auth/email/otp/verify','POST',{email,token:code},false);useSession.getState().setTokens(tokens);
  try {const admin=await request<Admin>('/v1/admin/me');useSession.getState().signIn(admin);return admin;}catch(error){await api.logout();throw error;}},
 async me(){return request<Admin>('/v1/admin/me');},
 async logout(){try{if(useSession.getState().token)await request('/v1/auth/logout','POST',{scope:'local'});}finally{useSession.getState().signOut();}},
 async data(resource:string,offset=0,id?:string){return request<Page>(`/v1/admin/portal/data/${resource}?limit=50&offset=${offset}${id?'&id='+encodeURIComponent(id):''}`);},
 async list(path:string,offset=0){const paginated=/^\/v1\/admin\/(orders|riders|vendor-applications|withdrawals|audits|broadcasts|support\/tickets)$/.test(path);const rows=await request<Row[]>(paginated?`${path}?limit=50&offset=${offset}`:path);return paginated?rows:rows.slice(offset,offset+50);},
};
