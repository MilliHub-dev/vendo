import { readEnv } from '../src/config/env.js';
import { createPool } from '../src/integrations/database.js';
import { createPaystackGateway } from '../src/integrations/paystack.js';
import { PostgresPaymentRepository } from '../src/modules/payments/repository.js';
import { PaymentService } from '../src/modules/payments/service.js';
const env=readEnv();
if(!env.DATABASE_URL)throw new Error('DATABASE_URL is required.');
const pool=createPool(env);
try {
  const repository=new PostgresPaymentRepository(pool);
  if(env.PAYSTACK_SECRET_KEY)console.info(await new PaymentService(repository,createPaystackGateway(env.PAYSTACK_SECRET_KEY,env.PAYSTACK_CALLBACK_URL)).process(100));
  else console.info({wallet_refunds:await repository.refundWallets(100)});
} catch{console.error('Payment processing failed. Check provider configuration and pending payment review records.');process.exitCode=1;}
finally{await pool.end();}
