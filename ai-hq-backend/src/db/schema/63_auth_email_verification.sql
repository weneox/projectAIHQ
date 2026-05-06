-- ============================================================
-- auth_email_verification_tokens
-- Email verification token ledger for self-service SaaS signup.
-- Stores only hashed tokens, never raw verification links.
-- ============================================================

create table if not exists auth_email_verification_tokens (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null references auth_identities(id) on delete cascade,
  token_hash text not null,
  email text not null,
  purpose text not null default 'email_verification',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_ip text,
  user_agent text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table auth_email_verification_tokens add column if not exists identity_id uuid;
alter table auth_email_verification_tokens add column if not exists token_hash text;
alter table auth_email_verification_tokens add column if not exists email text;
alter table auth_email_verification_tokens add column if not exists purpose text default 'email_verification';
alter table auth_email_verification_tokens add column if not exists expires_at timestamptz;
alter table auth_email_verification_tokens add column if not exists consumed_at timestamptz;
alter table auth_email_verification_tokens add column if not exists created_ip text;
alter table auth_email_verification_tokens add column if not exists user_agent text;
alter table auth_email_verification_tokens add column if not exists meta jsonb default '{}'::jsonb;
alter table auth_email_verification_tokens add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table auth_email_verification_tokens alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_constraint
    where conname = 'auth_email_verification_tokens_identity_id_fkey'
  ) then
    begin
      alter table auth_email_verification_tokens
        add constraint auth_email_verification_tokens_identity_id_fkey
        foreign key (identity_id) references auth_identities(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table auth_email_verification_tokens drop constraint if exists auth_email_verification_tokens_purpose_check';
  exception when others then null;
  end;

  begin
    alter table auth_email_verification_tokens
      add constraint auth_email_verification_tokens_purpose_check
      check (purpose in ('email_verification'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_auth_email_verification_tokens_token_hash
  on auth_email_verification_tokens(token_hash);

create index if not exists idx_auth_email_verification_tokens_identity_active
  on auth_email_verification_tokens(identity_id, expires_at desc)
  where consumed_at is null;

create index if not exists idx_auth_email_verification_tokens_email_active
  on auth_email_verification_tokens(lower(email), expires_at desc)
  where consumed_at is null;

create index if not exists idx_auth_email_verification_tokens_expiry
  on auth_email_verification_tokens(expires_at)
  where consumed_at is null;
