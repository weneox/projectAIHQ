-- src/db/schema/46_canonical_business_graph.sql
-- FINAL v1.0
-- =========================================================
-- Canonical business graph
-- additive layer on top of existing tenant profile/services/locations/contacts
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
-- 1) tenant_business_hours
-- canonical hours layer
-- optional location binding via tenant_locations
-- =========================================================

create table if not exists tenant_business_hours (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  location_id uuid references tenant_locations(id) on delete cascade,

  hours_key text not null,
  scope_type text not null default 'general',
  day_of_week smallint not null,

  label text not null default '',
  open_time text not null default '',
  close_time text not null default '',

  is_closed boolean not null default false,
  is_24h boolean not null default false,
  sort_order integer not null default 0,
  is_active boolean not null default true,

  notes_text text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_hours_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_hours_hours_key_chk
    check (btrim(hours_key) <> ''),

  constraint tenant_business_hours_scope_type_chk
    check (scope_type in ('general', 'location')),

  constraint tenant_business_hours_day_of_week_chk
    check (day_of_week between 1 and 7),

  constraint tenant_business_hours_sort_order_chk
    check (sort_order >= 0)
);

create unique index if not exists ux_tenant_business_hours_tenant_hours_key
  on tenant_business_hours(tenant_id, hours_key);

create index if not exists ix_tenant_business_hours_tenant_active
  on tenant_business_hours(tenant_id, is_active, sort_order asc, day_of_week asc, updated_at desc);

create index if not exists ix_tenant_business_hours_location
  on tenant_business_hours(location_id, day_of_week asc)
  where location_id is not null;

drop trigger if exists trg_tenant_business_hours_updated_at on tenant_business_hours;
create trigger trg_tenant_business_hours_updated_at
before update on tenant_business_hours
for each row execute function set_updated_at();

-- =========================================================
-- 2) tenant_business_products
-- canonical product catalog
-- =========================================================

create table if not exists tenant_business_products (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  product_key text not null,
  title text not null default '',
  description text not null default '',
  category text not null default 'general',
  sku text not null default '',

  price_amount numeric(12,2),
  currency text not null default 'AZN',
  pricing_model text not null default 'custom_quote',

  is_active boolean not null default true,
  sort_order integer not null default 0,

  highlights_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_products_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_products_product_key_chk
    check (btrim(product_key) <> ''),

  constraint tenant_business_products_title_chk
    check (btrim(title) <> ''),

  constraint tenant_business_products_category_chk
    check (btrim(category) <> ''),

  constraint tenant_business_products_pricing_model_chk
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
    ),

  constraint tenant_business_products_sort_order_chk
    check (sort_order >= 0)
);

create unique index if not exists ux_tenant_business_products_tenant_product_key
  on tenant_business_products(tenant_id, product_key);

create index if not exists ix_tenant_business_products_tenant_active
  on tenant_business_products(tenant_id, is_active, sort_order asc, updated_at desc);

create index if not exists ix_tenant_business_products_tenant_category
  on tenant_business_products(tenant_id, category, sort_order asc, updated_at desc);

drop trigger if exists trg_tenant_business_products_updated_at on tenant_business_products;
create trigger trg_tenant_business_products_updated_at
before update on tenant_business_products
for each row execute function set_updated_at();

-- =========================================================
-- 3) tenant_business_faq
-- canonical faq graph node
-- =========================================================

create table if not exists tenant_business_faq (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  faq_key text not null,
  question text not null default '',
  answer text not null default '',
  category text not null default 'general',

  is_active boolean not null default true,
  sort_order integer not null default 0,

  tags_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_faq_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_faq_faq_key_chk
    check (btrim(faq_key) <> ''),

  constraint tenant_business_faq_question_chk
    check (btrim(question) <> ''),

  constraint tenant_business_faq_category_chk
    check (btrim(category) <> ''),

  constraint tenant_business_faq_sort_order_chk
    check (sort_order >= 0)
);

create unique index if not exists ux_tenant_business_faq_tenant_faq_key
  on tenant_business_faq(tenant_id, faq_key);

create index if not exists ix_tenant_business_faq_tenant_active
  on tenant_business_faq(tenant_id, is_active, sort_order asc, updated_at desc);

create index if not exists ix_tenant_business_faq_tenant_category
  on tenant_business_faq(tenant_id, category, sort_order asc, updated_at desc);

drop trigger if exists trg_tenant_business_faq_updated_at on tenant_business_faq;
create trigger trg_tenant_business_faq_updated_at
before update on tenant_business_faq
for each row execute function set_updated_at();

-- =========================================================
-- 4) tenant_business_policies
-- canonical policy layer
-- =========================================================

