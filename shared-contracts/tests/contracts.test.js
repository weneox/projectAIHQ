import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRealtimeEnvelope,
  validateAihqOutboundAckRequest,
  validateDurableExecutionResponse,
  validateDurableVoiceSyncRequest,
  validateMetaCommentActionResponse,
  validateMetaGatewayOutboundResponse,
  validateOperationalChannels,
  validateOperationalReadiness,
  validateOperationalRepairAction,
  validateOperationalRepairGuidance,
  validateReadinessSurface,
  validateProviderAccessResponse,
  validateProjectedRuntime,
  validateResolveChannelProjectedResponse,
  validateRuntimeIncidentRequest,
  validateRuntimeIncidentResponse,
  validateVoiceOperationalResponse,
  validateVoiceProjectedRuntimeResponse,
  validateVoiceInternalResponse,
  validateVoiceSessionUpsertRequest,
} from "../index.js";

test("realtime envelope validation rejects missing tenant scope", () => {
  const checked = buildRealtimeEnvelope({
    type: "inbox.thread.updated",
    thread: { id: "thread-1" },
  });

  assert.equal(checked.ok, false);
  assert.equal(checked.error, "realtime_tenant_scope_required");
});

test("outbound ack contract requires thread and recipient ids", () => {
  const missingThread = validateAihqOutboundAckRequest({
    recipientId: "user-1",
  });
  assert.equal(missingThread.ok, false);
  assert.equal(missingThread.error, "thread_id_required");

  const valid = validateAihqOutboundAckRequest({
    threadId: "thread-1",
    recipientId: "user-1",
    tenantKey: "acme",
  });
  assert.equal(valid.ok, true);
});

test("voice session upsert contract still enforces tenant and provider call ids", () => {
  const checked = validateVoiceSessionUpsertRequest({
    tenantKey: "acme",
    providerCallSid: "CA123",
  });

  assert.equal(checked.ok, true);
});

test("meta gateway response contract requires explicit ok state", () => {
  const bad = validateMetaGatewayOutboundResponse({});
  assert.equal(bad.ok, false);

  const good = validateMetaGatewayOutboundResponse({ ok: true, result: {} });
  assert.equal(good.ok, true);
});

test("meta comment action response contract requires results array", () => {
  const bad = validateMetaCommentActionResponse({ ok: true });
  assert.equal(bad.ok, false);

  const good = validateMetaCommentActionResponse({ ok: true, results: [] });
  assert.equal(good.ok, true);
});

test("voice internal response contract requires explicit ok state", () => {
  const bad = validateVoiceInternalResponse({});
  assert.equal(bad.ok, false);

  const good = validateVoiceInternalResponse({ ok: true, session: { id: "voice-1" } });
  assert.equal(good.ok, true);
});

test("durable voice sync contract requires a supported action and provider call sid", () => {
  const bad = validateDurableVoiceSyncRequest({
    actionType: "voice.sync.state",
    payload: {},
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "provider_call_sid_required");

  const good = validateDurableVoiceSyncRequest({
    actionType: "voice.sync.state",
    payload: {
      providerCallSid: "CA123",
      status: "completed",
    },
  });
  assert.equal(good.ok, true);
});

test("durable execution response contract requires an execution id and status", () => {
  const bad = validateDurableExecutionResponse({ ok: true, execution: {} });
  assert.equal(bad.ok, false);

  const good = validateDurableExecutionResponse({
    ok: true,
    execution: {
      id: "exec-1",
      status: "pending",
    },
  });
  assert.equal(good.ok, true);
});

test("runtime incident contract requires service, area, and code", () => {
  const bad = validateRuntimeIncidentRequest({
    service: "meta-bot-backend",
  });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "runtime_incident_area_required");

  const good = validateRuntimeIncidentRequest({
    service: "meta-bot-backend",
    area: "provider_access",
    code: "meta_provider_access_unavailable",
    severity: "warn",
    reasonCode: "provider_secret_missing",
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.severity, "warn");
});

test("runtime incident response requires explicit incident payload", () => {
  const bad = validateRuntimeIncidentResponse({ ok: true });
  assert.equal(bad.ok, false);

  const good = validateRuntimeIncidentResponse({
    ok: true,
    incident: {
      id: "incident-1",
    },
  });
  assert.equal(good.ok, true);
});

test("projected runtime contract requires authority and tenant scope", () => {
  const bad = validateProjectedRuntime({
    authority: {},
    tenant: {},
  });
  assert.equal(bad.ok, false);

  const good = validateProjectedRuntime({
    authority: {
      mode: "strict",
      required: true,
      available: true,
      source: "approved_runtime_projection",
      tenantId: "tenant-1",
      tenantKey: "acme",
      runtimeProjectionId: "projection-1",
    },
    tenant: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      companyName: "Acme",
    },
    channels: {
      voice: {
        enabled: true,
      },
    },
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.authority.tenantKey, "acme");
});

test("resolve-channel projected response requires projectedRuntime", () => {
  const bad = validateResolveChannelProjectedResponse({
    ok: true,
    tenantKey: "acme",
    tenantId: "tenant-1",
  });
  assert.equal(bad.ok, false);

  const good = validateResolveChannelProjectedResponse({
    ok: true,
    tenantKey: "acme",
    tenantId: "tenant-1",
    resolvedChannel: "instagram",
    readiness: {
      status: "blocked",
      reasonCode: "channel_identifiers_missing",
      blockers: [
        {
          blocked: true,
          category: "meta",
          dependencyType: "channel_identifier",
          reasonCode: "channel_identifiers_missing",
          title: "Meta operational blocker",
          suggestedRepairActionId: "repair_channel_identifiers",
          nextAction: {
            id: "repair_channel_identifiers",
            kind: "focus",
            label: "Repair channel identifiers",
            requiredRole: "operator",
            allowed: true,
          },
        },
      ],
    },
    projectedRuntime: {
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme",
      },
    },
  });
  assert.equal(good.ok, true);
  assert.equal(good.value.readiness.status, "blocked");
});

