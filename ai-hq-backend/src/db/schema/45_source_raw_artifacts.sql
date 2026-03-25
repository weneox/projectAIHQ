-- src/db/schema/45_source_raw_artifacts.sql
-- FINAL v1.0
-- =========================================================
-- Raw source artifact layer
-- source intake -> raw artifacts -> observations -> synthesis
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
-- 1) tenant_source_raw_artifacts
-- one row = one raw captured artifact
-- examples:
-- - website page html/text
-- - google place details payload
-- - instagram profile payload
-- - uploaded pdf file metadata
-- - transcript/audio metadata
-- =========================================================

create table if not exists tenant_source_raw_artifacts (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid not null references tenant_sources(id) on delete cascade,
  source_run_id uuid references tenant_source_sync_runs(id) on delete set null,

  artifact_type text not null,
  artifact_key text not null,
  parent_artifact_id uuid references tenant_source_raw_artifacts(id) on delete set null,

  capture_method text not null default 'system',
  status text not null default 'active',
  visibility text not null default 'private',

  source_type text not null default '',
  source_url text not null default '',
  canonical_url text not null default '',
  external_artifact_id text not null default '',

  title text not null default '',
  subtitle text not null default '',
  page_type text not null default '',
  mime_type text not null default '',
  language text not null default '',

  http_status integer,
  byte_size bigint not null default 0,
  text_length integer not null default 0,

  content_hash text not null default '',
  checksum_sha256 text not null default '',

  raw_text text not null default '',
  extracted_text text not null default '',
  raw_html text not null default '',
  raw_json jsonb not null default '{}'::jsonb,

  headers_json jsonb not null default '{}'::jsonb,
  links_json jsonb not null default '[]'::jsonb,
  media_refs_json jsonb not null default '[]'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,

  quality_score numeric(5,4) not null default 0.0000,
  quality_label text not null default 'low',

  occurred_at timestamptz,
  fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_source_raw_artifacts_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_source_raw_artifacts_artifact_key_chk
    check (btrim(artifact_key) <> ''),

  constraint tenant_source_raw_artifacts_artifact_type_chk
    check (
      artifact_type in (
        'website_site',
        'website_page',
        'website_sitemap',
        'website_feed',
        'website_asset_ref',
        'place_details',
        'business_profile_payload',
        'social_profile',
        'social_post',
        'social_comment',
        'message_thread',
        'message',
        'document_file',
        'document_page',
        'spreadsheet_sheet',
        'slide_deck',
        'slide',
        'image',
        'video',
        'audio',
        'transcript',
        'api_payload',
        'manual_note',
        'other'
      )
    ),

  constraint tenant_source_raw_artifacts_capture_method_chk
    check (
      capture_method in (
        'crawler',
        'api',
        'oauth',
        'upload',
        'webhook',
        'manual',
        'ocr',
        'import',
        'system'
      )
    ),

  constraint tenant_source_raw_artifacts_status_chk
    check (
      status in (
        'active',
        'superseded',
        'discarded',
        'error'
      )
    ),

  constraint tenant_source_raw_artifacts_visibility_chk
    check (
      visibility in (
        'public',
        'private',
        'restricted',
        'hybrid'
      )
    ),

  constraint tenant_source_raw_artifacts_quality_score_chk
    check (quality_score >= 0 and quality_score <= 1),

  constraint tenant_source_raw_artifacts_quality_label_chk
    check (
      quality_label in (
        'low',
        'medium',
        'high',
        'very_high'
      )
    ),

  constraint tenant_source_raw_artifacts_byte_size_chk
    check (byte_size >= 0),

  constraint tenant_source_raw_artifacts_text_length_chk
    check (text_length >= 0),

  constraint tenant_source_raw_artifacts_http_status_chk
    check (http_status is null or (http_status >= 100 and http_status <= 599))
);

create unique index if not exists ux_tenant_source_raw_artifacts_run_artifact_key
  on tenant_source_raw_artifacts(source_run_id, artifact_key)
  where source_run_id is not null;

create index if not exists ix_tenant_source_raw_artifacts_tenant_created
  on tenant_source_raw_artifacts(tenant_id, created_at desc);

create index if not exists ix_tenant_source_raw_artifacts_source
  on tenant_source_raw_artifacts(source_id, created_at desc);

create index if not exists ix_tenant_source_raw_artifacts_run
  on tenant_source_raw_artifacts(source_run_id, created_at desc);

create index if not exists ix_tenant_source_raw_artifacts_type
  on tenant_source_raw_artifacts(tenant_id, artifact_type, created_at desc);

create index if not exists ix_tenant_source_raw_artifacts_status
  on tenant_source_raw_artifacts(tenant_id, status, created_at desc);

