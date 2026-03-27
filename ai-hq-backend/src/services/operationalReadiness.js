function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function bool(v, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function normalizeSamples(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      tenantKey: s(item?.tenantKey || item?.tenant_key),
      tenantId: s(item?.tenantId || item?.tenant_id),
      channelType: s(item?.channelType || item?.channel_type),
      pageId: s(item?.pageId || item?.page_id),
      igUserId: s(item?.igUserId || item?.ig_user_id),
      reasonCode: s(item?.reasonCode || item?.reason_code),
    }))
    .filter((item) => item.tenantKey || item.tenantId);
}

const OPERATIONAL_REASON_METADATA = {
  voice_settings_missing: {
    category: "voice",
    dependencyType: "voice_settings",
    title: "Voice settings missing",
    action: {
      id: "repair_voice_settings",
      kind: "focus",
      label: "Complete voice settings",
      target: {
        panel: "voice",
        field: "twilioPhoneNumber",
        section: "operational",
      },
      requiredRole: "admin",
    },
  },
  voice_disabled: {
    category: "voice",
    dependencyType: "voice_settings",
    title: "Voice runtime disabled",
    action: {
      id: "repair_voice_settings",
      kind: "focus",
      label: "Review voice settings",
      target: {
        panel: "voice",
        field: "enabled",
        section: "operational",
      },
      requiredRole: "admin",
    },
  },
  voice_phone_number_missing: {
    category: "voice",
    dependencyType: "voice_phone_number",
    title: "Voice phone number missing",
    action: {
      id: "repair_voice_phone_number",
      kind: "focus",
      label: "Add voice phone number",
      target: {
        panel: "voice",
        field: "twilioPhoneNumber",
        section: "operational",
      },
      requiredRole: "admin",
    },
  },
  voice_provider_unsupported: {
    category: "voice",
    dependencyType: "voice_provider",
    title: "Voice provider unsupported",
    action: {
      id: "repair_voice_settings",
      kind: "focus",
      label: "Review voice provider",
      target: {
        panel: "voice",
        field: "provider",
        section: "operational",
      },
      requiredRole: "admin",
    },
  },
  channel_not_connected: {
    category: "meta",
    dependencyType: "channel_connection",
    title: "Channel not connected",
    action: {
      id: "connect_meta_channel",
      kind: "oauth",
      label: "Connect Meta channel",
      target: {
        provider: "meta",
        channelType: "instagram",
        connectUrlPath: "/api/channels/meta/connect-url",
        section: "channels",
      },
      requiredRole: "operator",
    },
  },
  channel_identifiers_missing: {
    category: "meta",
    dependencyType: "channel_identifier",
    title: "Channel identifiers missing",
    action: {
      id: "repair_channel_identifiers",
      kind: "focus",
      label: "Add channel identifiers",
      target: {
        panel: "meta",
        field: "externalPageId",
        section: "operational",
      },
      requiredRole: "admin",
    },
  },
  provider_secret_missing: {
    category: "meta",
    dependencyType: "provider_secret",
    title: "Provider secret missing",
    action: {
      id: "open_provider_secrets",
      kind: "admin_route",
      label: "Open secure secrets",
      target: {
        path: "/admin/secrets",
        provider: "meta",
        secretKeys: ["page_access_token"],
      },
      requiredRole: "admin",
    },
  },
  approved_truth_unavailable: {
    category: "truth",
    dependencyType: "approved_truth",
    title: "Approved truth unavailable",
    action: {
      id: "open_setup_route",
      kind: "route",
      label: "Continue setup",
      target: {
        path: "/setup/studio",
        section: "truth",
      },
      requiredRole: "operator",
    },
  },
  approved_truth_empty: {
    category: "truth",
    dependencyType: "approved_truth",
    title: "Approved truth empty",
    action: {
      id: "open_setup_route",
      kind: "route",
      label: "Continue setup",
      target: {
        path: "/setup/studio",
        section: "truth",
      },
      requiredRole: "operator",
    },
  },
  runtime_projection_missing: {
    category: "runtime",
    dependencyType: "runtime_projection",
    title: "Runtime projection missing",
    action: {
      id: "open_setup_route",
      kind: "route",
      label: "Open setup runtime",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  projection_missing: {
    category: "runtime",
    dependencyType: "runtime_projection",
    title: "Runtime projection missing",
    action: {
      id: "refresh_projection",
      kind: "route",
      label: "Open runtime setup",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  runtime_projection_stale: {
    category: "runtime",
    dependencyType: "runtime_projection",
    title: "Runtime projection stale",
    action: {
      id: "open_setup_route",
      kind: "route",
      label: "Review runtime setup",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  projection_stale: {
    category: "runtime",
    dependencyType: "runtime_projection",
    title: "Runtime projection stale",
    action: {
      id: "refresh_projection",
      kind: "route",
      label: "Review runtime setup",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  truth_version_drift: {
    category: "runtime",
    dependencyType: "runtime_projection",
    title: "Runtime projection drifted from approved truth",
    action: {
      id: "refresh_projection",
      kind: "route",
      label: "Refresh projection",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  runtime_authority_unavailable: {
    category: "runtime",
    dependencyType: "runtime_authority",
    title: "Runtime authority unavailable",
    action: {
      id: "open_setup_route",
      kind: "route",
      label: "Review runtime authority",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  authority_invalid: {
    category: "runtime",
    dependencyType: "runtime_authority",
    title: "Runtime authority invalid",
    action: {
      id: "rebuild_runtime",
      kind: "route",
      label: "Rebuild runtime",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  projection_build_failed: {
    category: "runtime",
    dependencyType: "runtime_projection",
    title: "Runtime projection build failed",
    action: {
      id: "rebuild_runtime",
      kind: "route",
      label: "Rebuild runtime",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  repair_pending: {
    category: "runtime",
    dependencyType: "runtime_projection",
    title: "Runtime repair pending",
    action: {
      id: "refresh_projection",
      kind: "route",
      label: "Monitor runtime repair",
      target: {
        path: "/setup/runtime",
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  source_dependency_failed: {
    category: "runtime",
    dependencyType: "runtime_dependency",
    title: "Runtime dependency failed",
    action: {
      id: "investigate_dependency_failure",
      kind: "focus",
      label: "Investigate dependency failure",
      target: {
        section: "runtime",
      },
      requiredRole: "operator",
    },
  },
  approval_required: {
    category: "runtime",
    dependencyType: "approved_truth",
    title: "Truth approval required",
    action: {
      id: "verify_truth_publish",
      kind: "route",
      label: "Open truth setup",
      target: {
        path: "/setup/studio",
        section: "truth",
      },
      requiredRole: "operator",
    },
  },
  review_required: {
    category: "review",
    dependencyType: "review",
    title: "Review required",
    action: {
      id: "open_review_workspace",
      kind: "route",
      label: "Open review workspace",
      target: {
        path: "/settings?tab=knowledge-review",
        section: "review",
      },
      requiredRole: "operator",
    },
  },
};

function getReasonMetadata(reasonCode = "") {
  const key = lower(reasonCode);
  return (
    OPERATIONAL_REASON_METADATA[key] || {
      category: "operational",
      dependencyType: "unknown",
      title: "Operational blocker",
      action: {
        id: "review_operational_blocker",
        kind: "focus",
        label: "Review blocker",
        target: {
          section: "operational",
        },
        requiredRole: "operator",
      },
    }
  );
}

function roleRank(role = "") {
  const value = lower(role);
  if (value === "internal") return 4;
  if (value === "owner") return 3;
  if (value === "admin") return 2;
  if (value === "operator") return 1;
  return 0;
}

function isActionAllowedForRole(action = {}, viewerRole = "") {
  const required = lower(action?.requiredRole || "operator");
  const minimum =
    required === "owner"
      ? 3
      : required === "admin"
      ? 2
      : required === "operator"
      ? 1
      : 0;

  return roleRank(viewerRole) >= minimum;
}

function buildRepairActionDescriptor(reasonCode = "", overrides = {}) {
  const metadata = getReasonMetadata(reasonCode);
  const action = metadata.action || {};
  const target = {
    ...(action.target || {}),
    ...(overrides.target && typeof overrides.target === "object" ? overrides.target : {}),
  };

  return {
    id: s(overrides.id || action.id || "review_operational_blocker"),
    kind: lower(overrides.kind || action.kind || "focus"),
    label: s(overrides.label || action.label || "Review blocker"),
    requiredRole: lower(overrides.requiredRole || action.requiredRole || "operator"),
    allowed: bool(overrides.allowed, false),
    target,
  };
}

function buildOperationalBlockerItem(sample = {}, viewerRole = "") {
  const reasonCode = lower(sample?.reasonCode);
  const metadata = getReasonMetadata(reasonCode);
  const action = buildRepairActionDescriptor(reasonCode, {
    allowed: isActionAllowedForRole(metadata.action, viewerRole),
  });

  return {
    category: metadata.category,
    dependencyType: metadata.dependencyType,
    title: metadata.title,
    reasonCode,
    tenantKey: lower(sample?.tenantKey),
    tenantId: s(sample?.tenantId),
    channelType: lower(sample?.channelType),
    pageId: s(sample?.pageId),
    igUserId: s(sample?.igUserId),
    suggestedRepairActionId: action.id,
    repairAction: action,
  };
}

function buildOperationalBlockers({ voice = {}, meta = {}, runtime = {}, viewerRole = "" } = {}) {
  const items = [...arr(voice.samples), ...arr(meta.samples), ...arr(runtime.samples)]
    .map((sample) => buildOperationalBlockerItem(sample, viewerRole))
    .filter((item) => item.reasonCode);
  const reasonCodes = Array.from(
    new Set(items.map((item) => item.reasonCode).filter(Boolean))
  );
  const repairActions = Array.from(
    new Map(items.map((item) => [item.suggestedRepairActionId, item.repairAction]))
      .values()
  );

  return {
    items,
    reasonCodes,
    repairActions,
  };
}

function buildDisabledOperationalReadinessSummary({ enforced = false, error = "" } = {}) {
  return {
    ok: false,
    enabled: false,
    enforced: Boolean(enforced),
    status: error ? "attention" : "unavailable",
    error: s(error),
    blockerReasonCodes: [],
    repairActions: [],
    blockers: {
      total: 0,
      items: [],
      voice: {
        missingSettings: 0,
        disabledSettings: 0,
        missingPhoneNumber: 0,
        samples: [],
      },
      meta: {
        missingChannelIds: 0,
        missingPageAccessToken: 0,
        samples: [],
      },
      runtime: {
        missingProjection: 0,
        staleProjection: 0,
        invalidProjection: 0,
        samples: [],
      },
    },
  };
}

function finalizeOperationalReadinessSummary(summary = {}, { enforced = false, viewerRole = "" } = {}) {
  const voice = summary?.blockers?.voice || {};
  const meta = summary?.blockers?.meta || {};
  const runtime = summary?.blockers?.runtime || {};
  const derived = buildOperationalBlockers({
    voice,
    meta,
    runtime,
    viewerRole,
  });
  const total = n(summary?.blockers?.total, 0);

  return {
    ok: summary?.ok === true,
    enabled: summary?.enabled === true,
    enforced: Boolean(enforced),
    status:
      summary?.ok !== true
        ? "attention"
        : total > 0
        ? "blocked"
        : "ready",
    blockerReasonCodes: derived.reasonCodes,
    repairActions: derived.repairActions,
    blockers: {
      total,
      items: derived.items,
      voice: {
        missingSettings: n(voice.missingSettings),
        disabledSettings: n(voice.disabledSettings),
        missingPhoneNumber: n(voice.missingPhoneNumber),
        samples: normalizeSamples(voice.samples),
      },
      meta: {
        missingChannelIds: n(meta.missingChannelIds),
        missingPageAccessToken: n(meta.missingPageAccessToken),
        samples: normalizeSamples(meta.samples),
      },
      runtime: {
        missingProjection: n(runtime.missingProjection),
        staleProjection: n(runtime.staleProjection),
        invalidProjection: n(runtime.invalidProjection),
        samples: normalizeSamples(runtime.samples),
      },
    },
  };
}

export async function getOperationalReadinessSummary(db, options = {}) {
  if (!db?.query) {
    return buildDisabledOperationalReadinessSummary(options);
  }

  const voiceSummaryQ = await db.query(`
    with voice_tenants as (
      select
        t.id as tenant_id,
        t.tenant_key
      from tenants t
      join tenant_business_runtime_projection rp
        on rp.tenant_id = t.id
       and rp.is_current = true
      where coalesce(t.active, false) = true
        and coalesce(t.status, 'active') = 'active'
        and rp.status = 'ready'
        and lower(coalesce(rp.voice_json->>'enabled', 'false')) = 'true'
    )
    select
      count(*) filter (where tvs.tenant_id is null) as missing_settings,
      count(*) filter (
        where tvs.tenant_id is not null
          and coalesce(tvs.enabled, false) = false
      ) as disabled_settings,
      count(*) filter (
        where tvs.tenant_id is not null
          and btrim(coalesce(tvs.twilio_phone_number, '')) = ''
      ) as missing_phone_number,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'tenantKey', vt.tenant_key,
            'tenantId', vt.tenant_id,
            'reasonCode',
            case
              when tvs.tenant_id is null then 'voice_settings_missing'
              when coalesce(tvs.enabled, false) = false then 'voice_disabled'
              when btrim(coalesce(tvs.twilio_phone_number, '')) = '' then 'voice_phone_number_missing'
              else ''
            end
          )
        ) filter (
          where tvs.tenant_id is null
             or coalesce(tvs.enabled, false) = false
             or btrim(coalesce(tvs.twilio_phone_number, '')) = ''
        ),
        '[]'::jsonb
      ) as samples
    from voice_tenants vt
    left join tenant_voice_settings tvs on tvs.tenant_id = vt.tenant_id
  `);

  const metaSummaryQ = await db.query(`
    with meta_channels as (
      select
        t.id as tenant_id,
        t.tenant_key,
        tc.channel_type,
        tc.external_page_id,
        tc.external_user_id,
        tc.status,
        exists (
          select 1
          from tenant_secrets ts
          where ts.tenant_id = tc.tenant_id
            and lower(ts.provider) = lower(coalesce(nullif(tc.provider, ''), nullif(tc.secrets_ref, ''), 'meta'))
            and lower(ts.secret_key) = 'page_access_token'
            and coalesce(ts.is_active, true) = true
        ) as has_page_access_token
      from tenant_channels tc
      join tenants t on t.id = tc.tenant_id
      where coalesce(t.active, false) = true
        and coalesce(t.status, 'active') = 'active'
        and lower(coalesce(tc.provider, tc.secrets_ref, 'meta')) = 'meta'
        and lower(tc.channel_type) in ('instagram', 'facebook', 'messenger')
        and lower(coalesce(tc.status, '')) in ('connected', 'active')
    )
    select
      count(*) filter (
        where btrim(coalesce(external_page_id, '')) = ''
          and btrim(coalesce(external_user_id, '')) = ''
      ) as missing_channel_ids,
      count(*) filter (
        where not has_page_access_token
      ) as missing_page_access_token,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'tenantKey', tenant_key,
            'tenantId', tenant_id,
            'channelType', channel_type,
            'pageId', coalesce(external_page_id, ''),
            'igUserId', coalesce(external_user_id, ''),
            'reasonCode',
            case
              when btrim(coalesce(external_page_id, '')) = ''
               and btrim(coalesce(external_user_id, '')) = ''
                then 'channel_identifiers_missing'
              when not has_page_access_token
                then 'provider_secret_missing'
              else ''
            end
          )
        ) filter (
          where (btrim(coalesce(external_page_id, '')) = ''
                 and btrim(coalesce(external_user_id, '')) = '')
             or not has_page_access_token
        ),
        '[]'::jsonb
      ) as samples
    from meta_channels
  `);

  const runtimeSummaryQ = await db.query(`
    with latest_truth as (
      select distinct on (tenant_id)
        tenant_id,
        tenant_key
      from tenant_business_profile_versions
      order by tenant_id, approved_at desc nulls last, created_at desc
    ),
    runtime_projection as (
      select tenant_id, tenant_key, id, status
      from tenant_business_runtime_projection
      where is_current = true
    )
    select
      count(*) filter (where rp.id is null) as missing_projection,
      count(*) filter (where lower(coalesce(rp.status, '')) = 'stale') as stale_projection,
      count(*) filter (
        where rp.id is not null
          and lower(coalesce(rp.status, '')) not in ('ready', 'stale')
      ) as invalid_projection,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'tenantKey', lt.tenant_key,
            'tenantId', lt.tenant_id,
            'reasonCode',
            case
              when rp.id is null then 'projection_missing'
              when lower(coalesce(rp.status, '')) = 'stale' then 'projection_stale'
              else 'authority_invalid'
            end
          )
        ) filter (
          where rp.id is null
             or lower(coalesce(rp.status, '')) = 'stale'
             or lower(coalesce(rp.status, '')) not in ('ready', 'stale')
        ),
        '[]'::jsonb
      ) as samples
    from latest_truth lt
    left join runtime_projection rp on rp.tenant_id = lt.tenant_id
  `);

  const voice = voiceSummaryQ?.rows?.[0] || {};
  const meta = metaSummaryQ?.rows?.[0] || {};
  const runtime = runtimeSummaryQ?.rows?.[0] || {};
  const totalBlockers =
    n(voice.missing_settings) +
    n(voice.disabled_settings) +
    n(voice.missing_phone_number) +
    n(meta.missing_channel_ids) +
    n(meta.missing_page_access_token) +
    n(runtime.missing_projection) +
    n(runtime.stale_projection) +
    n(runtime.invalid_projection);

  return finalizeOperationalReadinessSummary(
    {
      ok: true,
      enabled: true,
      blockers: {
        total: totalBlockers,
        voice: {
          missingSettings: n(voice.missing_settings),
          disabledSettings: n(voice.disabled_settings),
          missingPhoneNumber: n(voice.missing_phone_number),
          samples: normalizeSamples(voice.samples),
        },
        meta: {
          missingChannelIds: n(meta.missing_channel_ids),
          missingPageAccessToken: n(meta.missing_page_access_token),
          samples: normalizeSamples(meta.samples),
        },
        runtime: {
          missingProjection: n(runtime.missing_projection),
          staleProjection: n(runtime.stale_projection),
          invalidProjection: n(runtime.invalid_projection),
          samples: normalizeSamples(runtime.samples),
        },
      },
    },
    options
  );
}

export function withOperationalReadinessContext(summary = {}, options = {}) {
  if (summary?.enabled === false) {
    return buildDisabledOperationalReadinessSummary(options);
  }

  return finalizeOperationalReadinessSummary(summary, options);
}

export function hasOperationalReadinessBlockers(summary = {}) {
  return n(summary?.blockers?.total, 0) > 0;
}

export function isProdLikeAppEnv(appEnv = "") {
  return !["", "development", "dev", "test"].includes(lower(appEnv));
}

export function shouldEnforceOperationalReadinessOnStartup({
  appEnv = "",
  enforceFlag = false,
} = {}) {
  return Boolean(enforceFlag) && isProdLikeAppEnv(appEnv);
}

export function buildOperationalReadinessBlockerError(summary = {}) {
  const voice = summary?.blockers?.voice || {};
  const meta = summary?.blockers?.meta || {};
  const details = [
    n(voice.missingSettings)
      ? `voice settings missing: ${n(voice.missingSettings)}`
      : "",
    n(voice.disabledSettings)
      ? `voice disabled: ${n(voice.disabledSettings)}`
      : "",
    n(voice.missingPhoneNumber)
      ? `voice phone missing: ${n(voice.missingPhoneNumber)}`
      : "",
    n(meta.missingChannelIds)
      ? `meta channel ids missing: ${n(meta.missingChannelIds)}`
      : "",
    n(meta.missingPageAccessToken)
      ? `meta provider secrets missing: ${n(meta.missingPageAccessToken)}`
      : "",
  ].filter(Boolean);

  return new Error(
    `Operational readiness blockers detected: ${details.join(", ") || "unknown blockers"}`
  );
}

export function buildOperationalRepairGuidance({
  reasonCode = "",
  viewerRole = "",
  missingFields = [],
  title = "",
  subtitle = "",
  action = {},
  target = {},
} = {}) {
  const metadata = getReasonMetadata(reasonCode);
  const nextAction = buildRepairActionDescriptor(reasonCode, {
    ...obj(action),
    allowed: isActionAllowedForRole(metadata.action, viewerRole),
    target,
  });

  return {
    blocked: Boolean(s(reasonCode)),
    category: metadata.category,
    dependencyType: metadata.dependencyType,
    reasonCode: lower(reasonCode),
    title: s(title || metadata.title),
    subtitle: s(subtitle),
    missing: arr(missingFields).map((item) => s(item)).filter(Boolean),
    suggestedRepairActionId: nextAction.id,
    nextAction,
  };
}

export function buildReadinessSurface({
  status = "ready",
  blockers = [],
  message = "",
} = {}) {
  const items = arr(blockers)
    .map((item) => item && typeof item === "object" ? item : null)
    .filter(Boolean);

  return {
    status: lower(status || (items.some((item) => item.blocked) ? "blocked" : "ready")),
    blocked: items.some((item) => item.blocked),
    message: s(message),
    blockers: items,
    repairActions: items
      .map((item) => obj(item.nextAction))
      .filter((item) => s(item.id)),
  };
}
