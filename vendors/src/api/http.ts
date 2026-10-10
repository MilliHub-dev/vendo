import type { ApiClient } from './client';
import type { Dashboard, Review, Payouts, RegisterStoreRequest } from './types';
import { createTransport, type Tokens } from './transport';
import { useSession } from '../store/session';

import { object, string, number, array, user, store, application, item, order, cities, type Row } from './dto';
import { bankName, banks as bundledBanks } from '../lib/banks';
let liveBanks: { code: string; name: string }[] | null = null;
const nameOfBank = (code: string) => liveBanks?.find(b => b.code === code)?.name ?? bankName(code);
const request = createTransport(process.env.NEXT_PUBLIC_API_URL ?? 'https://api.vendoltd.com', { get: () => ({token:useSession.getState().token,refreshToken:useSession.getState().refreshToken,accountId:useSession.getState().user?.id ?? null}), save: tokens => useSession.getState().setTokens(tokens), clear: () => useSession.getState().signOut() });
async function storeId() { const s = useSession.getState().store; if (!s || s.approval !== 'approved') throw new Error('Choose an approved store first.'); return s.id; }
async function path(suffix = '') { return `/v1/vendor/stores/${await storeId()}${suffix}`; }
// 50 is the largest page every list endpoint accepts (withdrawals and notifications cap there)
const PAGE=50;
async function all(endpoint: string): Promise<Row[]> { const rows: Row[]=[]; for(let offset=0;offset<=10000;offset+=PAGE){ const page=array(await request(`${endpoint}${endpoint.includes('?')?'&':'?'}limit=${PAGE}&offset=${offset}`)).map(object);rows.push(...page); if(page.length<PAGE) return rows; } throw new Error('Too many records. Refine the selection.'); }
async function portal() { return object(await request(await path('/portal'))); }
// The order list is polled every few seconds. Reloading a store's whole history each time gets slower
// as it grows, so the history is loaded once and each poll fetches only the newest page and merges it
// in. A full reload every five minutes picks up anything older that changed.
let orderCache: { storeId: string; rows: Row[]; loadedAt: number } | null = null;
const FULL_RELOAD_MS = 5 * 60_000;
async function storeOrders(): Promise<Row[]> {
  const id = await storeId(), endpoint = `/v1/vendor/stores/${id}/orders`;
  if (orderCache?.storeId !== id || Date.now() - orderCache.loadedAt > FULL_RELOAD_MS) {
    const rows = await all(endpoint);
    orderCache = { storeId: id, rows, loadedAt: Date.now() };
    return rows;
  }
  const newest = array(await request(`${endpoint}?limit=${PAGE}&offset=0`)).map(object);
  if (orderCache?.storeId !== id) return newest; // the store changed while this was loading
  const known = new Set(orderCache.rows.map((r) => r.id));
  // a full page of orders we've never seen means more arrived than one page holds: start over
  if (newest.length === PAGE && newest.every((r) => !known.has(r.id))) { orderCache = null; return storeOrders(); }
  const fresh = new Map(newest.map((r) => [r.id, r]));
  orderCache.rows = [...newest.filter((r) => !known.has(r.id)), ...orderCache.rows.map((r) => fresh.get(r.id) ?? r)];
  return orderCache.rows;
}
let withdrawalKey: { payload: string; key: string } | null = null;
let registrationKey: { payload: string; key: string } | null = null;
export const api: ApiClient = {
 async requestCode(email) { await request('/v1/auth/email/otp/request','POST',{email},false); },
 async verifyCode(email,code) { const tokens=await request<Tokens>('/v1/auth/email/otp/verify','POST',{email,token:code},false);useSession.getState().setTokens(tokens);const me=object(await request('/v1/me'));return {token:tokens.access_token,user:me.onboarding_step==='complete'?user(me):null}; },
 async completeSignUp(details) { await request('/v1/me/name','PATCH',{name:details.name});const me=object(await request('/v1/me/phone','PATCH',{phone:details.phone}));return user(me); },
 async getMe() { return user(object(await request('/v1/me'))); },
 async logout() { orderCache = null; try { await request('/v1/auth/logout','POST',{scope:'local'}); } finally { useSession.getState().signOut(); } },
 async listCities() { return cities(await request('/v1/cities','GET',undefined,false)); },
 async searchPlaces(cityId, query) { const r=object(await request(`/v1/maps/search?city_id=${encodeURIComponent(cityId)}&q=${encodeURIComponent(query.trim())}&limit=6`));return array(r.items).map(v=>{const p=object(v),at=object(p.location),name=string(p.name),address=string(p.address);return {label:address.toLowerCase().startsWith(name.toLowerCase())?address:[name,address].filter(Boolean).join(', '),lat:number(at.lat),lng:number(at.lng)};}); },
 async listStores() { return (await all('/v1/vendor/stores')).map(store); },
 async getStore() {
  const me=object(await request('/v1/me'));
  if (me.onboarding_step!=='complete') return null;
  if (!['customer','vendor_staff'].includes(string(me.role))) throw new Error('This account cannot access the vendor portal.');
  if(me.role==='vendor_staff') { const stores=array(await request('/v1/vendor/stores?limit=50')).map(object); const selected=stores.find(s=>s.id===useSession.getState().selectedStoreId&&s.is_active) ?? stores.find(s=>s.is_active) ?? stores[0];if(selected){const s=store(selected); if(s.approval==='approved'){const data=object(await request(`/v1/vendor/stores/${s.id}/portal`));s.commissionRate=data.commission_rate==null?null:number(data.commission_rate);s.tier=string(data.tier)||'Not assigned';s.ratingCount=number(data.rating_count);}return s;} }
  const result=await request('/v1/vendor/registration');return result?application(object(result)):null;
 },
 async registerStore(body: RegisterStoreRequest) { const payload={name:body.name,category:body.category,cuisine:body.cuisine,description:body.description,city_id:body.cityId,address:body.address,location:body.location,opening_hours:body.hours};const signature=JSON.stringify(payload);if(registrationKey?.payload!==signature)registrationKey={payload:signature,key:crypto.randomUUID()}; const result=application(object(await request('/v1/vendor/registration','POST',payload,true,registrationKey.key)));if(!result)throw new Error('Application could not be loaded.');return result; },
 async updateStore(body) { const payload:Row={};for(const [key,value] of Object.entries(body)){const names:Record<string,string>={logoUrl:'logo_url',bannerUrl:'image_url',hours:'opening_hours'};payload[names[key]??key]=value;}await request(await path(),'PATCH',payload);const s=await this.getStore();if(!s)throw new Error('Store unavailable.');return s; },
 async setOpen(open) { await request(await path('/availability'),'PUT',{is_open:open});const s=await this.getStore();if(!s)throw new Error('Store unavailable.');return s; },
 async uploadImage(file,kind) { if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>2*1024*1024)throw new Error('Use a JPEG, PNG or WebP image up to 2 MiB.');const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));const result=object(await request(await path('/media'),'POST',{purpose:kind==='logo'?'logo':'image',mime:file.type,data_base64:btoa(binary)}));const url=string(result.public_url);if(!url.startsWith('https://'))throw new Error('The upload did not return a public image URL.');return url; },
 async listOrders() { return (await storeOrders()).filter(r=>r.payment_status==='paid'&&r.status!=='scheduled').map(order); },
 async getOrder(id) { return order(object(await request(await path(`/orders/${encodeURIComponent(id)}`)))); },
 async acceptOrder(id,prepMinutes) { await request(await path(`/orders/${encodeURIComponent(id)}/action`),'POST',{action:'accept',prep_minutes:prepMinutes});return this.getOrder(id); },
 async rejectOrder(id,reason) { await request(await path(`/orders/${encodeURIComponent(id)}/action`),'POST',{action:'reject',reason});return this.getOrder(id); },
 async markReady(id) { await request(await path(`/orders/${encodeURIComponent(id)}/action`),'POST',{action:'ready'});return this.getOrder(id); },
 async listMenu() { return array(await request(await path('/menu'))).map(v=>item(object(v))); },
 async saveMenuItem(input,id) { let groups:unknown[]=[];if(id){const old=array(await request(await path('/menu'))).map(object).find(r=>r.id===id);if(!old)throw new Error('Menu item not found.');groups=array(old.option_groups);}const payload={name:input.name,description:input.description,price_kobo:input.priceKobo,category:input.category,is_available:input.isAvailable,image_url:input.imageUrl??null,option_groups:groups};return item(object(await request(await path(id?`/menu/${encodeURIComponent(id)}`:'/menu'),id?'PUT':'POST',payload))); },
 async setItemAvailable(id,available) { const old=(await this.listMenu()).find(i=>i.id===id);if(!old)throw new Error('Menu item not found.');return this.saveMenuItem({...old,isAvailable:available},id); },
 async deleteMenuItem(id) { await this.setItemAvailable(id,false); },
 async getDashboard() { return object((await portal()).dashboard) as Dashboard; },
 async getPayouts() { const prefix=`/v1/earnings/vendor/${await storeId()}`;const [account,bank,history]=await Promise.all([request(prefix),request(`${prefix}/bank`),all(`${prefix}/withdrawals`)]);const a=object(account),b=bank?object(bank):null;return {balanceKobo:number(a.available_kobo),heldKobo:number(a.held_kobo ?? 0),nextPayoutDate:null,account:b?{bankCode:string(b.bank_code),bankName:nameOfBank(string(b.bank_code)),accountNumber:string(b.last_four),accountName:string(b.account_name)}:null,history:history.map(h=>({id:string(h.id),amountKobo:number(h.amount_kobo),status:string(h.status),date:string(h.created_at),orders:0,note:string(h.review_note)||undefined}))} as Payouts; },
 async listBanks() { try { const r=object(await request('/v1/payout-banks'));const items=array(r.items).map(v=>{const b=object(v);return {code:string(b.code),name:string(b.name)};});if(items.length)liveBanks=items; } catch { /* the bundled list covers the major banks */ } return liveBanks ?? bundledBanks; },
 async saveBankAccount(account) { await request(`/v1/earnings/vendor/${await storeId()}/bank`,'PUT',{bank_code:account.bankCode,account_number:account.accountNumber});return this.getPayouts(); },
 async requestWithdrawal(amountKobo) { const id=await storeId(),payload=`${id}:${amountKobo}`;if(withdrawalKey?.payload!==payload)withdrawalKey={payload,key:crypto.randomUUID()};await request(`/v1/earnings/vendor/${id}/withdrawals`,'POST',{amount_kobo:amountKobo},true,withdrawalKey.key);withdrawalKey=null; },
 async listReviews() { return array((await portal()).reviews) as Review[]; },
 async listNotifications() { const r=object(await request('/v1/me/notifications?limit=50'));return array(r.items).map(v=>{const n=object(v);return {id:string(n.id),title:string(n.title),body:string(n.body),createdAt:string(n.created_at)};}); },
};
