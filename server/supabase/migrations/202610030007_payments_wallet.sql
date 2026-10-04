-- Money mutations are server-only; ledger references make retries idempotent.
CREATE TABLE vendo_internal.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.profiles(id),
  order_id uuid UNIQUE REFERENCES public.orders(id), purpose text NOT NULL CHECK (purpose IN ('order','top_up')),
  reference text NOT NULL UNIQUE, idempotency_key text NOT NULL, method text NOT NULL CHECK (method IN ('card','transfer','ussd')),
  amount_kobo bigint NOT NULL CHECK (amount_kobo BETWEEN 1 AND 1000000000), currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  email text NOT NULL, status text NOT NULL DEFAULT 'initializing' CHECK (status IN ('initializing','pending','succeeded','review')),
  authorization_url text, access_code text, provider_id text UNIQUE, review_reason text,
  created_at timestamptz NOT NULL DEFAULT now(), verified_at timestamptz, last_checked_at timestamptz,
  UNIQUE(customer_id,idempotency_key), CHECK ((purpose='order')=(order_id IS NOT NULL)),
  CHECK (status<>'succeeded' OR (provider_id IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TABLE public.wallets (
  customer_id uuid PRIMARY KEY REFERENCES public.profiles(id), currency text NOT NULL DEFAULT 'NGN' CHECK (currency='NGN'),
  balance_kobo bigint NOT NULL DEFAULT 0 CHECK (balance_kobo BETWEEN 0 AND 9000000000000),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.wallets(customer_id),
  kind text NOT NULL CHECK (kind IN ('top_up','checkout','refund')), reference text NOT NULL UNIQUE,
  amount_kobo bigint NOT NULL CHECK (amount_kobo<>0 AND amount_kobo BETWEEN -1000000000 AND 1000000000),
  balance_after_kobo bigint NOT NULL CHECK (balance_after_kobo BETWEEN 0 AND 9000000000000),
  order_id uuid REFERENCES public.orders(id), payment_id uuid REFERENCES vendo_internal.payment_intents(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((kind='checkout' AND amount_kobo<0 AND order_id IS NOT NULL AND payment_id IS NULL) OR
    (kind='top_up' AND amount_kobo>0 AND payment_id IS NOT NULL AND order_id IS NULL) OR
    (kind='refund' AND amount_kobo>0 AND order_id IS NOT NULL AND payment_id IS NULL))
);
CREATE INDEX wallet_history_idx ON public.wallet_transactions(customer_id,created_at DESC,id DESC);
CREATE TABLE vendo_internal.payment_webhooks (
  digest text PRIMARY KEY, event text NOT NULL, reference text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(), processed_at timestamptz
);
ALTER TABLE public.orders DROP CONSTRAINT orders_refund_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_refund_status_check CHECK (refund_status IN ('none','pending','refunded'));
ALTER TABLE vendo_internal.order_refunds DROP CONSTRAINT order_refunds_status_check;
ALTER TABLE vendo_internal.order_refunds ADD CONSTRAINT order_refunds_status_check CHECK (status IN ('pending','processed'));
ALTER TABLE vendo_internal.order_refunds ADD COLUMN processed_at timestamptz, ADD COLUMN provider_refund_id text UNIQUE;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.payment_webhooks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wallets,public.wallet_transactions,vendo_internal.payment_intents,vendo_internal.payment_webhooks FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.wallets,public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallets,public.wallet_transactions,vendo_internal.payment_intents,vendo_internal.payment_webhooks TO service_role;
CREATE POLICY wallets_own ON public.wallets FOR SELECT TO authenticated USING (customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=customer_id AND p.status='active'));
CREATE POLICY wallet_transactions_own ON public.wallet_transactions FOR SELECT TO authenticated USING (customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=customer_id AND p.status='active'));
CREATE FUNCTION vendo_internal.immutable_wallet_ledger() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Wallet ledger entries cannot be changed or deleted'; END;
$$;
REVOKE ALL ON FUNCTION vendo_internal.immutable_wallet_ledger() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER wallet_ledger_immutable BEFORE UPDATE OR DELETE ON public.wallet_transactions FOR EACH ROW EXECUTE FUNCTION vendo_internal.immutable_wallet_ledger();
