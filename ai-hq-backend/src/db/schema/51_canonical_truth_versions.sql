begin;

create table if not exists tenant_business_profile_versions (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  business_profile_id uuid references tenant_business_profile(id) on delete set null,
  business_capabilities_id uuid references tenant_business_capabilities(id) on delete set null,
  review_session_id uuid references tenant_setup_review_sessions(id) on delete set null,

  approved_at timestamptz not null default now(),
  approved_by text not null default '',

  source_summary_json jsonb not null default '{}'::jsonb,
  profile_snapshot_json jsonb not null default '{}'::jsonb,
  capabilities_snapshot_json jsonb not null default '{}'::jsonb,
  field_provenance_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint tenant_business_profile_versions_tenant_key_chk
    check (btrim(tenant_key) <> '')
);

create index if not exists ix_tenant_business_profile_versions_tenant_timeline
  on tenant_business_profile_versions(tenant_id, approved_at desc, created_at desc);

create index if not exists ix_tenant_business_profile_versions_review_session
  on tenant_business_profile_versions(review_session_id)
  where review_session_id is not null;

commit;
