-- src/db/schema/15_tenant_sources_and_knowledge.sql
-- FINAL v1.0
-- =========================================================
-- Tenant Sources + Knowledge Intelligence Layer
-- =========================================================
-- Goals:
-- connect external/public/private business sources
-- track sync runs and extraction pipeline
-- store AI-discovered candidate knowledge
-- store approved/final knowledge items
-- keep provenance / evidence / confidence
-- support manual approval + conflict review
-- work alongside existing tenant_business_* tables
-- production-safe / additive migration
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- shared trigger fn fallback
-- =========================================================
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
-- helper enum-like checks
-- =========================================================

-- NOTE:
-- We use CHECK constraints instead of CREATE TYPE enums
-- to keep migrations safer/easier in iterative SaaS builds.

-- =========================================================
-- 1) tenant_sources
-- =========================================================
-- Connected or registered data sources for a tenant:
-- website, instagram, facebook, whatsapp, google_maps, pdf, doc, crm, etc.

create table if not exists tenant_sources (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_type text not null,
  source_key text not null,
  display_name text not null default '',

  status text not null default 'pending',
  auth_status text not null default 'not_required',
  sync_status text not null default 'idle',

  connection_mode text not null default 'manual',
  access_scope text not null default 'public',

  source_url text not null default '',
  external_account_id text not null default '',
  external_page_id text not null default '',
  external_username text not null default '',

  is_enabled boolean not null default true,
  is_primary boolean not null default false,

  permissions_json jsonb not null default '{}'::jsonb,
  settings_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  last_connected_at timestamptz,
  last_sync_started_at timestamptz,
  last_sync_finished_at timestamptz,
  last_successful_sync_at timestamptz,
  last_error_at timestamptz,

  last_error_code text not null default '',
  last_error_message text not null default '',

  created_by text not null default '',
  updated_by text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_sources_source_type_chk check (
    source_type in (
      'website',
      'instagram',
      'facebook_page',
      'facebook_comments',
      'messenger',
      'whatsapp_business',
      'google_maps',
      'google_business',
      'linkedin',
      'tiktok',
      'youtube',
      'telegram',
      'email',
      'pdf',
      'document',
      'spreadsheet',
      'notion',
      'drive_folder',
      'crm',
      'manual_note',
      'api',
      'other'
    )
  ),

  constraint tenant_sources_status_chk check (
    status in (
      'pending',
      'connected',
      'disconnected',
      'revoked',
      'error',
      'archived'
    )
  ),

  constraint tenant_sources_auth_status_chk check (
    auth_status in (
      'not_required',
      'pending',
      'authorized',
      'expired',
      'revoked',
      'error'
    )
  ),

  constraint tenant_sources_sync_status_chk check (
    sync_status in (
      'idle',
      'queued',
      'running',
      'success',
      'partial',
      'error',
      'disabled'
    )
  ),

  constraint tenant_sources_connection_mode_chk check (
    connection_mode in (
      'manual',
      'oauth',
      'api_key',
      'webhook',
      'crawler',
      'upload',
      'import',
      'system'
    )
  ),

  constraint tenant_sources_access_scope_chk check (
    access_scope in (
      'public',
      'private',
      'hybrid'
    )
  ),

  constraint tenant_sources_tenant_key_chk check (btrim(tenant_key) <> ''),
  constraint tenant_sources_source_key_chk check (btrim(source_key) <> '')
);

create unique index if not exists ux_tenant_sources_tenant_source_key
  on tenant_sources(tenant_id, source_key);

create index if not exists ix_tenant_sources_tenant_id
  on tenant_sources(tenant_id);

create index if not exists ix_tenant_sources_tenant_key
  on tenant_sources(tenant_key);

create index if not exists ix_tenant_sources_source_type
  on tenant_sources(source_type);

create index if not exists ix_tenant_sources_status
  on tenant_sources(status);

create index if not exists ix_tenant_sources_enabled
  on tenant_sources(tenant_id, is_enabled, status);

