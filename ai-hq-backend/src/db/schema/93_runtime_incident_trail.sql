create table if not exists runtime_incidents (
  id uuid primary key default gen_random_uuid(),
  service text not null,
  area text not null,
  severity text not null default 'info',
  code text not null,
  reason_code text not null default '',
  request_id text,
  correlation_id text,
  tenant_id uuid,
  tenant_key text,
  detail_summary text not null default '',
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table runtime_incidents add column if not exists service text;
alter table runtime_incidents add column if not exists area text;
alter table runtime_incidents add column if not exists severity text default 'info';
alter table runtime_incidents add column if not exists code text;
alter table runtime_incidents add column if not exists reason_code text default '';
alter table runtime_incidents add column if not exists request_id text;
alter table runtime_incidents add column if not exists correlation_id text;
alter table runtime_incidents add column if not exists tenant_id uuid;
alter table runtime_incidents add column if not exists tenant_key text;
alter table runtime_incidents add column if not exists detail_summary text default '';
alter table runtime_incidents add column if not exists context jsonb default '{}'::jsonb;
alter table runtime_incidents add column if not exists occurred_at timestamptz default now();
alter table runtime_incidents add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table runtime_incidents alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table runtime_incidents alter column severity set default 'info';
  exception when others then null;
  end;
  begin
    alter table runtime_incidents alter column reason_code set default '';
  exception when others then null;
  end;
  begin
    alter table runtime_incidents alter column detail_summary set default '';
  exception when others then null;
  end;
  begin
    alter table runtime_incidents alter column context set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table runtime_incidents alter column occurred_at set default now();
  exception when others then null;
  end;
  begin
    alter table runtime_incidents alter column created_at set default now();
  exception when others then null;
  end;

  begin
    execute 'alter table runtime_incidents drop constraint if exists runtime_incidents_severity_check';
  exception when others then null;
  end;

  begin
    alter table runtime_incidents
      add constraint runtime_incidents_severity_check
      check (severity in ('info','warn','error'));
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'runtime_incidents_tenant_id_fkey') then
    begin
      alter table runtime_incidents
        add constraint runtime_incidents_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_runtime_incidents_service_occurred
  on runtime_incidents(service, occurred_at desc);

create index if not exists idx_runtime_incidents_severity_occurred
  on runtime_incidents(severity, occurred_at desc);

create index if not exists idx_runtime_incidents_tenant_occurred
  on runtime_incidents(tenant_id, occurred_at desc);
