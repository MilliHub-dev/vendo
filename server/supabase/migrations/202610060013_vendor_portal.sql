ALTER TABLE public.vendors ADD COLUMN opening_hours jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(opening_hours)='array' AND jsonb_array_length(opening_hours) IN (0,7));
ALTER TABLE public.orders ADD COLUMN vendor_prep_minutes integer CHECK (vendor_prep_minutes BETWEEN 1 AND 180), ADD COLUMN vendor_rejection_reason text CHECK (length(vendor_rejection_reason)<=500);