create index if not exists ix_tenant_sources_sync_status
  on tenant_sources(tenant_id, sync_status);

create index if not exists ix_tenant_sources_primary
  on tenant_sources(tenant_id, is_primary)
  where is_primary = true;

drop trigger if exists trg_tenant_sources_updated_at on tenant_sources;
create trigger trg_tenant_sources_updated_at
before update on tenant_sources
for each row execute function set_updated_at();

-- =========================================================
-- 2) tenant_source_sync_runs
-- =========================================================
-- Every sync/extract attempt for a source

create table if not exists tenant_source_sync_runs (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid not null references tenant_sources(id) on delete cascade,

  run_type text not null default 'sync',
  trigger_type text not null default 'manual',
  status text not null default 'queued',

  started_at timestamptz,
  finished_at timestamptz,

  duration_ms integer not null default 0,

  input_summary_json jsonb not null default '{}'::jsonb,
  extraction_summary_json jsonb not null default '{}'::jsonb,
  result_summary_json jsonb not null default '{}'::jsonb,

  pages_scanned integer not null default 0,
  records_scanned integer not null default 0,
  candidates_created integer not null default 0,
  items_promoted integer not null default 0,
  conflicts_found integer not null default 0,
  warnings_count integer not null default 0,
  errors_count integer not null default 0,

  error_code text not null default '',
  error_message text not null default '',
  logs_json jsonb not null default '[]'::jsonb,

  requested_by text not null default '',
  runner_key text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_source_sync_runs_run_type_chk check (
    run_type in (
      'connect',
      'sync',
      'resync',
      'crawl',
      'extract',
      'refresh',
      'disconnect'
    )
  ),

  constraint tenant_source_sync_runs_trigger_type_chk check (
    trigger_type in (
      'manual',
      'scheduled',
      'webhook',
      'source_change',
      'system',
      'retry'
    )
  ),

  constraint tenant_source_sync_runs_status_chk check (
    status in (
      'queued',
      'running',
      'success',
      'partial',
      'failed',
      'cancelled'
    )
  ),

  constraint tenant_source_sync_runs_tenant_key_chk check (btrim(tenant_key) <> ''),
  constraint tenant_source_sync_runs_duration_ms_chk check (duration_ms >= 0),
  constraint tenant_source_sync_runs_pages_scanned_chk check (pages_scanned >= 0),
  constraint tenant_source_sync_runs_records_scanned_chk check (records_scanned >= 0),
  constraint tenant_source_sync_runs_candidates_created_chk check (candidates_created >= 0),
  constraint tenant_source_sync_runs_items_promoted_chk check (items_promoted >= 0),
  constraint tenant_source_sync_runs_conflicts_found_chk check (conflicts_found >= 0),
  constraint tenant_source_sync_runs_warnings_count_chk check (warnings_count >= 0),
  constraint tenant_source_sync_runs_errors_count_chk check (errors_count >= 0)
);

alter table tenant_source_sync_runs
  add column if not exists review_session_id uuid null,
  add column if not exists metadata_json jsonb not null default '{}'::jsonb,
  add column if not exists meta_json jsonb not null default '{}'::jsonb,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists max_attempts integer not null default 3,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists lease_token text not null default '',
  add column if not exists lease_expires_at timestamptz,
  add column if not exists claimed_by text not null default '';

create index if not exists ix_tenant_source_sync_runs_tenant_id
  on tenant_source_sync_runs(tenant_id, created_at desc);

create index if not exists ix_tenant_source_sync_runs_source_id
  on tenant_source_sync_runs(source_id, created_at desc);

create index if not exists ix_tenant_source_sync_runs_status
  on tenant_source_sync_runs(tenant_id, status, created_at desc);

create index if not exists ix_tenant_source_sync_runs_retry
  on tenant_source_sync_runs(status, next_retry_at, created_at asc);

create index if not exists ix_tenant_source_sync_runs_lease
  on tenant_source_sync_runs(status, lease_expires_at, created_at asc);

