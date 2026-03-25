-- ============================================================
-- comments
-- ============================================================

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,
  channel text not null default 'instagram',
  source text not null default 'meta',

  external_comment_id text not null,
  external_parent_comment_id text,
  external_post_id text,

  external_user_id text,
  external_username text,
  customer_name text,

  text text not null default '',
  classification jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table comments add column if not exists tenant_id uuid;
alter table comments add column if not exists tenant_key text;
alter table comments add column if not exists channel text;
alter table comments add column if not exists source text;
alter table comments add column if not exists external_comment_id text;
alter table comments add column if not exists external_parent_comment_id text;
alter table comments add column if not exists external_post_id text;
alter table comments add column if not exists external_user_id text;
alter table comments add column if not exists external_username text;
alter table comments add column if not exists customer_name text;
alter table comments add column if not exists text text;
alter table comments add column if not exists classification jsonb default '{}'::jsonb;
alter table comments add column if not exists raw jsonb default '{}'::jsonb;
alter table comments add column if not exists created_at timestamptz default now();
alter table comments add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table comments alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table comments alter column channel set default 'instagram';
  exception when others then null;
  end;
  begin
    alter table comments alter column source set default 'meta';
  exception when others then null;
  end;
  begin
    alter table comments alter column text set default '';
  exception when others then null;
  end;
  begin
    alter table comments alter column classification set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table comments alter column raw set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table comments alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'comments_tenant_id_fkey') then
    begin
      alter table comments
        add constraint comments_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_comments_tenant_channel_external_comment
  on comments(tenant_key, channel, external_comment_id);

create index if not exists idx_comments_tenant_created
  on comments(tenant_id, created_at desc);

create index if not exists idx_comments_tenant_key_created
  on comments(tenant_key, created_at desc);

create index if not exists idx_comments_channel_created
  on comments(channel, created_at desc);

create index if not exists idx_comments_post
  on comments(external_post_id);

create index if not exists idx_comments_category
  on comments((classification->>'category'), created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_comments_updated_at') then
    execute '
      create trigger trg_comments_updated_at
      before update on comments
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;