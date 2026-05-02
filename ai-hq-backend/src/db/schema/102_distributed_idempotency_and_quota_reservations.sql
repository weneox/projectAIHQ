-- ============================================================
-- Distributed correctness hardening: idempotency + reservations
-- ============================================================

alter table inbox_messages alter column sent_at drop not null;
alter table inbox_messages alter column sent_at drop default;

alter table inbox_outbound_attempts add column if not exists reservation_token text;
alter table inbox_outbound_attempts add column if not exists reserved_until timestamptz;

alter table inbox_outbound_attempts drop constraint if exists inbox_outbound_attempts_status_check;
alter table inbox_outbound_attempts
  add constraint inbox_outbound_attempts_status_check
  check (status in ('pending','reserved','sent','failed','retrying','dead','queued','sending'));

create index if not exists idx_inbox_outbound_attempts_reserved_until
  on inbox_outbound_attempts(status, reserved_until asc)
  where status in ('reserved','sending');

alter table tenant_usage_daily add column if not exists reserved_api_calls int not null default 0;
alter table tenant_usage_daily add column if not exists reserved_ai_units int not null default 0;
alter table tenant_usage_daily add column if not exists reserved_messages_in int not null default 0;
alter table tenant_usage_daily add column if not exists reserved_messages_out int not null default 0;
alter table tenant_usage_daily add column if not exists reserved_webhook_events int not null default 0;

create table if not exists external_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  tenant_key text not null,
  provider text not null,
  action_type text not null,
  idempotency_key text not null,
  execution_id uuid,
  attempt_id uuid,
  state text not null default 'pending',
  lease_token text,
  lease_expires_at timestamptz,
  provider_message_id text,
  provider_response jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  attempt_count int not null default 0,
  first_reserved_at timestamptz,
  last_reserved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'external_idempotency_keys_state_check'
  ) then
    alter table external_idempotency_keys
      add constraint external_idempotency_keys_state_check
      check (state in ('pending','reserved','sent','failed','retrying'));
  end if;
end$$;

create unique index if not exists uq_external_idempotency_keys_global
  on external_idempotency_keys(tenant_key, provider, action_type, idempotency_key);

create index if not exists idx_external_idempotency_keys_reserved
  on external_idempotency_keys(state, lease_expires_at asc, updated_at asc);

create index if not exists idx_external_idempotency_keys_execution
  on external_idempotency_keys(execution_id, attempt_id);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_external_idempotency_keys_updated_at') then
    execute '
      create trigger trg_external_idempotency_keys_updated_at
      before update on external_idempotency_keys
      for each row execute function set_updated_at();
    ';
  end if;
end$$;
