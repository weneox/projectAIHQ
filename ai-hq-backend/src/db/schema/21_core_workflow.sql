-- ============================================================
-- proposals
-- ============================================================

create table if not exists proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tenant_key text,
  thread_id uuid,
  agent text not null,
  type text not null default 'generic',
  status text not null default 'pending',
  title text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decision_by text
);

alter table proposals add column if not exists tenant_id uuid;
alter table proposals add column if not exists tenant_key text;
alter table proposals add column if not exists id uuid;
alter table proposals add column if not exists thread_id uuid;
alter table proposals add column if not exists agent text;
alter table proposals add column if not exists type text;
alter table proposals add column if not exists status text;
alter table proposals add column if not exists title text;
alter table proposals add column if not exists payload jsonb default '{}'::jsonb;
alter table proposals add column if not exists created_at timestamptz default now();
alter table proposals add column if not exists decided_at timestamptz;
alter table proposals add column if not exists decision_by text;

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'proposals_conversation_id_fkey') then
    begin
      execute 'alter table proposals drop constraint proposals_conversation_id_fkey';
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='proposals' and column_name='conversation_id'
  ) then
    begin
      execute 'alter table proposals alter column conversation_id drop not null';
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='proposals' and column_name='agent_key'
  ) then
    begin
      execute 'alter table proposals alter column agent_key drop not null';
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns where table_name='proposals' and column_name='agent_key'
  ) and exists (
    select 1 from information_schema.columns where table_name='proposals' and column_name='agent'
  ) then
    begin
      execute 'update proposals set agent_key = agent where agent_key is null and agent is not null';
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  begin
    alter table proposals alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  begin
    execute 'alter table proposals drop constraint if exists proposals_status_check';
  exception when others then null;
  end;

  begin
    alter table proposals
      add constraint proposals_status_check
      check (status in ('pending','in_progress','approved','published','rejected'));
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'proposals_thread_id_fkey') then
    begin
      alter table proposals
        add constraint proposals_thread_id_fkey
        foreign key (thread_id) references threads(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'proposals_tenant_id_fkey') then
    begin
      alter table proposals
        add constraint proposals_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_proposals_status_created on proposals(status, created_at desc);
create index if not exists idx_proposals_tenant_status on proposals(tenant_id, status, created_at desc);
create index if not exists idx_proposals_tenant_key_status on proposals(tenant_key, status, created_at desc);

-- ============================================================
-- jobs
-- ============================================================

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tenant_key text,
  proposal_id uuid,
  type text not null default 'generic',
  status text not null default 'queued' check (status in ('queued','running','completed','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

alter table jobs add column if not exists tenant_id uuid;
alter table jobs add column if not exists tenant_key text;
alter table jobs add column if not exists id uuid;
alter table jobs add column if not exists proposal_id uuid;
alter table jobs add column if not exists type text;
alter table jobs add column if not exists status text;
alter table jobs add column if not exists input jsonb default '{}'::jsonb;
alter table jobs add column if not exists output jsonb default '{}'::jsonb;
alter table jobs add column if not exists error text;
alter table jobs add column if not exists created_at timestamptz default now();
alter table jobs add column if not exists started_at timestamptz;
alter table jobs add column if not exists finished_at timestamptz;

do $$
begin
  begin
    alter table jobs alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'jobs_proposal_id_fkey') then
    begin
      alter table jobs
        add constraint jobs_proposal_id_fkey
        foreign key (proposal_id) references proposals(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'jobs_tenant_id_fkey') then
    begin
      alter table jobs
        add constraint jobs_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_jobs_status_created on jobs(status, created_at desc);
create index if not exists idx_jobs_tenant_status_created on jobs(tenant_id, status, created_at desc);