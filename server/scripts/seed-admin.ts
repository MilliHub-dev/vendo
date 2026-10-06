import {createClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {readEnv} from '../src/config/env.js';
import {createPool} from '../src/integrations/database.js';

const email=z.string().trim().toLowerCase().pipe(z.email().max(254)).parse(process.argv[2]);
const name=z.string().trim().min(2).max(100).parse(process.argv[3]??'Vendo Admin');
const env=readEnv();
if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Configure Supabase URL and service-role credentials.');
const supabase=createClient(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const pool=createPool(env);
let created=false;
try {
 // Resolve the exact identity in the trusted database, never by client metadata.
 const existing=(await pool.query<{id:string;role:string|null;status:string|null}>(`SELECT u.id,p.role,p.status FROM auth.users u LEFT JOIN public.profiles p ON p.id=u.id WHERE lower(u.email)=$1`,[email])).rows;
 if(existing.length>1)throw new Error('Multiple identities match this email. Resolve them before provisioning.');
 if(existing[0]&&(existing[0].status&&existing[0].status!=='active'||existing[0].role&&!['customer','admin'].includes(existing[0].role)))throw new Error('This identity has an incompatible role or inactive status. Review it before provisioning.');
 let id=existing[0]?.id;
 if(!id){const result=await supabase.auth.admin.createUser({email,email_confirm:true});if(result.error||!result.data.user)throw new Error('Supabase could not create the admin identity. Check provider configuration.');id=result.data.user.id;created=true;}
 const client=await pool.connect();
 try {
  await client.query('BEGIN');
  const saved=await client.query(`INSERT INTO public.profiles(id,name,email,email_verified,role) VALUES($1,$2,$3,true,'admin')
    ON CONFLICT(id) DO UPDATE SET role='admin',name=COALESCE(profiles.name,EXCLUDED.name),email=EXCLUDED.email,email_verified=true
    WHERE profiles.status='active' AND profiles.role IN('customer','admin') RETURNING id`,[id,name,email]);
  if(!saved.rows[0])throw new Error('The account changed while provisioning. Review it before retrying.');
  await client.query("INSERT INTO vendo_internal.catalog_audit(actor_id,action,target_id) VALUES($1,'admin_provisioned',$1)",[id]);
  await client.query('COMMIT');
  console.info('Administrator account provisioned. Sign in using the email address and the one-time code sent by Supabase/Brevo.');
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}catch(error){
 const safe=error instanceof Error&&/^(Multiple identities|This identity|Supabase could not|The account changed)/.test(error.message)?error.message:'Admin seed failed. Check database connectivity and migrations; credentials were not logged.';
 console.error(safe);if(created)console.error('The authentication identity was created, but profile provisioning did not finish. Retry the same email after resolving the failure.');process.exitCode=1;
}finally{await pool.end();}
