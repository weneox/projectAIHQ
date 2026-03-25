-- ============================================================
-- threads
-- ============================================================

create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tenant_key text,
  title text,
  created_at timestamptz not null default now()
);

alter table threads add column if not exists tenant_id uuid;
alter table threads add column if not exists tenant_key text;

do $$
begin
  begin
    alter table threads alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'threads_tenant_id_fkey') then
    begin
      alter table threads
        add constraint threads_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_threads_tenant_created on threads(tenant_id, created_at desc);
create index if not exists idx_threads_tenant_key_created on threads(tenant_key, created_at desc);

-- ============================================================
-- messages
-- ============================================================

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references threads(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  agent text,
  content text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table messages add column if not exists id uuid;
alter table messages add column if not exists thread_id uuid;
alter table messages add column if not exists role text;
alter table messages add column if not exists agent text;
alter table messages add column if not exists content text;
alter table messages add column if not exists meta jsonb default '{}'::jsonb;
alter table messages add column if not exists created_at timestamptz default now();

do $$
begin
  if exists (select 1 from pg_constraint where conname = 'messages_conversation_id_fkey') then
    begin
      execute 'alter table messages drop constraint messages_conversation_id_fkey';
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name='messages' and column_name='conversation_id'
  ) then
    begin
      execute 'alter table messages alter column conversation_id drop not null';
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  begin
    alter table messages alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  begin
    alter table messages alter column thread_id set not null;
  exception when others then null;
  end;
end$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'messages_thread_id_fkey') then
    begin
      alter table messages
        add constraint messages_thread_id_fkey
        foreign key (thread_id) references threads(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_messages_thread_created on messages(thread_id, created_at);