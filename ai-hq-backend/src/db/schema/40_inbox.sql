-- ============================================================
-- inbox_threads
-- ============================================================

create table if not exists inbox_threads (
  id uuid primary key default gen_random_uuid(),

  tenant_id uuid,
  tenant_key text not null,
  channel text not null default 'instagram',
  external_thread_id text,
  external_user_id text,
  external_username text,
  customer_name text not null default '',

  status text not null default 'open',
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,

  unread_count int not null default 0,
  assigned_to text,
  labels jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,

  handoff_active boolean not null default false,
  handoff_reason text,
  handoff_priority text not null default 'normal',
  handoff_at timestamptz,
  handoff_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inbox_threads add column if not exists tenant_id uuid;
alter table inbox_threads add column if not exists tenant_key text;
alter table inbox_threads add column if not exists channel text;
alter table inbox_threads add column if not exists external_thread_id text;
alter table inbox_threads add column if not exists external_user_id text;
alter table inbox_threads add column if not exists external_username text;
alter table inbox_threads add column if not exists customer_name text;
alter table inbox_threads add column if not exists status text;
alter table inbox_threads add column if not exists last_message_at timestamptz;
alter table inbox_threads add column if not exists last_inbound_at timestamptz;
alter table inbox_threads add column if not exists last_outbound_at timestamptz;
alter table inbox_threads add column if not exists unread_count int;
alter table inbox_threads add column if not exists assigned_to text;
alter table inbox_threads add column if not exists labels jsonb default '[]'::jsonb;
alter table inbox_threads add column if not exists meta jsonb default '{}'::jsonb;
alter table inbox_threads add column if not exists handoff_active boolean default false;
alter table inbox_threads add column if not exists handoff_reason text;
alter table inbox_threads add column if not exists handoff_priority text default 'normal';
alter table inbox_threads add column if not exists handoff_at timestamptz;
alter table inbox_threads add column if not exists handoff_by text;
alter table inbox_threads add column if not exists created_at timestamptz default now();
alter table inbox_threads add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table inbox_threads alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column channel set default 'instagram';
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column customer_name set default '';
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column status set default 'open';
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column unread_count set default 0;
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column labels set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column handoff_active set default false;
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column handoff_priority set default 'normal';
  exception when others then null;
  end;
  begin
    alter table inbox_threads alter column updated_at set default now();
  exception when others then null;
  end;

  begin
    execute 'alter table inbox_threads drop constraint if exists inbox_threads_status_check';
  exception when others then null;
  end;

  begin
    alter table inbox_threads
      add constraint inbox_threads_status_check
      check (status in ('open','pending','resolved','closed','spam'));
  exception when others then null;
  end;

  begin
    execute 'alter table inbox_threads drop constraint if exists inbox_threads_channel_check';
  exception when others then null;
  end;

  begin
    alter table inbox_threads
      add constraint inbox_threads_channel_check
      check (channel in ('instagram','facebook','whatsapp','web','email','other'));
  exception when others then null;
  end;

  begin
    execute 'alter table inbox_threads drop constraint if exists inbox_threads_handoff_priority_check';
  exception when others then null;
  end;

  begin
    alter table inbox_threads
      add constraint inbox_threads_handoff_priority_check
      check (handoff_priority in ('low','normal','high','urgent'));
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'inbox_threads_tenant_id_fkey') then
    begin
      alter table inbox_threads
        add constraint inbox_threads_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

drop index if exists uq_inbox_threads_external;

create unique index if not exists uq_inbox_threads_tenant_channel_external
  on inbox_threads(tenant_key, channel, external_thread_id)
  where external_thread_id is not null;

create index if not exists idx_inbox_threads_tenant_status_updated
  on inbox_threads(tenant_id, status, updated_at desc);

create index if not exists idx_inbox_threads_tenant_key_status_updated
  on inbox_threads(tenant_key, status, updated_at desc);

create index if not exists idx_inbox_threads_last_message
  on inbox_threads(last_message_at desc);

create index if not exists idx_inbox_threads_unread
  on inbox_threads(unread_count desc, updated_at desc);

