ALTER TABLE public.orders DROP CONSTRAINT orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status IN ('pending_payment','scheduled','awaiting_vendor','searching_rider','rider_assigned','picked_up','on_the_way','delivered','cancelled','disputed'));
ALTER TABLE public.orders ADD COLUMN scheduled_at timestamptz, ADD COLUMN checkout_scheduled_at timestamptz, ADD COLUMN processing_due_at timestamptz,
  ADD COLUMN status_updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN picked_up_at timestamptz,
  ADD COLUMN delivered_at timestamptz, ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancellation_fee_kobo bigint NOT NULL DEFAULT 0 CHECK (cancellation_fee_kobo BETWEEN 0 AND 1000000000),
  ADD COLUMN cancellation_reason text CHECK (char_length(cancellation_reason) <= 500);
UPDATE public.orders o SET status_updated_at=COALESCE((SELECT max(created_at) FROM public.order_events e WHERE e.order_id=o.id),o.created_at),
  delivered_at=CASE WHEN status='delivered' THEN COALESCE((SELECT max(created_at) FROM public.order_events e WHERE e.order_id=o.id),o.created_at) END,
  cancelled_at=CASE WHEN status='cancelled' THEN COALESCE((SELECT max(created_at) FROM public.order_events e WHERE e.order_id=o.id),o.created_at) END;
ALTER TABLE public.orders ADD CONSTRAINT schedule_fields CHECK ((scheduled_at IS NULL)=(processing_due_at IS NULL)),
  ADD CONSTRAINT scheduled_is_paid CHECK (status<>'scheduled' OR (scheduled_at IS NOT NULL AND payment_status='paid'));
CREATE INDEX orders_due_idx ON public.orders(processing_due_at) WHERE status='scheduled';
CREATE INDEX orders_status_age_idx ON public.orders(status,status_updated_at);
ALTER TABLE public.order_events ADD COLUMN reason text;
CREATE FUNCTION public.touch_order_status() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN IF NEW.status IS DISTINCT FROM OLD.status THEN NEW.status_updated_at=now(); END IF; RETURN NEW; END;
$$;
REVOKE ALL ON FUNCTION public.touch_order_status() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER orders_status_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.touch_order_status();
CREATE TABLE vendo_internal.city_order_policies (
  city_id uuid PRIMARY KEY REFERENCES public.cities(id), assigned_cancellation_fee_kobo bigint NOT NULL CHECK (assigned_cancellation_fee_kobo BETWEEN 0 AND 1000000000),
  food_cancel_after_accept boolean NOT NULL, schedule_min_lead_minutes int NOT NULL CHECK (schedule_min_lead_minutes BETWEEN 15 AND 1440),
  schedule_max_days int NOT NULL CHECK (schedule_max_days BETWEEN 1 AND 30), schedule_edit_cutoff_minutes int NOT NULL CHECK (schedule_edit_cutoff_minutes BETWEEN 1 AND 1440),
  schedule_activation_lead_minutes int NOT NULL CHECK (schedule_activation_lead_minutes BETWEEN 1 AND 1440),
  unpaid_timeout_minutes int NOT NULL CHECK (unpaid_timeout_minutes BETWEEN 5 AND 1440), vendor_timeout_minutes int NOT NULL CHECK (vendor_timeout_minutes BETWEEN 1 AND 120),
  dispute_window_hours int NOT NULL CHECK (dispute_window_hours BETWEEN 1 AND 720),
  CHECK (schedule_min_lead_minutes >= schedule_activation_lead_minutes AND schedule_activation_lead_minutes >= schedule_edit_cutoff_minutes)
);
CREATE TABLE vendo_internal.order_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id),
  amount_kobo bigint NOT NULL CHECK (amount_kobo BETWEEN 0 AND 1000000000), status text NOT NULL DEFAULT 'pending' CHECK (status='pending'), created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO vendo_internal.order_refunds (order_id,amount_kobo) SELECT id,(quote->>'total_kobo')::bigint FROM public.orders WHERE payment_status='paid' AND refund_status='pending';
CREATE TABLE public.order_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id), customer_id uuid NOT NULL REFERENCES public.profiles(id),
  category text NOT NULL CHECK (category IN ('delivery','items','payment','other')), message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')), resolution text CHECK (char_length(resolution) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
  CHECK ((status='open' AND resolved_at IS NULL AND resolution IS NULL) OR (status='resolved' AND resolved_at IS NOT NULL AND resolution IS NOT NULL))
);
CREATE TABLE public.order_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL UNIQUE REFERENCES public.orders(id), customer_id uuid NOT NULL REFERENCES public.profiles(id),
  service_rating int NOT NULL CHECK (service_rating BETWEEN 1 AND 5), vendor_rating int CHECK (vendor_rating BETWEEN 1 AND 5), rider_rating int CHECK (rider_rating BETWEEN 1 AND 5),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment)<=1000), created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vendo_internal.city_order_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.order_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendo_internal.city_order_policies,vendo_internal.order_refunds FROM PUBLIC,anon,authenticated;
ALTER TABLE public.order_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_ratings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_disputes,public.order_ratings FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.order_disputes,public.order_ratings TO authenticated;
GRANT ALL ON public.order_disputes,public.order_ratings TO service_role;
CREATE POLICY disputes_own ON public.order_disputes FOR SELECT TO authenticated USING (customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=customer_id AND p.status='active'));
CREATE POLICY ratings_own ON public.order_ratings FOR SELECT TO authenticated USING (customer_id=(SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=customer_id AND p.status='active'));
-- Scheduling, timeouts and fee policies are opt-in per city; no invented business rules are seeded.
