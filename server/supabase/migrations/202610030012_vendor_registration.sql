ALTER TABLE public.vendors ADD COLUMN description text NOT NULL DEFAULT '',ADD COLUMN logo_url text;
CREATE TABLE vendo_internal.vendor_applications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),profile_id uuid NOT NULL REFERENCES public.profiles(id),input jsonb NOT NULL,idempotency_key text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN('pending','approved','rejected','withdrawn')),vendor_id uuid UNIQUE REFERENCES public.vendors(id),review_note text,reviewed_by uuid REFERENCES public.profiles(id),created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,CHECK((status='approved')=(vendor_id IS NOT NULL)),UNIQUE(profile_id,idempotency_key));
CREATE UNIQUE INDEX vendor_application_pending ON vendo_internal.vendor_applications(profile_id) WHERE status='pending';
CREATE INDEX vendor_application_queue ON vendo_internal.vendor_applications(status,created_at,id);
ALTER TABLE vendo_internal.vendor_applications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON vendo_internal.vendor_applications FROM PUBLIC,anon,authenticated;
GRANT ALL ON vendo_internal.vendor_applications TO service_role;
-- Notify eligible store staff only when a paid order enters vendor confirmation.
CREATE FUNCTION vendo_internal.notify_vendor_order() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE o public.orders; staff uuid;
BEGIN
 SELECT * INTO o FROM public.orders WHERE id=NEW.order_id;
 IF NEW.to_status='awaiting_vendor' AND o.vendor_id IS NOT NULL AND o.payment_status='paid' THEN
 FOR staff IN SELECT s.profile_id FROM vendo_internal.vendor_staff s JOIN public.profiles p ON p.id=s.profile_id WHERE s.vendor_id=o.vendor_id AND p.status='active' AND p.role='vendor_staff' LOOP
 PERFORM vendo_internal.notify(staff,'vendor-order:'||NEW.id,'vendor_order','New store order','A paid order needs your store confirmation. Open Vendo for details.',o.id,(SELECT o.status_updated_at+make_interval(mins=>p.vendor_timeout_minutes) FROM vendo_internal.city_order_policies p WHERE p.city_id=(o.quote->>'city_id')::uuid));
 END LOOP;END IF;RETURN NEW;
END; $$;
CREATE TRIGGER notifications_vendor_order AFTER INSERT ON public.order_events FOR EACH ROW EXECUTE FUNCTION vendo_internal.notify_vendor_order();
REVOKE ALL ON FUNCTION vendo_internal.notify_vendor_order() FROM PUBLIC,anon,authenticated;

ALTER TABLE vendo_internal.devices DROP CONSTRAINT devices_platform_check;
ALTER TABLE vendo_internal.devices ADD CONSTRAINT devices_platform_check CHECK(platform IN('android','ios','web'));
