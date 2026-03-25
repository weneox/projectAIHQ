-- src/db/schema/47_runtime_projection.sql
-- FINAL v1.0
-- =========================================================
-- Runtime projection layer
-- canonical business graph -> AI-ready tenant runtime
-- =========================================================

begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
  ) then
    execute $fn$
      create or replace function set_updated_at()
      returns trigger
      as $f$
      begin
        new.updated_at = now();
        return new;
      end;
      $f$ language plpgsql;
    $fn$;
  end if;
exception when others then
  null;
end
$$;

-- =========================================================
-- 1) tenant_business_runtime_projection
-- one current AI-ready runtime row per tenant
-- =========================================================

create table if not exists tenant_business_runtime_projection (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null unique references tenants(id) on delete cascade,
  tenant_key text not null unique,

  projection_version text not null default 'runtime_projection_v1',
  status text not null default 'draft',
  is_current boolean not null default true,

  source_snapshot_id uuid references tenant_business_synthesis_snapshots(id) on delete set null,
  source_profile_id uuid references tenant_business_profile(id) on delete set null,
  source_capabilities_id uuid references tenant_business_capabilities(id) on delete set null,

  projection_hash text not null default '',

  identity_json jsonb not null default '{}'::jsonb,
  profile_json jsonb not null default '{}'::jsonb,
  capabilities_json jsonb not null default '{}'::jsonb,

  contacts_json jsonb not null default '[]'::jsonb,
  locations_json jsonb not null default '[]'::jsonb,
  hours_json jsonb not null default '[]'::jsonb,
  services_json jsonb not null default '[]'::jsonb,
  products_json jsonb not null default '[]'::jsonb,
  faq_json jsonb not null default '[]'::jsonb,
  policies_json jsonb not null default '[]'::jsonb,
  social_accounts_json jsonb not null default '[]'::jsonb,
  channels_json jsonb not null default '[]'::jsonb,
  media_assets_json jsonb not null default '[]'::jsonb,

  approved_knowledge_json jsonb not null default '[]'::jsonb,
  active_facts_json jsonb not null default '[]'::jsonb,
  channel_policies_json jsonb not null default '[]'::jsonb,

  inbox_json jsonb not null default '{}'::jsonb,
  comments_json jsonb not null default '{}'::jsonb,
  content_json jsonb not null default '{}'::jsonb,
  voice_json jsonb not null default '{}'::jsonb,
  lead_capture_json jsonb not null default '{}'::jsonb,
  handoff_json jsonb not null default '{}'::jsonb,

  retrieval_corpus_json jsonb not null default '[]'::jsonb,
  runtime_context_text text not null default '',

  readiness_score numeric(5,4) not null default 0.0000,
  readiness_label text not null default 'not_ready',
  confidence numeric(5,4) not null default 0.0000,
  confidence_label text not null default 'low',

  generated_by text not null default '',
  approved_by text not null default '',

  generated_at timestamptz,
  approved_at timestamptz,
  last_refreshed_at timestamptz,

  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_runtime_projection_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_runtime_projection_status_chk
    check (
      status in (
        'draft',
        'ready',
        'stale',
        'error',
        'archived'
      )
    ),

  constraint tenant_business_runtime_projection_readiness_score_chk
    check (readiness_score >= 0 and readiness_score <= 1),

  constraint tenant_business_runtime_projection_confidence_chk
    check (confidence >= 0 and confidence <= 1),

  constraint tenant_business_runtime_projection_readiness_label_chk
    check (
      readiness_label in (
        'not_ready',
        'partial',
        'ready',
        'strong'
      )
    ),

  constraint tenant_business_runtime_projection_confidence_label_chk
    check (
      confidence_label in (
        'low',
        'medium',
        'high',
        'very_high'
      )
    )
);

create index if not exists ix_tenant_business_runtime_projection_status
  on tenant_business_runtime_projection(status, updated_at desc);

create index if not exists ix_tenant_business_runtime_projection_snapshot
  on tenant_business_runtime_projection(source_snapshot_id)
  where source_snapshot_id is not null;

create index if not exists ix_tenant_business_runtime_projection_ready
  on tenant_business_runtime_projection(readiness_label, status, updated_at desc);

create index if not exists ix_tenant_business_runtime_projection_context
  on tenant_business_runtime_projection
  using gin (to_tsvector('simple', coalesce(runtime_context_text, '')));

drop trigger if exists trg_tenant_business_runtime_projection_updated_at on tenant_business_runtime_projection;
create trigger trg_tenant_business_runtime_projection_updated_at
before update on tenant_business_runtime_projection
for each row execute function set_updated_at();

-- =========================================================
-- 2) tenant_business_runtime_projection_runs
-- audit/history for projection refreshes
-- =========================================================

create table if not exists tenant_business_runtime_projection_runs (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  runtime_projection_id uuid references tenant_business_runtime_projection(id) on delete set null,
  source_snapshot_id uuid references tenant_business_synthesis_snapshots(id) on delete set null,

  trigger_type text not null default 'manual',
  status text not null default 'queued',
  projection_version text not null default 'runtime_projection_v1',

  started_at timestamptz,
  finished_at timestamptz,
  duration_ms integer not null default 0,

  profile_changed boolean not null default false,
  capabilities_changed boolean not null default false,
  graph_changed boolean not null default false,
  policies_changed boolean not null default false,
  channels_changed boolean not null default false,

  input_summary_json jsonb not null default '{}'::jsonb,
  output_summary_json jsonb not null default '{}'::jsonb,
  warnings_json jsonb not null default '[]'::jsonb,
  errors_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  error_code text not null default '',
  error_message text not null default '',

  requested_by text not null default '',
  runner_key text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_runtime_projection_runs_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_runtime_projection_runs_trigger_type_chk
    check (
      trigger_type in (
        'manual',
        'scheduled',
        'source_change',
        'review_approval',
        'system',
        'retry'
      )
    ),

  constraint tenant_business_runtime_projection_runs_status_chk
    check (
      status in (
        'queued',
        'running',
        'success',
        'partial',
        'failed',
        'cancelled'
      )
    ),

  constraint tenant_business_runtime_projection_runs_duration_ms_chk
    check (duration_ms >= 0)
);

