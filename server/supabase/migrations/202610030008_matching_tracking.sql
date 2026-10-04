CREATE TABLE vendo_internal.riders (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id), city_id uuid NOT NULL REFERENCES public.cities(id),
  approval text NOT NULL DEFAULT 'pending' CHECK (approval IN ('pending','approved','rejected','suspended')),
  online boolean NOT NULL DEFAULT false, vehicle_type text NOT NULL CHECK (vehicle_type IN ('motorcycle','bicycle','car')),
  plate_number text NOT NULL CHECK (char_length(plate_number) BETWEEN 2 AND 30),
  approval_note text, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT online OR approval='approved')
);
CREATE TABLE vendo_internal.rider_locations (
  rider_id uuid PRIMARY KEY REFERENCES vendo_internal.riders(profile_id), lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180), accuracy_m double precision NOT NULL CHECK (accuracy_m BETWEEN 0 AND 500),
  heading double precision CHECK (heading>=0 AND heading<360), speed_mps double precision CHECK (speed_mps BETWEEN 0 AND 80),
  captured_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vendo_internal.matching_policies (
  city_id uuid PRIMARY KEY REFERENCES public.cities(id), initial_radius_m int NOT NULL CHECK (initial_radius_m BETWEEN 100 AND 50000),
  max_radius_m int NOT NULL CHECK (max_radius_m BETWEEN 100 AND 100000), radius_step_m int NOT NULL CHECK (radius_step_m BETWEEN 100 AND 50000),
  expansion_seconds int NOT NULL CHECK (expansion_seconds BETWEEN 5 AND 600), offer_seconds int NOT NULL CHECK (offer_seconds BETWEEN 5 AND 120),
  search_seconds int NOT NULL CHECK (search_seconds BETWEEN 30 AND 3600), location_max_age_seconds int NOT NULL CHECK (location_max_age_seconds BETWEEN 15 AND 300),
  max_accuracy_m int NOT NULL CHECK (max_accuracy_m BETWEEN 5 AND 500), CHECK (initial_radius_m<=max_radius_m AND search_seconds>=offer_seconds)
);
CREATE TABLE vendo_internal.matching_searches (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id), generation int NOT NULL DEFAULT 1 CHECK (generation>0),
  state text NOT NULL DEFAULT 'searching' CHECK (state IN ('searching','assigned','no_rider','closed')),
  started_at timestamptz NOT NULL DEFAULT now(), deadline_at timestamptz NOT NULL, radius_m int NOT NULL,
  reason text, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE vendo_internal.rider_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES public.orders(id), rider_id uuid NOT NULL REFERENCES vendo_internal.riders(profile_id),
  generation int NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
  distance_m int NOT NULL CHECK (distance_m>=0), offered_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL,
  responded_at timestamptz, UNIQUE(order_id,rider_id,generation)
);
CREATE UNIQUE INDEX one_pending_offer_per_order ON vendo_internal.rider_offers(order_id) WHERE status='pending';
CREATE UNIQUE INDEX one_pending_offer_per_rider ON vendo_internal.rider_offers(rider_id) WHERE status='pending';
-- Disputed jobs stay reserved until trusted operations explicitly resolve custody.
CREATE UNIQUE INDEX one_active_job_per_rider ON public.orders(assigned_rider_id)
  WHERE assigned_rider_id IS NOT NULL AND status IN ('rider_assigned','picked_up','on_the_way','disputed');
CREATE INDEX matching_orders_idx ON public.orders(created_at,id) WHERE status='searching_rider' AND payment_status='paid';
CREATE INDEX matching_riders_city_idx ON vendo_internal.riders(city_id) WHERE online AND approval='approved';
CREATE TABLE public.order_tracking (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id), rider_id uuid NOT NULL REFERENCES public.profiles(id),
  lat double precision NOT NULL CHECK (lat BETWEEN -90 AND 90), lng double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
  accuracy_m double precision NOT NULL CHECK (accuracy_m BETWEEN 0 AND 500), heading double precision CHECK (heading>=0 AND heading<360),
  speed_mps double precision CHECK (speed_mps BETWEEN 0 AND 80), captured_at timestamptz NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION vendo_internal.close_matching_offers() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.status<>'searching_rider' THEN
    UPDATE vendo_internal.rider_offers SET status='cancelled',responded_at=now() WHERE order_id=NEW.id AND status='pending';
    UPDATE vendo_internal.matching_searches SET state=CASE WHEN NEW.status IN ('rider_assigned','picked_up','on_the_way') THEN 'assigned' ELSE 'closed' END,updated_at=now() WHERE order_id=NEW.id;
  END IF;
  IF NEW.status NOT IN ('rider_assigned','picked_up','on_the_way') THEN DELETE FROM public.order_tracking WHERE order_id=NEW.id; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION vendo_internal.close_matching_offers() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER orders_close_matching AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION vendo_internal.close_matching_offers();
ALTER TABLE vendo_internal.riders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.rider_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.matching_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.matching_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendo_internal.rider_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_tracking ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendo_internal.riders,vendo_internal.rider_locations,vendo_internal.matching_policies,vendo_internal.matching_searches,vendo_internal.rider_offers,public.order_tracking FROM PUBLIC,anon,authenticated;
GRANT ALL ON vendo_internal.riders,vendo_internal.rider_locations,vendo_internal.matching_policies,vendo_internal.matching_searches,vendo_internal.rider_offers,public.order_tracking TO service_role;
GRANT SELECT ON public.order_tracking TO authenticated;
CREATE POLICY orders_assigned_rider ON public.orders FOR SELECT TO authenticated USING (assigned_rider_id=(SELECT auth.uid()) AND status IN ('rider_assigned','picked_up','on_the_way','disputed') AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active' AND p.role='rider'));
CREATE POLICY order_tracking_participants ON public.order_tracking FOR SELECT TO authenticated USING (
  EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=(SELECT auth.uid()) AND p.status='active') AND
  EXISTS(SELECT 1 FROM public.orders o WHERE o.id=order_id AND o.assigned_rider_id=rider_id AND o.status IN ('rider_assigned','picked_up','on_the_way') AND
    (o.customer_id=(SELECT auth.uid()) OR o.assigned_rider_id=(SELECT auth.uid()))));
-- No policy seeds: operations must approve matching windows, radii and GPS limits per city.
