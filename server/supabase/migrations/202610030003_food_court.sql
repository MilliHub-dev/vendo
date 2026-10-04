ALTER TABLE public.cities ADD COLUMN service_polygon jsonb,
  ADD COLUMN minimum_delivery_fee_kobo bigint NOT NULL DEFAULT 0 CHECK (minimum_delivery_fee_kobo BETWEEN 0 AND 1000000000),
  ADD COLUMN minimum_food_subtotal_kobo bigint NOT NULL DEFAULT 0 CHECK (minimum_food_subtotal_kobo BETWEEN 0 AND 1000000000);
CREATE TABLE public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, category text NOT NULL CHECK (category IN ('restaurant','fast_food','drinks','groceries','pharmacy')),
  cuisine text NOT NULL DEFAULT '', city_id uuid NOT NULL REFERENCES public.cities(id), address text NOT NULL,
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90), longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  is_open boolean NOT NULL DEFAULT false, is_active boolean NOT NULL DEFAULT true, image_url text,
  prep_minutes int NOT NULL DEFAULT 20 CHECK (prep_minutes BETWEEN 1 AND 180), rating double precision NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vendors_city_category_idx ON public.vendors(city_id, category);
CREATE TRIGGER vendors_updated BEFORE UPDATE ON public.vendors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), vendor_id uuid NOT NULL REFERENCES public.vendors(id), name text NOT NULL,
  description text NOT NULL DEFAULT '', price_kobo bigint NOT NULL CHECK (price_kobo BETWEEN 0 AND 1000000000), category text NOT NULL,
  is_available boolean NOT NULL DEFAULT true, image_url text, option_groups jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX menu_vendor_idx ON public.menu_items(vendor_id);
CREATE TRIGGER menu_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TABLE vendo_internal.vendor_staff (
  vendor_id uuid NOT NULL REFERENCES public.vendors(id), profile_id uuid NOT NULL REFERENCES public.profiles(id), PRIMARY KEY(vendor_id, profile_id)
);
CREATE TABLE vendo_internal.catalog_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL REFERENCES public.profiles(id), action text NOT NULL,
  target_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vendo_internal.food_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.profiles(id), vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  snapshot jsonb NOT NULL, pricing_version text NOT NULL, expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE INDEX food_quotes_expiry_idx ON vendo_internal.food_quotes(expires_at);
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, type text NOT NULL DEFAULT 'food' CHECK (type = 'food'),
  customer_id uuid NOT NULL REFERENCES public.profiles(id), vendor_id uuid NOT NULL REFERENCES public.vendors(id),
  quote_id uuid NOT NULL UNIQUE REFERENCES vendo_internal.food_quotes(id),
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','awaiting_vendor','searching_rider','rider_assigned','picked_up','on_the_way','delivered','cancelled','disputed')),
  payment_method text NOT NULL CHECK (payment_method IN ('wallet','card','transfer','ussd')), payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  refund_status text NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none','pending')), quote jsonb NOT NULL,
  idempotency_key text NOT NULL, vendor_ready_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, idempotency_key)
);
CREATE INDEX orders_customer_created_idx ON public.orders(customer_id, created_at DESC, id);
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id), actor_id uuid NOT NULL REFERENCES public.profiles(id),
  from_status text, to_status text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX order_events_order_created_idx ON public.order_events(order_id, created_at, id);
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vendors, public.menu_items, public.orders, public.order_events FROM anon, authenticated;
GRANT SELECT ON public.vendors, public.menu_items TO anon, authenticated;
GRANT SELECT ON public.orders, public.order_events TO authenticated;
GRANT ALL ON public.vendors, public.menu_items, public.orders, public.order_events TO service_role;
CREATE POLICY vendors_visible ON public.vendors FOR SELECT TO anon, authenticated USING (is_active AND EXISTS (SELECT 1 FROM public.cities c WHERE c.id = city_id AND c.is_active));
CREATE POLICY menu_visible ON public.menu_items FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.vendors v WHERE v.id = vendor_id));
CREATE POLICY orders_own ON public.orders FOR SELECT TO authenticated USING (customer_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = customer_id AND p.status = 'active'));
CREATE POLICY order_events_own ON public.order_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id));
ALTER TABLE vendo_internal.vendor_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.catalog_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.food_quotes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendo_internal.vendor_staff, vendo_internal.catalog_audit, vendo_internal.food_quotes FROM PUBLIC, anon, authenticated;
