import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ApiError } from '../../lib/errors.js';
import { serializeOrder } from '../orders/schema.js';
import { transition, type TransitionRow } from '../orders/transitions.js';
import { cityOpen } from '../food/pricing.js';
import { channels, paymentSchema, type Intent, type LedgerEntry, type PaymentRepository, type VerifiedTransaction, type PaymentMethod } from './schema.js';
type Row = TransitionRow & {customer_id:string;payment_method:string;vendor_id:string|null;created_at:Date;processing_due_at:Date|null;quote:{total_kobo:number;city_id:string}};
const intent = (row:Record<string,unknown>):Intent => ({...paymentSchema.parse({...row,amount_kobo:Number(row.amount_kobo),created_at:(row.created_at as Date).toISOString(),verified_at:row.verified_at?(row.verified_at as Date).toISOString():null}),customer_id:row.customer_id as string,email:row.email as string,idempotency_key:row.idempotency_key as string});
export class PostgresPaymentRepository implements PaymentRepository {
  constructor(private readonly pool:pg.Pool) {}
  private async transaction<T>(run:(client:pg.PoolClient)=>Promise<T>):Promise<T> {
    const client=await this.pool.connect();
    try{await client.query('BEGIN');const result=await run(client);await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }
  private async profile(client:pg.PoolClient,id:string,active=true) {
    // Serialize money operations before order/intent/wallet locks, while
    // allowing order-event FK key-share locks held by the due worker.
    const row=(await client.query<{status:string;email:string|null;onboarding_step:string}>('SELECT status,email,onboarding_step FROM public.profiles WHERE id=$1 FOR NO KEY UPDATE',[id])).rows[0];
    if(!row || (active && row.status!=='active')) throw new ApiError(403,'ACCOUNT_INACTIVE','This account cannot access this service.');
    if(active && row.onboarding_step!=='complete') throw new ApiError(403,'ONBOARDING_REQUIRED','Complete your name and email before continuing.');
    return row;
  }
  private async order(client:pg.PoolClient,userId:string,id:string) {
    const row=(await client.query<Row>('SELECT * FROM public.orders WHERE id=$1 AND customer_id=$2 FOR UPDATE',[id,userId])).rows[0];
    if(!row) throw new ApiError(404,'ORDER_NOT_FOUND','Order not found.'); return row;
  }
  private amount(amount:number) {if(!Number.isSafeInteger(amount)||amount<1||amount>1000000000)throw new ApiError(409,'INVALID_PAYMENT_AMOUNT','The payment amount is outside the supported range.');}
  private async unavailable(client:pg.PoolClient,row:Row):Promise<boolean> {
    const now=(await client.query<{now:Date}>('SELECT now() AS now')).rows[0]!.now;
    if(row.status!=='pending_payment'||row.payment_status!=='unpaid'||(row.processing_due_at && row.processing_due_at<=now))return true;
    const policy=(await client.query<{unpaid_timeout_minutes:number}>('SELECT unpaid_timeout_minutes FROM vendo_internal.city_order_policies WHERE city_id=$1 FOR SHARE',[row.quote.city_id])).rows[0];
    if(policy && row.created_at.getTime()+policy.unpaid_timeout_minutes*60000<=now.getTime())return true;
    const city=(await client.query<{is_active:boolean;opens_at:string|null;closes_at:string|null}>('SELECT is_active,opens_at,closes_at FROM public.cities WHERE id=$1 FOR SHARE',[row.quote.city_id])).rows[0];
    const vendor=row.type==='food'?(await client.query<{is_active:boolean;is_open:boolean}>('SELECT is_active,is_open FROM public.vendors WHERE id=$1 FOR SHARE',[row.vendor_id])).rows[0]:null;
    return !city?.is_active || (!row.scheduled_at && !cityOpen(city,now)) || (row.type==='food' && (!vendor?.is_active || (!row.scheduled_at && !vendor.is_open)));
  }
  async prepare(userId:string,key:string,input:{order_id:string}|{amount_kobo:number;method:PaymentMethod}) {
    return this.transaction(async(client)=>{
      const profile=await this.profile(client,userId);
      const order='order_id' in input?await this.order(client,userId,input.order_id):null;
      const existing=(await client.query('SELECT * FROM vendo_internal.payment_intents WHERE customer_id=$1 AND (idempotency_key=$2 OR order_id=$3) ORDER BY (idempotency_key=$2) DESC',[userId,key,order?.id??null])).rows;
      if(existing.length) {
        const saved=intent(existing[0]!);
        if(saved.order_id!==(order?.id??null)||(!order&&'amount_kobo' in input&&(saved.amount_kobo!==input.amount_kobo||saved.method!==input.method)))throw new ApiError(409,'IDEMPOTENCY_CONFLICT','This key belongs to a different payment.');
        return {intent:saved,fresh:false};
      }
      if(order && (order.payment_method==='wallet'||await this.unavailable(client,order)))throw new ApiError(409,'PAYMENT_NOT_ALLOWED','This order cannot start an external payment.');
      const amount=order?order.quote.total_kobo:('amount_kobo' in input?input.amount_kobo:0);this.amount(amount);
      const id=randomUUID(),reference=`VD-P-${id}`,method=order?order.payment_method:('method' in input?input.method:'card');
      const saved=(await client.query(`INSERT INTO vendo_internal.payment_intents(id,customer_id,order_id,purpose,reference,idempotency_key,method,amount_kobo,email)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[id,userId,order?.id??null,order?'order':'top_up',reference,key,method,amount,profile.email])).rows[0]!;
      return {intent:intent(saved),fresh:true};
    });
  }
  async initialized(id:string,result:{reference:string;authorization_url:string;access_code:string}) {
    const saved=(await this.pool.query(`UPDATE vendo_internal.payment_intents SET authorization_url=$2,access_code=$3,status=CASE WHEN status='initializing' THEN 'pending' ELSE status END WHERE id=$1 AND reference=$4 RETURNING *`,[id,result.authorization_url,result.access_code,result.reference])).rows[0];
    if(!saved)throw new ApiError(409,'PAYMENT_REFERENCE_MISMATCH','Checkout reference does not match.');return paymentSchema.parse(intent(saved));
  }
  async review(id:string,reason:string){await this.pool.query("UPDATE vendo_internal.payment_intents SET status='review',review_reason=$2 WHERE id=$1 AND status<>'succeeded'",[id,reason]);}
  async find(reference:string,userId?:string) {
    const row=(await this.pool.query('SELECT * FROM vendo_internal.payment_intents WHERE reference=$1 AND ($2::uuid IS NULL OR customer_id=$2)',[reference,userId??null])).rows[0];return row?intent(row):null;
  }
  private async moveWallet(client:pg.PoolClient,userId:string,amount:number,kind:LedgerEntry['kind'],reference:string,orderId:string|null,paymentId:string|null) {
    await client.query('INSERT INTO public.wallets(customer_id) VALUES($1) ON CONFLICT DO NOTHING',[userId]);
    const wallet=(await client.query<{balance_kobo:string}>('SELECT balance_kobo FROM public.wallets WHERE customer_id=$1 FOR UPDATE',[userId])).rows[0]!;
    const balance=Number(wallet.balance_kobo)+amount;
    if(balance<0)throw new ApiError(409,'INSUFFICIENT_FUNDS','Top up your wallet before paying for this order.');
    if(balance>9000000000000)throw new ApiError(409,'WALLET_LIMIT','The wallet balance limit would be exceeded. Contact support.');
    await client.query('INSERT INTO public.wallet_transactions(customer_id,kind,reference,amount_kobo,balance_after_kobo,order_id,payment_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[userId,kind,reference,amount,balance,orderId,paymentId]);
    await client.query('UPDATE public.wallets SET balance_kobo=$2,updated_at=now() WHERE customer_id=$1',[userId,balance]);
  }
  async apply(reference:string,data:VerifiedTransaction) {
    const found=await this.find(reference);if(!found)throw new ApiError(404,'PAYMENT_NOT_FOUND','Payment not found.');
    return this.transaction(async(client)=>{
      const profile=await this.profile(client,found.customer_id,false);
      const order=found.order_id?await this.order(client,found.customer_id,found.order_id):null;
      const saved=intent((await client.query('SELECT * FROM vendo_internal.payment_intents WHERE id=$1 FOR UPDATE',[found.id])).rows[0]!);
      if(saved.status==='succeeded')return paymentSchema.parse(saved);
      const metadata=data.metadata;
      if(data.reference!==saved.reference||data.amount!==saved.amount_kobo||data.currency!=='NGN'||data.customer.email.toLowerCase()!==saved.email.toLowerCase()||data.channel!==channels[saved.method]||metadata.payment_id!==saved.id||metadata.customer_id!==saved.customer_id||metadata.order_id!==saved.order_id||metadata.purpose!==saved.purpose || (order&&(order.quote.total_kobo!==saved.amount_kobo||order.payment_method!==saved.method))) {
        await client.query("UPDATE vendo_internal.payment_intents SET status='review',review_reason='verification_mismatch',last_checked_at=now() WHERE id=$1",[saved.id]);
        return paymentSchema.parse({...saved,status:'review'});
      }
      await client.query('UPDATE vendo_internal.payment_intents SET last_checked_at=now() WHERE id=$1',[saved.id]);
      if(data.status!=='success')return paymentSchema.parse(saved);
      if(!order)await this.moveWallet(client,saved.customer_id,saved.amount_kobo,'top_up',`topup:${saved.id}`,null,saved.id);
      else {
        const unavailable=profile.status!=='active'||await this.unavailable(client,order);
        await client.query("UPDATE public.orders SET payment_status='paid' WHERE id=$1",[order.id]);
        const paid={...order,payment_status:'paid'};
        if(unavailable) {
          if(order.status==='pending_payment')await transition(client,paid,'cancelled',saved.customer_id,'late_or_unavailable_payment');
          // A successful charge after an unpaid cancellation needs a full refund,
          // even though the earlier cancellation didn't create a refund intent.
          await client.query("UPDATE public.orders SET refund_status='pending' WHERE id=$1",[order.id]);
          await client.query('INSERT INTO vendo_internal.order_refunds(order_id,amount_kobo) VALUES($1,$2) ON CONFLICT(order_id) DO NOTHING',[order.id,saved.amount_kobo]);
        } else await transition(client,paid,order.scheduled_at?'scheduled':order.type==='food'?'awaiting_vendor':'searching_rider',saved.customer_id,'payment_verified');
      }
      const result=(await client.query("UPDATE vendo_internal.payment_intents SET status='succeeded',review_reason=NULL,provider_id=$2,verified_at=now() WHERE id=$1 RETURNING *",[saved.id,data.id])).rows[0]!;
      return paymentSchema.parse(intent(result));
    });
  }
  async wallet(userId:string) {
    const row=(await this.pool.query<{balance_kobo:string;updated_at:Date}>('SELECT balance_kobo,updated_at FROM public.wallets WHERE customer_id=$1',[userId])).rows[0];
    return {currency:'NGN' as const,balance_kobo:row?Number(row.balance_kobo):0,updated_at:row?row.updated_at.toISOString():null};
  }
  async history(userId:string,limit:number,offset:number) {
    const {rows}=await this.pool.query('SELECT * FROM public.wallet_transactions WHERE customer_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3',[userId,limit,offset]);
    return rows.map(row=>({id:row.id as string,kind:row.kind as LedgerEntry['kind'],reference:row.reference as string,amount_kobo:Number(row.amount_kobo),balance_after_kobo:Number(row.balance_after_kobo),order_id:row.order_id as string|null,payment_id:row.payment_id as string|null,created_at:(row.created_at as Date).toISOString()}));
  }
  async checkout(userId:string,orderId:string) {
    return this.transaction(async(client)=>{
      await this.profile(client,userId);const row=await this.order(client,userId,orderId);
      if(row.payment_method!=='wallet')throw new ApiError(409,'PAYMENT_METHOD_MISMATCH','This order uses a different payment method.');
      if(row.payment_status==='paid') {
        if(!(await client.query('SELECT id FROM public.wallet_transactions WHERE reference=$1',[`order:${row.id}`])).rows[0])throw new ApiError(409,'PAYMENT_REVIEW_REQUIRED','This payment needs support review.');
        return serializeOrder(row);
      }
      if(await this.unavailable(client,row))throw new ApiError(409,'PAYMENT_NOT_ALLOWED','This order cannot be paid now.');
      this.amount(row.quote.total_kobo);
      await this.moveWallet(client,userId,-row.quote.total_kobo,'checkout',`order:${row.id}`,row.id,null);
      await client.query("UPDATE public.orders SET payment_status='paid' WHERE id=$1",[row.id]);
      await transition(client,{...row,payment_status:'paid'},row.scheduled_at?'scheduled':row.type==='food'?'awaiting_vendor':'searching_rider',userId,'wallet_payment');
      return serializeOrder((await client.query('SELECT * FROM public.orders WHERE id=$1',[row.id])).rows[0]!);
    });
  }
  async enqueue(digest:string,event:string,reference:string) {await this.pool.query(`INSERT INTO vendo_internal.payment_webhooks(digest,event,reference,processed_at) VALUES($1,$2,$3,CASE WHEN EXISTS(SELECT 1 FROM vendo_internal.payment_intents WHERE reference=$3 AND status='succeeded') THEN now() END) ON CONFLICT DO NOTHING`,[digest,event,reference]);}
  async pending(limit:number) {
    // Reserve a polling slot before HTTP, so outages/abandoned checkouts do not
    // starve newer payments. Independent workers may verify twice safely.
    const {rows}=await this.pool.query<{reference:string}>(`WITH due AS (
      SELECT p.id FROM vendo_internal.payment_intents p WHERE p.status<>'succeeded'
      AND (p.last_checked_at IS NULL OR p.last_checked_at<now()-interval '1 minute')
      ORDER BY p.last_checked_at NULLS FIRST,p.created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
      UPDATE vendo_internal.payment_intents p SET last_checked_at=now() FROM due WHERE p.id=due.id RETURNING p.reference`,[limit]);
    return rows.map(row=>row.reference);
  }
  async finishEvents(reference:string) {await this.pool.query('UPDATE vendo_internal.payment_webhooks SET processed_at=now() WHERE reference=$1 AND processed_at IS NULL',[reference]);}
  async reconcileRefund(actorId:string,id:string,data:import('./schema.js').VerifiedRefund) {
    const found=(await this.pool.query<{order_id:string;customer_id:string}>('SELECT r.order_id,o.customer_id FROM vendo_internal.order_refunds r JOIN public.orders o ON o.id=r.order_id WHERE r.id=$1',[id])).rows[0];
    if(!found)throw new ApiError(404,'REFUND_NOT_FOUND','Refund not found.');
    return this.transaction(async(client)=>{
      if(!(await client.query("SELECT id FROM public.profiles WHERE id=$1 AND role='admin' AND status='active' FOR SHARE",[actorId])).rows[0])throw new ApiError(403,'ADMIN_REQUIRED','Administrator access is required.');
      await this.profile(client,found.customer_id,false);const order=await this.order(client,found.customer_id,found.order_id);
      const refund=(await client.query<{status:'pending'|'processed';amount_kobo:string;provider_refund_id:string|null}>('SELECT * FROM vendo_internal.order_refunds WHERE id=$1 FOR UPDATE',[id])).rows[0]!;
      const payment=(await client.query<{provider_id:string}>(`SELECT provider_id FROM vendo_internal.payment_intents WHERE order_id=$1 AND status='succeeded'`,[order.id])).rows[0];
      if(order.payment_method==='wallet'||!payment||order.status!=='cancelled'||order.payment_status!=='paid'||data.transaction!==payment.provider_id||data.amount!==Number(refund.amount_kobo)||data.currency!=='NGN'||(refund.provider_refund_id && refund.provider_refund_id!==data.id))throw new ApiError(409,'REFUND_MISMATCH','The provider refund does not match this cancelled order.');
      if(refund.status==='processed')return {status:refund.status};
      await client.query("INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES($1,'refund_reconciled',$2)",[actorId,id]);
      await client.query('UPDATE vendo_internal.order_refunds SET provider_refund_id=$2 WHERE id=$1',[id,data.id]);
      if(data.status!=='processed')return {status:'pending' as const};
      await client.query("UPDATE vendo_internal.order_refunds SET status='processed',processed_at=now() WHERE id=$1",[id]);
      await client.query("UPDATE public.orders SET refund_status='refunded' WHERE id=$1",[order.id]);
      return {status:'processed' as const};
    });
  }
  async refundWallets(limit:number) {
    const {rows}=await this.pool.query<{order_id:string;customer_id:string}>(`SELECT r.order_id,o.customer_id FROM vendo_internal.order_refunds r JOIN public.orders o ON o.id=r.order_id
      WHERE r.status='pending' AND o.payment_method='wallet' AND EXISTS(SELECT 1 FROM public.wallet_transactions l WHERE l.reference='order:'||o.id::text) ORDER BY r.created_at LIMIT $1`,[limit]);
    let processed=0;
    for(const row of rows)await this.transaction(async(client)=>{
      await this.profile(client,row.customer_id,false);const order=await this.order(client,row.customer_id,row.order_id);
      const refund=(await client.query<{id:string;status:string;amount_kobo:string}>('SELECT * FROM vendo_internal.order_refunds WHERE order_id=$1 FOR UPDATE',[order.id])).rows[0]!;
      if(refund.status!=='pending')return;
      const debit=(await client.query<{amount_kobo:string}>('SELECT amount_kobo FROM public.wallet_transactions WHERE reference=$1 AND customer_id=$2',[`order:${order.id}`,row.customer_id])).rows[0];
      const amount=Number(refund.amount_kobo);
      if(order.status!=='cancelled'||order.payment_status!=='paid'||!debit||amount<1||amount> -Number(debit.amount_kobo))throw new ApiError(409,'INVALID_REFUND','This refund requires support review.');
      await this.moveWallet(client,row.customer_id,amount,'refund',`refund:${refund.id}`,order.id,null);
      await client.query("UPDATE vendo_internal.order_refunds SET status='processed',processed_at=now() WHERE id=$1",[refund.id]);
      await client.query("UPDATE public.orders SET refund_status='refunded' WHERE id=$1",[order.id]);processed++;
    });
    return processed;
  }
}
