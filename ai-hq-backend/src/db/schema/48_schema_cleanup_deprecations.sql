-- src/db/schema/48_schema_cleanup_deprecations.sql
-- FINAL v1.0
-- =========================================================
-- Controlled cleanup / deprecations / final normalization
-- =========================================================

begin;

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

-- =========================================================
-- 1) queryable deprecation registry
-- =========================================================

create table if not exists system_schema_deprecations (
  id uuid primary key default gen_random_uuid(),

  object_type text not null,
  object_name text not null,
  replacement_object text not null default '',
  status text not null default 'deprecated',
  notes text not null default '',

  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint system_schema_deprecations_object_type_chk
    check (
      object_type in (
        'migration',
        'table',
        'view',
        'function',
        'constraint',
        'index',
        'column',
        'other'
      )
    ),

  constraint system_schema_deprecations_status_chk
    check (
      status in (
        'deprecated',
        'superseded',
        'compat_only',
        'legacy_overlay'
      )
    )
);

create unique index if not exists ux_system_schema_deprecations_object
  on system_schema_deprecations(object_type, object_name);

drop trigger if exists trg_system_schema_deprecations_updated_at on system_schema_deprecations;
create trigger trg_system_schema_deprecations_updated_at
before update on system_schema_deprecations
for each row execute function set_updated_at();

insert into system_schema_deprecations (
  object_type,
  object_name,
  replacement_object,
  status,
  notes
)
values
  (
    'migration',
    '17_tenant_services_patch.sql',
    '16_tenant_services_setup.sql + 48_schema_cleanup_deprecations.sql',
    'superseded',
    'Legacy patch migration. Safe to remove from fresh installs.'
  ),
  (
    'migration',
    '44_google_maps_source_type_patch.sql',
    '15_tenant_sources_and_knowledge.sql + 48_schema_cleanup_deprecations.sql',
    'superseded',
    'Legacy source-type patch. Final tenant_sources constraint is normalized here.'
  ),
  (
    'table',
    'tenant_business_facts',
    'tenant_business_runtime_projection.active_facts_json',
    'legacy_overlay',
    'Auxiliary overlay layer. Not canonical truth.'
  ),
  (
    'table',
    'tenant_knowledge_items',
    'tenant_business_* canonical graph + tenant_business_runtime_projection',
    'compat_only',
    'Approved knowledge overlay. Not the whole canonical business graph.'
  )
on conflict (object_type, object_name) do update
set
  replacement_object = excluded.replacement_object,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

-- =========================================================
-- 2) final tenant_sources constraint normalization
-- fixes older/reduced google_maps patch direction
-- =========================================================

do $$
declare
  r record;
begin
  for r in
    select
      c.relname as table_name,
      con.conname as constraint_name
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('tenant_sources', 'sources')
      and con.contype = 'c'
      and (
        con.conname ilike '%source_type%'
        or con.conname ilike '%type_check%'
        or pg_get_constraintdef(con.oid) ilike '%google_maps%'
        or pg_get_constraintdef(con.oid) ilike '%source_type%'
      )
  loop
    begin
      execute format(
        'alter table public.%I drop constraint if exists %I',
        r.table_name,
        r.constraint_name
      );
    exception when others then
      null;
    end;
  end loop;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_sources'
      and column_name = 'source_type'
  ) then
    begin
      execute $sql$
        alter table public.tenant_sources
        add constraint tenant_sources_source_type_chk
        check (
          source_type in (
            'website',
            'instagram',
            'facebook',
            'facebook_page',
            'facebook_comments',
            'messenger',
            'whatsapp',
            'whatsapp_business',
            'google_maps',
            'google_business',
            'linkedin',
            'tiktok',
            'youtube',
            'telegram',
            'x',
            'twitter',
            'email',
            'pdf',
            'document',
            'spreadsheet',
            'notion',
            'drive_folder',
            'crm',
            'manual',
            'manual_note',
            'upload',
            'api',
            'other'
          )
        )
      $sql$;
    exception when duplicate_object then
      null;
    end;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_sources'
      and column_name = 'type'
  ) then
    begin
      execute $sql$
        alter table public.tenant_sources
        add constraint tenant_sources_type_chk
        check (
          type is null
          or type in (
            'website',
            'instagram',
            'facebook',
            'facebook_page',
            'facebook_comments',
            'messenger',
            'whatsapp',
            'whatsapp_business',
            'google_maps',
            'google_business',
            'linkedin',
            'tiktok',
            'youtube',
            'telegram',
            'x',
            'twitter',
            'email',
            'pdf',
            'document',
            'spreadsheet',
            'notion',
            'drive_folder',
            'crm',
            'manual',
            'manual_note',
            'upload',
            'api',
            'other'
          )
        )
      $sql$;
    exception when duplicate_object then
      null;
    end;
  end if;
