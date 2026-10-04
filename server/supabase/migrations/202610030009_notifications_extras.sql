-- Private campaign configuration; no monetary campaign or legal copy is seeded.
ALTER TABLE public.account_preferences ADD COLUMN sms_enabled boolean NOT NULL DEFAULT false, ADD COLUMN reminders_enabled boolean NOT NULL DEFAULT true;
CREATE TABLE vendo_internal.promos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9_-]{3,32}$'),
 active boolean NOT NULL,starts_at timestamptz NOT NULL,ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 scope text NOT NULL CHECK(scope IN ('all','food','dispatch')),city_id uuid REFERENCES public.cities(id),vendor_id uuid REFERENCES public.vendors(id),
 basis text NOT NULL CHECK(basis IN ('delivery','food_subtotal')),kind text NOT NULL CHECK(kind IN ('fixed','percent')),
 value integer NOT NULL CHECK(value BETWEEN 1 AND 1000000000 AND (kind<>'percent' OR value<=10000)),max_discount_kobo integer NOT NULL CHECK(max_discount_kobo BETWEEN 1 AND 1000000000),
 minimum_total_kobo integer NOT NULL CHECK(minimum_total_kobo BETWEEN 0 AND 1000000000),max_uses integer NOT NULL CHECK(max_uses BETWEEN 1 AND 1000000),
 per_customer_limit integer NOT NULL CHECK(per_customer_limit BETWEEN 1 AND 1000),used_count integer NOT NULL DEFAULT 0 CHECK(used_count>=0),
 CHECK((vendor_id IS NULL AND basis<>'food_subtotal') OR scope='food')
);
CREATE TABLE vendo_internal.promo_redemptions (order_id uuid PRIMARY KEY REFERENCES public.orders(id),promo_id uuid NOT NULL REFERENCES vendo_internal.promos(id),customer_id uuid NOT NULL REFERENCES public.profiles(id),discount_kobo integer NOT NULL CHECK(discount_kobo>0),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX promo_customer_idx ON vendo_internal.promo_redemptions(promo_id,customer_id);
CREATE TABLE vendo_internal.referral_policies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),enabled boolean NOT NULL,config jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE vendo_internal.referral_codes (profile_id uuid PRIMARY KEY REFERENCES public.profiles(id),code text NOT NULL UNIQUE CHECK(code ~ '^[A-Z0-9]{16}$'));
CREATE TABLE vendo_internal.referrals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),referrer_id uuid NOT NULL REFERENCES public.profiles(id),referee_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),policy_id uuid NOT NULL REFERENCES vendo_internal.referral_policies(id),terms jsonb NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','rewarded','expired')),qualifying_order_id uuid UNIQUE REFERENCES public.orders(id),created_at timestamptz NOT NULL DEFAULT now(),rewarded_at timestamptz,last_checked_at timestamptz,CHECK(referrer_id<>referee_id));
ALTER TABLE public.wallet_transactions ADD COLUMN referral_id uuid REFERENCES vendo_internal.referrals(id);
ALTER TABLE public.wallet_transactions DROP CONSTRAINT wallet_transactions_kind_check, DROP CONSTRAINT wallet_transactions_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_kind_check CHECK(kind IN ('top_up','checkout','refund','referral')),
 ADD CONSTRAINT wallet_transactions_source_check CHECK(
 (kind='checkout' AND amount_kobo<0 AND order_id IS NOT NULL AND payment_id IS NULL AND referral_id IS NULL) OR
 (kind='top_up' AND amount_kobo>0 AND payment_id IS NOT NULL AND order_id IS NULL AND referral_id IS NULL) OR
 (kind='refund' AND amount_kobo>0 AND order_id IS NOT NULL AND payment_id IS NULL AND referral_id IS NULL) OR
 (kind='referral' AND amount_kobo>0 AND order_id IS NOT NULL AND payment_id IS NULL AND referral_id IS NOT NULL));
