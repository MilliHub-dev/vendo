CREATE SCHEMA IF NOT EXISTS vendo_internal;
REVOKE ALL ON SCHEMA vendo_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE vendo_internal.email_verifications (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vendo_internal.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id),
  reason text CHECK (char_length(reason) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed')),
  requested_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vendo_internal.account_recovery_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  contact_email text NOT NULL,
  message text NOT NULL CHECK (char_length(message) BETWEEN 10 AND 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE vendo_internal.email_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.account_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.account_recovery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA vendo_internal FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.invalidate_email_verification() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    DELETE FROM vendo_internal.email_verifications WHERE profile_id = NEW.id;
    NEW.email_verified = false;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_email_verification() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER profiles_email_changed BEFORE UPDATE OF email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.invalidate_email_verification();

CREATE TABLE public.account_preferences (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  push_enabled boolean NOT NULL DEFAULT true,
  email_enabled boolean NOT NULL DEFAULT true,
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER preferences_updated_at BEFORE UPDATE ON public.account_preferences
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.account_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_preferences FROM anon, authenticated;
GRANT SELECT ON public.account_preferences TO authenticated;
GRANT ALL ON public.account_preferences TO service_role;
CREATE POLICY preferences_read_own ON public.account_preferences FOR SELECT TO authenticated
USING (profile_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.status = 'active'));

ALTER POLICY profiles_read_own ON public.profiles USING (id = (SELECT auth.uid()) AND status = 'active');
ALTER POLICY addresses_read_own ON public.saved_addresses
USING (profile_id = (SELECT auth.uid()) AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id AND p.status = 'active'));
