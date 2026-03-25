-- ============================================================
-- tenant_id backfill from tenant_key
-- legacy compatibility for runtime tables
-- ============================================================

do $$
begin
  begin
    update threads x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update proposals x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update notifications x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update jobs x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update audit_log x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update push_subscriptions x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update content_items x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update inbox_threads x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update inbox_messages x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update inbox_outbound_attempts x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update leads x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update lead_events x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update comments x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update voice_calls x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update voice_call_events x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update voice_daily_usage x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update voice_call_sessions x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update inbox_thread_state x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update content_media_assets x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;

  begin
    update content_qa_reports x
    set tenant_id = t.id
    from tenants t
    where x.tenant_id is null
      and x.tenant_key is not null
      and t.tenant_key = x.tenant_key;
  exception when others then null;
  end;
exception when others then null;
end$$;