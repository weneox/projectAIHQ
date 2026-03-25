-- ============================================================
-- leads
-- ============================================================

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,
  source text not null default 'manual',
  source_ref text,

  inbox_thread_id uuid,
  proposal_id uuid,

  full_name text not null default '',
  username text,
  company text,
  phone text,
  email text,

  interest text,
  notes text not null default '',

  stage text not null default 'new',
  score int not null default 0,
  status text not null default 'open',

  owner text,
  priority text not null default 'normal',
  value_azn numeric(12,2) not null default 0,
  follow_up_at timestamptz,
  next_action text,
  won_reason text,
  lost_reason text,

  extra jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table leads add column if not exists tenant_id uuid;
alter table leads add column if not exists tenant_key text;
alter table leads add column if not exists source text;
alter table leads add column if not exists source_ref text;
alter table leads add column if not exists inbox_thread_id uuid;
alter table leads add column if not exists proposal_id uuid;
alter table leads add column if not exists full_name text;
alter table leads add column if not exists username text;
alter table leads add column if not exists company text;
alter table leads add column if not exists phone text;
alter table leads add column if not exists email text;
alter table leads add column if not exists interest text;
alter table leads add column if not exists notes text;
alter table leads add column if not exists stage text;
alter table leads add column if not exists score int;
alter table leads add column if not exists status text;
alter table leads add column if not exists owner text;
alter table leads add column if not exists priority text default 'normal';
alter table leads add column if not exists value_azn numeric(12,2) default 0;
alter table leads add column if not exists follow_up_at timestamptz;
alter table leads add column if not exists next_action text;
alter table leads add column if not exists won_reason text;
alter table leads add column if not exists lost_reason text;
alter table leads add column if not exists extra jsonb default '{}'::jsonb;
alter table leads add column if not exists created_at timestamptz default now();
alter table leads add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table leads alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table leads alter column source set default 'manual';
  exception when others then null;
  end;
  begin
    alter table leads alter column full_name set default '';
  exception when others then null;
  end;
  begin
    alter table leads alter column notes set default '';
  exception when others then null;
  end;
  begin
    alter table leads alter column stage set default 'new';
  exception when others then null;
  end;
  begin
    alter table leads alter column score set default 0;
  exception when others then null;
  end;
  begin
    alter table leads alter column status set default 'open';
  exception when others then null;
  end;
  begin
    alter table leads alter column priority set default 'normal';
  exception when others then null;
  end;
  begin
    alter table leads alter column value_azn set default 0;
  exception when others then null;
  end;
  begin
    alter table leads alter column extra set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table leads alter column updated_at set default now();
  exception when others then null;
  end;

  begin
    execute 'update leads set priority = ''normal'' where priority is null or priority = ''''';
  exception when others then null;
  end;

  begin
    execute 'update leads set value_azn = 0 where value_azn is null';
  exception when others then null;
  end;

  begin
    execute 'alter table leads drop constraint if exists leads_stage_check';
  exception when others then null;
  end;

  begin
    alter table leads
      add constraint leads_stage_check
      check (stage in ('new','contacted','qualified','proposal','won','lost'));
  exception when others then null;
  end;

  begin
    execute 'alter table leads drop constraint if exists leads_status_check';
  exception when others then null;
  end;

  begin
    alter table leads
      add constraint leads_status_check
      check (status in ('open','archived','spam','closed'));
  exception when others then null;
  end;

  begin
    execute 'alter table leads drop constraint if exists leads_priority_check';
  exception when others then null;
  end;

  begin
    alter table leads
      add constraint leads_priority_check
      check (priority in ('low','normal','high','urgent'));
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'leads_inbox_thread_id_fkey') then
    begin
      alter table leads
        add constraint leads_inbox_thread_id_fkey
        foreign key (inbox_thread_id) references inbox_threads(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_proposal_id_fkey') then
    begin
      alter table leads
        add constraint leads_proposal_id_fkey
        foreign key (proposal_id) references proposals(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_tenant_id_fkey') then
    begin
      alter table leads
        add constraint leads_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_leads_tenant_created on leads(tenant_id, created_at desc);
create index if not exists idx_leads_tenant_key_created on leads(tenant_key, created_at desc);
create index if not exists idx_leads_stage_created on leads(stage, created_at desc);
create index if not exists idx_leads_status_created on leads(status, created_at desc);
create index if not exists idx_leads_inbox_thread on leads(inbox_thread_id);
create index if not exists idx_leads_email on leads(email);
create index if not exists idx_leads_phone on leads(phone);
create index if not exists idx_leads_owner_updated on leads(owner, updated_at desc);
create index if not exists idx_leads_priority_updated on leads(priority, updated_at desc);
create index if not exists idx_leads_follow_up on leads(follow_up_at);
create index if not exists idx_leads_value on leads(value_azn desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_leads_updated_at') then
    execute '
      create trigger trg_leads_updated_at
      before update on leads
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- lead_events
-- ============================================================

create table if not exists lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null,
  tenant_id uuid,
  tenant_key text not null,
  type text not null,
  actor text not null default 'ai_hq',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table lead_events add column if not exists tenant_id uuid;
alter table lead_events add column if not exists tenant_key text;
alter table lead_events add column if not exists type text;
alter table lead_events add column if not exists actor text default 'ai_hq';
alter table lead_events add column if not exists payload jsonb default '{}'::jsonb;
alter table lead_events add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table lead_events alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table lead_events alter column actor set default 'ai_hq';
  exception when others then null;
  end;
  begin
    alter table lead_events alter column payload set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table lead_events alter column created_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'lead_events_lead_id_fkey') then
    begin
      alter table lead_events
        add constraint lead_events_lead_id_fkey
        foreign key (lead_id) references leads(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'lead_events_tenant_id_fkey') then
    begin
      alter table lead_events
        add constraint lead_events_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_lead_events_lead_created on lead_events(lead_id, created_at desc);
create index if not exists idx_lead_events_tenant_created on lead_events(tenant_id, created_at desc);
create index if not exists idx_lead_events_tenant_key_created on lead_events(tenant_key, created_at desc);
create index if not exists idx_lead_events_type_created on lead_events(type, created_at desc);