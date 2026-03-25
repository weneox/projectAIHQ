-- ============================================================
-- tenant_profiles
-- ============================================================

create table if not exists tenant_profiles (
  tenant_id uuid primary key,
  brand_name text not null default '',
  website_url text,
  public_email text,
  public_phone text,
  audience_summary text not null default '',
  services_summary text not null default '',
  value_proposition text not null default '',
  brand_summary text not null default '',
  tone_of_voice text not null default 'professional',
  preferred_cta text not null default '',
  banned_phrases jsonb not null default '[]'::jsonb,
  communication_rules jsonb not null default '{}'::jsonb,
  visual_style jsonb not null default '{}'::jsonb,
  extra_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_profiles add column if not exists brand_name text default '';
alter table tenant_profiles add column if not exists website_url text;
alter table tenant_profiles add column if not exists public_email text;
alter table tenant_profiles add column if not exists public_phone text;
alter table tenant_profiles add column if not exists audience_summary text default '';
alter table tenant_profiles add column if not exists services_summary text default '';
alter table tenant_profiles add column if not exists value_proposition text default '';
alter table tenant_profiles add column if not exists brand_summary text default '';
alter table tenant_profiles add column if not exists tone_of_voice text default 'professional';
alter table tenant_profiles add column if not exists preferred_cta text default '';
alter table tenant_profiles add column if not exists banned_phrases jsonb default '[]'::jsonb;
alter table tenant_profiles add column if not exists communication_rules jsonb default '{}'::jsonb;
alter table tenant_profiles add column if not exists visual_style jsonb default '{}'::jsonb;
alter table tenant_profiles add column if not exists extra_context jsonb default '{}'::jsonb;
alter table tenant_profiles add column if not exists created_at timestamptz default now();
alter table tenant_profiles add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_profiles_tenant_id_fkey') then
    begin
      alter table tenant_profiles
        add constraint tenant_profiles_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_profiles_updated_at') then
    execute '
      create trigger trg_tenant_profiles_updated_at
      before update on tenant_profiles
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_ai_policies
-- ============================================================

create table if not exists tenant_ai_policies (
  tenant_id uuid primary key,
  auto_reply_enabled boolean not null default true,
  suppress_ai_during_handoff boolean not null default true,
  mark_seen_enabled boolean not null default true,
  typing_indicator_enabled boolean not null default true,
  create_lead_enabled boolean not null default true,
  approval_required_content boolean not null default true,
  approval_required_publish boolean not null default true,
  quiet_hours_enabled boolean not null default false,
  quiet_hours jsonb not null default '{}'::jsonb,
  inbox_policy jsonb not null default '{}'::jsonb,
  comment_policy jsonb not null default '{}'::jsonb,
  content_policy jsonb not null default '{}'::jsonb,
  escalation_rules jsonb not null default '{}'::jsonb,
  risk_rules jsonb not null default '{}'::jsonb,
  lead_scoring_rules jsonb not null default '{}'::jsonb,
  publish_policy jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_ai_policies add column if not exists auto_reply_enabled boolean default true;
alter table tenant_ai_policies add column if not exists suppress_ai_during_handoff boolean default true;
alter table tenant_ai_policies add column if not exists mark_seen_enabled boolean default true;
alter table tenant_ai_policies add column if not exists typing_indicator_enabled boolean default true;
alter table tenant_ai_policies add column if not exists create_lead_enabled boolean default true;
alter table tenant_ai_policies add column if not exists approval_required_content boolean default true;
alter table tenant_ai_policies add column if not exists approval_required_publish boolean default true;
alter table tenant_ai_policies add column if not exists quiet_hours_enabled boolean default false;
alter table tenant_ai_policies add column if not exists quiet_hours jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists inbox_policy jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists comment_policy jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists content_policy jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists escalation_rules jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists risk_rules jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists lead_scoring_rules jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists publish_policy jsonb default '{}'::jsonb;
alter table tenant_ai_policies add column if not exists created_at timestamptz default now();
alter table tenant_ai_policies add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_ai_policies_tenant_id_fkey') then
    begin
      alter table tenant_ai_policies
        add constraint tenant_ai_policies_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_ai_policies_updated_at') then
    execute '
      create trigger trg_tenant_ai_policies_updated_at
      before update on tenant_ai_policies
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_agent_configs
-- ============================================================

create table if not exists tenant_agent_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  agent_key text not null,
  display_name text not null default '',
  role_summary text not null default '',
  enabled boolean not null default true,
  model text,
  temperature numeric(4,2),
  prompt_overrides jsonb not null default '{}'::jsonb,
  tool_access jsonb not null default '{}'::jsonb,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_agent_configs add column if not exists display_name text default '';
alter table tenant_agent_configs add column if not exists role_summary text default '';
alter table tenant_agent_configs add column if not exists enabled boolean default true;
alter table tenant_agent_configs add column if not exists model text;
alter table tenant_agent_configs add column if not exists temperature numeric(4,2);
alter table tenant_agent_configs add column if not exists prompt_overrides jsonb default '{}'::jsonb;
alter table tenant_agent_configs add column if not exists tool_access jsonb default '{}'::jsonb;
alter table tenant_agent_configs add column if not exists limits jsonb default '{}'::jsonb;
alter table tenant_agent_configs add column if not exists created_at timestamptz default now();
alter table tenant_agent_configs add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tenant_agent_configs_tenant_id_fkey') then
    begin
      alter table tenant_agent_configs
        add constraint tenant_agent_configs_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_tenant_agent_configs_tenant_agent
  on tenant_agent_configs(tenant_id, agent_key);

create index if not exists idx_tenant_agent_configs_enabled
  on tenant_agent_configs(tenant_id, enabled, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_agent_configs_updated_at') then
    execute '
      create trigger trg_tenant_agent_configs_updated_at
      before update on tenant_agent_configs
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;