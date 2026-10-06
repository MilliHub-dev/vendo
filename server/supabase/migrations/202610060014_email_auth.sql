-- Email identities may onboard before providing a contact phone.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
ALTER TABLE public.profiles DROP CONSTRAINT name_before_email;
ALTER TABLE public.profiles DROP COLUMN onboarding_step;
ALTER TABLE public.profiles ADD COLUMN onboarding_step text GENERATED ALWAYS AS (
  CASE WHEN name IS NULL THEN 'name_required' WHEN email IS NULL THEN 'email_required'
       WHEN phone IS NULL THEN 'phone_required' ELSE 'complete' END
) STORED;
