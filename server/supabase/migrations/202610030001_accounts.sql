-- Run against Supabase Postgres: auth.users, auth.uid(), and API roles exist there.
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL UNIQUE CHECK (phone ~ '^\+234[789][0-9]{9}$'),
  name text CHECK (name IS NULL OR (name = btrim(name) AND char_length(name) BETWEEN 2 AND 100 AND name !~ '[[:cntrl:]]')),
  email text CHECK (email IS NULL OR (email = lower(btrim(email)) AND char_length(email) <= 254 AND email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
  email_verified boolean NOT NULL DEFAULT false,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'rider', 'admin', 'vendor_staff')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deactivated')),
  onboarding_step text GENERATED ALWAYS AS (
    CASE WHEN name IS NULL THEN 'name_required' WHEN email IS NULL THEN 'email_required' ELSE 'complete' END
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT name_before_email CHECK (email IS NULL OR name IS NOT NULL),
  CONSTRAINT verified_email_present CHECK (NOT email_verified OR email IS NOT NULL)
);

CREATE FUNCTION public.set_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  country text NOT NULL DEFAULT 'NG',
  is_active boolean NOT NULL DEFAULT false,
  -- Rates remain unset until approved. No invented fares in production seed data.
  base_fare_kobo bigint CHECK (base_fare_kobo >= 0),
  per_km_rate_kobo bigint CHECK (per_km_rate_kobo >= 0),
  opens_at time,
  closes_at time,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER cities_updated_at BEFORE UPDATE ON public.cities
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.profiles ADD COLUMN city_id uuid REFERENCES public.cities(id);

CREATE TABLE public.saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  city_id uuid REFERENCES public.cities(id),
  label text NOT NULL CHECK (char_length(label) BETWEEN 1 AND 80),
  address text NOT NULL CHECK (char_length(address) BETWEEN 1 AND 500),
  landmark text CHECK (char_length(landmark) <= 500),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_addresses_profile_id_idx ON public.saved_addresses(profile_id);
CREATE TRIGGER addresses_updated_at BEFORE UPDATE ON public.saved_addresses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles, public.cities, public.saved_addresses FROM anon, authenticated;
GRANT SELECT ON public.profiles, public.cities, public.saved_addresses TO authenticated;
GRANT SELECT ON public.cities TO anon;
GRANT ALL ON public.profiles, public.cities, public.saved_addresses TO service_role;

CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY cities_read_active ON public.cities FOR SELECT TO anon, authenticated USING (is_active);
CREATE POLICY addresses_read_own ON public.saved_addresses FOR SELECT TO authenticated USING (profile_id = (SELECT auth.uid()));

INSERT INTO public.cities (name) VALUES ('Abuja'), ('Kaduna'), ('Kano'), ('Lagos');