create index if not exists ix_tenant_business_runtime_projection_runs_tenant
  on tenant_business_runtime_projection_runs(tenant_id, created_at desc);

create index if not exists ix_tenant_business_runtime_projection_runs_projection
  on tenant_business_runtime_projection_runs(runtime_projection_id, created_at desc);

create index if not exists ix_tenant_business_runtime_projection_runs_status
  on tenant_business_runtime_projection_runs(tenant_id, status, created_at desc);

drop trigger if exists trg_tenant_business_runtime_projection_runs_updated_at on tenant_business_runtime_projection_runs;
create trigger trg_tenant_business_runtime_projection_runs_updated_at
before update on tenant_business_runtime_projection_runs
for each row execute function set_updated_at();

-- =========================================================
-- 3) helper views
-- =========================================================

create or replace view v_tenant_current_runtime_projection as
select
  rp.id,
  rp.tenant_id,
  rp.tenant_key,
  rp.projection_version,
  rp.status,
  rp.is_current,
  rp.source_snapshot_id,
  rp.source_profile_id,
  rp.source_capabilities_id,
  rp.projection_hash,
  rp.identity_json,
  rp.profile_json,
  rp.capabilities_json,
  rp.contacts_json,
  rp.locations_json,
  rp.hours_json,
  rp.services_json,
  rp.products_json,
  rp.faq_json,
  rp.policies_json,
  rp.social_accounts_json,
  rp.channels_json,
  rp.media_assets_json,
  rp.approved_knowledge_json,
  rp.active_facts_json,
  rp.channel_policies_json,
  rp.inbox_json,
  rp.comments_json,
  rp.content_json,
  rp.voice_json,
  rp.lead_capture_json,
  rp.handoff_json,
  rp.retrieval_corpus_json,
  rp.runtime_context_text,
  rp.readiness_score,
  rp.readiness_label,
  rp.confidence,
  rp.confidence_label,
  rp.generated_at,
  rp.approved_at,
  rp.last_refreshed_at,
  rp.metadata_json,
  rp.created_at,
  rp.updated_at
from tenant_business_runtime_projection rp
where rp.is_current = true
  and rp.status in ('ready', 'stale', 'draft');

create or replace view v_tenant_runtime_readiness as
select
  t.id as tenant_id,
  t.tenant_key,

  case when coalesce(nullif(btrim(p.company_name), ''), '') <> '' then true else false end as has_profile_name,
  case when coalesce(nullif(btrim(p.summary_short), ''), '') <> '' then true else false end as has_profile_summary,
  case when exists (
    select 1 from tenant_services s
    where s.tenant_id = t.id and s.is_active = true
  ) then true else false end as has_services,
  case when exists (
    select 1 from tenant_contacts c
    where c.tenant_id = t.id and c.enabled = true
  ) then true else false end as has_contacts,
  case when exists (
    select 1 from tenant_business_channels ch
    where ch.tenant_id = t.id and ch.is_active = true
  ) then true else false end as has_channels,
  case when exists (
    select 1 from tenant_business_faq f
    where f.tenant_id = t.id and f.is_active = true
  ) then true else false end as has_faq,
  case when exists (
    select 1 from tenant_business_policies bp
    where bp.tenant_id = t.id and bp.is_active = true
  ) then true else false end as has_policies,
  case when exists (
    select 1 from tenant_knowledge_items k
    where k.tenant_id = t.id and k.status in ('approved', 'active')
  ) then true else false end as has_knowledge,
  rp.status as runtime_status,
  rp.readiness_score,
  rp.readiness_label,
  rp.confidence,
  rp.confidence_label,
  rp.last_refreshed_at,
  rp.updated_at as runtime_updated_at
from tenants t
left join tenant_business_profile p
  on p.tenant_id = t.id
left join tenant_business_runtime_projection rp
  on rp.tenant_id = t.id
 and rp.is_current = true;

-- =========================================================
-- 4) seed/backfill
-- create draft runtime rows for existing tenants if missing
-- =========================================================

insert into tenant_business_runtime_projection (
  tenant_id,
  tenant_key,
  projection_version,
  status,
  is_current,
  source_profile_id,
  source_capabilities_id,
  identity_json,
  profile_json,
  capabilities_json,
  generated_by,
  metadata_json
)
select
  t.id,
  coalesce(nullif(btrim(t.tenant_key), ''), t.id::text),
  'runtime_projection_v1',
  'draft',
  true,
  p.id,
  c.id,
  jsonb_build_object(
    'tenantId', t.id,
    'tenantKey', coalesce(nullif(btrim(t.tenant_key), ''), t.id::text)
  ),
  coalesce(p.profile_json, '{}'::jsonb),
  coalesce(c.capabilities_json, '{}'::jsonb),
  'migration_seed',
  '{}'::jsonb
from tenants t
left join tenant_business_profile p
  on p.tenant_id = t.id
left join tenant_business_capabilities c
  on c.tenant_id = t.id
where not exists (
  select 1
  from tenant_business_runtime_projection rp
  where rp.tenant_id = t.id
);

commit;