-- src/db/schema/41_source_fusion_core.sql
-- source-fusion core: normalized observations + synthesis snapshots

begin;

create table if not exists tenant_source_observations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid null,
  source_run_id uuid null,
  source_type text not null,

  observation_group text not null default 'general',
  claim_type text not null,
  claim_key text not null,

  raw_value_text text not null default '',
  raw_value_json jsonb not null default '{}'::jsonb,

  normalized_value_text text not null default '',
  normalized_value_json jsonb not null default '{}'::jsonb,

  evidence_text text not null default '',
  page_url text not null default '',
  page_title text not null default '',

  confidence numeric(5,4) not null default 0,
  confidence_label text not null default 'low',

  resolution_status text not null default 'pending',
  conflict_key text not null default '',

  extraction_method text not null default 'parser',
  extraction_model text not null default '',

  metadata_json jsonb not null default '{}'::jsonb,

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenant_source_observations_tenant
  on tenant_source_observations (tenant_id, created_at desc);

create index if not exists idx_tenant_source_observations_claim
  on tenant_source_observations (tenant_id, claim_type, normalized_value_text);

create index if not exists idx_tenant_source_observations_source_run
  on tenant_source_observations (source_run_id, created_at desc);

create index if not exists idx_tenant_source_observations_source
  on tenant_source_observations (tenant_id, source_type, claim_type);

create table if not exists tenant_business_synthesis_snapshots (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_run_id uuid null,

  synthesis_version text not null default 'source_fusion_v1',
  status text not null default 'generated',
  is_current boolean not null default false,

  sources_json jsonb not null default '[]'::jsonb,
  observations_json jsonb not null default '{}'::jsonb,
  conflicts_json jsonb not null default '[]'::jsonb,

  profile_json jsonb not null default '{}'::jsonb,
  capabilities_json jsonb not null default '{}'::jsonb,
  knowledge_items_json jsonb not null default '[]'::jsonb,

  summary_text text not null default '',
  confidence numeric(5,4) not null default 0,
  confidence_label text not null default 'low',

  metadata_json jsonb not null default '{}'::jsonb,

  created_by text not null default '',
  approved_by text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tenant_business_synthesis_snapshots_tenant
  on tenant_business_synthesis_snapshots (tenant_id, created_at desc);

create index if not exists idx_tenant_business_synthesis_snapshots_current
  on tenant_business_synthesis_snapshots (tenant_id, is_current, created_at desc);

commit;