create table if not exists tenant_business_policies (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  policy_key text not null,
  policy_type text not null,
  title text not null default '',

  summary_text text not null default '',
  policy_text text not null default '',
  policy_json jsonb not null default '{}'::jsonb,

  is_active boolean not null default true,
  priority integer not null default 100,

  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_policies_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_policies_policy_key_chk
    check (btrim(policy_key) <> ''),

  constraint tenant_business_policies_title_chk
    check (btrim(title) <> ''),

  constraint tenant_business_policies_policy_type_chk
    check (
      policy_type in (
        'pricing',
        'quote',
        'booking',
        'callback',
        'refund',
        'cancellation',
        'delivery',
        'service_area',
        'lead_capture',
        'handoff',
        'response',
        'comment',
        'content',
        'voice',
        'support',
        'privacy',
        'legal',
        'other'
      )
    ),

  constraint tenant_business_policies_priority_chk
    check (priority >= 0)
);

create unique index if not exists ux_tenant_business_policies_tenant_policy_key
  on tenant_business_policies(tenant_id, policy_key);

create index if not exists ix_tenant_business_policies_tenant_active
  on tenant_business_policies(tenant_id, is_active, priority asc, updated_at desc);

create index if not exists ix_tenant_business_policies_tenant_type
  on tenant_business_policies(tenant_id, policy_type, priority asc, updated_at desc);

drop trigger if exists trg_tenant_business_policies_updated_at on tenant_business_policies;
create trigger trg_tenant_business_policies_updated_at
before update on tenant_business_policies
for each row execute function set_updated_at();

-- =========================================================
-- 5) tenant_business_social_accounts
-- canonical social identity layer
-- =========================================================

create table if not exists tenant_business_social_accounts (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid references tenant_sources(id) on delete set null,

  account_key text not null,
  platform text not null,
  handle text not null default '',
  display_name text not null default '',
  profile_url text not null default '',

  external_account_id text not null default '',
  bio_text text not null default '',

  is_primary boolean not null default false,
  is_verified boolean not null default false,
  is_active boolean not null default true,

  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_social_accounts_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_social_accounts_account_key_chk
    check (btrim(account_key) <> ''),

  constraint tenant_business_social_accounts_platform_chk
    check (
      platform in (
        'instagram',
        'facebook',
        'linkedin',
        'tiktok',
        'youtube',
        'telegram',
        'x',
        'twitter',
        'whatsapp',
        'google_business',
        'website',
        'other'
      )
    )
);

create unique index if not exists ux_tenant_business_social_accounts_tenant_account_key
  on tenant_business_social_accounts(tenant_id, account_key);

create index if not exists ix_tenant_business_social_accounts_tenant_active
  on tenant_business_social_accounts(tenant_id, is_active, platform, updated_at desc);

create index if not exists ix_tenant_business_social_accounts_source
  on tenant_business_social_accounts(source_id)
  where source_id is not null;

drop trigger if exists trg_tenant_business_social_accounts_updated_at on tenant_business_social_accounts;
create trigger trg_tenant_business_social_accounts_updated_at
before update on tenant_business_social_accounts
for each row execute function set_updated_at();

-- =========================================================
-- 6) tenant_business_channels
-- canonical operational channels layer
-- =========================================================

create table if not exists tenant_business_channels (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid references tenant_sources(id) on delete set null,
  social_account_id uuid references tenant_business_social_accounts(id) on delete set null,

  channel_key text not null,
  channel_type text not null,
  label text not null default '',

  endpoint text not null default '',
  external_channel_id text not null default '',

  is_primary boolean not null default false,
  is_connected boolean not null default false,
  is_active boolean not null default true,

  supports_inbound boolean not null default true,
  supports_outbound boolean not null default false,
  supports_comments boolean not null default false,
  supports_calls boolean not null default false,
  supports_handoff boolean not null default true,

  status text not null default 'draft',
  config_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_channels_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_channels_channel_key_chk
    check (btrim(channel_key) <> ''),

  constraint tenant_business_channels_channel_type_chk
    check (
      channel_type in (
        'website_form',
        'webchat',
        'instagram_dm',
        'facebook_messenger',
        'whatsapp',
        'comments',
        'voice',
        'email',
        'phone',
        'telegram',
        'other'
      )
    ),

  constraint tenant_business_channels_status_chk
    check (
      status in (
        'draft',
        'active',
        'paused',
        'disabled',
        'archived'
      )
    )
);

create unique index if not exists ux_tenant_business_channels_tenant_channel_key
  on tenant_business_channels(tenant_id, channel_key);

create index if not exists ix_tenant_business_channels_tenant_active
  on tenant_business_channels(tenant_id, is_active, channel_type, updated_at desc);

create index if not exists ix_tenant_business_channels_source
  on tenant_business_channels(source_id)
  where source_id is not null;

