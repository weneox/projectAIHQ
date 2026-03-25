-- src/db/schema/16_tenant_services_setup.sql
-- FINAL v1.0
-- =========================================================
-- tenant_services
-- canonical setup/service catalog table for tenant workspace
-- =========================================================

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
  ) then
    execute $fn$
      create or replace function set_updated_at()
      returns trigger
      as $f$
      begin
        new.updated_at = now();
        return new;
      end;
      $f$ language plpgsql;
    $fn$;
  end if;
exception when others then
  null;
end
$$;

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
  updated_at timestamptz not null default now(),

  constraint tenant_services_tenant_key_chk check (btrim(tenant_key) <> ''),
  constraint tenant_services_service_key_chk check (btrim(service_key) <> ''),
  constraint tenant_services_title_chk check (btrim(title) <> ''),
  constraint tenant_services_category_chk check (btrim(category) <> ''),
  constraint tenant_services_pricing_model_chk check (
    pricing_model in (
      'custom_quote',
      'fixed',
      'starting_from',
      'hourly',
      'package',
      'free',
      'contact'
    )
  ),
  constraint tenant_services_sort_order_chk check (sort_order >= 0),
  constraint tenant_services_duration_minutes_chk check (
    duration_minutes is null or duration_minutes >= 0
  )
);

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