drop trigger if exists trg_tenant_source_sync_runs_updated_at on tenant_source_sync_runs;
create trigger trg_tenant_source_sync_runs_updated_at
before update on tenant_source_sync_runs
for each row execute function set_updated_at();

-- =========================================================
-- 3) tenant_knowledge_candidates
-- =========================================================
-- Raw AI-discovered or extractor-discovered info awaiting review
-- Can come from one or multiple sources.
-- This is NOT yet trusted final knowledge.

create table if not exists tenant_knowledge_candidates (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid references tenant_sources(id) on delete set null,
  source_run_id uuid references tenant_source_sync_runs(id) on delete set null,

  candidate_group text not null default 'general',
  category text not null,
  item_key text not null,

  title text not null default '',
  value_text text not null default '',
  value_json jsonb not null default '{}'::jsonb,

  normalized_text text not null default '',
  normalized_json jsonb not null default '{}'::jsonb,

  confidence numeric(5,4) not null default 0.0000,
  confidence_label text not null default 'low',

  status text not null default 'pending',
  review_reason text not null default '',
  conflict_hash text not null default '',

  source_evidence_json jsonb not null default '[]'::jsonb,
  extraction_method text not null default 'ai',
  extraction_model text not null default '',

  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),

  approved_item_id uuid,
  superseded_by_candidate_id uuid references tenant_knowledge_candidates(id) on delete set null,

  reviewed_by text not null default '',
  reviewed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_knowledge_candidates_category_chk check (
    category in (
      'company',
      'summary',
      'service',
      'product',
      'pricing',
      'pricing_policy',
      'offer',
      'faq',
      'objection',
      'contact',
      'location',
      'hours',
      'language',
      'tone',
      'brand',
      'policy',
      'capability',
      'cta',
      'social_link',
      'channel',
      'claim',
      'audience',
      'support',
      'booking',
      'handoff',
      'campaign',
      'legal',
      'other'
    )
  ),

  constraint tenant_knowledge_candidates_confidence_chk check (
    confidence >= 0 and confidence <= 1
  ),

  constraint tenant_knowledge_candidates_confidence_label_chk check (
    confidence_label in (
      'low',
      'medium',
      'high',
      'very_high'
    )
  ),

  constraint tenant_knowledge_candidates_status_chk check (
    status in (
      'pending',
      'approved',
      'rejected',
      'needs_review',
      'conflict',
      'superseded',
      'promoted'
    )
  ),

  constraint tenant_knowledge_candidates_extraction_method_chk check (
    extraction_method in (
      'ai',
      'rule',
      'parser',
      'ocr',
      'human',
      'import',
      'system'
    )
  ),

  constraint tenant_knowledge_candidates_tenant_key_chk check (btrim(tenant_key) <> ''),
  constraint tenant_knowledge_candidates_item_key_chk check (btrim(item_key) <> ''),
  constraint tenant_knowledge_candidates_group_chk check (btrim(candidate_group) <> '')
);

create index if not exists ix_tenant_knowledge_candidates_tenant_id
  on tenant_knowledge_candidates(tenant_id, created_at desc);

create index if not exists ix_tenant_knowledge_candidates_source_id
  on tenant_knowledge_candidates(source_id, created_at desc);

create index if not exists ix_tenant_knowledge_candidates_run_id
  on tenant_knowledge_candidates(source_run_id);

create index if not exists ix_tenant_knowledge_candidates_status
  on tenant_knowledge_candidates(tenant_id, status, created_at desc);

create index if not exists ix_tenant_knowledge_candidates_category_key
  on tenant_knowledge_candidates(tenant_id, category, item_key);

create index if not exists ix_tenant_knowledge_candidates_conflict_hash
  on tenant_knowledge_candidates(tenant_id, conflict_hash)
  where conflict_hash <> '';

create index if not exists ix_tenant_knowledge_candidates_pending_review
  on tenant_knowledge_candidates(tenant_id, category, created_at desc)
  where status in ('pending', 'needs_review', 'conflict');

