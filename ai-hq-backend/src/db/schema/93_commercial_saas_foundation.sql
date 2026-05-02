-- ============================================================
-- Commercial SaaS foundation: lifecycle, usage, quotas
-- ============================================================

alter table tenants add column if not exists lifecycle_status text default 'active';
alter table tenants add column if not exists billing_status text default 'unconfigured';
alter table tenants add column if not exists trial_ends_at timestamptz;
alter table tenants add column if not exists suspended_at timestamptz;
alter table tenants add column if not exists suspension_reason text;
alter table tenants add column if not exists deleted_at timestamptz;
alter table tenants add column if not exists deletion_reason text;

alter table audit_log add column if not exists request_id text;
create index if not exists idx_audit_request_id
  on audit_log(request_id) where request_id is not null;

do $$
begin
  begin
    execute 'alter table tenants drop constraint if exists tenants_status_check';
  exception when others then null;
  end;

  begin
    alter table tenants
      add constraint tenants_status_check
      check (status in ('active','paused','trial','suspended','archived','deleted'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenants drop constraint if exists tenants_lifecycle_status_check';
  exception when others then null;
  end;

  begin
    alter table tenants
      add constraint tenants_lifecycle_status_check
      check (lifecycle_status in ('creating','trial','active','suspended','deleting','deleted','archived'));
  exception when others then null;
  end;
end$$;

create index if not exists idx_tenants_active_status_plan
  on tenants(active, status, plan_key, updated_at desc);

create index if not exists idx_tenants_lifecycle_status
  on tenants(lifecycle_status, updated_at desc);

create table if not exists tenant_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  tenant_key text not null,
  actor text not null default 'system',
  action text not null,
  status_from text,
  status_to text,
  reason text,
  meta jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_tenant_lifecycle_events_tenant_created
  on tenant_lifecycle_events(tenant_id, created_at desc);

create index if not exists idx_tenant_lifecycle_events_key_created
  on tenant_lifecycle_events(tenant_key, created_at desc);

create table if not exists tenant_usage_daily (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,
  usage_date date not null,
  plan_key text,
  api_calls int not null default 0,
  ai_units int not null default 0,
  messages_in int not null default 0,
  messages_out int not null default 0,
  webhook_events int not null default 0,
  quota_rejections int not null default 0,
  billable_events jsonb not null default '[]'::jsonb,
  last_event_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_usage_daily add column if not exists plan_key text;
alter table tenant_usage_daily add column if not exists api_calls int default 0;
alter table tenant_usage_daily add column if not exists ai_units int default 0;
alter table tenant_usage_daily add column if not exists messages_in int default 0;
alter table tenant_usage_daily add column if not exists messages_out int default 0;
alter table tenant_usage_daily add column if not exists webhook_events int default 0;
alter table tenant_usage_daily add column if not exists quota_rejections int default 0;
alter table tenant_usage_daily add column if not exists billable_events jsonb default '[]'::jsonb;
alter table tenant_usage_daily add column if not exists last_event_at timestamptz;
alter table tenant_usage_daily add column if not exists created_at timestamptz default now();
alter table tenant_usage_daily add column if not exists updated_at timestamptz default now();

create unique index if not exists uq_tenant_usage_daily_tenant_date
  on tenant_usage_daily(tenant_id, usage_date);

create index if not exists idx_tenant_usage_daily_key_date
  on tenant_usage_daily(tenant_key, usage_date desc);

create index if not exists idx_tenant_usage_daily_plan_date
  on tenant_usage_daily(plan_key, usage_date desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_usage_daily_updated_at') then
    execute '
      create trigger trg_tenant_usage_daily_updated_at
      before update on tenant_usage_daily
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;