end
$$;

-- =========================================================
-- 3) final tenant_services normalization
-- makes old patch harmless and leaves one clean final table shape
-- =========================================================

alter table tenant_services
  add column if not exists tenant_key text,
  add column if not exists service_key text,
  add column if not exists title text default '',
  add column if not exists description text default '',
  add column if not exists category text default 'general',
  add column if not exists price_from numeric(12,2),
  add column if not exists currency text default 'AZN',
  add column if not exists pricing_model text default 'custom_quote',
  add column if not exists duration_minutes integer,
  add column if not exists is_active boolean default true,
  add column if not exists sort_order integer default 0,
  add column if not exists highlights_json jsonb default '[]'::jsonb,
  add column if not exists metadata_json jsonb default '{}'::jsonb,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

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
  begin
    alter table tenant_services drop constraint if exists tenant_services_tenant_key_chk;
  exception when others then null;
  end;

  begin
    alter table tenant_services drop constraint if exists tenant_services_service_key_chk;
  exception when others then null;
  end;

  begin
    alter table tenant_services drop constraint if exists tenant_services_title_chk;
  exception when others then null;
  end;

  begin
    alter table tenant_services drop constraint if exists tenant_services_category_chk;
  exception when others then null;
  end;

  begin
    alter table tenant_services drop constraint if exists tenant_services_pricing_model_chk;
  exception when others then null;
  end;

  begin
    alter table tenant_services drop constraint if exists tenant_services_sort_order_chk;
  exception when others then null;
  end;

  begin
    alter table tenant_services drop constraint if exists tenant_services_duration_minutes_chk;
  exception when others then null;
  end;

  alter table tenant_services
    add constraint tenant_services_tenant_key_chk
      check (btrim(tenant_key) <> '');

  alter table tenant_services
    add constraint tenant_services_service_key_chk
      check (btrim(service_key) <> '');

  alter table tenant_services
    add constraint tenant_services_title_chk
      check (btrim(title) <> '');

  alter table tenant_services
    add constraint tenant_services_category_chk
      check (btrim(category) <> '');

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

  alter table tenant_services
    add constraint tenant_services_sort_order_chk
      check (sort_order >= 0);

  alter table tenant_services
    add constraint tenant_services_duration_minutes_chk
      check (duration_minutes is null or duration_minutes >= 0);
exception when others then
  null;
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

-- =========================================================
-- 4) semantic comments for canonical vs overlay roles
-- =========================================================

comment on table tenant_source_raw_artifacts is
'Raw source artifacts. Extractors write here first. Not canonical business truth.';

comment on table tenant_source_artifact_chunks is
'Normalized retrieval/search chunks derived from raw artifacts.';

comment on table tenant_source_observations is
'Observation/claim layer derived from raw artifacts and source payloads.';

comment on table tenant_business_synthesis_snapshots is
'Synthesis/fusion layer. Candidate business state before canonical/runtime projection.';

comment on table tenant_business_profile is
'Canonical synthesized business profile projection. Raw extractors should not write here directly.';

comment on table tenant_business_capabilities is
'Derived capability projection for runtime behavior. Not a raw source table.';

comment on table tenant_business_runtime_projection is
'Final AI-ready tenant runtime projection consumed by inbox/comments/content/voice systems.';

comment on table tenant_business_facts is
'Legacy overlay facts layer. Useful as manual/system overlay, but not the canonical truth source.';

comment on table tenant_knowledge_items is
'Approved knowledge overlay. Use alongside canonical business graph, not instead of it.';

-- =========================================================
-- 5) helper view for querying deprecations quickly
-- =========================================================

create or replace view v_system_schema_deprecations as
select
  d.id,
  d.object_type,
  d.object_name,
  d.replacement_object,
  d.status,
  d.notes,
  d.metadata_json,
  d.created_at,
  d.updated_at
from system_schema_deprecations d
order by d.object_type, d.object_name;

commit;