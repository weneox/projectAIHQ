-- ============================================================
-- admin_auth_sessions
-- ============================================================

create table if not exists admin_auth_sessions (
  id uuid primary key default gen_random_uuid(),
  session_token_hash text not null,
  ip text,
  user_agent text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table admin_auth_sessions add column if not exists session_token_hash text;
alter table admin_auth_sessions add column if not exists ip text;
alter table admin_auth_sessions add column if not exists user_agent text;
alter table admin_auth_sessions add column if not exists expires_at timestamptz;
alter table admin_auth_sessions add column if not exists revoked_at timestamptz;
alter table admin_auth_sessions add column if not exists created_at timestamptz default now();
alter table admin_auth_sessions add column if not exists last_seen_at timestamptz;

do $$
begin
  begin
    alter table admin_auth_sessions alter column id set default gen_random_uuid();
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_admin_auth_sessions_token_hash
  on admin_auth_sessions(session_token_hash);

create index if not exists idx_admin_auth_sessions_active
  on admin_auth_sessions(expires_at desc)
  where revoked_at is null;

-- ============================================================
-- auth_login_attempts
-- ============================================================

create table if not exists auth_login_attempts (
  id uuid primary key default gen_random_uuid(),
  actor_type text not null,
  scope_key text not null,
  ip text not null,
  attempt_count int not null default 0,
  first_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  blocked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table auth_login_attempts add column if not exists actor_type text;
alter table auth_login_attempts add column if not exists scope_key text;
alter table auth_login_attempts add column if not exists ip text;
alter table auth_login_attempts add column if not exists attempt_count int default 0;
alter table auth_login_attempts add column if not exists first_attempt_at timestamptz default now();
alter table auth_login_attempts add column if not exists last_attempt_at timestamptz default now();
alter table auth_login_attempts add column if not exists blocked_until timestamptz;
alter table auth_login_attempts add column if not exists created_at timestamptz default now();
alter table auth_login_attempts add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table auth_login_attempts alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  begin
    execute 'alter table auth_login_attempts drop constraint if exists auth_login_attempts_actor_type_check';
  exception when others then null;
  end;

  begin
    alter table auth_login_attempts
      add constraint auth_login_attempts_actor_type_check
      check (actor_type in ('admin','user'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_auth_login_attempts_scope_ip
  on auth_login_attempts(actor_type, scope_key, ip);

create index if not exists idx_auth_login_attempts_blocked
  on auth_login_attempts(actor_type, blocked_until desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_auth_login_attempts_updated_at') then
    execute '
      create trigger trg_auth_login_attempts_updated_at
      before update on auth_login_attempts
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;