create index if not exists ix_tenant_knowledge_candidates_confidence
  on tenant_knowledge_candidates(tenant_id, confidence desc);

drop trigger if exists trg_tenant_knowledge_candidates_updated_at on tenant_knowledge_candidates;
create trigger trg_tenant_knowledge_candidates_updated_at
before update on tenant_knowledge_candidates
for each row execute function set_updated_at();

-- =========================================================
-- 4) tenant_knowledge_items
-- =========================================================
-- Approved / trusted business knowledge used by runtime systems.
-- May be curated manually or promoted from candidates.

create table if not exists tenant_knowledge_items (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  canonical_key text not null,
  category text not null,
  item_key text not null,

  title text not null default '',
  value_text text not null default '',
  value_json jsonb not null default '{}'::jsonb,

  normalized_text text not null default '',
  normalized_json jsonb not null default '{}'::jsonb,

  status text not null default 'approved',
  priority integer not null default 100,
  confidence numeric(5,4) not null default 1.0000,

  source_count integer not null default 0,
  primary_source_id uuid references tenant_sources(id) on delete set null,
  source_evidence_json jsonb not null default '[]'::jsonb,

  approval_mode text not null default 'manual',
  approved_from_candidate_id uuid references tenant_knowledge_candidates(id) on delete set null,

  effective_from timestamptz,
  effective_to timestamptz,

  tags_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_by text not null default '',
  approved_by text not null default '',
  updated_by text not null default '',

  created_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now(),

  constraint tenant_knowledge_items_category_chk check (
    category in (
      'company',
      'summary',
      'service',
      'product',
      'pricing',
      'pricing_policy',
      'offer',
      'faq',
      'objection',
      'contact',
      'location',
      'hours',
      'language',
      'tone',
      'brand',
      'policy',
      'capability',
      'cta',
      'social_link',
      'channel',
      'claim',
      'audience',
      'support',
      'booking',
      'handoff',
      'campaign',
      'legal',
      'other'
    )
  ),

  constraint tenant_knowledge_items_status_chk check (
    status in (
      'approved',
      'active',
      'inactive',
      'deprecated',
      'archived'
    )
  ),

  constraint tenant_knowledge_items_approval_mode_chk check (
    approval_mode in (
      'manual',
      'auto',
      'promoted',
      'system'
    )
  ),

  constraint tenant_knowledge_items_priority_chk check (priority >= 0),
  constraint tenant_knowledge_items_confidence_chk check (
    confidence >= 0 and confidence <= 1
  ),
  constraint tenant_knowledge_items_source_count_chk check (source_count >= 0),

  constraint tenant_knowledge_items_tenant_key_chk check (btrim(tenant_key) <> ''),
  constraint tenant_knowledge_items_canonical_key_chk check (btrim(canonical_key) <> ''),
  constraint tenant_knowledge_items_item_key_chk check (btrim(item_key) <> '')
);

create unique index if not exists ux_tenant_knowledge_items_tenant_canonical_key
  on tenant_knowledge_items(tenant_id, canonical_key);

create index if not exists ix_tenant_knowledge_items_tenant_id
  on tenant_knowledge_items(tenant_id, updated_at desc);

create index if not exists ix_tenant_knowledge_items_category
  on tenant_knowledge_items(tenant_id, category, priority asc, updated_at desc);

create index if not exists ix_tenant_knowledge_items_status
  on tenant_knowledge_items(tenant_id, status);

create index if not exists ix_tenant_knowledge_items_primary_source
  on tenant_knowledge_items(primary_source_id);

create index if not exists ix_tenant_knowledge_items_active
  on tenant_knowledge_items(tenant_id, category, priority asc)
  where status in ('approved', 'active');

drop trigger if exists trg_tenant_knowledge_items_updated_at on tenant_knowledge_items;
create trigger trg_tenant_knowledge_items_updated_at
before update on tenant_knowledge_items
for each row execute function set_updated_at();

-- =========================================================
-- 5) tenant_knowledge_approvals
-- =========================================================
-- Approval / rejection / merge history for transparency and auditability

