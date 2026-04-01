-- ============================================================
-- auth_identities
-- ============================================================

create table if not exists auth_identities (
  id uuid primary key default gen_random_uuid(),
  primary_email text not null,
  normalized_email text not null,
  password_hash text,
  auth_provider text not null default 'local',
  provider_subject text,
  email_verified boolean not null default false,
  status text not null default 'active',
  meta jsonb not null default '{}'::jsonb,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table auth_identities add column if not exists primary_email text;
alter table auth_identities add column if not exists normalized_email text;
alter table auth_identities add column if not exists password_hash text;
alter table auth_identities add column if not exists auth_provider text default 'local';
alter table auth_identities add column if not exists provider_subject text;
alter table auth_identities add column if not exists email_verified boolean default false;
alter table auth_identities add column if not exists status text default 'active';
alter table auth_identities add column if not exists meta jsonb default '{}'::jsonb;
alter table auth_identities add column if not exists last_login_at timestamptz;
alter table auth_identities add column if not exists created_at timestamptz default now();
alter table auth_identities add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table auth_identities alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  begin
    execute 'alter table auth_identities drop constraint if exists auth_identities_status_check';
  exception when others then null;
  end;

  begin
    alter table auth_identities
      add constraint auth_identities_status_check
      check (status in ('invited','active','disabled','removed'));
  exception when others then null;
  end;

  begin
    execute 'alter table auth_identities drop constraint if exists auth_identities_auth_provider_check';
  exception when others then null;
  end;

  begin
    alter table auth_identities
      add constraint auth_identities_auth_provider_check
      check (auth_provider in ('local','google','microsoft','magic_link','system'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_auth_identities_normalized_email
  on auth_identities(normalized_email);

create unique index if not exists uq_auth_identities_provider_subject
  on auth_identities(auth_provider, provider_subject)
  where provider_subject is not null and btrim(provider_subject) <> '';

create index if not exists idx_auth_identities_status
  on auth_identities(status, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_auth_identities_updated_at') then
    execute '
      create trigger trg_auth_identities_updated_at
      before update on auth_identities
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- auth_identity_memberships
-- ============================================================

create table if not exists auth_identity_memberships (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null,
  tenant_id uuid not null,
  role text not null default 'member',
  status text not null default 'active',
  permissions jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table auth_identity_memberships add column if not exists identity_id uuid;
alter table auth_identity_memberships add column if not exists tenant_id uuid;
alter table auth_identity_memberships add column if not exists role text default 'member';
alter table auth_identity_memberships add column if not exists status text default 'active';
alter table auth_identity_memberships add column if not exists permissions jsonb default '{}'::jsonb;
alter table auth_identity_memberships add column if not exists meta jsonb default '{}'::jsonb;
alter table auth_identity_memberships add column if not exists last_seen_at timestamptz;
alter table auth_identity_memberships add column if not exists created_at timestamptz default now();
alter table auth_identity_memberships add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table auth_identity_memberships alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_constraint where conname = 'auth_identity_memberships_identity_id_fkey'
  ) then
    begin
      alter table auth_identity_memberships
        add constraint auth_identity_memberships_identity_id_fkey
        foreign key (identity_id) references auth_identities(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'auth_identity_memberships_tenant_id_fkey'
  ) then
    begin
      alter table auth_identity_memberships
        add constraint auth_identity_memberships_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table auth_identity_memberships drop constraint if exists auth_identity_memberships_role_check';
  exception when others then null;
  end;

  begin
    alter table auth_identity_memberships
      add constraint auth_identity_memberships_role_check
      check (role in ('owner','admin','operator','member','marketer','analyst'));
  exception when others then null;
  end;

  begin
    execute 'alter table auth_identity_memberships drop constraint if exists auth_identity_memberships_status_check';
  exception when others then null;
  end;

  begin
    alter table auth_identity_memberships
      add constraint auth_identity_memberships_status_check
      check (status in ('invited','active','disabled','removed'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_auth_identity_memberships_identity_tenant
  on auth_identity_memberships(identity_id, tenant_id);

create index if not exists idx_auth_identity_memberships_tenant_status
  on auth_identity_memberships(tenant_id, status, updated_at desc);

create index if not exists idx_auth_identity_memberships_identity_status
  on auth_identity_memberships(identity_id, status, updated_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_auth_identity_memberships_updated_at'
  ) then
    execute '
      create trigger trg_auth_identity_memberships_updated_at
      before update on auth_identity_memberships
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- auth_identity_sessions
-- ============================================================

create table if not exists auth_identity_sessions (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null,
  active_tenant_id uuid,
  active_membership_id uuid,
  session_token_hash text not null,
  session_version int not null default 1,
  ip text,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table auth_identity_sessions add column if not exists identity_id uuid;
alter table auth_identity_sessions add column if not exists active_tenant_id uuid;
alter table auth_identity_sessions add column if not exists active_membership_id uuid;
alter table auth_identity_sessions add column if not exists session_token_hash text;
alter table auth_identity_sessions add column if not exists session_version int default 1;
alter table auth_identity_sessions add column if not exists ip text;
alter table auth_identity_sessions add column if not exists user_agent text;
alter table auth_identity_sessions add column if not exists expires_at timestamptz;
alter table auth_identity_sessions add column if not exists revoked_at timestamptz;
alter table auth_identity_sessions add column if not exists created_at timestamptz default now();
alter table auth_identity_sessions add column if not exists last_seen_at timestamptz;

do $$
begin
  begin
    alter table auth_identity_sessions alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_constraint where conname = 'auth_identity_sessions_identity_id_fkey'
  ) then
    begin
      alter table auth_identity_sessions
        add constraint auth_identity_sessions_identity_id_fkey
        foreign key (identity_id) references auth_identities(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'auth_identity_sessions_active_tenant_id_fkey'
  ) then
    begin
      alter table auth_identity_sessions
        add constraint auth_identity_sessions_active_tenant_id_fkey
        foreign key (active_tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'auth_identity_sessions_active_membership_id_fkey'
  ) then
    begin
      alter table auth_identity_sessions
        add constraint auth_identity_sessions_active_membership_id_fkey
        foreign key (active_membership_id) references auth_identity_memberships(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_auth_identity_sessions_token_hash
  on auth_identity_sessions(session_token_hash);

create index if not exists idx_auth_identity_sessions_identity_active
  on auth_identity_sessions(identity_id, expires_at desc)
  where revoked_at is null;

create index if not exists idx_auth_identity_sessions_tenant_active
  on auth_identity_sessions(active_tenant_id, expires_at desc)
  where revoked_at is null;
