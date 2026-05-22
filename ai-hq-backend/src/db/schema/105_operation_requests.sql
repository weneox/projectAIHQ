-- Tenant-scoped operational records created from voice/web/API intake.

create table if not exists operation_requests (
  id uuid primary key,
  tenant_id uuid not null,
  tenant_key text not null,
  source_channel text not null default 'voice',
  source_call_id uuid null,
  source_event_id uuid null,
  source_tool_call_id text null,
  operation_type text not null,
  request_type text not null,
  business_family text not null default 'generic_business',
  status text not null default 'new',
  priority text not null default 'normal',
  title text not null default '',
  description text not null default '',
  customer_name text null,
  customer_phone text null,
  customer_email text null,
  company_name text null,
  requested_date text null,
  requested_time text null,
  location text null,
  address text null,
  assigned_to text null,
  due_at timestamptz null,
  resolved_at timestamptz null,
  slots jsonb not null default '{}'::jsonb,
  extraction jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table operation_requests add column if not exists tenant_id uuid;
alter table operation_requests add column if not exists tenant_key text default '';
alter table operation_requests add column if not exists source_channel text default 'voice';
alter table operation_requests add column if not exists source_call_id uuid;
alter table operation_requests add column if not exists source_event_id uuid;
alter table operation_requests add column if not exists source_tool_call_id text;
alter table operation_requests add column if not exists operation_type text default 'create_request';
alter table operation_requests add column if not exists request_type text default 'custom_request';
alter table operation_requests add column if not exists business_family text default 'generic_business';
alter table operation_requests add column if not exists status text default 'new';
alter table operation_requests add column if not exists priority text default 'normal';
alter table operation_requests add column if not exists title text default '';
alter table operation_requests add column if not exists description text default '';
alter table operation_requests add column if not exists customer_name text;
alter table operation_requests add column if not exists customer_phone text;
alter table operation_requests add column if not exists customer_email text;
alter table operation_requests add column if not exists company_name text;
alter table operation_requests add column if not exists requested_date text;
alter table operation_requests add column if not exists requested_time text;
alter table operation_requests add column if not exists location text;
alter table operation_requests add column if not exists address text;
alter table operation_requests add column if not exists assigned_to text;
alter table operation_requests add column if not exists due_at timestamptz;
alter table operation_requests add column if not exists resolved_at timestamptz;
alter table operation_requests add column if not exists slots jsonb default '{}'::jsonb;
alter table operation_requests add column if not exists extraction jsonb default '{}'::jsonb;
alter table operation_requests add column if not exists meta jsonb default '{}'::jsonb;
alter table operation_requests add column if not exists created_at timestamptz default now();
alter table operation_requests add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table operation_requests alter column source_channel set default 'voice';
    alter table operation_requests alter column business_family set default 'generic_business';
    alter table operation_requests alter column status set default 'new';
    alter table operation_requests alter column priority set default 'normal';
    alter table operation_requests alter column title set default '';
    alter table operation_requests alter column description set default '';
    alter table operation_requests alter column slots set default '{}'::jsonb;
    alter table operation_requests alter column extraction set default '{}'::jsonb;
    alter table operation_requests alter column meta set default '{}'::jsonb;
    alter table operation_requests alter column created_at set default now();
    alter table operation_requests alter column updated_at set default now();
  exception when others then null;
  end;

  begin
    alter table operation_requests
      add constraint operation_requests_tenant_id_fkey
      foreign key (tenant_id) references tenants(id) on delete cascade;
  exception when duplicate_object then null;
  when others then null;
  end;

  begin
    execute 'alter table operation_requests drop constraint if exists operation_requests_status_check';
    alter table operation_requests
      add constraint operation_requests_status_check
      check (status in ('new','in_review','waiting_customer','contacted','scheduled','resolved','cancelled','failed'));
  exception when others then null;
  end;

  begin
    execute 'alter table operation_requests drop constraint if exists operation_requests_priority_check';
    alter table operation_requests
      add constraint operation_requests_priority_check
      check (priority in ('low','normal','high','urgent'));
  exception when others then null;
  end;

  begin
    execute 'alter table operation_requests drop constraint if exists operation_requests_source_channel_check';
    alter table operation_requests
      add constraint operation_requests_source_channel_check
      check (source_channel in ('voice','webchat','whatsapp','email','manual','api','other'));
  exception when others then null;
  end;
end $$;

create index if not exists operation_requests_tenant_created_idx
  on operation_requests (tenant_id, created_at desc);

create index if not exists operation_requests_tenant_status_created_idx
  on operation_requests (tenant_id, status, created_at desc);

create index if not exists operation_requests_tenant_request_type_created_idx
  on operation_requests (tenant_id, request_type, created_at desc);

create index if not exists operation_requests_tenant_source_call_idx
  on operation_requests (tenant_id, source_call_id);

create index if not exists operation_requests_tenant_customer_phone_idx
  on operation_requests (tenant_id, customer_phone);

create unique index if not exists operation_requests_voice_tool_call_unique_idx
  on operation_requests (tenant_id, source_channel, source_tool_call_id)
  where source_tool_call_id is not null;