create table if not exists tenant_knowledge_approvals (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  candidate_id uuid references tenant_knowledge_candidates(id) on delete set null,
  knowledge_item_id uuid references tenant_knowledge_items(id) on delete set null,
  source_id uuid references tenant_sources(id) on delete set null,

  action text not null,
  decision text not null,

  reviewer_type text not null default 'human',
  reviewer_id text not null default '',
  reviewer_name text not null default '',

  reason text not null default '',
  before_json jsonb not null default '{}'::jsonb,
  after_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint tenant_knowledge_approvals_action_chk check (
    action in (
      'approve',
      'reject',
      'merge',
      'promote',
      'archive',
      'restore',
      'override',
      'auto_accept',
      'auto_reject'
    )
  ),

  constraint tenant_knowledge_approvals_decision_chk check (
    decision in (
      'approved',
      'rejected',
      'merged',
      'promoted',
      'archived',
      'restored',
      'overridden'
    )
  ),

  constraint tenant_knowledge_approvals_reviewer_type_chk check (
    reviewer_type in (
      'human',
      'ai',
      'system'
    )
  ),

  constraint tenant_knowledge_approvals_tenant_key_chk check (btrim(tenant_key) <> '')
);

create index if not exists ix_tenant_knowledge_approvals_tenant_id
  on tenant_knowledge_approvals(tenant_id, created_at desc);

create index if not exists ix_tenant_knowledge_approvals_candidate_id
  on tenant_knowledge_approvals(candidate_id);

create index if not exists ix_tenant_knowledge_approvals_item_id
  on tenant_knowledge_approvals(knowledge_item_id);

create index if not exists ix_tenant_knowledge_approvals_source_id
  on tenant_knowledge_approvals(source_id);

-- =========================================================
-- 6) tenant_business_profile
-- =========================================================
-- AI-generated + user-reviewed high-level company profile summary.
-- One row per tenant. This is a synthesized profile layer.

create table if not exists tenant_business_profile (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null unique references tenants(id) on delete cascade,
  tenant_key text not null unique,

  profile_status text not null default 'draft',

  company_name text not null default '',
  display_name text not null default '',
  legal_name text not null default '',
  industry_key text not null default '',
  subindustry_key text not null default '',

  summary_short text not null default '',
  summary_long text not null default '',
  value_proposition text not null default '',
  target_audience text not null default '',
  tone_profile text not null default '',

  main_language text not null default 'az',
  supported_languages jsonb not null default '[]'::jsonb,

  website_url text not null default '',
  primary_phone text not null default '',
  primary_email text not null default '',
  primary_address text not null default '',

  profile_json jsonb not null default '{}'::jsonb,
  source_summary_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  confidence numeric(5,4) not null default 0.0000,
  confidence_label text not null default 'low',

  generated_by text not null default '',
  approved_by text not null default '',

  generated_at timestamptz,
  approved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_profile_status_chk check (
    profile_status in (
      'draft',
      'review',
      'approved',
      'stale',
      'archived'
    )
  ),

  constraint tenant_business_profile_confidence_chk check (
    confidence >= 0 and confidence <= 1
  ),

  constraint tenant_business_profile_confidence_label_chk check (
    confidence_label in (
      'low',
      'medium',
      'high',
      'very_high'
    )
  ),

  constraint tenant_business_profile_tenant_key_chk check (btrim(tenant_key) <> '')
);

create index if not exists ix_tenant_business_profile_industry
  on tenant_business_profile(industry_key);

drop trigger if exists trg_tenant_business_profile_updated_at on tenant_business_profile;
create trigger trg_tenant_business_profile_updated_at
before update on tenant_business_profile
for each row execute function set_updated_at();

-- =========================================================
-- 7) tenant_business_capabilities
-- =========================================================
-- Runtime decision flags/capabilities for AI behavior.
-- One row per tenant. Structured "can/cannot/should" layer.

