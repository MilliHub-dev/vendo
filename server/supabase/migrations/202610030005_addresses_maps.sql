ALTER TABLE public.saved_addresses ADD COLUMN note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
  ADD COLUMN is_default boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX saved_addresses_one_default_idx ON public.saved_addresses(profile_id) WHERE is_default;
-- Public clients keep read-only ownership RLS. All mutations go through the API.
