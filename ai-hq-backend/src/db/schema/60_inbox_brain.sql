-- ============================================================
-- tenant_services
-- ============================================================

create table if not exists tenant_services (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  service_key text not null,
  title text not null default '',

  enabled boolean not null default true,
  sellable boolean not null default true,
  visible_in_ai boolean not null default true,

  category text not null default 'general',

  description_short text not null default '',
  description_full text not null default '',

  keywords jsonb not null default '[]'::jsonb,
  synonyms jsonb not null default '[]'::jsonb,
  example_requests jsonb not null default '[]'::jsonb,

  pricing_mode text not null default 'quote_required',
  contact_capture_mode text not null default 'optional',
  handoff_mode text not null default 'optional',
  response_mode text not null default 'template',

  faq_answer text not null default '',
  disabled_reply_text text not null default '',

  sort_order int not null default 0,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_services add column if not exists tenant_id uuid;
alter table tenant_services add column if not exists service_key text;
alter table tenant_services add column if not exists title text default '';
alter table tenant_services add column if not exists enabled boolean default true;
alter table tenant_services add column if not exists sellable boolean default true;
alter table tenant_services add column if not exists visible_in_ai boolean default true;
alter table tenant_services add column if not exists category text default 'general';
alter table tenant_services add column if not exists description_short text default '';
alter table tenant_services add column if not exists description_full text default '';
alter table tenant_services add column if not exists keywords jsonb default '[]'::jsonb;
alter table tenant_services add column if not exists synonyms jsonb default '[]'::jsonb;
alter table tenant_services add column if not exists example_requests jsonb default '[]'::jsonb;
alter table tenant_services add column if not exists pricing_mode text default 'quote_required';
alter table tenant_services add column if not exists contact_capture_mode text default 'optional';
alter table tenant_services add column if not exists handoff_mode text default 'optional';
alter table tenant_services add column if not exists response_mode text default 'template';
alter table tenant_services add column if not exists faq_answer text default '';
alter table tenant_services add column if not exists disabled_reply_text text default '';
alter table tenant_services add column if not exists sort_order int default 0;
alter table tenant_services add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_services add column if not exists created_at timestamptz default now();
alter table tenant_services add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_services alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column title set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column sellable set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column visible_in_ai set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column category set default 'general';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column description_short set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column description_full set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column keywords set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column synonyms set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column example_requests set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column pricing_mode set default 'quote_required';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column contact_capture_mode set default 'optional';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column handoff_mode set default 'optional';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column response_mode set default 'template';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column faq_answer set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column disabled_reply_text set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column sort_order set default 0;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_services alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'tenant_services_tenant_id_fkey') then
    begin
      alter table tenant_services
        add constraint tenant_services_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_services drop constraint if exists tenant_services_pricing_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_services
      add constraint tenant_services_pricing_mode_check
      check (pricing_mode in ('hidden','from_price','fixed_price','quote_required'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_services drop constraint if exists tenant_services_contact_capture_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_services
      add constraint tenant_services_contact_capture_mode_check
      check (contact_capture_mode in ('never','optional','required_before_quote','required_before_handoff'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_services drop constraint if exists tenant_services_handoff_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_services
      add constraint tenant_services_handoff_mode_check
      check (handoff_mode in ('never','optional','required'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_services drop constraint if exists tenant_services_response_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_services
      add constraint tenant_services_response_mode_check
      check (response_mode in ('deterministic','template','llm_assisted'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_tenant_services_tenant_service_key
  on tenant_services(tenant_id, service_key);

create index if not exists idx_tenant_services_tenant_enabled_sort
  on tenant_services(tenant_id, enabled, sort_order asc, updated_at desc);

create index if not exists idx_tenant_services_tenant_visible
  on tenant_services(tenant_id, visible_in_ai, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_services_updated_at') then
    execute '
      create trigger trg_tenant_services_updated_at
      before update on tenant_services
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_knowledge_entries
-- ============================================================

create table if not exists tenant_knowledge_entries (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  entry_type text not null default 'faq',

  title text not null default '',
  question text not null default '',
  answer text not null default '',

  language text not null default 'en',
  service_key text,
  intent_key text,

  keywords jsonb not null default '[]'::jsonb,
  priority int not null default 100,
  enabled boolean not null default true,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_knowledge_entries add column if not exists tenant_id uuid;
alter table tenant_knowledge_entries add column if not exists entry_type text default 'faq';
alter table tenant_knowledge_entries add column if not exists title text default '';
alter table tenant_knowledge_entries add column if not exists question text default '';
alter table tenant_knowledge_entries add column if not exists answer text default '';
alter table tenant_knowledge_entries add column if not exists language text default 'en';
alter table tenant_knowledge_entries add column if not exists service_key text;
alter table tenant_knowledge_entries add column if not exists intent_key text;
alter table tenant_knowledge_entries add column if not exists keywords jsonb default '[]'::jsonb;
alter table tenant_knowledge_entries add column if not exists priority int default 100;
alter table tenant_knowledge_entries add column if not exists enabled boolean default true;
alter table tenant_knowledge_entries add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_knowledge_entries add column if not exists created_at timestamptz default now();
alter table tenant_knowledge_entries add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_knowledge_entries alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column entry_type set default 'faq';
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column title set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column question set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column answer set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column language set default 'en';
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column keywords set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column priority set default 100;
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_knowledge_entries alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'tenant_knowledge_entries_tenant_id_fkey') then
    begin
      alter table tenant_knowledge_entries
        add constraint tenant_knowledge_entries_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_knowledge_entries drop constraint if exists tenant_knowledge_entries_entry_type_check';
  exception when others then null;
  end;

  begin
    alter table tenant_knowledge_entries
      add constraint tenant_knowledge_entries_entry_type_check
      check (entry_type in ('faq','policy','sales','support','contact','pricing','service_denial','handoff'));
  exception when others then null;
  end;
end$$;

create index if not exists idx_tenant_knowledge_entries_tenant_type_enabled
  on tenant_knowledge_entries(tenant_id, entry_type, enabled, priority asc, updated_at desc);

create index if not exists idx_tenant_knowledge_entries_tenant_service
  on tenant_knowledge_entries(tenant_id, service_key, enabled, priority asc, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_knowledge_entries_updated_at') then
    execute '
      create trigger trg_tenant_knowledge_entries_updated_at
      before update on tenant_knowledge_entries
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- tenant_response_playbooks
-- ============================================================

create table if not exists tenant_response_playbooks (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid not null,
  intent_key text not null default 'general',
  service_key text,
  language text not null default 'en',

  user_example text not null default '',
  ideal_reply text not null default '',

  reply_style text not null default '',
  cta_type text not null default '',

  priority int not null default 100,
  enabled boolean not null default true,

  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_response_playbooks add column if not exists tenant_id uuid;
alter table tenant_response_playbooks add column if not exists intent_key text default 'general';
alter table tenant_response_playbooks add column if not exists service_key text;
alter table tenant_response_playbooks add column if not exists language text default 'en';
alter table tenant_response_playbooks add column if not exists user_example text default '';
alter table tenant_response_playbooks add column if not exists ideal_reply text default '';
alter table tenant_response_playbooks add column if not exists reply_style text default '';
alter table tenant_response_playbooks add column if not exists cta_type text default '';
alter table tenant_response_playbooks add column if not exists priority int default 100;
alter table tenant_response_playbooks add column if not exists enabled boolean default true;
alter table tenant_response_playbooks add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_response_playbooks add column if not exists created_at timestamptz default now();
alter table tenant_response_playbooks add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_response_playbooks alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column intent_key set default 'general';
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column language set default 'en';
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column user_example set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column ideal_reply set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column reply_style set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column cta_type set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column priority set default 100;
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_response_playbooks alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'tenant_response_playbooks_tenant_id_fkey') then
    begin
      alter table tenant_response_playbooks
        add constraint tenant_response_playbooks_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_tenant_response_playbooks_tenant_lookup
  on tenant_response_playbooks(tenant_id, intent_key, language, enabled, priority asc, updated_at desc);

create index if not exists idx_tenant_response_playbooks_tenant_service
  on tenant_response_playbooks(tenant_id, service_key, enabled, priority asc, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_response_playbooks_updated_at') then
    execute '
      create trigger trg_tenant_response_playbooks_updated_at
      before update on tenant_response_playbooks
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- inbox_thread_state
-- ============================================================

create table if not exists inbox_thread_state (
  thread_id uuid primary key,

  tenant_id uuid,
  tenant_key text not null,

  last_customer_intent text,
  last_customer_service_key text,

  last_ai_intent text,
  last_ai_service_key text,
  last_ai_reply_hash text,
  last_ai_reply_text text,
  last_ai_cta_type text,
  last_response_mode text,

  contact_requested_at timestamptz,
  contact_shared_at timestamptz,
  pricing_explained_at timestamptz,
  lead_created_at timestamptz,

  handoff_announced_at timestamptz,
  handoff_message_id uuid,
  suppressed_until_operator_reply boolean not null default false,

  repeat_intent_count int not null default 0,
  repeat_service_count int not null default 0,

  awaiting_customer_answer_to text,
  last_decision_meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inbox_thread_state add column if not exists thread_id uuid;
alter table inbox_thread_state add column if not exists tenant_id uuid;
alter table inbox_thread_state add column if not exists tenant_key text;
alter table inbox_thread_state add column if not exists last_customer_intent text;
alter table inbox_thread_state add column if not exists last_customer_service_key text;
alter table inbox_thread_state add column if not exists last_ai_intent text;
alter table inbox_thread_state add column if not exists last_ai_service_key text;
alter table inbox_thread_state add column if not exists last_ai_reply_hash text;
alter table inbox_thread_state add column if not exists last_ai_reply_text text;
alter table inbox_thread_state add column if not exists last_ai_cta_type text;
alter table inbox_thread_state add column if not exists last_response_mode text;
alter table inbox_thread_state add column if not exists contact_requested_at timestamptz;
alter table inbox_thread_state add column if not exists contact_shared_at timestamptz;
alter table inbox_thread_state add column if not exists pricing_explained_at timestamptz;
alter table inbox_thread_state add column if not exists lead_created_at timestamptz;
alter table inbox_thread_state add column if not exists handoff_announced_at timestamptz;
alter table inbox_thread_state add column if not exists handoff_message_id uuid;
alter table inbox_thread_state add column if not exists suppressed_until_operator_reply boolean default false;
alter table inbox_thread_state add column if not exists repeat_intent_count int default 0;
alter table inbox_thread_state add column if not exists repeat_service_count int default 0;
alter table inbox_thread_state add column if not exists awaiting_customer_answer_to text;
alter table inbox_thread_state add column if not exists last_decision_meta jsonb default '{}'::jsonb;
alter table inbox_thread_state add column if not exists created_at timestamptz default now();
alter table inbox_thread_state add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table inbox_thread_state alter column suppressed_until_operator_reply set default false;
  exception when others then null;
  end;
  begin
    alter table inbox_thread_state alter column repeat_intent_count set default 0;
  exception when others then null;
  end;
  begin
    alter table inbox_thread_state alter column repeat_service_count set default 0;
  exception when others then null;
  end;
  begin
    alter table inbox_thread_state alter column last_decision_meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table inbox_thread_state alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table inbox_thread_state alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'inbox_thread_state_thread_id_fkey') then
    begin
      alter table inbox_thread_state
        add constraint inbox_thread_state_thread_id_fkey
        foreign key (thread_id) references inbox_threads(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inbox_thread_state_tenant_id_fkey') then
    begin
      alter table inbox_thread_state
        add constraint inbox_thread_state_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inbox_thread_state_handoff_message_id_fkey') then
    begin
      alter table inbox_thread_state
        add constraint inbox_thread_state_handoff_message_id_fkey
        foreign key (handoff_message_id) references inbox_messages(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_inbox_thread_state_tenant_updated
  on inbox_thread_state(tenant_id, updated_at desc);

create index if not exists idx_inbox_thread_state_tenant_key_updated
  on inbox_thread_state(tenant_key, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_inbox_thread_state_updated_at') then
    execute '
      create trigger trg_inbox_thread_state_updated_at
      before update on inbox_thread_state
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;