create table if not exists tenant_business_capabilities (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null unique references tenants(id) on delete cascade,
  tenant_key text not null unique,

  can_share_prices boolean not null default false,
  can_share_starting_prices boolean not null default false,
  requires_human_for_custom_quote boolean not null default true,

  can_capture_leads boolean not null default true,
  can_capture_phone boolean not null default true,
  can_capture_email boolean not null default true,

  can_offer_booking boolean not null default false,
  can_offer_consultation boolean not null default false,
  can_offer_callback boolean not null default true,

  supports_instagram_dm boolean not null default false,
  supports_facebook_messenger boolean not null default false,
  supports_whatsapp boolean not null default false,
  supports_comments boolean not null default false,
  supports_voice boolean not null default false,
  supports_email boolean not null default false,

  supports_multilanguage boolean not null default false,
  primary_language text not null default 'az',
  supported_languages jsonb not null default '[]'::jsonb,

  handoff_enabled boolean not null default true,
  auto_handoff_on_human_request boolean not null default true,
  auto_handoff_on_low_confidence boolean not null default true,

  should_avoid_competitor_comparisons boolean not null default true,
  should_avoid_legal_claims boolean not null default true,
  should_avoid_unverified_promises boolean not null default true,

  reply_style text not null default 'professional',
  reply_length text not null default 'medium',
  emoji_level text not null default 'low',
  cta_style text not null default 'soft',

  pricing_mode text not null default 'custom_quote',
  booking_mode text not null default 'manual',
  sales_mode text not null default 'consultative',

  capabilities_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  derived_from_profile boolean not null default false,
  approved_by text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_business_capabilities_tenant_key_chk check (btrim(tenant_key) <> ''),

  constraint tenant_business_capabilities_reply_style_chk check (
    reply_style in (
      'friendly',
      'professional',
      'premium',
      'luxury',
      'corporate',
      'playful',
      'consultative'
    )
  ),

  constraint tenant_business_capabilities_reply_length_chk check (
    reply_length in (
      'short',
      'medium',
      'detailed'
    )
  ),

  constraint tenant_business_capabilities_emoji_level_chk check (
    emoji_level in (
      'none',
      'low',
      'medium',
      'high'
    )
  ),

  constraint tenant_business_capabilities_cta_style_chk check (
    cta_style in (
      'none',
      'soft',
      'direct',
      'strong'
    )
  ),

  constraint tenant_business_capabilities_pricing_mode_chk check (
    pricing_mode in (
      'hidden',
      'starting_price',
      'fixed_price',
      'custom_quote',
      'hybrid'
    )
  ),

  constraint tenant_business_capabilities_booking_mode_chk check (
    booking_mode in (
      'disabled',
      'manual',
      'form',
      'calendar',
      'whatsapp',
      'instagram',
      'phone'
    )
  ),

  constraint tenant_business_capabilities_sales_mode_chk check (
    sales_mode in (
      'soft',
      'consultative',
      'direct',
      'high_touch'
    )
  )
);

drop trigger if exists trg_tenant_business_capabilities_updated_at on tenant_business_capabilities;
create trigger trg_tenant_business_capabilities_updated_at
before update on tenant_business_capabilities
for each row execute function set_updated_at();

-- =========================================================
-- 8) Optional helper view:
-- pending review candidates for admin UI
-- =========================================================
create or replace view v_tenant_knowledge_review_queue as
select
  c.id,
  c.tenant_id,
  c.tenant_key,
  c.source_id,
  s.source_type,
  s.display_name as source_display_name,
  c.source_run_id,
  c.category,
  c.item_key,
  c.title,
  c.value_text,
  c.value_json,
  c.confidence,
  c.confidence_label,
  c.status,
  c.review_reason,
  c.conflict_hash,
  c.source_evidence_json,
  c.first_seen_at,
  c.last_seen_at,
  c.created_at,
  c.updated_at
from tenant_knowledge_candidates c
left join tenant_sources s
  on s.id = c.source_id
where c.status in ('pending', 'needs_review', 'conflict');