create index if not exists ix_tenant_business_channels_social_account
  on tenant_business_channels(social_account_id)
  where social_account_id is not null;

drop trigger if exists trg_tenant_business_channels_updated_at on tenant_business_channels;
create trigger trg_tenant_business_channels_updated_at
before update on tenant_business_channels
for each row execute function set_updated_at();

-- =========================================================
-- 7) tenant_business_media_assets
-- canonical media asset graph node
-- =========================================================

create table if not exists tenant_business_media_assets (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid references tenant_sources(id) on delete set null,
  source_run_id uuid references tenant_source_sync_runs(id) on delete set null,

  asset_key text not null,
  asset_type text not null,
  title text not null default '',

  url text not null default '',
  storage_url text not null default '',
  mime_type text not null default '',

  alt_text text not null default '',
  width integer,
  height integer,
  duration_ms integer,

  visibility text not null default 'public',
  is_primary boolean not null default false,
  is_active boolean not null default true,

  tags_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_media_assets_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_business_media_assets_asset_key_chk
    check (btrim(asset_key) <> ''),

  constraint tenant_business_media_assets_asset_type_chk
    check (
      asset_type in (
        'logo',
        'cover',
        'banner',
        'gallery_image',
        'image',
        'video',
        'audio',
        'document',
        'other'
      )
    ),

  constraint tenant_business_media_assets_visibility_chk
    check (
      visibility in (
        'public',
        'internal',
        'restricted'
      )
    ),

  constraint tenant_business_media_assets_width_chk
    check (width is null or width >= 0),

  constraint tenant_business_media_assets_height_chk
    check (height is null or height >= 0),

  constraint tenant_business_media_assets_duration_ms_chk
    check (duration_ms is null or duration_ms >= 0)
);

create unique index if not exists ux_tenant_business_media_assets_tenant_asset_key
  on tenant_business_media_assets(tenant_id, asset_key);

create index if not exists ix_tenant_business_media_assets_tenant_active
  on tenant_business_media_assets(tenant_id, is_active, asset_type, updated_at desc);

create index if not exists ix_tenant_business_media_assets_source
  on tenant_business_media_assets(source_id, source_run_id, updated_at desc);

drop trigger if exists trg_tenant_business_media_assets_updated_at on tenant_business_media_assets;
create trigger trg_tenant_business_media_assets_updated_at
before update on tenant_business_media_assets
for each row execute function set_updated_at();

-- =========================================================
-- 8) helper views
-- existing canonical-ish tables exposed under graph views
-- =========================================================

create or replace view v_tenant_business_graph_profile as
select
  p.tenant_id,
  p.tenant_key,
  p.profile_status,
  p.company_name,
  p.display_name,
  p.legal_name,
  p.industry_key,
  p.subindustry_key,
  p.summary_short,
  p.summary_long,
  p.value_proposition,
  p.target_audience,
  p.tone_profile,
  p.main_language,
  p.supported_languages,
  p.website_url,
  p.primary_phone,
  p.primary_email,
  p.primary_address,
  p.profile_json,
  p.source_summary_json,
  p.metadata_json,
  p.confidence,
  p.confidence_label,
  p.generated_at,
  p.approved_at,
  p.created_at,
  p.updated_at
from tenant_business_profile p;

create or replace view v_tenant_business_graph_locations as
select
  l.id,
  l.tenant_id,
  t.tenant_key,
  l.location_key,
  l.title,
  l.country_code,
  l.city,
  l.address_line,
  l.map_url,
  l.phone,
  l.email,
  l.working_hours,
  l.delivery_areas,
  l.is_primary,
  l.enabled as is_active,
  l.sort_order,
  l.meta as metadata_json,
  l.created_at,
  l.updated_at
from tenant_locations l
join tenants t
  on t.id = l.tenant_id;

create or replace view v_tenant_business_graph_contacts as
select
  c.id,
  c.tenant_id,
  t.tenant_key,
  c.contact_key,
  c.channel,
  c.label,
  c.value,
  c.is_primary,
  c.enabled as is_active,
  c.visible_public,
  c.visible_in_ai,
  c.sort_order,
  c.meta as metadata_json,
  c.created_at,
  c.updated_at
from tenant_contacts c
join tenants t
  on t.id = c.tenant_id;

create or replace view v_tenant_business_graph_services as
select
  s.id,
  s.tenant_id,
  s.tenant_key,
  s.service_key,
  s.title,
  s.description,
  s.category,
  s.price_from,
  s.currency,
  s.pricing_model,
  s.duration_minutes,
  s.is_active,
  s.sort_order,
  s.highlights_json,
  s.metadata_json,
  s.created_at,
  s.updated_at
from tenant_services s;

commit;