test("voice projected runtime response validates successful payloads", () => {
  const checked = validateVoiceProjectedRuntimeResponse({
    ok: true,
    projectedRuntime: {
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
      },
      tenant: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme",
      },
      channels: {
        voice: {
          enabled: true,
        },
      },
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.projectedRuntime.tenant.tenantKey, "acme");
});

test("operational channels contract validates explicit voice and meta payloads", () => {
  const checked = validateOperationalChannels({
    voice: {
      available: true,
      ready: true,
      provider: "twilio",
      operator: {
        enabled: true,
        phone: "+15550001111",
      },
      operatorRouting: {
        mode: "manual",
        departments: {},
      },
      realtime: {
        model: "gpt-4o-realtime-preview",
      },
    },
    meta: {
      available: true,
      ready: true,
      provider: "meta",
      channelType: "instagram",
      pageId: "page-1",
      igUserId: "ig-1",
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.voice.provider, "twilio");
  assert.equal(checked.value.meta.pageId, "page-1");
  assert.equal(checked.value.voice.reasonCode, "");
});

test("voice operational response requires operationalChannels", () => {
  const checked = validateVoiceOperationalResponse({
    ok: true,
    operationalChannels: {
      voice: {
        available: true,
        ready: true,
        provider: "twilio",
      },
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.operationalChannels.voice.provider, "twilio");
});

test("provider access response validates secret-backed internal access payloads", () => {
  const checked = validateProviderAccessResponse({
    ok: true,
    operationalChannels: {
      meta: {
        available: true,
        ready: true,
        provider: "meta",
        channelType: "instagram",
        pageId: "page-1",
        igUserId: "ig-1",
      },
    },
    providerAccess: {
      provider: "meta",
      tenantKey: "acme",
      tenantId: "tenant-1",
      available: true,
      pageId: "page-1",
      igUserId: "ig-1",
      pageAccessToken: "secret-token",
      appSecret: "secret-app",
      secretKeys: ["page_access_token", "app_secret"],
    },
    readiness: {
      status: "ready",
      blockers: [],
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.providerAccess.provider, "meta");
  assert.equal(checked.value.providerAccess.secretKeys.length, 2);
  assert.equal(checked.value.readiness.status, "ready");
});

test("operational repair action contract requires safe structured descriptors", () => {
  const checked = validateOperationalRepairAction({
    id: "open_provider_secrets",
    kind: "admin_route",
    label: "Open secure secrets",
    requiredRole: "admin",
    allowed: false,
    target: {
      path: "/admin/secrets",
      provider: "meta",
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.requiredRole, "admin");
});

test("operational repair guidance contract requires reason-backed next actions when blocked", () => {
  const checked = validateOperationalRepairGuidance({
    blocked: true,
    category: "meta",
    dependencyType: "provider_secret",
    reasonCode: "provider_secret_missing",
    title: "Provider secret missing",
    suggestedRepairActionId: "open_provider_secrets",
    nextAction: {
      id: "open_provider_secrets",
      kind: "admin_route",
      label: "Open secure secrets",
      requiredRole: "admin",
      allowed: false,
      target: {
        path: "/admin/secrets",
      },
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.nextAction.kind, "admin_route");
});

test("operational readiness contract validates blocker reason codes and repair actions", () => {
  const checked = validateOperationalReadiness({
    ok: false,
    enabled: true,
    enforced: true,
    status: "blocked",
    blockerReasonCodes: ["provider_secret_missing"],
    repairActions: [
      {
        id: "open_provider_secrets",
        kind: "admin_route",
        label: "Open secure secrets",
        requiredRole: "admin",
        allowed: false,
      },
    ],
    blockers: {
      total: 1,
      items: [
        {
          category: "meta",
          dependencyType: "provider_secret",
          reasonCode: "provider_secret_missing",
          suggestedRepairActionId: "open_provider_secrets",
          repairAction: {
            id: "open_provider_secrets",
            kind: "admin_route",
            label: "Open secure secrets",
            requiredRole: "admin",
            allowed: false,
          },
        },
      ],
      voice: {},
      meta: {},
    },
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.blockers.items[0].reasonCode, "provider_secret_missing");
});

test("shared readiness surface contract validates cross-surface blocker items", () => {
  const checked = validateReadinessSurface({
    status: "blocked",
    reasonCode: "approved_truth_unavailable",
    intentionallyUnavailable: true,
    message: "Approved truth is unavailable.",
    blockers: [
      {
        blocked: true,
        category: "truth",
        dependencyType: "approved_truth",
        reasonCode: "approved_truth_unavailable",
        title: "Approved truth blocker",
        subtitle: "No approved truth is being projected.",
        missing: ["approved_truth"],
        suggestedRepairActionId: "open_setup_route",
        nextAction: {
          id: "open_setup_route",
          kind: "route",
          label: "Open setup",
          requiredRole: "operator",
          allowed: true,
          target: {
            path: "/setup/studio",
          },
        },
      },
    ],
  });

  assert.equal(checked.ok, true);
  assert.equal(checked.value.blockers[0].reasonCode, "approved_truth_unavailable");
  assert.equal(checked.value.blockers[0].nextAction.kind, "route");
});
