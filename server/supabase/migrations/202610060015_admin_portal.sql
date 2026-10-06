CREATE TABLE vendo_internal.admin_actions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES public.profiles(id),action text NOT NULL,
 target_id uuid NOT NULL,reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 1000),
 idempotency_key text,digest text,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_kind_check, DROP CONSTRAINT wallet_transactions_source_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_kind_check CHECK(kind IN('top_up','checkout','refund','referral','adjustment')),
 ADD CONSTRAINT wallet_transactions_source_check CHECK(
 (kind='checkout' AND amount_kobo<0 AND order_id IS NOT NULL AND payment_id IS NULL AND referral_id IS NULL) OR
 (kind='top_up' AND amount_kobo>0 AND payment_id IS NOT NULL AND order_id IS NULL AND referral_id IS NULL) OR
 (kind='refund' AND amount_kobo>0 AND order_id IS NOT NULL AND payment_id IS NULL AND referral_id IS NULL) OR
 (kind='referral' AND amount_kobo>0 AND order_id IS NOT NULL AND payment_id IS NULL AND referral_id IS NOT NULL) OR
 (kind='adjustment' AND order_id IS NULL AND payment_id IS NULL AND referral_id IS NULL));
ALTER TABLE vendo_internal.earnings_ledger DROP CONSTRAINT earnings_ledger_kind_check;
ALTER TABLE vendo_internal.earnings_ledger ADD CONSTRAINT earnings_ledger_kind_check CHECK(kind IN('earning','hold','release','payout','reversal','adjustment'));
CREATE TABLE vendo_internal.admin_broadcasts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),actor_id uuid NOT NULL REFERENCES public.profiles(id),
 audience text NOT NULL CHECK(audience IN('customers','riders','vendors')),city_ids uuid[] NOT NULL,
 title text NOT NULL,body text NOT NULL,send_at timestamptz NOT NULL,status text NOT NULL DEFAULT 'scheduled' CHECK(status IN('scheduled','queued','cancelled')),
 recipients integer NOT NULL DEFAULT 0,idempotency_key text NOT NULL,digest text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(actor_id,idempotency_key)
);
CREATE INDEX admin_broadcasts_due ON vendo_internal.admin_broadcasts(send_at) WHERE status='scheduled';
ALTER TABLE vendo_internal.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.admin_broadcasts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendo_internal.admin_actions,vendo_internal.admin_broadcasts FROM PUBLIC,anon,authenticated;
GRANT ALL ON vendo_internal.admin_actions,vendo_internal.admin_broadcasts TO service_role;
