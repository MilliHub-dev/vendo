CREATE TABLE public.dispatch_packages (
  city_id uuid NOT NULL REFERENCES public.cities(id), size text NOT NULL CHECK (size IN ('document','small','large')),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 100), fee_kobo bigint NOT NULL CHECK (fee_kobo BETWEEN 0 AND 1000000000),
  max_weight_g int NOT NULL CHECK (max_weight_g BETWEEN 1 AND 100000),
  max_length_cm double precision NOT NULL CHECK (max_length_cm > 0 AND max_length_cm <= 300),
  max_width_cm double precision NOT NULL CHECK (max_width_cm > 0 AND max_width_cm <= 300),
  max_height_cm double precision NOT NULL CHECK (max_height_cm > 0 AND max_height_cm <= 300),
  is_active boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(city_id,size)
);
CREATE TRIGGER dispatch_packages_updated BEFORE UPDATE ON public.dispatch_packages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.dispatch_packages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dispatch_packages FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.dispatch_packages TO anon,authenticated;
GRANT ALL ON public.dispatch_packages TO service_role;
CREATE POLICY dispatch_packages_visible ON public.dispatch_packages FOR SELECT TO anon,authenticated
  USING (is_active AND EXISTS (SELECT 1 FROM public.cities c WHERE c.id=city_id AND c.is_active));
CREATE TABLE vendo_internal.dispatch_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid NOT NULL REFERENCES public.profiles(id), city_id uuid NOT NULL REFERENCES public.cities(id),
  snapshot jsonb NOT NULL, pricing_version text NOT NULL, package_config jsonb NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '5 minutes'
);
CREATE INDEX dispatch_quotes_expiry_idx ON vendo_internal.dispatch_quotes(expires_at);
ALTER TABLE public.orders ALTER COLUMN vendor_id DROP NOT NULL, ALTER COLUMN quote_id DROP NOT NULL;
ALTER TABLE public.orders DROP CONSTRAINT orders_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_type_check CHECK (type IN ('food','dispatch'));
ALTER TABLE public.orders ADD COLUMN dispatch_quote_id uuid UNIQUE REFERENCES vendo_internal.dispatch_quotes(id),
  ADD COLUMN assigned_rider_id uuid REFERENCES public.profiles(id);
ALTER TABLE public.orders ADD CONSTRAINT order_source_check CHECK (
  (type='food' AND vendor_id IS NOT NULL AND quote_id IS NOT NULL AND dispatch_quote_id IS NULL) OR
  (type='dispatch' AND vendor_id IS NULL AND quote_id IS NULL AND dispatch_quote_id IS NOT NULL)
);
CREATE TABLE vendo_internal.dispatch_delivery_codes (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id), encrypted_code text NOT NULL, code_hash text NOT NULL CHECK (code_hash ~ '^[a-f0-9]{64}$'),
  key_version text NOT NULL DEFAULT 'v1', attempts int NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  consumed_at timestamptz, locked_at timestamptz
);
ALTER TABLE vendo_internal.dispatch_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.dispatch_delivery_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendo_internal.dispatch_quotes, vendo_internal.dispatch_delivery_codes FROM PUBLIC,anon,authenticated;
-- Package fees and limits must be approved and configured per city; no production placeholders.
