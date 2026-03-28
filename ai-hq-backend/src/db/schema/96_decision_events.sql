create table if not exists tenant_decision_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  tenant_key text not null default '',
  event_type text not null,
  actor text not null default '',
  source text not null default '',
  surface text not null default '',
  channel_type text not null default '',
  policy_outcome text not null default '',
  reason_codes jsonb not null default '[]'::jsonb,
  health_state_json jsonb not null default '{}'::jsonb,
  approval_posture_json jsonb not null default '{}'::jsonb,
  execution_posture_json jsonb not null default '{}'::jsonb,
  control_state_json jsonb not null default '{}'::jsonb,
  truth_version_id text not null default '',
  runtime_projection_id text not null default '',
  affected_surfaces jsonb not null default '[]'::jsonb,
  recommended_next_action_json jsonb not null default '{}'::jsonb,
  decision_context_json jsonb not null default '{}'::jsonb,
  event_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_decision_events_tenant_time
  on tenant_decision_events (tenant_id, event_at desc);

create index if not exists idx_tenant_decision_events_type_time
  on tenant_decision_events (event_type, event_at desc);

create index if not exists idx_tenant_decision_events_tenant_key_time
  on tenant_decision_events (tenant_key, event_at desc);
