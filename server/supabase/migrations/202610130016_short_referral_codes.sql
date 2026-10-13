-- Referral codes become four characters (letters and digits) so they are easy to say and type.
-- Lookalikes (0/O, 1/I) are left out. Existing long codes are replaced with short ones.
ALTER TABLE vendo_internal.referral_codes DROP CONSTRAINT referral_codes_code_check;
DO $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  r record; candidate text;
BEGIN
  FOR r IN SELECT profile_id FROM vendo_internal.referral_codes WHERE char_length(code) > 6 LOOP
    LOOP
      SELECT string_agg(substr(alphabet, 1 + floor(random() * 32)::int, 1), '') INTO candidate FROM generate_series(1, 4);
      EXIT WHEN NOT EXISTS (SELECT 1 FROM vendo_internal.referral_codes WHERE code = candidate);
    END LOOP;
    UPDATE vendo_internal.referral_codes SET code = candidate WHERE profile_id = r.profile_id;
  END LOOP;
END $$;
-- Four characters normally, up to six once the four-character space gets crowded. Sixteen is still
-- allowed so a server that has not been redeployed yet keeps working after this runs.
ALTER TABLE vendo_internal.referral_codes ADD CONSTRAINT referral_codes_code_check CHECK (code ~ '^[A-Z0-9]{4,16}$');
