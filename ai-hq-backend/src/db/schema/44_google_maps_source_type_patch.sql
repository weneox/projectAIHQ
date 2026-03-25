begin;

do $$
declare
  enum_type_name text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_sources'
      and column_name = 'source_type'
  ) then
    select t.typname
      into enum_type_name
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'tenant_sources'
      and a.attname = 'source_type'
      and a.attnum > 0
      and not a.attisdropped
      and t.typtype = 'e'
    limit 1;

    if coalesce(enum_type_name, '') <> '' then
      execute format(
        'alter type public.%I add value if not exists %L',
        enum_type_name,
        'google_maps'
      );
    end if;
  end if;

  enum_type_name := '';

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_sources'
      and column_name = 'type'
  ) then
    select t.typname
      into enum_type_name
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'tenant_sources'
      and a.attname = 'type'
      and a.attnum > 0
      and not a.attisdropped
      and t.typtype = 'e'
    limit 1;

    if coalesce(enum_type_name, '') <> '' then
      execute format(
        'alter type public.%I add value if not exists %L',
        enum_type_name,
        'google_maps'
      );
    end if;
  end if;

  enum_type_name := '';

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sources'
      and column_name = 'source_type'
  ) then
    select t.typname
      into enum_type_name
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'sources'
      and a.attname = 'source_type'
      and a.attnum > 0
      and not a.attisdropped
      and t.typtype = 'e'
    limit 1;

    if coalesce(enum_type_name, '') <> '' then
      execute format(
        'alter type public.%I add value if not exists %L',
        enum_type_name,
        'google_maps'
      );
    end if;
  end if;

  enum_type_name := '';

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sources'
      and column_name = 'type'
  ) then
    select t.typname
      into enum_type_name
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'sources'
      and a.attname = 'type'
      and a.attnum > 0
      and not a.attisdropped
      and t.typtype = 'e'
    limit 1;

    if coalesce(enum_type_name, '') <> '' then
      execute format(
        'alter type public.%I add value if not exists %L',
        enum_type_name,
        'google_maps'
      );
    end if;
  end if;
end
$$;

do $$
declare
  r record;
begin
  for r in
    select
      c.relname as table_name,
      con.conname as constraint_name
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('tenant_sources', 'sources')
      and con.contype = 'c'
      and (
        con.conname ilike '%source_type%'
        or con.conname ilike '%type_check%'
        or pg_get_constraintdef(con.oid) ilike '%source_type%'
        or pg_get_constraintdef(con.oid) ilike '%google_maps%'
        or pg_get_constraintdef(con.oid) ilike '%website%'
      )
  loop
    execute format(
      'alter table public.%I drop constraint %I',
      r.table_name,
      r.constraint_name
    );
  end loop;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_sources'
      and column_name = 'source_type'
  ) then
    begin
      execute $sql$
        alter table public.tenant_sources
        add constraint tenant_sources_source_type_check
        check (
          source_type is null
          or source_type in (
            'website',
            'google_maps',
            'instagram',
            'facebook',
            'linkedin',
            'whatsapp',
            'tiktok',
            'youtube',
            'telegram',
            'x',
            'twitter',
            'manual',
            'other'
          )
        )
      $sql$;
    exception when duplicate_object then
      null;
    end;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tenant_sources'
      and column_name = 'type'
  ) then
    begin
      execute $sql$
        alter table public.tenant_sources
        add constraint tenant_sources_type_check
        check (
          type is null
          or type in (
            'website',
            'google_maps',
            'instagram',
            'facebook',
            'linkedin',
            'whatsapp',
            'tiktok',
            'youtube',
            'telegram',
            'x',
            'twitter',
            'manual',
            'other'
          )
        )
      $sql$;
    exception when duplicate_object then
      null;
    end;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sources'
      and column_name = 'source_type'
  ) then
    begin
      execute $sql$
        alter table public.sources
        add constraint sources_source_type_check
        check (
          source_type is null
          or source_type in (
            'website',
            'google_maps',
            'instagram',
            'facebook',
            'linkedin',
            'whatsapp',
            'tiktok',
            'youtube',
            'telegram',
            'x',
            'twitter',
            'manual',
            'other'
          )
        )
      $sql$;
    exception when duplicate_object then
      null;
    end;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sources'
      and column_name = 'type'
  ) then
    begin
      execute $sql$
        alter table public.sources
        add constraint sources_type_check
        check (
          type is null
          or type in (
            'website',
            'google_maps',
            'instagram',
            'facebook',
            'linkedin',
            'whatsapp',
            'tiktok',
            'youtube',
            'telegram',
            'x',
            'twitter',
            'manual',
            'other'
          )
        )
      $sql$;
    exception when duplicate_object then
      null;
    end;
  end if;
end
$$;

commit;