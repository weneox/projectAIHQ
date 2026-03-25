-- src/db/schema/49_setup_review_sessions.sql
-- setup review session layer
-- purpose:
-- 1) keep confirmed canonical truth untouched during setup retests
-- 2) keep current setup/import work in a separate active review session draft
-- 3) link evidence/snapshots/candidates to a specific review session
-- 4) allow finalize/discard flows without corrupting canonical truth

BEGIN;

-- ---------------------------------------------------------------------------
-- updated_at trigger helper for new setup review tables
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_tenant_setup_review_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- main review session table
-- one tenant can only have one active session at a time
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_setup_review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'processing', 'ready', 'finalized', 'discarded', 'failed')),

  mode text NOT NULL DEFAULT 'setup'
    CHECK (mode IN ('setup', 'refresh', 'rescan')),

  primary_source_type text NOT NULL DEFAULT '',
  primary_source_id uuid NULL,

  current_step text NOT NULL DEFAULT '',
  started_by uuid NULL,

  base_runtime_projection_id uuid NULL,

  title text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz NULL,
  discarded_at timestamptz NULL,
  failed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_sessions_tenant_id
  ON public.tenant_setup_review_sessions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_sessions_tenant_status
  ON public.tenant_setup_review_sessions (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_sessions_started_at
  ON public.tenant_setup_review_sessions (started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenant_setup_review_sessions_active_per_tenant
  ON public.tenant_setup_review_sessions (tenant_id)
  WHERE status IN ('draft', 'processing', 'ready');

DROP TRIGGER IF EXISTS trg_touch_tenant_setup_review_sessions_updated_at
  ON public.tenant_setup_review_sessions;

CREATE TRIGGER trg_touch_tenant_setup_review_sessions_updated_at
BEFORE UPDATE ON public.tenant_setup_review_sessions
FOR EACH ROW
EXECUTE FUNCTION public.touch_tenant_setup_review_updated_at();

-- ---------------------------------------------------------------------------
-- session <-> source link table
-- needed so a single setup session can hold multiple attached sources cleanly
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_setup_review_session_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.tenant_setup_review_sessions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  source_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'context'
    CHECK (role IN ('primary', 'context', 'supporting')),

  label text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0 CHECK (position >= 0),

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  attached_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_tenant_setup_review_session_sources UNIQUE (session_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_session_sources_session_id
  ON public.tenant_setup_review_session_sources (session_id);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_session_sources_tenant_id
  ON public.tenant_setup_review_session_sources (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_session_sources_source_id
  ON public.tenant_setup_review_session_sources (source_id);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_session_sources_role
  ON public.tenant_setup_review_session_sources (session_id, role, position);

-- ---------------------------------------------------------------------------
-- materialized draft shown to setup UI
-- UI should read this, not canonical truth, during review
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_setup_review_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE REFERENCES public.tenant_setup_review_sessions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  draft_payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  business_profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  knowledge_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,

  source_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  completeness jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  diff_from_canonical jsonb NOT NULL DEFAULT '{}'::jsonb,

  last_snapshot_id uuid NULL,

  version integer NOT NULL DEFAULT 1 CHECK (version > 0),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_drafts_tenant_id
  ON public.tenant_setup_review_drafts (tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_drafts_updated_at
  ON public.tenant_setup_review_drafts (updated_at DESC);

DROP TRIGGER IF EXISTS trg_touch_tenant_setup_review_drafts_updated_at
  ON public.tenant_setup_review_drafts;

CREATE TRIGGER trg_touch_tenant_setup_review_drafts_updated_at
BEFORE UPDATE ON public.tenant_setup_review_drafts
FOR EACH ROW
EXECUTE FUNCTION public.touch_tenant_setup_review_updated_at();

-- ---------------------------------------------------------------------------
-- audit / debugging / recovery event log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tenant_setup_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.tenant_setup_review_sessions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_events_session_id
  ON public.tenant_setup_review_events (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_events_tenant_id
  ON public.tenant_setup_review_events (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tenant_setup_review_events_event_type
  ON public.tenant_setup_review_events (event_type);

-- ---------------------------------------------------------------------------
-- helper to add nullable review_session_id to existing evidence/source tables
-- safely no-op if the table does not exist
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._setup_review_add_review_session_link(p_table_name text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_table_exists boolean;
  v_column_exists boolean;
  v_constraint_name text;
  v_index_name text;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = p_table_name
  )
  INTO v_table_exists;

  IF NOT v_table_exists THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table_name
      AND column_name = 'review_session_id'
  )
  INTO v_column_exists;

  IF NOT v_column_exists THEN
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN review_session_id uuid NULL',
      p_table_name
    );
  END IF;

  v_constraint_name := p_table_name || '_review_session_id_fkey';
  v_index_name := 'idx_' || p_table_name || '_review_session_id';

  BEGIN
    EXECUTE format(
      'ALTER TABLE public.%I
         ADD CONSTRAINT %I
         FOREIGN KEY (review_session_id)
         REFERENCES public.tenant_setup_review_sessions(id)
         ON DELETE SET NULL',
      p_table_name,
      v_constraint_name
    );
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON public.%I (review_session_id)',
    v_index_name,
    p_table_name
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- attach review_session_id to likely evidence/source lifecycle tables
-- all calls are safe even if a table is missing in this environment
-- ---------------------------------------------------------------------------

SELECT public._setup_review_add_review_session_link('tenant_source_sync_runs');
SELECT public._setup_review_add_review_session_link('tenant_source_raw_artifacts');
SELECT public._setup_review_add_review_session_link('tenant_source_observations');
SELECT public._setup_review_add_review_session_link('tenant_source_claims');
SELECT public._setup_review_add_review_session_link('tenant_business_synthesis_snapshots');
SELECT public._setup_review_add_review_session_link('tenant_knowledge_candidates');

-- optional compatibility names in case one of these exists in your branch
SELECT public._setup_review_add_review_session_link('tenant_source_runs');
SELECT public._setup_review_add_review_session_link('tenant_source_artifacts');
SELECT public._setup_review_add_review_session_link('tenant_business_claims');
SELECT public._setup_review_add_review_session_link('tenant_source_candidates');

-- cleanup helper; migration has already done its work
DROP FUNCTION IF EXISTS public._setup_review_add_review_session_link(text);

COMMIT;