create index if not exists idx_inbox_threads_handoff_active
  on inbox_threads(tenant_id, handoff_active, updated_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_inbox_threads_updated_at') then
    execute '
      create trigger trg_inbox_threads_updated_at
      before update on inbox_threads
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;

-- ============================================================
-- inbox_messages
-- ============================================================

create table if not exists inbox_messages (
  id uuid primary key default gen_random_uuid(),

  thread_id uuid not null,
  tenant_id uuid,
  tenant_key text not null,
  direction text not null default 'inbound',
  sender_type text not null default 'customer',

  external_message_id text,
  message_type text not null default 'text',
  text text not null default '',

  attachments jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb,

  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table inbox_messages add column if not exists tenant_id uuid;
alter table inbox_messages add column if not exists tenant_key text;
alter table inbox_messages add column if not exists direction text;
alter table inbox_messages add column if not exists sender_type text;
alter table inbox_messages add column if not exists external_message_id text;
alter table inbox_messages add column if not exists message_type text;
alter table inbox_messages add column if not exists text text;
alter table inbox_messages add column if not exists attachments jsonb default '[]'::jsonb;
alter table inbox_messages add column if not exists meta jsonb default '{}'::jsonb;
alter table inbox_messages add column if not exists sent_at timestamptz default now();
alter table inbox_messages add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table inbox_messages alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table inbox_messages alter column direction set default 'inbound';
  exception when others then null;
  end;
  begin
    alter table inbox_messages alter column sender_type set default 'customer';
  exception when others then null;
  end;
  begin
    alter table inbox_messages alter column message_type set default 'text';
  exception when others then null;
  end;
  begin
    alter table inbox_messages alter column text set default '';
  exception when others then null;
  end;
  begin
    alter table inbox_messages alter column attachments set default '[]'::jsonb;
  exception when others then null;
  end;
  begin
    alter table inbox_messages alter column meta set default '{}'::jsonb;
  exception when others then null;
  end;

  begin
    execute 'alter table inbox_messages drop constraint if exists inbox_messages_direction_check';
  exception when others then null;
  end;

  begin
    alter table inbox_messages
      add constraint inbox_messages_direction_check
      check (direction in ('inbound','outbound','internal'));
  exception when others then null;
  end;

  begin
    execute 'alter table inbox_messages drop constraint if exists inbox_messages_sender_type_check';
  exception when others then null;
  end;

  begin
    alter table inbox_messages
      add constraint inbox_messages_sender_type_check
      check (sender_type in ('customer','agent','operator','assistant','system','ai'));
  exception when others then null;
  end;

  begin
    execute 'alter table inbox_messages drop constraint if exists inbox_messages_message_type_check';
  exception when others then null;
  end;

  begin
    alter table inbox_messages
      add constraint inbox_messages_message_type_check
      check (
        message_type in (
          'text',
          'image',
          'video',
          'audio',
          'file',
          'document',
          'voice',
          'sticker',
          'gif',
          'location',
          'contact',
          'story_reply',
          'reaction',
          'button',
          'interactive',
          'system',
          'other'
        )
      );
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'inbox_messages_thread_id_fkey') then
    begin
      alter table inbox_messages
        add constraint inbox_messages_thread_id_fkey
        foreign key (thread_id) references inbox_threads(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inbox_messages_tenant_id_fkey') then
    begin
      alter table inbox_messages
        add constraint inbox_messages_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_inbox_messages_thread_direction_external
  on inbox_messages(thread_id, direction, external_message_id)
  where external_message_id is not null;

create unique index if not exists uq_inbox_messages_external
  on inbox_messages(thread_id, external_message_id)
  where external_message_id is not null;

create index if not exists idx_inbox_messages_thread_sent
  on inbox_messages(thread_id, sent_at asc);

create index if not exists idx_inbox_messages_tenant_created
  on inbox_messages(tenant_id, created_at desc);

create index if not exists idx_inbox_messages_tenant_key_created
  on inbox_messages(tenant_key, created_at desc);

create index if not exists idx_inbox_messages_external_lookup
  on inbox_messages(tenant_key, external_message_id, created_at desc)
  where external_message_id is not null;

-- ============================================================
-- inbox_outbound_attempts
-- ============================================================

create table if not exists inbox_outbound_attempts (
  id uuid primary key default gen_random_uuid(),

  message_id uuid not null,
  thread_id uuid not null,
  tenant_id uuid,
  tenant_key text not null,
  channel text not null default 'instagram',

  provider text not null default 'meta',
  recipient_id text,
  provider_message_id text,

  payload jsonb not null default '{}'::jsonb,
  provider_response jsonb not null default '{}'::jsonb,

  status text not null default 'queued',
  attempt_count int not null default 0,
  max_attempts int not null default 5,

  queued_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,

  sent_at timestamptz,
  last_error text,
  last_error_code text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table inbox_outbound_attempts add column if not exists tenant_id uuid;
alter table inbox_outbound_attempts add column if not exists tenant_key text;
alter table inbox_outbound_attempts add column if not exists channel text default 'instagram';
alter table inbox_outbound_attempts add column if not exists provider text default 'meta';
alter table inbox_outbound_attempts add column if not exists recipient_id text;
alter table inbox_outbound_attempts add column if not exists provider_message_id text;
alter table inbox_outbound_attempts add column if not exists payload jsonb default '{}'::jsonb;
alter table inbox_outbound_attempts add column if not exists provider_response jsonb default '{}'::jsonb;
alter table inbox_outbound_attempts add column if not exists status text default 'queued';
alter table inbox_outbound_attempts add column if not exists attempt_count int default 0;
alter table inbox_outbound_attempts add column if not exists max_attempts int default 5;
alter table inbox_outbound_attempts add column if not exists queued_at timestamptz default now();
alter table inbox_outbound_attempts add column if not exists first_attempt_at timestamptz;
alter table inbox_outbound_attempts add column if not exists last_attempt_at timestamptz;
alter table inbox_outbound_attempts add column if not exists next_retry_at timestamptz;
alter table inbox_outbound_attempts add column if not exists sent_at timestamptz;
alter table inbox_outbound_attempts add column if not exists last_error text;
alter table inbox_outbound_attempts add column if not exists last_error_code text;
alter table inbox_outbound_attempts add column if not exists created_at timestamptz default now();
alter table inbox_outbound_attempts add column if not exists updated_at timestamptz default now();

do $$
begin
  begin
    alter table inbox_outbound_attempts alter column id set default gen_random_uuid();
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column channel set default 'instagram';
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column provider set default 'meta';
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column payload set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column provider_response set default '{}'::jsonb;
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column status set default 'queued';
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column attempt_count set default 0;
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column max_attempts set default 5;
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column queued_at set default now();
  exception when others then null;
  end;
  begin
    alter table inbox_outbound_attempts alter column updated_at set default now();
  exception when others then null;
  end;

  begin
    execute 'alter table inbox_outbound_attempts drop constraint if exists inbox_outbound_attempts_status_check';
  exception when others then null;
  end;

  begin
    alter table inbox_outbound_attempts
      add constraint inbox_outbound_attempts_status_check
      check (status in ('queued','sending','sent','failed','retrying','dead'));
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'inbox_outbound_attempts_message_id_fkey') then
    begin
      alter table inbox_outbound_attempts
        add constraint inbox_outbound_attempts_message_id_fkey
        foreign key (message_id) references inbox_messages(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inbox_outbound_attempts_thread_id_fkey') then
    begin
      alter table inbox_outbound_attempts
        add constraint inbox_outbound_attempts_thread_id_fkey
        foreign key (thread_id) references inbox_threads(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'inbox_outbound_attempts_tenant_id_fkey') then
    begin
      alter table inbox_outbound_attempts
        add constraint inbox_outbound_attempts_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_inbox_outbound_attempts_provider_message_id
  on inbox_outbound_attempts(provider, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_inbox_outbound_attempts_message
  on inbox_outbound_attempts(message_id, created_at desc);

create index if not exists idx_inbox_outbound_attempts_thread
  on inbox_outbound_attempts(thread_id, created_at desc);

create index if not exists idx_inbox_outbound_attempts_retry_queue
  on inbox_outbound_attempts(status, next_retry_at asc, created_at asc);

create index if not exists idx_inbox_outbound_attempts_tenant_status
  on inbox_outbound_attempts(tenant_id, status, created_at desc);

create index if not exists idx_inbox_outbound_attempts_tenant_key_status
  on inbox_outbound_attempts(tenant_key, status, created_at desc);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_inbox_outbound_attempts_updated_at') then
    execute '
      create trigger trg_inbox_outbound_attempts_updated_at
      before update on inbox_outbound_attempts
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;