-- ============================================================
-- TENANTS / SaaS foundation
-- ============================================================

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null unique,
  company_name text not null default '',
  legal_name text,
  industry_key text not null default 'generic_business',
  country_code text,
  timezone text not null default 'Asia/Baku',
  default_language text not null default 'en',
  enabled_languages jsonb not null default '["en"]'::jsonb,
  market_region text,
  plan_key text not null default 'starter',
  status text not null default 'active',
  active boolean not null default true,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenants add column if not exists company_name text default '';
alter table tenants add column if not exists legal_name text;
alter table tenants add column if not exists industry_key text default 'generic_business';
alter table tenants add column if not exists country_code text;
alter table tenants add column if not exists timezone text default 'Asia/Baku';
alter table tenants add column if not exists default_language text default 'en';
alter table tenants add column if not exists enabled_languages jsonb default '["en"]'::jsonb;
alter table tenants add column if not exists market_region text;
alter table tenants add column if not exists plan_key text default 'starter';
alter table tenants add column if not exists status text default 'active';
alter table tenants add column if not exists active boolean default true;
alter table tenants add column if not exists onboarding_completed_at timestamptz;
alter table tenants add column if not exists created_at timestamptz default now();
alter table tenants add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenants alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenants alter column company_name set default '';
  exception when others then null;
  end;
  begin
    alter table tenants alter column industry_key set default 'generic_business';
  exception when others then null;
  end;
  begin
    alter table tenants alter column timezone set default 'Asia/Baku';
  exception when others then null;
  end;
  begin
    alter table tenants alter column default_language set default 'en';
  exception when others then null;
  end;
  begin
    alter table tenants alter column enabled_languages set default '["en"]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenants alter column plan_key set default 'starter';
  exception when others then null;
  end;
  begin
    alter table tenants alter column status set default 'active';
  exception when others then null;
  end;
  begin
    alter table tenants alter column active set default true;
  exception when others then null;
  end;
  begin
    alter table tenants alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenants alter column updated_at set default now();
  exception when others then null;
  end;
end$$;

do $$
begin
  begin
    execute 'alter table tenants drop constraint if exists tenants_status_check';
  exception when others then null;
  end;

  begin
    alter table tenants
      add constraint tenants_status_check
      check (status in ('active','paused','trial','suspended','archived'));
  exception when others then null;
  end;
end$$;

create index if not exists idx_tenants_key on tenants(tenant_key);
create index if not exists idx_tenants_active on tenants(active);
create index if not exists idx_tenants_status on tenants(status);
create index if not exists idx_tenants_industry on tenants(industry_key);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenants_updated_at') then
    execute '
      create trigger trg_tenants_updated_at
      before update on tenants
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_key hard rules for subdomain-based tenancy
-- ============================================================

create table if not exists reserved_tenant_keys (
  key text primary key,
  created_at timestamptz not null default now()
);

insert into reserved_tenant_keys (key) values
  ('www'),
  ('api'),
  ('hq'),
  ('mail'),
  ('docs'),
  ('status'),
  ('admin'),
  ('app'),
  ('cdn'),
  ('assets'),
  ('blog'),
  ('help'),
  ('support'),
  ('auth'),
  ('m'),
  ('dev'),
  ('staging'),
  ('demo')
on conflict (key) do nothing;

do $$
begin
  begin
    execute 'alter table tenants drop constraint if exists tenants_tenant_key_format_check';
  exception when others then null;
  end;

  begin
    alter table tenants
      add constraint tenants_tenant_key_format_check
      check (
        tenant_key ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'
      );
  exception when others then null;
  end;
end$$;

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'enforce_tenant_key_rules'
  ) then
    execute $fn$
      create or replace function enforce_tenant_key_rules()
      returns trigger
      as $f$
      declare
        v_key text;
      begin
        v_key := lower(trim(coalesce(new.tenant_key, '')));

        if v_key = '' then
          raise exception 'tenant_key is required';
        end if;

        if v_key !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$' then
          raise exception 'tenant_key must match subdomain format';
        end if;

        if exists (
          select 1
          from reserved_tenant_keys
          where key = v_key
        ) then
          raise exception 'tenant_key is reserved';
        end if;

        new.tenant_key := v_key;
        return new;
      end;
      $f$ language plpgsql;
    $fn$;
  end if;
exception when others then null;
end$$;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgname = 'trg_tenants_enforce_tenant_key_rules'
  ) then
    begin
      execute 'drop trigger trg_tenants_enforce_tenant_key_rules on tenants';
    exception when others then null;
    end;
  end if;

  begin
    execute '
      create trigger trg_tenants_enforce_tenant_key_rules
      before insert or update of tenant_key on tenants
      for each row execute function enforce_tenant_key_rules()
    ';
  exception when others then null;
  end;
end$$;