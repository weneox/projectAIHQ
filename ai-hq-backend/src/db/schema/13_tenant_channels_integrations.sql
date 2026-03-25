-- ============================================================
-- tenant_channels
-- ============================================================

create table if not exists tenant_channels (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  channel_type text not null,
  provider text not null,
  display_name text not null default '',
  external_account_id text,
  external_page_id text,
  external_user_id text,
  external_username text,
  status text not null default 'disconnected',
  is_primary boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  secrets_ref text,
  health jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_channels add column if not exists display_name text default '';
alter table tenant_channels add column if not exists external_account_id text;
alter table tenant_channels add column if not exists external_page_id text;
alter table tenant_channels add column if not exists external_user_id text;
alter table tenant_channels add column if not exists external_username text;
alter table tenant_channels add column if not exists status text default 'disconnected';
alter table tenant_channels add column if not exists is_primary boolean default false;
alter table tenant_channels add column if not exists config jsonb default '{}'::jsonb;
alter table tenant_channels add column if not exists secrets_ref text;
alter table tenant_channels add column if not exists health jsonb default '{}'::jsonb;
alter table tenant_channels add column if not exists last_sync_at timestamptz;
alter table tenant_channels add column if not exists created_at timestamptz default now();
alter table tenant_channels add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_channels_tenant_id_fkey') then
    begin
      alter table tenant_channels
        add constraint tenant_channels_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_channels drop constraint if exists tenant_channels_status_check';
  exception when others then null;
  end;

  begin
    alter table tenant_channels
      add constraint tenant_channels_status_check
      check (status in ('disconnected','connecting','connected','error','disabled'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_channels drop constraint if exists tenant_channels_channel_type_check';
  exception when others then null;
  end;

  begin
    alter table tenant_channels
      add constraint tenant_channels_channel_type_check
      check (channel_type in ('instagram','facebook','whatsapp','telegram','webchat','email','other'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_tenant_channels_unique_account
  on tenant_channels(
    tenant_id,
    channel_type,
    provider,
    coalesce(external_account_id, ''),
    coalesce(external_page_id, ''),
    coalesce(external_user_id, '')
  );

create index if not exists idx_tenant_channels_tenant_status
  on tenant_channels(tenant_id, status, updated_at desc);

create index if not exists idx_tenant_channels_type
  on tenant_channels(tenant_id, channel_type, updated_at desc);

create index if not exists idx_tenant_channels_resolve_page
  on tenant_channels(channel_type, external_page_id, is_primary desc, updated_at desc)
  where external_page_id is not null;

create index if not exists idx_tenant_channels_resolve_user
  on tenant_channels(channel_type, external_user_id, is_primary desc, updated_at desc)
  where external_user_id is not null;

create index if not exists idx_tenant_channels_resolve_account
  on tenant_channels(channel_type, external_account_id, is_primary desc, updated_at desc)
  where external_account_id is not null;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_channels_updated_at') then
    execute '
      create trigger trg_tenant_channels_updated_at
      before update on tenant_channels
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_integrations
-- ============================================================

create table if not exists tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  integration_type text not null,
  provider text not null,
  display_name text not null default '',
  status text not null default 'disabled',
  config jsonb not null default '{}'::jsonb,
  secrets_ref text,
  health jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_integrations add column if not exists display_name text default '';
alter table tenant_integrations add column if not exists status text default 'disabled';
alter table tenant_integrations add column if not exists config jsonb default '{}'::jsonb;
alter table tenant_integrations add column if not exists secrets_ref text;
alter table tenant_integrations add column if not exists health jsonb default '{}'::jsonb;
alter table tenant_integrations add column if not exists last_sync_at timestamptz;
alter table tenant_integrations add column if not exists created_at timestamptz default now();
alter table tenant_integrations add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_integrations_tenant_id_fkey') then
    begin
      alter table tenant_integrations
        add constraint tenant_integrations_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_integrations drop constraint if exists tenant_integrations_status_check';
  exception when others then null;
  end;

  begin
    alter table tenant_integrations
      add constraint tenant_integrations_status_check
      check (status in ('disabled','enabled','error','pending'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_tenant_integrations_type_provider
  on tenant_integrations(tenant_id, integration_type, provider);

create index if not exists idx_tenant_integrations_tenant_status
  on tenant_integrations(tenant_id, status, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_integrations_updated_at') then
    execute '
      create trigger trg_tenant_integrations_updated_at
      before update on tenant_integrations
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_secrets
-- ============================================================

create table if not exists tenant_secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  provider text not null,
  secret_key text not null,
  secret_value_enc text not null,
  secret_value_iv text not null,
  secret_value_tag text not null,
  version int not null default 1,
  is_active boolean not null default true,
  created_by text,
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_secrets add column if not exists tenant_id uuid;
alter table tenant_secrets add column if not exists provider text;
alter table tenant_secrets add column if not exists secret_key text;
alter table tenant_secrets add column if not exists secret_value_enc text;
alter table tenant_secrets add column if not exists secret_value_iv text;
alter table tenant_secrets add column if not exists secret_value_tag text;
alter table tenant_secrets add column if not exists version int default 1;
alter table tenant_secrets add column if not exists is_active boolean default true;
alter table tenant_secrets add column if not exists created_by text;
alter table tenant_secrets add column if not exists updated_by text;
alter table tenant_secrets add column if not exists created_at timestamptz default now();
alter table tenant_secrets add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_secrets alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  begin
    alter table tenant_secrets alter column version set default 1;
  exception when others then null;
  end;

  begin
    alter table tenant_secrets alter column is_active set default true;
  exception when others then null;
  end;

  begin
    alter table tenant_secrets alter column created_at set default now();
  exception when others then null;
  end;

  begin
    alter table tenant_secrets alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'tenant_secrets_tenant_id_fkey') then
    begin
      alter table tenant_secrets
        add constraint tenant_secrets_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_tenant_secrets_provider_key
  on tenant_secrets(tenant_id, provider, secret_key);

create index if not exists idx_tenant_secrets_tenant_provider
  on tenant_secrets(tenant_id, provider, updated_at desc);

create index if not exists idx_tenant_secrets_active
  on tenant_secrets(tenant_id, is_active, updated_at desc);

create index if not exists idx_tenant_secrets_provider_key_active
  on tenant_secrets(tenant_id, provider, secret_key, is_active, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_secrets_updated_at') then
    execute '
      create trigger trg_tenant_secrets_updated_at
      before update on tenant_secrets
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;