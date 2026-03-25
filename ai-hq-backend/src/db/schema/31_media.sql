-- ============================================================
-- content_media_assets
-- ============================================================

create table if not exists content_media_assets (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,

  content_id uuid,
  proposal_id uuid,
  thread_id uuid,
  job_id uuid,

  asset_kind text not null default 'other',
  asset_role text not null default '',
  status text not null default 'ready',

  provider text not null default '',
  provider_asset_id text,
  external_url text,
  storage_provider text not null default 'cloudinary',
  storage_key text,
  public_url text,
  preview_url text,

  mime_type text,
  file_ext text,
  format text,
  language text,

  duration_ms int not null default 0,
  width int,
  height int,
  fps numeric(8,2),

  bytes bigint not null default 0,
  checksum_sha256 text,

  sort_order int not null default 0,
  source_ref text,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_media_assets add column if not exists tenant_id uuid;
alter table content_media_assets add column if not exists tenant_key text;
alter table content_media_assets add column if not exists content_id uuid;
alter table content_media_assets add column if not exists proposal_id uuid;
alter table content_media_assets add column if not exists thread_id uuid;
alter table content_media_assets add column if not exists job_id uuid;
alter table content_media_assets add column if not exists asset_kind text default 'other';
alter table content_media_assets add column if not exists asset_role text default '';
alter table content_media_assets add column if not exists status text default 'ready';
alter table content_media_assets add column if not exists provider text default '';
alter table content_media_assets add column if not exists provider_asset_id text;
alter table content_media_assets add column if not exists external_url text;
alter table content_media_assets add column if not exists storage_provider text default 'cloudinary';
alter table content_media_assets add column if not exists storage_key text;
alter table content_media_assets add column if not exists public_url text;
alter table content_media_assets add column if not exists preview_url text;
alter table content_media_assets add column if not exists mime_type text;
alter table content_media_assets add column if not exists file_ext text;
alter table content_media_assets add column if not exists format text;
alter table content_media_assets add column if not exists language text;
alter table content_media_assets add column if not exists duration_ms int default 0;
alter table content_media_assets add column if not exists width int;
alter table content_media_assets add column if not exists height int;
alter table content_media_assets add column if not exists fps numeric(8,2);
alter table content_media_assets add column if not exists bytes bigint default 0;
alter table content_media_assets add column if not exists checksum_sha256 text;
alter table content_media_assets add column if not exists sort_order int default 0;
alter table content_media_assets add column if not exists source_ref text;
alter table content_media_assets add column if not exists meta jsonb default '{}'::jsonb;
alter table content_media_assets add column if not exists created_at timestamptz default now();
alter table content_media_assets add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table content_media_assets alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column asset_kind set default 'other';
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column asset_role set default '';
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column status set default 'ready';
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column provider set default '';
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column storage_provider set default 'cloudinary';
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column duration_ms set default 0;
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column bytes set default 0;
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column sort_order set default 0;
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table content_media_assets alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'content_media_assets_tenant_id_fkey') then
    begin
      alter table content_media_assets
        add constraint content_media_assets_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_media_assets_content_id_fkey') then
    begin
      alter table content_media_assets
        add constraint content_media_assets_content_id_fkey
        foreign key (content_id) references content_items(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_media_assets_proposal_id_fkey') then
    begin
      alter table content_media_assets
        add constraint content_media_assets_proposal_id_fkey
        foreign key (proposal_id) references proposals(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_media_assets_thread_id_fkey') then
    begin
      alter table content_media_assets
        add constraint content_media_assets_thread_id_fkey
        foreign key (thread_id) references threads(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'content_media_assets_job_id_fkey') then
    begin
      alter table content_media_assets
        add constraint content_media_assets_job_id_fkey
        foreign key (job_id) references jobs(id) on delete set null;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table content_media_assets drop constraint if exists content_media_assets_asset_kind_check';
  exception when others then null;
  end;

  begin
    alter table content_media_assets
      add constraint content_media_assets_asset_kind_check
      check (
        asset_kind in (
          'voiceover',
          'voiceover_segment',
          'scene_image',
          'scene_video',
          'source_image',
          'rendered_video',
          'cover',
          'thumbnail',
          'subtitle_srt',
          'subtitle_vtt',
          'music',
          'sfx',
          'waveform',
          'other'
        )
      );
  exception when others then null;
  end;

  begin
    execute 'alter table content_media_assets drop constraint if exists content_media_assets_status_check';
  exception when others then null;
  end;

  begin
    alter table content_media_assets
      add constraint content_media_assets_status_check
      check (status in ('queued','processing','ready','failed','archived'));
  exception when others then null;
  end;
end$$;

create index if not exists idx_content_media_assets_content_sort
  on content_media_assets(content_id, asset_kind, sort_order, created_at asc);

create index if not exists idx_content_media_assets_proposal_created
  on content_media_assets(proposal_id, created_at desc);

create index if not exists idx_content_media_assets_job_created
  on content_media_assets(job_id, created_at desc);

create index if not exists idx_content_media_assets_tenant_created
  on content_media_assets(tenant_id, created_at desc);

create index if not exists idx_content_media_assets_kind_status
  on content_media_assets(asset_kind, status, created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_content_media_assets_updated_at') then
    execute '
      create trigger trg_content_media_assets_updated_at
      before update on content_media_assets
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;