create index if not exists ix_tenant_source_raw_artifacts_url
  on tenant_source_raw_artifacts(tenant_id, canonical_url, source_url);

create index if not exists ix_tenant_source_raw_artifacts_parent
  on tenant_source_raw_artifacts(parent_artifact_id)
  where parent_artifact_id is not null;

create index if not exists ix_tenant_source_raw_artifacts_hash
  on tenant_source_raw_artifacts(tenant_id, content_hash)
  where btrim(content_hash) <> '';

create index if not exists ix_tenant_source_raw_artifacts_json
  on tenant_source_raw_artifacts using gin (raw_json);

drop trigger if exists trg_tenant_source_raw_artifacts_updated_at on tenant_source_raw_artifacts;
create trigger trg_tenant_source_raw_artifacts_updated_at
before update on tenant_source_raw_artifacts
for each row execute function set_updated_at();

-- =========================================================
-- 2) tenant_source_artifact_chunks
-- normalized chunk layer for search / retrieval / observation extraction
-- one artifact can have many chunks
-- =========================================================

create table if not exists tenant_source_artifact_chunks (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null references tenants(id) on delete cascade,
  tenant_key text not null,

  source_id uuid not null references tenant_sources(id) on delete cascade,
  source_run_id uuid references tenant_source_sync_runs(id) on delete set null,
  artifact_id uuid not null references tenant_source_raw_artifacts(id) on delete cascade,

  chunk_key text not null,
  chunk_index integer not null default 0,
  chunk_type text not null default 'text',

  page_number integer,
  section_label text not null default '',
  section_title text not null default '',

  text_content text not null default '',
  normalized_text text not null default '',

  char_count integer not null default 0,
  token_estimate integer not null default 0,

  language text not null default '',
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenant_source_artifact_chunks_tenant_key_chk
    check (btrim(tenant_key) <> ''),

  constraint tenant_source_artifact_chunks_chunk_key_chk
    check (btrim(chunk_key) <> ''),

  constraint tenant_source_artifact_chunks_chunk_type_chk
    check (
      chunk_type in (
        'text',
        'heading',
        'paragraph',
        'list_item',
        'faq',
        'table_row',
        'metadata',
        'summary',
        'other'
      )
    ),

  constraint tenant_source_artifact_chunks_chunk_index_chk
    check (chunk_index >= 0),

  constraint tenant_source_artifact_chunks_page_number_chk
    check (page_number is null or page_number >= 0),

  constraint tenant_source_artifact_chunks_char_count_chk
    check (char_count >= 0),

  constraint tenant_source_artifact_chunks_token_estimate_chk
    check (token_estimate >= 0)
);

create unique index if not exists ux_tenant_source_artifact_chunks_artifact_chunk_key
  on tenant_source_artifact_chunks(artifact_id, chunk_key);

create index if not exists ix_tenant_source_artifact_chunks_tenant_created
  on tenant_source_artifact_chunks(tenant_id, created_at desc);

create index if not exists ix_tenant_source_artifact_chunks_artifact
  on tenant_source_artifact_chunks(artifact_id, chunk_index asc);

create index if not exists ix_tenant_source_artifact_chunks_run
  on tenant_source_artifact_chunks(source_run_id, created_at desc);

create index if not exists ix_tenant_source_artifact_chunks_type
  on tenant_source_artifact_chunks(tenant_id, chunk_type, created_at desc);

create index if not exists ix_tenant_source_artifact_chunks_search
  on tenant_source_artifact_chunks
  using gin (to_tsvector('simple', coalesce(normalized_text, '') || ' ' || coalesce(text_content, '')));

drop trigger if exists trg_tenant_source_artifact_chunks_updated_at on tenant_source_artifact_chunks;
create trigger trg_tenant_source_artifact_chunks_updated_at
before update on tenant_source_artifact_chunks
for each row execute function set_updated_at();

-- =========================================================
-- 3) helper view
-- latest active artifacts for inspection/admin/debug
-- =========================================================

create or replace view v_tenant_source_latest_artifacts as
select
  a.id,
  a.tenant_id,
  a.tenant_key,
  a.source_id,
  a.source_run_id,
  s.source_type,
  s.display_name as source_display_name,
  a.artifact_type,
  a.artifact_key,
  a.status,
  a.capture_method,
  a.visibility,
  a.source_url,
  a.canonical_url,
  a.title,
  a.page_type,
  a.mime_type,
  a.language,
  a.http_status,
  a.byte_size,
  a.text_length,
  a.quality_score,
  a.quality_label,
  a.fetched_at,
  a.created_at,
  a.updated_at
from tenant_source_raw_artifacts a
left join tenant_sources s
  on s.id = a.source_id
where a.status = 'active';

commit;