-- =========================================================
-- 9) Optional helper view:
-- active trusted knowledge for runtime
-- =========================================================
create or replace view v_tenant_active_knowledge as
select
  k.id,
  k.tenant_id,
  k.tenant_key,
  k.canonical_key,
  k.category,
  k.item_key,
  k.title,
  k.value_text,
  k.value_json,
  k.normalized_text,
  k.normalized_json,
  k.priority,
  k.confidence,
  k.source_count,
  k.primary_source_id,
  s.source_type as primary_source_type,
  s.display_name as primary_source_display_name,
  k.source_evidence_json,
  k.tags_json,
  k.metadata_json,
  k.created_at,
  k.approved_at,
  k.updated_at
from tenant_knowledge_items k
left join tenant_sources s
  on s.id = k.primary_source_id
where k.status in ('approved', 'active')
  and (k.effective_from is null or k.effective_from <= now())
  and (k.effective_to is null or k.effective_to >= now());

-- =========================================================
-- 10) seed / backfill safety
-- =========================================================
-- Create default profile/capability rows for existing tenants
-- without overwriting anything already present.

insert into tenant_business_profile (
  tenant_id,
  tenant_key,
  company_name,
  display_name,
  legal_name,
  industry_key,
  summary_short,
  summary_long,
  main_language,
  supported_languages,
  website_url,
  profile_status,
  confidence,
  confidence_label
)
select
  t.id,
  coalesce(nullif(btrim(t.tenant_key), ''), t.id::text) as tenant_key,
  coalesce(nullif(btrim(t.company_name), ''), '') as company_name,
  coalesce(
    nullif(btrim(tp.brand_name), ''),
    nullif(btrim(t.company_name), ''),
    ''
  ) as display_name,
  coalesce(nullif(btrim(t.legal_name), ''), '') as legal_name,
  coalesce(nullif(btrim(t.industry_key), ''), 'generic_business') as industry_key,
  coalesce(nullif(btrim(tp.brand_summary), ''), '') as summary_short,
  coalesce(nullif(btrim(tp.brand_summary), ''), '') as summary_long,
  coalesce(nullif(btrim(t.default_language), ''), 'az') as main_language,
  case
    when jsonb_typeof(coalesce(t.enabled_languages, '[]'::jsonb)) = 'array'
      then coalesce(t.enabled_languages, '[]'::jsonb)
    else '[]'::jsonb
  end as supported_languages,
  coalesce(nullif(btrim(tp.website_url), ''), '') as website_url,
  'draft' as profile_status,
  0.1000 as confidence,
  'low' as confidence_label
from tenants t
left join tenant_profiles tp
  on tp.tenant_id = t.id
where not exists (
  select 1
  from tenant_business_profile p
  where p.tenant_id = t.id
);

insert into tenant_business_capabilities (
  tenant_id,
  tenant_key,
  primary_language,
  supported_languages,
  supports_multilanguage,
  can_capture_leads,
  can_capture_phone,
  can_capture_email,
  can_offer_callback,
  handoff_enabled,
  auto_handoff_on_human_request,
  auto_handoff_on_low_confidence,
  reply_style
)
select
  t.id,
  coalesce(nullif(btrim(t.tenant_key), ''), t.id::text) as tenant_key,
  coalesce(nullif(btrim(t.default_language), ''), 'az') as primary_language,
  case
    when jsonb_typeof(coalesce(t.enabled_languages, '[]'::jsonb)) = 'array'
      then coalesce(t.enabled_languages, '[]'::jsonb)
    else '[]'::jsonb
  end as supported_languages,
  case
    when jsonb_typeof(coalesce(t.enabled_languages, '[]'::jsonb)) = 'array'
         and jsonb_array_length(coalesce(t.enabled_languages, '[]'::jsonb)) > 1
      then true
    else false
  end as supports_multilanguage,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  coalesce(nullif(btrim(tp.tone_of_voice), ''), 'professional') as reply_style
from tenants t
left join tenant_profiles tp
  on tp.tenant_id = t.id
where not exists (
  select 1
  from tenant_business_capabilities c
  where c.tenant_id = t.id
);