create table if not exists tenant_execution_policy_controls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,
  scope_type text not null default 'tenant_default',
  surface_key text not null default 'tenant',
  autonomy_enabled boolean not null default true,
  operator_only_mode boolean not null default false,
  human_review_required boolean not null default false,
  handoff_preferred boolean not null default false,
  handoff_required boolean not null default false,
  blocked_until_repair boolean not null default false,
  emergency_stop boolean not null default false,
  policy_reason text not null default '',
  operator_note text not null default '',
  changed_by text not null default '',
  changed_at timestamptz not null default now(),
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_execution_policy_controls_scope_chk check (
    lower(scope_type) in ('tenant_default', 'channel')
  ),
  constraint tenant_execution_policy_controls_surface_chk check (
    lower(surface_key) in ('tenant', 'inbox', 'comments', 'voice', 'meta')
  ),
  constraint tenant_execution_policy_controls_uq unique (tenant_id, scope_type, surface_key)
);

create index if not exists idx_tenant_execution_policy_controls_tenant
  on tenant_execution_policy_controls (tenant_id, surface_key, updated_at desc);
