-- src/db/schema/98_website_domain_verifications.sql

create table if not exists tenant_domain_verifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  channel_type text not null default 'webchat',
  verification_scope text not null default 'website_widget',
  verification_method text not null default 'dns_txt',
  domain text not null,
  normalized_domain text not null,
  status text not null default 'unverified',
  challenge_token text not null default '',
  challenge_dns_name text not null default '',
  challenge_dns_value text not null default '',
  challenge_version int not null default 1,
  requested_by text,
  last_checked_at timestamptz,
  verified_at timestamptz,
  status_reason_code text,
  status_message text,
  verification_meta jsonb not null default '{}'::jsonb,
  last_seen_values jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table tenant_domain_verifications add column if not exists channel_type text default 'webchat';
alter table tenant_domain_verifications add column if not exists verification_scope text default 'website_widget';
alter table tenant_domain_verifications add column if not exists verification_method text default 'dns_txt';
alter table tenant_domain_verifications add column if not exists domain text default '';
alter table tenant_domain_verifications add column if not exists normalized_domain text default '';
alter table tenant_domain_verifications add column if not exists status text default 'unverified';
alter table tenant_domain_verifications add column if not exists challenge_token text default '';
alter table tenant_domain_verifications add column if not exists challenge_dns_name text default '';
alter table tenant_domain_verifications add column if not exists challenge_dns_value text default '';
alter table tenant_domain_verifications add column if not exists challenge_version int default 1;
alter table tenant_domain_verifications add column if not exists requested_by text;
alter table tenant_domain_verifications add column if not exists last_checked_at timestamptz;
alter table tenant_domain_verifications add column if not exists verified_at timestamptz;
alter table tenant_domain_verifications add column if not exists status_reason_code text;
alter table tenant_domain_verifications add column if not exists status_message text;
alter table tenant_domain_verifications add column if not exists verification_meta jsonb default '{}'::jsonb;
alter table tenant_domain_verifications add column if not exists last_seen_values jsonb default '[]'::jsonb;
alter table tenant_domain_verifications add column if not exists created_at timestamptz default now();
alter table tenant_domain_verifications add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_domain_verifications_tenant_id_fkey'
  ) then
    begin
      alter table tenant_domain_verifications
        add constraint tenant_domain_verifications_tenant_id_fkey
        foreign key (tenant_id) references tenants(id) on delete cascade;
    exception when others then null;
    end;
  end if;

  begin
    execute 'alter table tenant_domain_verifications drop constraint if exists tenant_domain_verifications_status_check';
  exception when others then null;
  end;

  begin
    alter table tenant_domain_verifications
      add constraint tenant_domain_verifications_status_check
      check (status in ('unverified','pending','verified','failed'));
  exception when others then null;
  end;

  begin
    execute 'alter table tenant_domain_verifications drop constraint if exists tenant_domain_verifications_method_check';
  exception when others then null;
  end;

  begin
    alter table tenant_domain_verifications
      add constraint tenant_domain_verifications_method_check
      check (verification_method in ('dns_txt','meta_tag','html_file'));
  exception when others then null;
  end;
end$$;

create unique index if not exists uq_tenant_domain_verifications_tenant_channel_domain
  on tenant_domain_verifications(tenant_id, channel_type, normalized_domain);

create index if not exists idx_tenant_domain_verifications_tenant_status
  on tenant_domain_verifications(tenant_id, channel_type, status, updated_at desc);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_tenant_domain_verifications_updated_at'
  ) then
    execute '
      create trigger trg_tenant_domain_verifications_updated_at
      before update on tenant_domain_verifications
      for each row execute function set_updated_at();
    ';
  end if;
exception when others then null;
end$$;
