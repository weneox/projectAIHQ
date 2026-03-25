-- ============================================================
-- tenant_business_facts
-- company-wide structured facts for AI / inbox / comments / voice
-- ============================================================

create table if not exists tenant_business_facts (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  fact_key text not null,
  fact_group text not null default 'general',

  title text not null default '',
  value_text text not null default '',
  value_json jsonb not null default '{}'::jsonb,

  language text not null default 'en',

  channel_scope jsonb not null default '[]'::jsonb,
  usecase_scope jsonb not null default '[]'::jsonb,

  priority int not null default 100,
  enabled boolean not null default true,

  source_type text not null default 'manual',
  source_ref text,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_business_facts add column if not exists tenant_id uuid;
alter table tenant_business_facts add column if not exists fact_key text;
alter table tenant_business_facts add column if not exists fact_group text default 'general';
alter table tenant_business_facts add column if not exists title text default '';
alter table tenant_business_facts add column if not exists value_text text default '';
alter table tenant_business_facts add column if not exists value_json jsonb default '{}'::jsonb;
alter table tenant_business_facts add column if not exists language text default 'en';
alter table tenant_business_facts add column if not exists channel_scope jsonb default '[]'::jsonb;
alter table tenant_business_facts add column if not exists usecase_scope jsonb default '[]'::jsonb;
alter table tenant_business_facts add column if not exists priority int default 100;
alter table tenant_business_facts add column if not exists enabled boolean default true;
alter table tenant_business_facts add column if not exists source_type text default 'manual';
alter table tenant_business_facts add column if not exists source_ref text;
alter table tenant_business_facts add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_business_facts add column if not exists created_at timestamptz default now();
alter table tenant_business_facts add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_business_facts alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column fact_group set default 'general';
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column title set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column value_text set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column value_json set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column language set default 'en';
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column channel_scope set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column usecase_scope set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column priority set default 100;
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column source_type set default 'manual';
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_business_facts alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_constraint where conname = 'tenant_business_facts_tenant_id_fkey'
  ) then
    begin
      alter table tenant_business_facts
        add constraint tenant_business_facts_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_business_facts drop constraint if exists tenant_business_facts_source_type_check';
  exception when others then null;
  end;

  begin
    alter table tenant_business_facts
      add constraint tenant_business_facts_source_type_check
      check (source_type in ('manual','imported','derived','system'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_tenant_business_facts_tenant_key_lang
  on tenant_business_facts(tenant_id, fact_key, language);

create index if not exists idx_tenant_business_facts_tenant_group_enabled
  on tenant_business_facts(tenant_id, fact_group, enabled, priority asc, updated_at desc);

create index if not exists idx_tenant_business_facts_tenant_enabled
  on tenant_business_facts(tenant_id, enabled, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_business_facts_updated_at') then
    execute '
      create trigger trg_tenant_business_facts_updated_at
      before update on tenant_business_facts
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_channel_policies
-- channel-specific behavior rules
-- ============================================================

create table if not exists tenant_channel_policies (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  channel text not null,
  subchannel text not null default 'default',

  enabled boolean not null default true,
  auto_reply_enabled boolean not null default true,
  ai_reply_enabled boolean not null default true,
  human_handoff_enabled boolean not null default true,

  pricing_visibility text not null default 'inherit',
  public_reply_mode text not null default 'inherit',
  contact_capture_mode text not null default 'inherit',
  escalation_mode text not null default 'inherit',

  reply_style text not null default '',
  max_reply_sentences int not null default 2,

  rules jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_channel_policies add column if not exists tenant_id uuid;
alter table tenant_channel_policies add column if not exists channel text;
alter table tenant_channel_policies add column if not exists subchannel text default 'default';
alter table tenant_channel_policies add column if not exists enabled boolean default true;
alter table tenant_channel_policies add column if not exists auto_reply_enabled boolean default true;
alter table tenant_channel_policies add column if not exists ai_reply_enabled boolean default true;
alter table tenant_channel_policies add column if not exists human_handoff_enabled boolean default true;
alter table tenant_channel_policies add column if not exists pricing_visibility text default 'inherit';
alter table tenant_channel_policies add column if not exists public_reply_mode text default 'inherit';
alter table tenant_channel_policies add column if not exists contact_capture_mode text default 'inherit';
alter table tenant_channel_policies add column if not exists escalation_mode text default 'inherit';
alter table tenant_channel_policies add column if not exists reply_style text default '';
alter table tenant_channel_policies add column if not exists max_reply_sentences int default 2;
alter table tenant_channel_policies add column if not exists rules jsonb default '{}'::jsonb;
alter table tenant_channel_policies add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_channel_policies add column if not exists created_at timestamptz default now();
alter table tenant_channel_policies add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_channel_policies alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column subchannel set default 'default';
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column auto_reply_enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column ai_reply_enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column human_handoff_enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column pricing_visibility set default 'inherit';
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column public_reply_mode set default 'inherit';
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column contact_capture_mode set default 'inherit';
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column escalation_mode set default 'inherit';
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column reply_style set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column max_reply_sentences set default 2;
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column rules set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_channel_policies alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_constraint where conname = 'tenant_channel_policies_tenant_id_fkey'
  ) then
    begin
      alter table tenant_channel_policies
        add constraint tenant_channel_policies_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_channel_policies drop constraint if exists tenant_channel_policies_pricing_visibility_check';
  exception when others then null;
  end;

  begin
    alter table tenant_channel_policies
      add constraint tenant_channel_policies_pricing_visibility_check
      check (pricing_visibility in ('inherit','hidden','allowed','redirect_to_dm','quote_only'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_channel_policies drop constraint if exists tenant_channel_policies_public_reply_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_channel_policies
      add constraint tenant_channel_policies_public_reply_mode_check
      check (public_reply_mode in ('inherit','disabled','short_public','dm_redirect','operator_only'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_channel_policies drop constraint if exists tenant_channel_policies_contact_capture_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_channel_policies
      add constraint tenant_channel_policies_contact_capture_mode_check
      check (contact_capture_mode in ('inherit','never','optional','required_before_quote','required_before_handoff'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_channel_policies drop constraint if exists tenant_channel_policies_escalation_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_channel_policies
      add constraint tenant_channel_policies_escalation_mode_check
      check (escalation_mode in ('inherit','manual','automatic','operator_only'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_tenant_channel_policies_tenant_channel_subchannel
  on tenant_channel_policies(tenant_id, channel, subchannel);

create index if not exists idx_tenant_channel_policies_tenant_channel
  on tenant_channel_policies(tenant_id, channel, enabled, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_channel_policies_updated_at') then
    execute '
      create trigger trg_tenant_channel_policies_updated_at
      before update on tenant_channel_policies
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_locations
-- ============================================================

create table if not exists tenant_locations (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  location_key text not null,
  title text not null default '',

  country_code text,
  city text,
  address_line text,
  map_url text,

  phone text,
  email text,

  working_hours jsonb not null default '{}'::jsonb,
  delivery_areas jsonb not null default '[]'::jsonb,

  is_primary boolean not null default false,
  enabled boolean not null default true,
  sort_order int not null default 0,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_locations add column if not exists tenant_id uuid;
alter table tenant_locations add column if not exists location_key text;
alter table tenant_locations add column if not exists title text default '';
alter table tenant_locations add column if not exists country_code text;
alter table tenant_locations add column if not exists city text;
alter table tenant_locations add column if not exists address_line text;
alter table tenant_locations add column if not exists map_url text;
alter table tenant_locations add column if not exists phone text;
alter table tenant_locations add column if not exists email text;
alter table tenant_locations add column if not exists working_hours jsonb default '{}'::jsonb;
alter table tenant_locations add column if not exists delivery_areas jsonb default '[]'::jsonb;
alter table tenant_locations add column if not exists is_primary boolean default false;
alter table tenant_locations add column if not exists enabled boolean default true;
alter table tenant_locations add column if not exists sort_order int default 0;
alter table tenant_locations add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_locations add column if not exists created_at timestamptz default now();
alter table tenant_locations add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_locations alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column title set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column working_hours set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column delivery_areas set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column is_primary set default false;
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column sort_order set default 0;
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_locations alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_constraint where conname = 'tenant_locations_tenant_id_fkey'
  ) then
    begin
      alter table tenant_locations
        add constraint tenant_locations_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_tenant_locations_tenant_location_key
  on tenant_locations(tenant_id, location_key);

create index if not exists idx_tenant_locations_tenant_enabled_sort
  on tenant_locations(tenant_id, enabled, sort_order asc, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_locations_updated_at') then
    execute '
      create trigger trg_tenant_locations_updated_at
      before update on tenant_locations
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_contacts
-- ============================================================

create table if not exists tenant_contacts (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  contact_key text not null,
  channel text not null,

  label text not null default '',
  value text not null default '',

  is_primary boolean not null default false,
  enabled boolean not null default true,
  visible_public boolean not null default true,
  visible_in_ai boolean not null default true,

  sort_order int not null default 0,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_contacts add column if not exists tenant_id uuid;
alter table tenant_contacts add column if not exists contact_key text;
alter table tenant_contacts add column if not exists channel text;
alter table tenant_contacts add column if not exists label text default '';
alter table tenant_contacts add column if not exists value text default '';
alter table tenant_contacts add column if not exists is_primary boolean default false;
alter table tenant_contacts add column if not exists enabled boolean default true;
alter table tenant_contacts add column if not exists visible_public boolean default true;
alter table tenant_contacts add column if not exists visible_in_ai boolean default true;
alter table tenant_contacts add column if not exists sort_order int default 0;
alter table tenant_contacts add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_contacts add column if not exists created_at timestamptz default now();
alter table tenant_contacts add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_contacts alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column label set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column value set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column is_primary set default false;
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column visible_public set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column visible_in_ai set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column sort_order set default 0;
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_contacts alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (
    select 1 from pg_constraint where conname = 'tenant_contacts_tenant_id_fkey'
  ) then
    begin
      alter table tenant_contacts
        add constraint tenant_contacts_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_tenant_contacts_tenant_contact_key
  on tenant_contacts(tenant_id, contact_key);

create index if not exists idx_tenant_contacts_tenant_channel_enabled
  on tenant_contacts(tenant_id, channel, enabled, sort_order asc, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_contacts_updated_at') then
    execute '
      create trigger trg_tenant_contacts_updated_at
      before update on tenant_contacts
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;