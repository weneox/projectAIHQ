-- src/db/schema/17_tenant_services_patch.sql
-- FINAL v1.0
-- patch existing tenant_services tables that were created before
-- the full setup schema existed

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists tenant_services (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  service_key text not null,
  title text not null default '',
  description text not null default '',
  category text not null default 'general',

  price_from numeric(12,2),
  currency text not null default 'AZN',
  pricing_model text not null default 'custom_quote',

  duration_minutes integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,

  highlights_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_services add column if not exists tenant_key text;
alter table tenant_services add column if not exists service_key text;
alter table tenant_services add column if not exists title text default '';
alter table tenant_services add column if not exists description text default '';
alter table tenant_services add column if not exists category text default 'general';
alter table tenant_services add column if not exists price_from numeric(12,2);
alter table tenant_services add column if not exists currency text default 'AZN';
alter table tenant_services add column if not exists pricing_model text default 'custom_quote';
alter table tenant_services add column if not exists duration_minutes integer;
alter table tenant_services add column if not exists is_active boolean default true;
alter table tenant_services add column if not exists sort_order integer default 0;
alter table tenant_services add column if not exists highlights_json jsonb default '[]'::jsonb;
alter table tenant_services add column if not exists metadata_json jsonb default '{}'::jsonb;
alter table tenant_services add column if not exists created_at timestamptz default now();
alter table tenant_services add column if not exists updated_at timestamptz default now();

update tenant_services ts
set tenant_key = t.tenant_key
from tenants t
where t.id = ts.tenant_id
  and (ts.tenant_key is null or btrim(ts.tenant_key) = '');

update tenant_services
set title = 'Untitled service'
where title is null or btrim(title) = '';

update tenant_services
set description = ''
where description is null;

update tenant_services
set category = 'general'
where category is null or btrim(category) = '';

update tenant_services
set currency = 'AZN'
where currency is null or btrim(currency) = '';

update tenant_services
set pricing_model = 'custom_quote'
where pricing_model is null or btrim(pricing_model) = '';

update tenant_services
set is_active = true
where is_active is null;

update tenant_services
set sort_order = 0
where sort_order is null;

update tenant_services
set highlights_json = '[]'::jsonb
where highlights_json is null;

update tenant_services
set metadata_json = '{}'::jsonb
where metadata_json is null;

update tenant_services
set created_at = now()
where created_at is null;

update tenant_services
set updated_at = now()
where updated_at is null;

update tenant_services
set service_key =
  coalesce(
    nullif(
      regexp_replace(
        regexp_replace(
          lower(coalesce(nullif(btrim(title), ''), 'service')),
          '[^a-z0-9]+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ),
      ''
    ),
    'service'
  ) || '-' || substr(replace(id::text, '-', ''), 1, 8)
where service_key is null or btrim(service_key) = '';

alter table tenant_services
  alter column tenant_key set not null,
  alter column service_key set not null,
  alter column title set not null,
  alter column description set not null,
  alter column category set not null,
  alter column currency set not null,
  alter column pricing_model set not null,
  alter column is_active set not null,
  alter column sort_order set not null,
  alter column highlights_json set not null,
  alter column metadata_json set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

alter table tenant_services
  alter column title set default '',
  alter column description set default '',
  alter column category set default 'general',
  alter column currency set default 'AZN',
  alter column pricing_model set default 'custom_quote',
  alter column is_active set default true,
  alter column sort_order set default 0,
  alter column highlights_json set default '[]'::jsonb,
  alter column metadata_json set default '{}'::jsonb,
  alter column created_at set default now(),
  alter column updated_at set default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_services_tenant_key_chk'
  ) then
    alter table tenant_services
      add constraint tenant_services_tenant_key_chk
      check (btrim(tenant_key) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_services_service_key_chk'
  ) then
    alter table tenant_services
      add constraint tenant_services_service_key_chk
      check (btrim(service_key) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_services_title_chk'
  ) then
    alter table tenant_services
      add constraint tenant_services_title_chk
      check (btrim(title) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_services_category_chk'
  ) then
    alter table tenant_services
      add constraint tenant_services_category_chk
      check (btrim(category) <> '');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_services_pricing_model_chk'
  ) then
    alter table tenant_services
      add constraint tenant_services_pricing_model_chk
      check (
        pricing_model in (
          'custom_quote',
          'fixed',
          'starting_from',
          'hourly',
          'package',
          'free',
          'contact'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_services_sort_order_chk'
  ) then
    alter table tenant_services
      add constraint tenant_services_sort_order_chk
      check (sort_order >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_services_duration_minutes_chk'
  ) then
    alter table tenant_services
      add constraint tenant_services_duration_minutes_chk
      check (duration_minutes is null or duration_minutes >= 0);
  end if;
end
$$;

create unique index if not exists ux_tenant_services_tenant_service_key
  on tenant_services(tenant_id, service_key);

create index if not exists ix_tenant_services_tenant_id
  on tenant_services(tenant_id, updated_at desc);

create index if not exists ix_tenant_services_tenant_active
  on tenant_services(tenant_id, is_active, sort_order asc, updated_at desc);

create index if not exists ix_tenant_services_tenant_category
  on tenant_services(tenant_id, category, sort_order asc, updated_at desc);

drop trigger if exists trg_tenant_services_updated_at on tenant_services;

create trigger trg_tenant_services_updated_at
before update on tenant_services
for each row execute function set_updated_at(); 