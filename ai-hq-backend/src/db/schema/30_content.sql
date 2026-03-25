-- ============================================================
-- content_items
-- ============================================================

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,

  proposal_id uuid,
  thread_id uuid,
  job_id uuid,

  status text not null default 'draft.ready',
  version int not null default 1,
  content_pack jsonb not null default '{}'::jsonb,
  last_feedback text not null default '',

  type text not null default 'image',
  title text not null default '',
  caption text not null default '',
  hashtags text not null default '',
  media jsonb not null default '{}'::jsonb,
  schedule_at timestamptz,
  approved_at timestamptz,
  approved_by text,
  published_at timestamptz,
  publish jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_items add column if not exists tenant_id uuid;
alter table content_items add column if not exists tenant_key text;
alter table content_items add column if not exists proposal_id uuid;
alter table content_items add column if not exists thread_id uuid;
alter table content_items add column if not exists job_id uuid;
alter table content_items add column if not exists status text;
alter table content_items add column if not exists version int;
alter table content_items add column if not exists content_pack jsonb default '{}'::jsonb;
alter table content_items add column if not exists last_feedback text;
alter table content_items add column if not exists type text;
alter table content_items add column if not exists title text;
alter table content_items add column if not exists caption text;
alter table content_items add column if not exists hashtags text;
alter table content_items add column if not exists media jsonb default '{}'::jsonb;
alter table content_items add column if not exists schedule_at timestamptz;
alter table content_items add column if not exists approved_at timestamptz;
alter table content_items add column if not exists approved_by text;
alter table content_items add column if not exists published_at timestamptz;
alter table content_items add column if not exists publish jsonb default '{}'::jsonb;
alter table content_items add column if not exists created_at timestamptz default now();
alter table content_items add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table content_items alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table content_items alter column status set default 'draft.ready';
  exception when others then null;
  end;
  begin
    alter table content_items alter column version set default 1;
  exception when others then null;
  end;
  begin
    alter table content_items alter column content_pack set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table content_items alter column last_feedback set default '';
  exception when others then null;
  end;
  begin
    alter table content_items alter column type set default 'image';
  exception when others then null;
  end;
  begin
    alter table content_items alter column title set default '';
  exception when others then null;
  end;
  begin
    alter table content_items alter column caption set default '';
  exception when others then null;
  end;
  begin
    alter table content_items alter column hashtags set default '';
  exception when others then null;
  end;
  begin
    alter table content_items alter column media set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table content_items alter column publish set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table content_items alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table content_items alter column updated_at set default now();
  exception when others then null;
  end;

  begin
    execute 'alter table content_items drop constraint if exists content_items_status_check';
  exception when others then null;
  end;

  begin
    alter table content_items
      add constraint content_items_status_check
      check (
        status like 'draft.%'
        OR status like 'voice.%'
        OR status like 'scene.%'
        OR status like 'asset.%'
        OR status like 'assets.%'
        OR status like 'render.%'
        OR status like 'qa.%'
        OR status like 'publish.%'
        OR status in ('publishing','published')
        OR status in (
          'pending',
          'queued',
          'running',
          'in_progress',
          'completed',
          'failed',
          'approved',
          'rejected',
          'pending_approval'
        )
      );
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'content_items_proposal_id_fkey') then
    begin
      alter table content_items
        add constraint content_items_proposal_id_fkey
        foreign key (proposal_id) references proposals(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_items_thread_id_fkey') then
    begin
      alter table content_items
        add constraint content_items_thread_id_fkey
        foreign key (thread_id) references threads(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_items_job_id_fkey') then
    begin
      alter table content_items
        add constraint content_items_job_id_fkey
        foreign key (job_id) references jobs(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_items_tenant_id_fkey') then
    begin
      alter table content_items
        add constraint content_items_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_content_proposal_updated on content_items(proposal_id, updated_at desc);
create index if not exists idx_content_status_updated on content_items(status, updated_at desc);
create index if not exists idx_content_tenant_status on content_items(tenant_id, status, created_at desc);
create index if not exists idx_content_tenant_key_status on content_items(tenant_key, status, created_at desc);
create index if not exists idx_content_schedule on content_items(status, schedule_at);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_content_items_updated_at') then
    execute '
      create trigger trg_content_items_updated_at
      before update on content_items
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- content_qa_reports
-- ============================================================

create table if not exists content_qa_reports (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,

  content_id uuid,
  proposal_id uuid,
  job_id uuid,

  status text not null default 'passed',
  score int not null default 0,

  checks jsonb not null default '{}'::jsonb,
  summary text not null default '',
  recommendations jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now()
);

alter table content_qa_reports add column if not exists tenant_id uuid;
alter table content_qa_reports add column if not exists tenant_key text;
alter table content_qa_reports add column if not exists content_id uuid;
alter table content_qa_reports add column if not exists proposal_id uuid;
alter table content_qa_reports add column if not exists job_id uuid;
alter table content_qa_reports add column if not exists status text default 'passed';
alter table content_qa_reports add column if not exists score int default 0;
alter table content_qa_reports add column if not exists checks jsonb default '{}'::jsonb;
alter table content_qa_reports add column if not exists summary text default '';
alter table content_qa_reports add column if not exists recommendations jsonb default '[]'::jsonb;
alter table content_qa_reports add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table content_qa_reports alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table content_qa_reports alter column status set default 'passed';
  exception when others then null;
  end;
  begin
    alter table content_qa_reports alter column score set default 0;
  exception when others then null;
  end;
  begin
    alter table content_qa_reports alter column checks set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table content_qa_reports alter column summary set default '';
  exception when others then null;
  end;
  begin
    alter table content_qa_reports alter column recommendations set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table content_qa_reports alter column created_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'content_qa_reports_tenant_id_fkey') then
    begin
      alter table content_qa_reports
        add constraint content_qa_reports_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_qa_reports_content_id_fkey') then
    begin
      alter table content_qa_reports
        add constraint content_qa_reports_content_id_fkey
        foreign key (content_id) references content_items(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_qa_reports_proposal_id_fkey') then
    begin
      alter table content_qa_reports
        add constraint content_qa_reports_proposal_id_fkey
        foreign key (proposal_id) references proposals(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_qa_reports_job_id_fkey') then
    begin
      alter table content_qa_reports
        add constraint content_qa_reports_job_id_fkey
        foreign key (job_id) references jobs(id) on delete set null;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table content_qa_reports drop constraint if exists content_qa_reports_status_check';
  exception when others then null;
  end;

  begin
    alter table content_qa_reports
      add constraint content_qa_reports_status_check
      check (status in ('passed','warning','failed'));
  exception when others then null;
  end;
end$$;

create index if not exists idx_content_qa_reports_content_created
  on content_qa_reports(content_id, created_at desc);

create index if not exists idx_content_qa_reports_proposal_created
  on content_qa_reports(proposal_id, created_at desc);

create index if not exists idx_content_qa_reports_job_created
  on content_qa_reports(job_id, created_at desc);

create index if not exists idx_content_qa_reports_tenant_created
  on content_qa_reports(tenant_id, created_at desc);