import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTransport, ApiError, type Tokens } from '../src/api/transport.ts';

test('HTTP uses the live origin, bearer auth and idempotency headers; refresh is shared across requests', async () => {
 let token: string|null='expired',refreshToken:string|null='refresh',refreshes=0;
 const calls: {url:string;headers:Headers}[]=[];
 const fetcher:typeof fetch=async(url,init)=>{const h=new Headers(init?.headers);calls.push({url:String(url),headers:h});
  if(String(url).endsWith('/v1/auth/refresh')){refreshes++;await new Promise(r=>setTimeout(r,5));return Response.json({access_token:'new',refresh_token:'rotated',expires_in:3600});}
  if(h.get('authorization')==='Bearer expired')return Response.json({error:{message:'Expired',code:'AUTH_FAILED'}},{status:401});
  return Response.json({ok:true});
 };
 const request=createTransport('https://api.vendoltd.com/',{get:()=>({token,refreshToken}),save:(t:Tokens)=>{token=t.access_token;refreshToken=t.refresh_token;},clear:()=>{token=null;refreshToken=null;}},fetcher);
 await Promise.all([request('/v1/me'),request('/v1/vendor/stores')]);
 assert.equal(refreshes,1);assert.equal(refreshToken,'rotated');
 await request('/v1/vendor/registration','POST',{name:'Store'},true,'registration-key');
 assert.equal(calls.at(-1)?.headers.get('idempotency-key'),'registration-key');
 assert.equal(calls.at(-1)?.url,'https://api.vendoltd.com/v1/vendor/registration');
 assert.equal(calls.at(-1)?.headers.get('authorization'),'Bearer new');
});

test('A failed refresh clears invalid credentials; validation errors do not refresh', async () => {
 let cleared=false;
 const access={get:()=>({token:'expired',refreshToken:'refresh'}),save:()=>{},clear:()=>{cleared=true;}};
 const request=createTransport('https://api.vendoltd.com',access,async()=>Response.json({error:{message:'Invalid session',code:'AUTH_FAILED'}},{status:401}));
 await assert.rejects(()=>request('/v1/me'),ApiError);assert.ok(cleared);
 let count=0;
 const invalid=createTransport('https://api.vendoltd.com',access,async()=>{count++;return Response.json({error:{message:'Choose a city',code:'VALIDATION_ERROR'}},{status:400});});
 await assert.rejects(()=>invalid('/v1/vendor/registration','POST',{}),/Choose a city/);assert.equal(count,1);
});

test('A refresh for an old account cannot overwrite a newly signed-in account', async()=>{
 let accountId='old',token='expired',refreshToken='old-refresh',saved=false;
 let release: ((value:Response)=>void)|undefined;
 const response=new Promise<Response>(resolve=>{release=resolve;});
 const request=createTransport('https://api.vendoltd.com',{get:()=>({accountId,token,refreshToken}),save:()=>{saved=true;},clear:()=>{throw new Error('Must not clear the new account.');}},async url=>String(url).endsWith('/refresh')?response:Response.json({error:{message:'Expired'}},{status:401}));
 const pending=request('/v1/me');
 await new Promise(r=>setTimeout(r,10));accountId='new';token='new-token';refreshToken='new-refresh';
 release!(Response.json({access_token:'old-new-token',refresh_token:'old-rotated',expires_in:3600}));
 await assert.rejects(()=>pending,/account changed/);assert.equal(saved,false);assert.equal(token,'new-token');
});
