-- ============================================================
-- tenant_users
-- ============================================================

create table if not exists tenant_users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_email text not null,
  full_name text not null default '',
  role text not null default 'operator',
  status text not null default 'invited',
  password_hash text,
  auth_provider text not null default 'local',
  email_verified boolean not null default false,
  session_version int not null default 1,
  permissions jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_users add column if not exists tenant_id uuid;
alter table tenant_users add column if not exists user_email text;
alter table tenant_users add column if not exists full_name text default '';
alter table tenant_users add column if not exists role text default 'operator';
alter table tenant_users add column if not exists status text default 'invited';
alter table tenant_users add column if not exists password_hash text;
alter table tenant_users add column if not exists auth_provider text default 'local';
alter table tenant_users add column if not exists email_verified boolean default false;
alter table tenant_users add column if not exists session_version int default 1;
alter table tenant_users add column if not exists permissions jsonb default '{}'::jsonb;
alter table tenant_users add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_users add column if not exists last_seen_at timestamptz;
alter table tenant_users add column if not exists last_login_at timestamptz;
alter table tenant_users add column if not exists created_at timestamptz default now();
alter table tenant_users add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_users alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'tenant_users_tenant_id_fkey') then
    begin
      alter table tenant_users
        add constraint tenant_users_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_users drop constraint if exists tenant_users_role_check';
  exception when others then null;
  end;

  begin
    alter table tenant_users
      add constraint tenant_users_role_check
      check (role in ('owner','admin','operator','member','marketer','analyst'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_users drop constraint if exists tenant_users_status_check';
  exception when others then null;
  end;

  begin
    alter table tenant_users
      add constraint tenant_users_status_check
      check (status in ('invited','active','disabled','removed'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_users drop constraint if exists tenant_users_auth_provider_check';
  exception when others then null;
  end;

  begin
    alter table tenant_users
      add constraint tenant_users_auth_provider_check
      check (auth_provider in ('local','google','microsoft','magic_link','system'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_tenant_users_email
  on tenant_users(tenant_id, lower(user_email));

create index if not exists idx_tenant_users_role
  on tenant_users(tenant_id, role, status, updated_at desc);

create index if not exists idx_tenant_users_login
  on tenant_users(lower(user_email), status, tenant_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_users_updated_at') then
    execute '
      create trigger trg_tenant_users_updated_at
      before update on tenant_users
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- auth_sessions
-- ============================================================

create table if not exists auth_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_user_id uuid not null,
  tenant_id uuid not null,
  session_token_hash text not null,
  session_version int not null default 1,
  ip text,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table auth_sessions add column if not exists tenant_user_id uuid;
alter table auth_sessions add column if not exists tenant_id uuid;
alter table auth_sessions add column if not exists session_token_hash text;
alter table auth_sessions add column if not exists session_version int default 1;
alter table auth_sessions add column if not exists ip text;
alter table auth_sessions add column if not exists user_agent text;
alter table auth_sessions add column if not exists expires_at timestamptz;
alter table auth_sessions add column if not exists revoked_at timestamptz;
alter table auth_sessions add column if not exists created_at timestamptz default now();
alter table auth_sessions add column if not exists last_seen_at timestamptz;

do $$
begin
  begin
    alter table auth_sessions alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'auth_sessions_tenant_user_id_fkey') then
    begin
      alter table auth_sessions
        add constraint auth_sessions_tenant_user_id_fkey
        foreign key (tenant_user_id) references tenant_users(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'auth_sessions_tenant_id_fkey') then
    begin
      alter table auth_sessions
        add constraint auth_sessions_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_auth_sessions_token_hash
  on auth_sessions(session_token_hash);

create index if not exists idx_auth_sessions_user_active
  on auth_sessions(tenant_user_id, expires_at desc)
  where revoked_at is null;

create index if not exists idx_auth_sessions_tenant_active
  on auth_sessions(tenant_id, expires_at desc)
  where revoked_at is null;