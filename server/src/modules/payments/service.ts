import { ApiError } from '../../lib/errors.js';
import { paymentSchema, type PaymentGateway, type PaymentMethod, type PaymentRepository } from './schema.js';
export class PaymentService {
  constructor(private readonly repository:PaymentRepository,private readonly gateway:PaymentGateway) {}
  async initialize(userId:string,key:string,input:{order_id:string}|{amount_kobo:number;method:PaymentMethod}) {
    if(this.gateway.configured===false)throw new ApiError(503,'PAYMENTS_NOT_CONFIGURED','Payments are not configured.');
    const prepared=await this.repository.prepare(userId,key,input);
    if(!prepared.fresh)return paymentSchema.parse(prepared.intent);
    try {return await this.repository.initialized(prepared.intent.id,await this.gateway.initialize(prepared.intent));}
    catch(error){await this.repository.review(prepared.intent.id,'initialization_unknown');throw error;}
  }
  async verify(reference:string,userId?:string) {
    const saved=await this.repository.find(reference,userId);
    if(!saved)throw new ApiError(404,'PAYMENT_NOT_FOUND','Payment not found.');
    if(saved.status==='succeeded'){await this.repository.finishEvents(reference);return paymentSchema.parse(saved);}
    const result=await this.repository.apply(reference,await this.gateway.verify(reference));
    if(result.status==='succeeded')await this.repository.finishEvents(reference);
    return result;
  }
  async reconcileRefund(actorId:string,id:string,providerId:string) {
    return this.repository.reconcileRefund(actorId,id,await this.gateway.verifyRefund(providerId));
  }
  async process(limit=100) {
    let verified=0,failed=0;
    for(const reference of await this.repository.pending(limit)) {
      try{if((await this.verify(reference)).status==='succeeded')verified++;}catch{failed++;}
    }
    return {verified,failed,wallet_refunds:await this.repository.refundWallets(limit)};
  }
}
