BEGIN;

create table if not exists tenant_decision_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  tenant_key text not null default '',
  event_type text not null default 'execution_policy_decision',
  actor text not null default 'system',
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

alter table tenant_decision_events
  add column if not exists tenant_id uuid;

alter table tenant_decision_events
  add column if not exists tenant_key text not null default '';

alter table tenant_decision_events
  add column if not exists event_type text not null default 'execution_policy_decision';

alter table tenant_decision_events
  add column if not exists actor text not null default 'system';

alter table tenant_decision_events
  add column if not exists source text not null default '';

alter table tenant_decision_events
  add column if not exists surface text not null default '';

alter table tenant_decision_events
  add column if not exists channel_type text not null default '';

alter table tenant_decision_events
  add column if not exists policy_outcome text not null default '';

alter table tenant_decision_events
  add column if not exists reason_codes jsonb not null default '[]'::jsonb;

alter table tenant_decision_events
  add column if not exists health_state_json jsonb not null default '{}'::jsonb;

alter table tenant_decision_events
  add column if not exists approval_posture_json jsonb not null default '{}'::jsonb;

alter table tenant_decision_events
  add column if not exists execution_posture_json jsonb not null default '{}'::jsonb;

alter table tenant_decision_events
  add column if not exists control_state_json jsonb not null default '{}'::jsonb;

alter table tenant_decision_events
  add column if not exists truth_version_id text not null default '';

alter table tenant_decision_events
  add column if not exists runtime_projection_id text not null default '';

alter table tenant_decision_events
  add column if not exists affected_surfaces jsonb not null default '[]'::jsonb;

alter table tenant_decision_events
  add column if not exists recommended_next_action_json jsonb not null default '{}'::jsonb;

alter table tenant_decision_events
  add column if not exists decision_context_json jsonb not null default '{}'::jsonb;

alter table tenant_decision_events
  add column if not exists event_at timestamptz not null default now();

alter table tenant_decision_events
  add column if not exists created_at timestamptz not null default now();

do $$
begin
  begin
    alter table tenant_decision_events
      alter column tenant_key set default '';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column event_type set default 'execution_policy_decision';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column actor set default 'system';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column source set default '';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column surface set default '';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column channel_type set default '';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column policy_outcome set default '';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column reason_codes set default '[]'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column health_state_json set default '{}'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column approval_posture_json set default '{}'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column execution_posture_json set default '{}'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column control_state_json set default '{}'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column truth_version_id set default '';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column runtime_projection_id set default '';
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column affected_surfaces set default '[]'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column recommended_next_action_json set default '{}'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column decision_context_json set default '{}'::jsonb;
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column event_at set default now();
  exception when others then null;
  end;

  begin
    alter table tenant_decision_events
      alter column created_at set default now();
  exception when others then null;
  end;
end $$;

create index if not exists idx_tenant_decision_events_tenant_event_at
  on tenant_decision_events (tenant_id, event_at desc);

create index if not exists idx_tenant_decision_events_tenant_key_event_at
  on tenant_decision_events (tenant_key, event_at desc);

create index if not exists idx_tenant_decision_events_event_type_event_at
  on tenant_decision_events (event_type, event_at desc);

create index if not exists idx_tenant_decision_events_surface_event_at
  on tenant_decision_events (surface, event_at desc);

COMMIT;