-- Additive billing fields so Bexio contacts can be filled from AGC profiles
-- (any country). first/last name map to Bexio person name_2 / name_1;
-- country_code (ISO 3166-1 alpha-2) maps to Bexio country_id.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS country_code text;

COMMENT ON COLUMN public.profiles.first_name IS 'Given name; mapped to Bexio contact name_2';
COMMENT ON COLUMN public.profiles.last_name IS 'Family name; mapped to Bexio contact name_1';
COMMENT ON COLUMN public.profiles.country_code IS 'ISO 3166-1 alpha-2; mapped to Bexio country_id';

-- Backfill names from full_name (last token = family name). Clients can correct
-- compound surnames on the next profile edit.
UPDATE public.profiles
SET
  first_name = CASE
    WHEN btrim(full_name) ~ '\s' THEN regexp_replace(btrim(full_name), '\s+\S+$', '')
    ELSE ''
  END,
  last_name = CASE
    WHEN btrim(full_name) ~ '\s' THEN regexp_replace(btrim(full_name), '^.*\s+', '')
    ELSE btrim(full_name)
  END
WHERE first_name IS NULL AND last_name IS NULL AND full_name IS NOT NULL AND btrim(full_name) <> '';

-- Best-effort ISO code from the legacy free-text country column.
UPDATE public.profiles SET country_code = 'CH'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('switzerland','schweiz','suisse','svizzera','swiss','ch');
UPDATE public.profiles SET country_code = 'ES'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('spain','espanya','españa','espanol','es');
UPDATE public.profiles SET country_code = 'FR'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('france','francia','fr');
UPDATE public.profiles SET country_code = 'DE'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('germany','deutschland','allemagne','de');
UPDATE public.profiles SET country_code = 'IT'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('italy','italia','it');
UPDATE public.profiles SET country_code = 'AT'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('austria','österreich','osterreich','at');
UPDATE public.profiles SET country_code = 'PT'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('portugal','pt');
UPDATE public.profiles SET country_code = 'GB'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('united kingdom','uk','great britain','england','gb');
UPDATE public.profiles SET country_code = 'US'
  WHERE country_code IS NULL AND lower(btrim(coalesce(country, ''))) IN ('united states','usa','united states of america','us');

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_country_code_iso;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_country_code_iso
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');
