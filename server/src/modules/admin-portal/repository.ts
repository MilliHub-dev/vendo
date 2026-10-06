import type pg from 'pg';
import { createHash } from 'node:crypto';
import { ApiError } from '../../lib/errors.js';
import { actor, audit, serialize, transaction } from '../../lib/postgres.js';

export const resources = ['customers','vendors','payments','wallet-transactions','refunds','banners','referral-policies','finance-policies','menu','events','withdrawals','riders','audits'] as const;
export type Resource = typeof resources[number];
export interface AdminPortalRepository {
  list(user: string, resource: Resource, limit: number, offset: number, id?: string): Promise<Record<string, unknown>[]>;
  overview(user: string): Promise<Record<string, unknown>>;
  adjust(user: string, input: {kind:'customer'|'rider';id:string;amount_kobo:number;reason:string}, key:string): Promise<{ok:true}>;
  vendorStatus(user:string,id:string,active:boolean,reason:string):Promise<{ok:true}>;
}
export class PostgresAdminPortalRepository implements AdminPortalRepository {
  constructor(private readonly pool: pg.Pool) {}
  async list(user:string, resource:Resource, limit:number, offset:number, id?:string) {
    return transaction(this.pool, async c => {
      await actor(c,user,'admin');
      const queries: Record<Resource,string> = {
        customers: `SELECT p.id,p.name,p.phone,p.email,p.status,p.city_id,p.created_at,COALESCE(w.balance_kobo,0) AS wallet_kobo,
          (SELECT count(*)::int FROM public.orders o WHERE o.customer_id=p.id) AS orders,
          (SELECT COALESCE(sum((o.quote->>'total_kobo')::bigint),0) FROM public.orders o WHERE o.customer_id=p.id AND o.payment_status='paid') AS paid_total_kobo
          FROM public.profiles p LEFT JOIN public.wallets w ON w.customer_id=p.id WHERE p.role='customer' ORDER BY p.created_at DESC,p.id`,
        vendors: `SELECT v.*,(SELECT count(*)::int FROM public.menu_items m WHERE m.vendor_id=v.id) AS menu_items,
          (SELECT count(*)::int FROM public.orders o WHERE o.quote->>'vendor_id'=v.id::text AND o.status='delivered' AND o.delivered_at>=now()-interval '30 days') AS delivered_30d,
          (SELECT COALESCE(sum((o.quote->>'subtotal_kobo')::bigint),0) FROM public.orders o WHERE o.quote->>'vendor_id'=v.id::text AND o.status='delivered' AND o.delivered_at>=now()-interval '30 days') AS sales_30d_kobo
          FROM public.vendors v ORDER BY v.name,v.id`,
        payments: `SELECT id,customer_id,order_id,purpose,reference,method,amount_kobo,currency,status,created_at,verified_at FROM vendo_internal.payment_intents ORDER BY created_at DESC,id`,
        'wallet-transactions': `SELECT * FROM public.wallet_transactions ORDER BY created_at DESC,id`,
        refunds: `SELECT r.*,o.code,o.payment_method FROM vendo_internal.order_refunds r JOIN public.orders o ON o.id=r.order_id ORDER BY r.created_at DESC,r.id`,
        banners: `SELECT * FROM public.promo_banners ORDER BY starts_at DESC,id`,
        'referral-policies': `SELECT id,enabled,config,created_at FROM vendo_internal.referral_policies ORDER BY created_at DESC,id`,
        'finance-policies': `SELECT * FROM vendo_internal.finance_policies ORDER BY created_at DESC,id`,
        menu: `SELECT * FROM public.menu_items WHERE vendor_id=$3::uuid ORDER BY name,id`,
        events: `SELECT * FROM public.order_events WHERE order_id=$3::uuid ORDER BY created_at,id`,
        withdrawals: `SELECT w.id,w.account_id,w.reference,w.amount_kobo,w.status,w.review_note,w.created_at,w.updated_at,a.kind,a.entity_id,b.account_name,b.bank_code,b.last_four FROM vendo_internal.withdrawals w JOIN vendo_internal.earnings_accounts a ON a.id=w.account_id LEFT JOIN vendo_internal.payout_banks b ON b.account_id=a.id ORDER BY w.created_at DESC,w.id`,
        riders: `SELECT r.*,p.name,p.phone,p.status,l.lat,l.lng,l.captured_at,
          CASE WHEN l.captured_at IS NULL THEN true ELSE l.captured_at<now()-interval '60 seconds' END AS location_stale,
          (SELECT count(*)::int FROM public.orders o WHERE o.assigned_rider_id=r.profile_id AND o.status='delivered') AS trips,
          (SELECT COALESCE(avg(x.rider_rating),0) FROM public.order_ratings x JOIN public.orders o ON o.id=x.order_id WHERE o.assigned_rider_id=r.profile_id) AS rating,
          COALESCE(a.available_kobo,0) AS available_kobo,COALESCE(a.held_kobo,0) AS held_kobo
          FROM vendo_internal.riders r JOIN public.profiles p ON p.id=r.profile_id LEFT JOIN vendo_internal.rider_locations l ON l.rider_id=r.profile_id
          LEFT JOIN vendo_internal.earnings_accounts a ON a.kind='rider' AND a.entity_id=r.profile_id ORDER BY r.created_at DESC,r.profile_id`,
        audits: `SELECT a.*,p.name AS actor_name,(SELECT x.reason FROM vendo_internal.admin_actions x WHERE x.actor_id=a.actor_id AND x.target_id=a.target_id AND x.action=a.action AND x.created_at=a.created_at LIMIT 1) AS reason FROM vendo_internal.catalog_audit a LEFT JOIN public.profiles p ON p.id=a.actor_id ORDER BY a.created_at DESC,a.id`,
      };
      return (await c.query(queries[resource]+' LIMIT $1 OFFSET $2', ['menu','events'].includes(resource)?[limit,offset,id??null]:[limit,offset])).rows.map(serialize);
    });
  }
  async overview(user:string) {
    return transaction(this.pool, async c => {
      await actor(c,user,'admin');
      const totals=(await c.query(`SELECT count(*)::int AS orders,
        count(*) FILTER(WHERE status='delivered')::int AS delivered,
        count(*) FILTER(WHERE status='disputed')::int AS disputes,
        COALESCE(sum((quote->>'total_kobo')::bigint) FILTER(WHERE payment_status='paid'),0) AS paid_kobo
        FROM public.orders WHERE created_at>=date_trunc('day',now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos'`)).rows[0];
      const queues=(await c.query(`SELECT
        (SELECT count(*)::int FROM vendo_internal.riders WHERE approval='pending') AS rider_applications,
        (SELECT count(*)::int FROM vendo_internal.vendor_applications WHERE status='pending') AS vendor_applications,
        (SELECT count(*)::int FROM vendo_internal.withdrawals WHERE status='requested') AS withdrawals,
        (SELECT count(*)::int FROM public.orders WHERE status='disputed') AS disputes,
        (SELECT count(*)::int FROM vendo_internal.riders WHERE online AND approval='approved') AS online_riders`)).rows[0];
      const days=(await c.query(`SELECT (created_at AT TIME ZONE 'Africa/Lagos')::date::text AS day,count(*)::int AS orders,
        count(*) FILTER(WHERE status='delivered')::int AS delivered,
        COALESCE(sum((quote->>'total_kobo')::bigint) FILTER(WHERE payment_status='paid'),0) AS paid_kobo
        FROM public.orders WHERE created_at>=now()-interval '14 days' GROUP BY 1 ORDER BY 1`)).rows;
      return {today:totals,queues,days};
    });
  }
  async vendorStatus(user:string,id:string,active:boolean,reason:string) {
    return transaction(this.pool,async c=>{await actor(c,user,'admin');
      if(!(await c.query('UPDATE public.vendors SET is_active=$2,is_open=CASE WHEN $2 THEN is_open ELSE false END WHERE id=$1 RETURNING id',[id,active])).rows[0]) throw new ApiError(404,'VENDOR_NOT_FOUND','Vendor not found.');
      await c.query('INSERT INTO vendo_internal.admin_actions(actor_id,action,target_id,reason) VALUES($1,$2,$3,$4)',[user,active?'vendor_reinstated':'vendor_suspended',id,reason]);
      await audit(c,user,active?'vendor_reinstated':'vendor_suspended',id);return {ok:true as const};});
  }
  async adjust(user:string,input:{kind:'customer'|'rider';id:string;amount_kobo:number;reason:string},key:string) {
    return transaction(this.pool,async c=>{
      await actor(c,user,'admin');const digest=createHash('sha256').update(JSON.stringify(input)).digest('hex');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`adjust:${user}:${key}`]);
      const saved=(await c.query('SELECT digest FROM vendo_internal.admin_actions WHERE actor_id=$1 AND idempotency_key=$2',[user,key])).rows[0];
      if(saved){if(saved.digest!==digest)throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This key was used for a different adjustment.');return {ok:true as const};}
      await actor(c,input.id,input.kind==='customer'?'customer':'rider');
      const action=(await c.query("INSERT INTO vendo_internal.admin_actions(actor_id,action,target_id,reason,idempotency_key,digest) VALUES($1,'balance_adjustment',$2,$3,$4,$5) RETURNING id",[user,input.id,input.reason,key,digest])).rows[0]!;
      const reference=`admin:${action.id}`;
      if(input.kind==='customer') {
        await c.query('INSERT INTO public.wallets(customer_id) VALUES($1) ON CONFLICT DO NOTHING',[input.id]);
        const wallet=(await c.query('SELECT balance_kobo FROM public.wallets WHERE customer_id=$1 FOR UPDATE',[input.id])).rows[0]!;
        const balance=Number(wallet.balance_kobo)+input.amount_kobo;
        if(balance<0 || balance>9000000000000)throw new ApiError(409,'INVALID_BALANCE','Adjustment would exceed the allowed balance.');
        await c.query('UPDATE public.wallets SET balance_kobo=$2,updated_at=now() WHERE customer_id=$1',[input.id,balance]);
        await c.query("INSERT INTO public.wallet_transactions(customer_id,kind,reference,amount_kobo,balance_after_kobo) VALUES($1,'adjustment',$2,$3,$4)",[input.id,reference,input.amount_kobo,balance]);
      } else {
        await c.query("INSERT INTO vendo_internal.earnings_accounts(kind,entity_id) VALUES('rider',$1) ON CONFLICT(kind,entity_id) DO NOTHING",[input.id]);
        const account=(await c.query("SELECT * FROM vendo_internal.earnings_accounts WHERE kind='rider' AND entity_id=$1 FOR UPDATE",[input.id])).rows[0]!;
        const balance=Number(account.available_kobo)+input.amount_kobo;
        if(balance<0 || balance>9000000000000)throw new ApiError(409,'INVALID_BALANCE','Adjustment would exceed the allowed balance.');
        await c.query('UPDATE vendo_internal.earnings_accounts SET available_kobo=$2 WHERE id=$1',[account.id,balance]);
        await c.query("INSERT INTO vendo_internal.earnings_ledger(account_id,reference,kind,available_delta,held_delta,available_after,held_after) VALUES($1,$2,'adjustment',$3,0,$4,$5)",[account.id,reference,input.amount_kobo,balance,account.held_kobo]);
      }
      await audit(c,user,'balance_adjustment',input.id);return {ok:true as const};
    });
  }
}
