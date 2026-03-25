-- ============================================================
-- notifications
-- ============================================================

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tenant_key text,
  recipient text not null default 'ceo',
  type text not null default 'info',
  title text not null default '',
  body text not null default '',
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table notifications add column if not exists tenant_id uuid;
alter table notifications add column if not exists tenant_key text;
alter table notifications add column if not exists id uuid;
alter table notifications add column if not exists recipient text;
alter table notifications add column if not exists type text;
alter table notifications add column if not exists title text;
alter table notifications add column if not exists body text;
alter table notifications add column if not exists payload jsonb default '{}'::jsonb;
alter table notifications add column if not exists read_at timestamptz;
alter table notifications add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table notifications alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'notifications_tenant_id_fkey') then
    begin
      alter table notifications
        add constraint notifications_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_notifications_recipient_created on notifications(recipient, created_at desc);
create index if not exists idx_notifications_unread on notifications(recipient) where read_at is null;
create index if not exists idx_notifications_tenant_created on notifications(tenant_id, created_at desc);

-- ============================================================
-- audit_log
-- ============================================================

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tenant_key text,
  actor text not null default 'system',
  action text not null,
  object_type text not null default 'unknown',
  object_id text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_log add column if not exists tenant_id uuid;
alter table audit_log add column if not exists tenant_key text;
alter table audit_log add column if not exists id uuid;
alter table audit_log add column if not exists actor text;
alter table audit_log add column if not exists action text;
alter table audit_log add column if not exists object_type text;
alter table audit_log add column if not exists object_id text;
alter table audit_log add column if not exists meta jsonb default '{}'::jsonb;
alter table audit_log add column if not exists created_at timestamptz default now();

do $$
begin
  begin
    alter table audit_log alter column id set default gen_random_uuid();
  exception when others then null;
  end;

  if not exists (select 1 from pg_constraint where conname = 'audit_log_tenant_id_fkey') then
    begin
      alter table audit_log
        add constraint audit_log_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create index if not exists idx_audit_created on audit_log(created_at desc);
create index if not exists idx_audit_action on audit_log(action, created_at desc);
create index if not exists idx_audit_tenant_created on audit_log(tenant_id, created_at desc);
create index if not exists idx_audit_object_lookup
  on audit_log(object_type, object_id, created_at desc);

-- ============================================================
-- push_subscriptions
-- ============================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  tenant_key text,
  recipient text not null default 'ceo',
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table push_subscriptions add column if not exists tenant_id uuid;
alter table push_subscriptions add column if not exists tenant_key text;
alter table push_subscriptions add column if not exists id uuid;
alter table push_subscriptions add column if not exists recipient text;
alter table push_subscriptions add column if not exists endpoint text;
alter table push_subscriptions add column if not exists p256dh text;
alter table push_subscriptions add column if not exists auth text;
alter table push_subscriptions add column if not exists user_agent text;
alter table push_subscriptions add column if not exists created_at timestamptz default now();
alter table push_subscriptions add column if not exists last_seen_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'push_subscriptions_tenant_id_fkey') then
    begin
      alter table push_subscriptions
        add constraint push_subscriptions_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete set null;
    exception when others then null;
    end;
  end if;
end$$;

create unique index if not exists uq_push_endpoint on push_subscriptions(endpoint);
create index if not exists idx_push_recipient on push_subscriptions(recipient, created_at desc);
create index if not exists idx_push_tenant_created on push_subscriptions(tenant_id, created_at desc);