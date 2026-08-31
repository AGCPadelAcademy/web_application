-- ============================================================================
-- Migration: 0003_bexio_integration
-- Purpose  : Provider-neutral billing integration schema for the Bexio
--            financial/accounting integration (spec: specs/features/007-bexio-integration).
--            Additive only — no existing table, policy, function, bucket, or
--            enum is altered in meaning.
--
-- Review notes
--   - Apply via the Supabase MCP `apply_migration` tool or the dashboard SQL
--     editor after review (same convention as 0001/0002).
--   - All statements are idempotent where practical (IF NOT EXISTS / DROP+CREATE).
--   - New tables are default-deny: RLS enabled, SELECT policies only where
--     documented below; ALL writes happen via the service role inside Edge
--     Functions (service role bypasses RLS).
--   - Secrets are NEVER stored in these tables — only Vault secret NAMES.
-- ============================================================================

-- 1. Extensions --------------------------------------------------------------
-- pg_cron + pg_net power the scheduled reconciliation worker (job registered
-- in migration 0004). supabase_vault is already installed; kept for safety.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- 2. billing_integrations (singleton per provider) ---------------------------

CREATE TABLE IF NOT EXISTS public.billing_integrations (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                text NOT NULL UNIQUE CHECK (provider = 'bexio'),
  status                  text NOT NULL DEFAULT 'not_connected'
    CHECK (status IN ('not_connected', 'connected', 'degraded', 'requires_reauth', 'disconnected')),
  config                  jsonb NOT NULL DEFAULT '{}'::jsonb,
  refresh_token_secret    text,          -- Vault secret NAME, never a value
  access_token_secret     text,          -- Vault secret NAME, never a value
  scopes                  text[],
  connected_at            timestamptz,
  connected_by            uuid,
  last_successful_call_at timestamptz,
  last_error              text,          -- sanitized; no payloads/tokens
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read billing integrations" ON public.billing_integrations;
CREATE POLICY "Admins can read billing integrations"
  ON public.billing_integrations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 3. billing_contacts (AGC user ↔ external accounting contact) ---------------

CREATE TABLE IF NOT EXISTS public.billing_contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider       text NOT NULL DEFAULT 'bexio',
  external_id    text NOT NULL,
  email_snapshot text NOT NULL,
  synced_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id),
  UNIQUE (provider, external_id)
);

ALTER TABLE public.billing_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read billing contacts" ON public.billing_contacts;
CREATE POLICY "Admins can read billing contacts"
  ON public.billing_contacts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 4. billing_documents (external invoice reference per booking) --------------

CREATE TABLE IF NOT EXISTS public.billing_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  provider        text NOT NULL DEFAULT 'bexio',
  external_id     text NOT NULL,
  document_nr     text,
  api_reference   text NOT NULL,
  status          text NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'partially_paid', 'paid', 'cancelled')),
  total           numeric(10, 2) NOT NULL,
  currency        text NOT NULL DEFAULT 'CHF',
  issued_at       timestamptz NOT NULL DEFAULT now(),
  last_synced_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (booking_id),
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS billing_documents_status_idx ON public.billing_documents(status);

ALTER TABLE public.billing_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and owners can read billing documents" ON public.billing_documents;
CREATE POLICY "Admins and owners can read billing documents"
  ON public.billing_documents
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = billing_documents.booking_id
        AND bookings.user_id = (SELECT auth.uid())
    )
  );

-- 5. billing_operations (idempotency + retry queue) --------------------------

CREATE TABLE IF NOT EXISTS public.billing_operations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind                text NOT NULL
    CHECK (kind IN ('contact_sync', 'invoice_issue', 'invoice_cancel', 'reconcile_check')),
  idempotency_key     text NOT NULL UNIQUE,
  booking_id          uuid REFERENCES public.bookings(id),
  billing_document_id uuid REFERENCES public.billing_documents(id),
  status              text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'succeeded', 'failed')),
  attempts            integer NOT NULL DEFAULT 0,
  max_attempts        integer NOT NULL DEFAULT 8,
  next_retry_at       timestamptz,
  last_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_operations_due_idx
  ON public.billing_operations(status, next_retry_at);

ALTER TABLE public.billing_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read billing operations" ON public.billing_operations;
CREATE POLICY "Admins can read billing operations"
  ON public.billing_operations
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 6. billing_events (append-only audit log) ----------------------------------

CREATE TABLE IF NOT EXISTS public.billing_events (
  id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type          text NOT NULL,
  actor_user_id       uuid,
  booking_id          uuid,
  billing_document_id uuid,
  details             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read billing events" ON public.billing_events;
CREATE POLICY "Admins can read billing events"
  ON public.billing_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 7. bookings: additive payment-confirmation attribution ---------------------

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_confirmation_source text
    CHECK (payment_confirmation_source IN ('bexio_reconciliation', 'manual_proof'));

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz;

-- 8. billing_public_config (world-readable boolean flag) ---------------------
-- Powers the frontend cutover branch (legacy generator vs Bexio path) without
-- leaking any integration detail. Runs with view-owner rights like the
-- existing booking_slots view (migration 0006 pattern); exposes one boolean.

CREATE OR REPLACE VIEW public.billing_public_config AS
SELECT EXISTS (
  SELECT 1
  FROM public.billing_integrations
  WHERE provider = 'bexio'
    AND status IN ('connected', 'degraded')
) AS integration_enabled;

GRANT SELECT ON public.billing_public_config TO authenticated;

-- 9. Vault helper RPCs (service-role only) -----------------------------------
-- Edge Functions cannot reach the vault schema through PostgREST, so secret
-- storage goes through these SECURITY DEFINER functions. Rotation semantics:
-- put = delete-by-name then create, so a name always resolves to one value.

CREATE OR REPLACE FUNCTION public.billing_get_secret(p_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  ORDER BY created_at DESC
  LIMIT 1;
  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_put_secret(p_name text, p_secret text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  DELETE FROM vault.secrets WHERE name = p_name;
  SELECT vault.create_secret(p_secret, p_name) INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_delete_secret(p_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM vault.secrets WHERE name = p_name;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_get_secret(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_put_secret(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_delete_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_get_secret(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_put_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_delete_secret(text) TO service_role;

-- ============================================================================
-- Post-migration checklist
--   1. Set Edge Function secrets (dashboard or CLI): BEXIO_CLIENT_ID,
--      BEXIO_CLIENT_SECRET, BEXIO_OAUTH_STATE_SECRET, PUBLIC_APP_URL.
--   2. Apply migration 0004 to register the reconciliation schedule.
--   3. Deploy the bexio-oauth Edge Function, then run the OAuth connect flow
--      from the admin Integrations tab.
-- ============================================================================