CREATE TABLE public.support_tickets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid NOT NULL REFERENCES public.profiles(id),subject text NOT NULL,category text NOT NULL CHECK(category IN ('order','payment','account','other')),order_id uuid REFERENCES public.orders(id),status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','resolved')),idempotency_key text NOT NULL,input jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(customer_id,idempotency_key));
CREATE TABLE public.support_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),ticket_id uuid NOT NULL REFERENCES public.support_tickets(id),actor_id uuid NOT NULL REFERENCES public.profiles(id),message text NOT NULL CHECK(length(message) BETWEEN 1 AND 3000),from_support boolean NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.legal_pages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),slug text NOT NULL CHECK(slug IN ('terms','privacy','refund')),version text NOT NULL,title text NOT NULL,content text NOT NULL,published_at timestamptz NOT NULL DEFAULT now(),UNIQUE(slug,version));
CREATE TABLE public.legal_acceptances (profile_id uuid NOT NULL REFERENCES public.profiles(id),legal_id uuid NOT NULL REFERENCES public.legal_pages(id),accepted_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(profile_id,legal_id));
CREATE TABLE public.notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES public.profiles(id),dedupe_key text NOT NULL,kind text NOT NULL,title text NOT NULL,body text NOT NULL,order_id uuid REFERENCES public.orders(id),expires_at timestamptz,read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(profile_id,dedupe_key));
CREATE INDEX notifications_inbox_idx ON public.notifications(profile_id,created_at DESC,id DESC);
CREATE TABLE vendo_internal.devices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES public.profiles(id),token text NOT NULL,token_hash text NOT NULL UNIQUE,platform text NOT NULL CHECK(platform IN ('android','ios')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE vendo_internal.notification_outbox (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),notification_id uuid NOT NULL REFERENCES public.notifications(id),channel text NOT NULL CHECK(channel IN ('push','sms','email','whatsapp')),device_id uuid REFERENCES vendo_internal.devices(id) ON DELETE SET NULL,target_key text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','sending','sent','skipped','failed')),attempts integer NOT NULL DEFAULT 0,available_at timestamptz NOT NULL DEFAULT now(),lease_id uuid,lease_until timestamptz,last_error text,UNIQUE(notification_id,channel,target_key));
CREATE INDEX notification_due_idx ON vendo_internal.notification_outbox(available_at) WHERE status IN ('pending','sending');
CREATE FUNCTION vendo_internal.notify(p uuid,k text,kind text,title text,body text,oid uuid DEFAULT NULL,expiry timestamptz DEFAULT NULL) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE nid uuid;
BEGIN
 INSERT INTO public.notifications(profile_id,dedupe_key,kind,title,body,order_id,expires_at)
 SELECT p,k,kind,title,body,oid,expiry FROM public.profiles WHERE id=p AND status='active'
 ON CONFLICT(profile_id,dedupe_key) DO NOTHING RETURNING id INTO nid;
 IF nid IS NULL THEN RETURN; END IF;
 INSERT INTO vendo_internal.notification_outbox(notification_id,channel,target_key) SELECT nid,c,c FROM unnest(ARRAY['sms','email','whatsapp']) AS c;
 INSERT INTO vendo_internal.notification_outbox(notification_id,channel,device_id,target_key) SELECT nid,'push',id,id::text FROM vendo_internal.devices WHERE profile_id=p;
END; $$;
CREATE FUNCTION vendo_internal.notify_order_event() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE o public.orders;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=NEW.order_id;
 PERFORM vendo_internal.notify(o.customer_id,'event:'||NEW.id,'order','Order update','Your order status is '||replace(NEW.to_status,'_',' ')||'. Open Vendo for details.',o.id);
 IF o.assigned_rider_id IS NOT NULL THEN
 PERFORM vendo_internal.notify(o.assigned_rider_id,'event:'||NEW.id,'order','Delivery update','Your delivery status changed. Open Vendo for details.',o.id);
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER notifications_order_event AFTER INSERT ON public.order_events FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_order_event();
CREATE FUNCTION vendo_internal.notify_offer() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 PERFORM vendo_internal.notify(NEW.rider_id,'offer:'||NEW.id,'rider_offer','New delivery offer','Open Vendo to review your delivery offer.',NEW.order_id,NEW.expires_at); RETURN NEW;
END; $$;
CREATE TRIGGER notifications_rider_offer AFTER INSERT ON vendo_internal.rider_offers FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_offer();
CREATE FUNCTION vendo_internal.notify_payment() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.status='succeeded' AND OLD.status<>'succeeded' THEN
 PERFORM vendo_internal.notify(NEW.customer_id,'payment:'||NEW.id,'payment','Payment confirmed','Your payment was confirmed. Open Vendo for details.',NEW.order_id);
 END IF;RETURN NEW;
END; $$;
CREATE TRIGGER notifications_payment AFTER UPDATE ON vendo_internal.payment_intents FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_payment();
CREATE FUNCTION vendo_internal.notify_refund() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p uuid;
BEGIN
 IF NEW.status='processed' AND OLD.status<>'processed' THEN
 SELECT customer_id INTO p FROM public.orders WHERE id=NEW.order_id;
 PERFORM vendo_internal.notify(p,'refund:'||NEW.order_id,'refund','Refund processed','Your refund was processed. Open Vendo for details.',NEW.order_id);
 END IF;RETURN NEW;
END; $$;
CREATE TRIGGER notifications_refund AFTER UPDATE ON vendo_internal.order_refunds FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_refund();
CREATE FUNCTION vendo_internal.notify_onboarding() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.onboarding_step='complete' AND OLD.onboarding_step<>'complete' THEN
 PERFORM vendo_internal.notify(NEW.id,'welcome','welcome','Welcome to Vendo','Your account is ready. Explore Vendo to get started.');
 END IF;RETURN NEW;
END; $$;
CREATE TRIGGER notifications_welcome AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_onboarding();
-- No direct client mutations; identities, campaign money, tokens and jobs are server-only.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['promos','promo_redemptions','referral_policies','referral_codes','referrals','devices','notification_outbox'] LOOP
 EXECUTE format('ALTER TABLE vendo_internal.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON vendo_internal.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT ALL ON vendo_internal.%I TO service_role',t);
 END LOOP;
 FOREACH t IN ARRAY ARRAY['support_tickets','support_messages','legal_pages','legal_acceptances','notifications'] LOOP
 EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
 EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
 END LOOP;
END $$;
GRANT SELECT ON public.legal_pages TO anon;
CREATE POLICY legal_public ON public.legal_pages FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY legal_acceptances_own ON public.legal_acceptances FOR SELECT TO authenticated USING(profile_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=profile_id AND status='active'));
CREATE POLICY notifications_own ON public.notifications FOR SELECT TO authenticated USING(profile_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=profile_id AND status='active'));
CREATE POLICY support_tickets_own ON public.support_tickets FOR SELECT TO authenticated USING(customer_id=(SELECT auth.uid()) AND EXISTS(SELECT 1 FROM public.profiles WHERE id=customer_id AND status='active'));
CREATE POLICY support_messages_own ON public.support_messages FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.support_tickets WHERE id=ticket_id AND customer_id=(SELECT auth.uid())));
REVOKE ALL ON FUNCTION vendo_internal.notify(uuid,text,text,text,text,uuid,timestamptz),vendo_internal.notify_order_event(),vendo_internal.notify_offer(),vendo_internal.notify_payment(),vendo_internal.notify_refund(),vendo_internal.notify_onboarding() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION vendo_internal.notify(uuid,text,text,text,text,uuid,timestamptz) TO service_role;
CREATE FUNCTION vendo_internal.notify_order_fields() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.payment_status='paid' AND OLD.payment_status<>'paid' AND NEW.payment_method='wallet' THEN
 PERFORM vendo_internal.notify(NEW.customer_id,'wallet-payment:'||NEW.id,'payment','Payment confirmed','Your wallet payment was confirmed. Open Vendo for details.',NEW.id);
 END IF;
 IF NEW.vendor_ready_at IS NOT NULL AND OLD.vendor_ready_at IS NULL THEN
 PERFORM vendo_internal.notify(NEW.customer_id,'ready:'||NEW.id,'order','Order ready','Your order is ready for pickup. Open Vendo for details.',NEW.id);
 IF NEW.assigned_rider_id IS NOT NULL THEN PERFORM vendo_internal.notify(NEW.assigned_rider_id,'ready:'||NEW.id,'order','Order ready','Your order is ready for pickup. Open Vendo for details.',NEW.id); END IF;
 END IF;RETURN NEW;
END; $$;
CREATE TRIGGER notifications_order_fields AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_order_fields();
CREATE FUNCTION vendo_internal.notify_no_rider() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE p uuid;
BEGIN
 IF NEW.state='no_rider' AND (TG_OP='INSERT' OR OLD.state<>'no_rider') THEN
 SELECT customer_id INTO p FROM public.orders WHERE id=NEW.order_id;
 PERFORM vendo_internal.notify(p,'no-rider:'||NEW.order_id||':'||NEW.generation,'no_rider','No rider available','We could not find a rider. Open Vendo to retry or review your options.',NEW.order_id);
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER notifications_no_rider AFTER INSERT OR UPDATE ON vendo_internal.matching_searches FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_no_rider();
REVOKE ALL ON FUNCTION vendo_internal.notify_order_fields(),vendo_internal.notify_no_rider() FROM PUBLIC,anon,authenticated;
