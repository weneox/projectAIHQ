create table if not exists durable_executions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete set null,
  tenant_key text not null default 'default',
  channel text not null default 'system',
  provider text not null default 'internal',
  action_type text not null,
  target_type text not null default 'runtime',
  target_id text,
  thread_id uuid,
  conversation_id text,
  message_id uuid,
  idempotency_key text not null,
  payload_summary jsonb not null default '{}'::jsonb,
  safe_metadata jsonb not null default '{}'::jsonb,
  correlation_ids jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_retry_at timestamptz,
  lease_token text,
  lease_expires_at timestamptz,
  claimed_by text,
  last_attempt_at timestamptz,
  succeeded_at timestamptz,
  dead_lettered_at timestamptz,
  last_error_code text,
  last_error_message text,
  last_error_classification text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'durable_executions_status_check'
  ) then
    alter table durable_executions
      add constraint durable_executions_status_check
      check (
        status in (
          'pending',
          'in_progress',
          'succeeded',
          'retryable',
          'terminal',
          'dead_lettered'
        )
      );
  end if;
end
$$;

create table if not exists durable_execution_attempts (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references durable_executions(id) on delete cascade,
  attempt_number integer not null,
  status_from text,
  status_to text,
  lease_token text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  error_code text,
  error_message text,
  error_classification text,
  result_summary jsonb not null default '{}'::jsonb,
  correlation_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_durable_executions_idempotency
  on durable_executions (tenant_key, provider, action_type, idempotency_key);

create unique index if not exists uq_durable_execution_attempts_number
  on durable_execution_attempts (execution_id, attempt_number);

create index if not exists idx_durable_executions_retry_pickup
  on durable_executions (status, next_retry_at asc, created_at asc);

create index if not exists idx_durable_executions_stuck_pickup
  on durable_executions (status, lease_expires_at asc, updated_at asc);

create index if not exists idx_durable_executions_tenant_status
  on durable_executions (tenant_key, status, updated_at desc, created_at desc);

create index if not exists idx_durable_executions_dead_lettered
  on durable_executions (status, dead_lettered_at desc nulls last, updated_at desc);

create index if not exists idx_durable_execution_attempts_execution
  on durable_execution_attempts (execution_id, attempt_number desc, created_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_durable_executions_updated_at'
  ) then
    create trigger trg_durable_executions_updated_at
    before update on durable_executions
    for each row
    execute function set_updated_at();
  end if;
end
$$;
