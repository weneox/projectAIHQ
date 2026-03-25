-- ============================================================
-- tenant_voice_settings
-- ============================================================

create table if not exists tenant_voice_settings (
  tenant_id uuid primary key,

  enabled boolean not null default false,
  provider text not null default 'twilio',
  mode text not null default 'assistant',

  display_name text not null default '',
  default_language text not null default 'en',
  supported_languages jsonb not null default '["en"]'::jsonb,

  greeting jsonb not null default '{}'::jsonb,
  fallback_greeting jsonb not null default '{}'::jsonb,
  business_context text not null default '',
  instructions text not null default '',

  business_hours_enabled boolean not null default false,
  business_hours jsonb not null default '{}'::jsonb,

  operator_enabled boolean not null default true,
  operator_phone text,
  operator_label text not null default '',
  transfer_strategy text not null default 'handoff',

  callback_enabled boolean not null default true,
  callback_mode text not null default 'lead_only',

  max_call_seconds int not null default 180,
  silence_hangup_seconds int not null default 12,

  capture_rules jsonb not null default '{}'::jsonb,
  lead_rules jsonb not null default '{}'::jsonb,
  escalation_rules jsonb not null default '{}'::jsonb,
  reporting_rules jsonb not null default '{}'::jsonb,

  twilio_phone_number text,
  twilio_phone_sid text,
  twilio_config jsonb not null default '{}'::jsonb,

  cost_control jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_voice_settings add column if not exists tenant_id uuid;
alter table tenant_voice_settings add column if not exists enabled boolean default false;
alter table tenant_voice_settings add column if not exists provider text default 'twilio';
alter table tenant_voice_settings add column if not exists mode text default 'assistant';
alter table tenant_voice_settings add column if not exists display_name text default '';
alter table tenant_voice_settings add column if not exists default_language text default 'en';
alter table tenant_voice_settings add column if not exists supported_languages jsonb default '["en"]'::jsonb;
alter table tenant_voice_settings add column if not exists greeting jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists fallback_greeting jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists business_context text default '';
alter table tenant_voice_settings add column if not exists instructions text default '';
alter table tenant_voice_settings add column if not exists business_hours_enabled boolean default false;
alter table tenant_voice_settings add column if not exists business_hours jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists operator_enabled boolean default true;
alter table tenant_voice_settings add column if not exists operator_phone text;
alter table tenant_voice_settings add column if not exists operator_label text default '';
alter table tenant_voice_settings add column if not exists transfer_strategy text default 'handoff';
alter table tenant_voice_settings add column if not exists callback_enabled boolean default true;
alter table tenant_voice_settings add column if not exists callback_mode text default 'lead_only';
alter table tenant_voice_settings add column if not exists max_call_seconds int default 180;
alter table tenant_voice_settings add column if not exists silence_hangup_seconds int default 12;
alter table tenant_voice_settings add column if not exists capture_rules jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists lead_rules jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists escalation_rules jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists reporting_rules jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists twilio_phone_number text;
alter table tenant_voice_settings add column if not exists twilio_phone_sid text;
alter table tenant_voice_settings add column if not exists twilio_config jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists cost_control jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists meta jsonb default '{}'::jsonb;
alter table tenant_voice_settings add column if not exists created_at timestamptz default now();
alter table tenant_voice_settings add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table tenant_voice_settings alter column enabled set default false;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column provider set default 'twilio';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column mode set default 'assistant';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column display_name set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column default_language set default 'en';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column supported_languages set default '["en"]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column greeting set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column fallback_greeting set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column business_context set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column instructions set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column business_hours_enabled set default false;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column business_hours set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column operator_enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column operator_label set default '';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column transfer_strategy set default 'handoff';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column callback_enabled set default true;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column callback_mode set default 'lead_only';
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column max_call_seconds set default 180;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column silence_hangup_seconds set default 12;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column capture_rules set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column lead_rules set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column escalation_rules set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column reporting_rules set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column twilio_config set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column cost_control set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table tenant_voice_settings alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'tenant_voice_settings_tenant_id_fkey') then
    begin
      alter table tenant_voice_settings
        add constraint tenant_voice_settings_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_voice_settings drop constraint if exists tenant_voice_settings_provider_check';
  exception when others then null;
  end;

  begin
    alter table tenant_voice_settings
      add constraint tenant_voice_settings_provider_check
      check (provider in ('twilio','sip','byoc','other'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_voice_settings drop constraint if exists tenant_voice_settings_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_voice_settings
      add constraint tenant_voice_settings_mode_check
      check (mode in ('assistant','ivr','hybrid','disabled'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_voice_settings drop constraint if exists tenant_voice_settings_transfer_strategy_check';
  exception when others then null;
  end;

  begin
    alter table tenant_voice_settings
      add constraint tenant_voice_settings_transfer_strategy_check
      check (transfer_strategy in ('handoff','callback','schedule_callback','never'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_voice_settings drop constraint if exists tenant_voice_settings_callback_mode_check';
  exception when others then null;
  end;

  begin
    alter table tenant_voice_settings
      add constraint tenant_voice_settings_callback_mode_check
      check (callback_mode in ('disabled','lead_only','always','after_hours'));
  exception when others then null;
  end;
end$$;

create index if not exists idx_tenant_voice_settings_enabled
  on tenant_voice_settings(enabled, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_tenant_voice_settings_updated_at') then
    execute '
      create trigger trg_tenant_voice_settings_updated_at
      before update on tenant_voice_settings
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- voice_calls
-- ============================================================

create table if not exists voice_calls (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,

  provider text not null default 'twilio',
  provider_call_sid text,
  provider_stream_sid text,

  direction text not null default 'inbound',
  status text not null default 'queued',

  from_number text,
  to_number text,
  caller_name text,

  started_at timestamptz,
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds int not null default 0,

  language text not null default 'en',
  agent_mode text not null default 'assistant',

  handoff_requested boolean not null default false,
  handoff_completed boolean not null default false,
  handoff_target text,

  callback_requested boolean not null default false,
  callback_phone text,

  lead_id uuid,
  inbox_thread_id uuid,

  transcript text not null default '',
  summary text not null default '',
  outcome text not null default 'unknown',
  intent text,
  sentiment text,

  cost_amount numeric(12,6) not null default 0,
  cost_currency text not null default 'USD',

  metrics jsonb not null default '{}'::jsonb,
  extraction jsonb not null default '{}'::jsonb,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table voice_calls add column if not exists tenant_id uuid;
alter table voice_calls add column if not exists tenant_key text;
alter table voice_calls add column if not exists provider text default 'twilio';
alter table voice_calls add column if not exists provider_call_sid text;
alter table voice_calls add column if not exists provider_stream_sid text;
alter table voice_calls add column if not exists direction text default 'inbound';
alter table voice_calls add column if not exists status text default 'queued';
alter table voice_calls add column if not exists from_number text;
alter table voice_calls add column if not exists to_number text;
alter table voice_calls add column if not exists caller_name text;
alter table voice_calls add column if not exists started_at timestamptz;
alter table voice_calls add column if not exists answered_at timestamptz;
alter table voice_calls add column if not exists ended_at timestamptz;
alter table voice_calls add column if not exists duration_seconds int default 0;
alter table voice_calls add column if not exists language text default 'en';
alter table voice_calls add column if not exists agent_mode text default 'assistant';
alter table voice_calls add column if not exists handoff_requested boolean default false;
alter table voice_calls add column if not exists handoff_completed boolean default false;
alter table voice_calls add column if not exists handoff_target text;
alter table voice_calls add column if not exists callback_requested boolean default false;
alter table voice_calls add column if not exists callback_phone text;
alter table voice_calls add column if not exists lead_id uuid;
alter table voice_calls add column if not exists inbox_thread_id uuid;
alter table voice_calls add column if not exists transcript text default '';
alter table voice_calls add column if not exists summary text default '';
alter table voice_calls add column if not exists outcome text default 'unknown';
alter table voice_calls add column if not exists intent text;
alter table voice_calls add column if not exists sentiment text;
alter table voice_calls add column if not exists cost_amount numeric(12,6) default 0;
alter table voice_calls add column if not exists cost_currency text default 'USD';
alter table voice_calls add column if not exists metrics jsonb default '{}'::jsonb;
alter table voice_calls add column if not exists extraction jsonb default '{}'::jsonb;
alter table voice_calls add column if not exists meta jsonb default '{}'::jsonb;
alter table voice_calls add column if not exists created_at timestamptz default now();
alter table voice_calls add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table voice_calls alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column provider set default 'twilio';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column direction set default 'inbound';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column status set default 'queued';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column duration_seconds set default 0;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column language set default 'en';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column agent_mode set default 'assistant';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column handoff_requested set default false;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column handoff_completed set default false;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column callback_requested set default false;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column transcript set default '';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column summary set default '';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column outcome set default 'unknown';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column cost_amount set default 0;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column cost_currency set default 'USD';
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column metrics set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column extraction set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table voice_calls alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'voice_calls_tenant_id_fkey') then
    begin
      alter table voice_calls
        add constraint voice_calls_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'voice_calls_lead_id_fkey') then
    begin
      alter table voice_calls
        add constraint voice_calls_lead_id_fkey
        foreign key (lead_id) references leads(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'voice_calls_inbox_thread_id_fkey') then
    begin
      alter table voice_calls
        add constraint voice_calls_inbox_thread_id_fkey
        foreign key (inbox_thread_id) references inbox_threads(id) on delete set null;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table voice_calls drop constraint if exists voice_calls_provider_check';
  exception when others then null;
  end;

  begin
    alter table voice_calls
      add constraint voice_calls_provider_check
      check (provider in ('twilio','sip','byoc','other'));
  exception when others then null;
  end;

  begin
    execute 'alter table voice_calls drop constraint if exists voice_calls_direction_check';
  exception when others then null;
  end;

  begin
    alter table voice_calls
      add constraint voice_calls_direction_check
      check (direction in ('inbound','outbound','callback','internal_test'));
  exception when others then null;
  end;

  begin
    execute 'alter table voice_calls drop constraint if exists voice_calls_status_check';
  exception when others then null;
  end;

  begin
    alter table voice_calls
      add constraint voice_calls_status_check
      check (status in ('queued','ringing','in_progress','completed','failed','busy','no_answer','canceled'));
  exception when others then null;
  end;

  begin
    execute 'alter table voice_calls drop constraint if exists voice_calls_agent_mode_check';
  exception when others then null;
  end;

  begin
    alter table voice_calls
      add constraint voice_calls_agent_mode_check
      check (agent_mode in ('assistant','ivr','human','hybrid'));
  exception when others then null;
  end;

  begin
    execute 'alter table voice_calls drop constraint if exists voice_calls_outcome_check';
  exception when others then null;
  end;

  begin
    alter table voice_calls
      add constraint voice_calls_outcome_check
      check (outcome in (
        'unknown',
        'lead_captured',
        'handoff_completed',
        'callback_requested',
        'faq_resolved',
        'missed',
        'spam',
        'failed'
      ));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_voice_calls_provider_call_sid
  on voice_calls(provider, provider_call_sid)
  where provider_call_sid is not null;

create index if not exists idx_voice_calls_tenant_created
  on voice_calls(tenant_id, created_at desc);

create index if not exists idx_voice_calls_tenant_key_created
  on voice_calls(tenant_key, created_at desc);

create index if not exists idx_voice_calls_status_started
  on voice_calls(status, started_at desc);

create index if not exists idx_voice_calls_lead
  on voice_calls(lead_id, created_at desc);

create index if not exists idx_voice_calls_thread
  on voice_calls(inbox_thread_id, created_at desc);

create index if not exists idx_voice_calls_from_number
  on voice_calls(from_number, created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_voice_calls_updated_at') then
    execute '
      create trigger trg_voice_calls_updated_at
      before update on voice_calls
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- voice_call_sessions
-- ============================================================

create table if not exists voice_call_sessions (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,

  voice_call_id uuid,
  provider text not null default 'twilio',
  provider_call_sid text not null,
  provider_conference_sid text,
  conference_name text,

  customer_number text,
  customer_name text,

  direction text not null default 'outbound_callback',
  status text not null default 'bot_active',

  requested_department text,
  resolved_department text,

  operator_user_id text,
  operator_name text,
  operator_join_mode text not null default 'live',

  bot_active boolean not null default true,
  operator_join_requested boolean not null default false,
  operator_joined boolean not null default false,
  whisper_active boolean not null default false,
  takeover_active boolean not null default false,

  lead_payload jsonb not null default '{}'::jsonb,
  transcript_live jsonb not null default '[]'::jsonb,
  summary text not null default '',
  meta jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  operator_requested_at timestamptz,
  operator_joined_at timestamptz,
  ended_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table voice_call_sessions add column if not exists tenant_id uuid;
alter table voice_call_sessions add column if not exists tenant_key text;
alter table voice_call_sessions add column if not exists voice_call_id uuid;
alter table voice_call_sessions add column if not exists provider text default 'twilio';
alter table voice_call_sessions add column if not exists provider_call_sid text;
alter table voice_call_sessions add column if not exists provider_conference_sid text;
alter table voice_call_sessions add column if not exists conference_name text;
alter table voice_call_sessions add column if not exists customer_number text;
alter table voice_call_sessions add column if not exists customer_name text;
alter table voice_call_sessions add column if not exists direction text default 'outbound_callback';
alter table voice_call_sessions add column if not exists status text default 'bot_active';
alter table voice_call_sessions add column if not exists requested_department text;
alter table voice_call_sessions add column if not exists resolved_department text;
alter table voice_call_sessions add column if not exists operator_user_id text;
alter table voice_call_sessions add column if not exists operator_name text;
alter table voice_call_sessions add column if not exists operator_join_mode text default 'live';
alter table voice_call_sessions add column if not exists bot_active boolean default true;
alter table voice_call_sessions add column if not exists operator_join_requested boolean default false;
alter table voice_call_sessions add column if not exists operator_joined boolean default false;
alter table voice_call_sessions add column if not exists whisper_active boolean default false;
alter table voice_call_sessions add column if not exists takeover_active boolean default false;
alter table voice_call_sessions add column if not exists lead_payload jsonb default '{}'::jsonb;
alter table voice_call_sessions add column if not exists transcript_live jsonb default '[]'::jsonb;
alter table voice_call_sessions add column if not exists summary text default '';
alter table voice_call_sessions add column if not exists meta jsonb default '{}'::jsonb;
alter table voice_call_sessions add column if not exists started_at timestamptz default now();
alter table voice_call_sessions add column if not exists operator_requested_at timestamptz;
alter table voice_call_sessions add column if not exists operator_joined_at timestamptz;
alter table voice_call_sessions add column if not exists ended_at timestamptz;
alter table voice_call_sessions add column if not exists created_at timestamptz default now();
alter table voice_call_sessions add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table voice_call_sessions alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column provider set default 'twilio';
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column direction set default 'outbound_callback';
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column status set default 'bot_active';
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column operator_join_mode set default 'live';
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column bot_active set default true;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column operator_join_requested set default false;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column operator_joined set default false;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column whisper_active set default false;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column takeover_active set default false;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column lead_payload set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column transcript_live set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column summary set default '';
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column started_at set default now();
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table voice_call_sessions alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'voice_call_sessions_tenant_id_fkey') then
    begin
      alter table voice_call_sessions
        add constraint voice_call_sessions_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'voice_call_sessions_voice_call_id_fkey') then
    begin
      alter table voice_call_sessions
        add constraint voice_call_sessions_voice_call_id_fkey
        foreign key (voice_call_id) references voice_calls(id) on delete set null;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table voice_call_sessions drop constraint if exists voice_call_sessions_provider_check';
  exception when others then null;
  end;

  begin
    alter table voice_call_sessions
      add constraint voice_call_sessions_provider_check
      check (provider in ('twilio','sip','byoc','other'));
  exception when others then null;
  end;

  begin
    execute 'alter table voice_call_sessions drop constraint if exists voice_call_sessions_direction_check';
  exception when others then null;
  end;

  begin
    alter table voice_call_sessions
      add constraint voice_call_sessions_direction_check
      check (direction in ('inbound','outbound','outbound_callback','manual','other'));
  exception when others then null;
  end;

  begin
    execute 'alter table voice_call_sessions drop constraint if exists voice_call_sessions_status_check';
  exception when others then null;
  end;

  begin
    alter table voice_call_sessions
      add constraint voice_call_sessions_status_check
      check (
        status in (
          'bot_active',
          'bot_silent',
          'agent_ringing',
          'agent_whisper',
          'agent_live',
          'completed',
          'failed'
        )
      );
  exception when others then null;
  end;

  begin
    execute 'alter table voice_call_sessions drop constraint if exists voice_call_sessions_operator_join_mode_check';
  exception when others then null;
  end;

  begin
    alter table voice_call_sessions
      add constraint voice_call_sessions_operator_join_mode_check
      check (operator_join_mode in ('live','whisper','monitor','barge'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_voice_call_sessions_provider_call_sid
  on voice_call_sessions(provider, provider_call_sid);

create index if not exists idx_voice_call_sessions_tenant_created
  on voice_call_sessions(tenant_id, created_at desc);

create index if not exists idx_voice_call_sessions_tenant_key_created
  on voice_call_sessions(tenant_key, created_at desc);

create index if not exists idx_voice_call_sessions_status_updated
  on voice_call_sessions(status, updated_at desc);

create index if not exists idx_voice_call_sessions_voice_call
  on voice_call_sessions(voice_call_id, created_at desc);

create index if not exists idx_voice_call_sessions_operator_requested
  on voice_call_sessions(operator_join_requested, operator_joined, updated_at desc);

create index if not exists idx_voice_call_sessions_conference
  on voice_call_sessions(conference_name, created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_voice_call_sessions_updated_at') then
    execute '
      create trigger trg_voice_call_sessions_updated_at
      before update on voice_call_sessions
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- voice_call_events
-- ============================================================

create table if not exists voice_call_events (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null,
  tenant_id uuid,
  tenant_key text not null,
  event_type text not null,
  actor text not null default 'system',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table voice_call_events add column if not exists tenant_id uuid;
alter table voice_call_events add column if not exists tenant_key text;
alter table voice_call_events add column if not exists event_type text;
alter table voice_call_events add column if not exists actor text default 'system';
alter table voice_call_events add column if not exists payload jsonb default '{}'::jsonb;
alter table voice_call_events add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table voice_call_events alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table voice_call_events alter column actor set default 'system';
  exception when others then null;
  end;
  begin
    alter table voice_call_events alter column payload set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_call_events alter column created_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'voice_call_events_call_id_fkey') then
    begin
      alter table voice_call_events
        add constraint voice_call_events_call_id_fkey
        foreign key (call_id) references voice_calls(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'voice_call_events_tenant_id_fkey') then
    begin
      alter table voice_call_events
        add constraint voice_call_events_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_voice_call_events_call_created
  on voice_call_events(call_id, created_at asc);

create index if not exists idx_voice_call_events_tenant_created
  on voice_call_events(tenant_id, created_at desc);

create index if not exists idx_voice_call_events_type_created
  on voice_call_events(event_type, created_at desc);

-- ============================================================
-- voice_daily_usage
-- ============================================================

create table if not exists voice_daily_usage (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,
  usage_date date not null,

  provider text not null default 'twilio',

  call_count int not null default 0,
  inbound_count int not null default 0,
  outbound_count int not null default 0,

  total_duration_seconds int not null default 0,
  total_cost_amount numeric(12,6) not null default 0,
  cost_currency text not null default 'USD',

  metrics jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table voice_daily_usage add column if not exists tenant_id uuid;
alter table voice_daily_usage add column if not exists tenant_key text;
alter table voice_daily_usage add column if not exists usage_date date;
alter table voice_daily_usage add column if not exists provider text default 'twilio';
alter table voice_daily_usage add column if not exists call_count int default 0;
alter table voice_daily_usage add column if not exists inbound_count int default 0;
alter table voice_daily_usage add column if not exists outbound_count int default 0;
alter table voice_daily_usage add column if not exists total_duration_seconds int default 0;
alter table voice_daily_usage add column if not exists total_cost_amount numeric(12,6) default 0;
alter table voice_daily_usage add column if not exists cost_currency text default 'USD';
alter table voice_daily_usage add column if not exists metrics jsonb default '{}'::jsonb;
alter table voice_daily_usage add column if not exists created_at timestamptz default now();
alter table voice_daily_usage add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table voice_daily_usage alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column provider set default 'twilio';
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column call_count set default 0;
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column inbound_count set default 0;
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column outbound_count set default 0;
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column total_duration_seconds set default 0;
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column total_cost_amount set default 0;
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column cost_currency set default 'USD';
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column metrics set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column created_at set default now();
  exception when others then null;
  end;
  begin
    alter table voice_daily_usage alter column updated_at set default now();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'voice_daily_usage_tenant_id_fkey') then
    begin
      alter table voice_daily_usage
        add constraint voice_daily_usage_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table voice_daily_usage drop constraint if exists voice_daily_usage_provider_check';
  exception when others then null;
  end;

  begin
    alter table voice_daily_usage
      add constraint voice_daily_usage_provider_check
      check (provider in ('twilio','sip','byoc','other'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_voice_daily_usage_tenant_provider_date
  on voice_daily_usage(tenant_id, provider, usage_date);

create index if not exists idx_voice_daily_usage_tenant_date
  on voice_daily_usage(tenant_id, usage_date desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_voice_daily_usage_updated_at') then
    execute '
      create trigger trg_voice_daily_usage_updated_at
      before update on voice_daily_usage
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- generic voice defaults normalization
-- ============================================================

do $$
begin
  update tenant_voice_settings
  set
    display_name = coalesce(nullif(display_name, ''), ''),
    default_language = coalesce(nullif(default_language, ''), 'en'),
    supported_languages = coalesce(supported_languages, '["en"]'::jsonb),
    greeting = coalesce(greeting, '{}'::jsonb),
    fallback_greeting = coalesce(fallback_greeting, '{}'::jsonb),
    business_context = coalesce(business_context, ''),
    instructions = coalesce(instructions, ''),
    operator_label = coalesce(nullif(operator_label, ''), ''),
    transfer_strategy = case
      when transfer_strategy in ('handoff','callback','schedule_callback','never') then transfer_strategy
      else 'handoff'
    end,
    callback_mode = case
      when callback_mode in ('disabled','lead_only','always','after_hours') then callback_mode
      else 'lead_only'
    end,
    capture_rules = coalesce(capture_rules, '{}'::jsonb),
    lead_rules = coalesce(lead_rules, '{}'::jsonb),
    escalation_rules = coalesce(escalation_rules, '{}'::jsonb),
    reporting_rules = coalesce(reporting_rules, '{}'::jsonb),
    twilio_config = coalesce(twilio_config, '{}'::jsonb),
    cost_control = coalesce(cost_control, '{}'::jsonb),
    meta = coalesce(meta, '{}'::jsonb),
    updated_at = now()
  where true;
exception when others then null;
end$$;