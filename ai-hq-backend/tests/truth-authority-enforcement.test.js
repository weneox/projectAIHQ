import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import {
  __test__ as runtimeAuthorityTest,
  buildRuntimeAuthorityFailurePayload,
} from "../src/services/businessBrain/getTenantBrainRuntime.js";
import { buildProjectedTenantRuntime } from "../src/services/projectedTenantRuntime.js";
import { buildVoiceConfigFromProjectedRuntime } from "../src/routes/api/voice/config.js";
import { processVoiceTenantConfig } from "../src/services/voiceInternalRuntime.js";
import { ingestCommentHandler } from "../src/routes/api/comments/handlers.js";
import { inboxInternalRoutes } from "../src/routes/api/inbox/internal.js";
import { buildOperationalChannels } from "../src/services/operationalChannels.js";

function createMockRes(onFinish) {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    finished: false,
    setHeader(key, value) {
      this.headers[String(key).toLowerCase()] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
    type(value) {
      this.headers["content-type"] = value;
      return this;
    },
    send(payload) {
      this.body = payload;
      this.finished = true;
      onFinish?.();
      return this;
    },
  };
}

async function invokeRouter(router, method, path, req = {}) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve({ req: fullReq, res });
    };

    const normalizedHeaders = Object.fromEntries(
      Object.entries(req.headers || {}).map(([key, value]) => [
        String(key).toLowerCase(),
        value,
      ])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      protocol: "https",
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      header(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);
    router.handle(fullReq, res, (err) => {
      if (settled) return;
      if (err) {
        settled = true;
        reject(err);
        return;
      }
      settled = true;
      resolve({ req: fullReq, res });
    });
  });
}

test("strict runtime authority metadata is authoritative only for approved runtime projection", () => {
  const authority = runtimeAuthorityTest.buildRuntimeAuthority({
    mode: "strict",
    available: true,
    tenantId: "tenant-1",
    tenantKey: "acme",
    runtimeProjection: {
      id: "projection-1",
      status: "ready",
      projection_hash: "hash-1",
    },
    freshness: {
      stale: false,
      reasons: [],
    },
  });

  assert.equal(authority.required, true);
  assert.equal(authority.available, true);
  assert.equal(authority.source, "approved_runtime_projection");
  assert.equal(authority.runtimeProjectionId, "projection-1");
  assert.equal(authority.projectionHash, "hash-1");
  assert.deepEqual(authority.freshnessReasons, []);
});

test("projected runtime unifies voice and tenant profile from approved projection", () => {
  const operationalChannels = {
    voice: {
      available: true,
      ready: true,
      reasonCode: "",
      provider: "twilio",
      operator: {
        phone: "+15550002222",
        callerId: "+15550003333",
      },
      operatorRouting: {
        mode: "manual",
        departments: {},
      },
      realtime: {
        model: "gpt-4o-realtime-preview",
        voice: "alloy",
      },
      telephony: {
        phoneNumber: "+15550001111",
      },
      callback: {},
      transfer: {},
      limits: {},
      source: "tenant_voice_settings",
      updatedAt: "2026-03-26T00:00:00.000Z",
      contractHash: "hash-op-1",
    },
    meta: {
      available: false,
      ready: false,
      reasonCode: "channel_not_connected",
      provider: "meta",
      channelType: "",
      pageId: "",
      igUserId: "",
    },
  };

  const projectedRuntime = buildProjectedTenantRuntime({
    runtime: {
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
      },
      raw: {
        projection: {
          projection_hash: "hash-1",
          readiness_label: "ready",
          confidence_label: "high",
          identity_json: {
            tenantId: "tenant-1",
            tenantKey: "acme",
            companyName: "Acme Clinic",
            displayName: "Acme Clinic",
            industryKey: "beauty",
            websiteUrl: "https://acme.example",
            mainLanguage: "en",
            supportedLanguages: ["en", "az"],
          },
          profile_json: {
            summaryShort: "Premium care",
            toneProfile: "professional",
          },
          contacts_json: [
            {
              channel: "phone",
              isPrimary: true,
              value: "+15550001111",
            },
            {
              channel: "email",
              isPrimary: true,
              value: "hello@acme.example",
            },
          ],
          services_json: [
            {
              serviceKey: "consultation",
              title: "Consultation",
              description: "Book a consultation",
            },
          ],
          inbox_json: {
            enabled: true,
          },
          comments_json: {
            enabled: true,
          },
          voice_json: {
            enabled: true,
            supportsCalls: true,
            primaryPhone: "+15550001111",
            canOfferCallback: true,
          },
          lead_capture_json: {
            enabled: true,
            contactCaptureMode: "guided",
          },
          handoff_json: {
            enabled: true,
            escalationMode: "manual",
          },
          channels_json: [
            {
              channelType: "instagram",
              label: "IG",
              endpoint: "instagram",
            },
          ],
        },
      },
    },
    operationalChannels,
  });

  const voiceConfig = buildVoiceConfigFromProjectedRuntime(projectedRuntime, {
    tenantKey: "acme",
    toNumber: "+15550001111",
  });

  assert.equal(projectedRuntime.tenant.companyName, "Acme Clinic");
  assert.equal(projectedRuntime.channels.voice.primaryPhone, "+15550001111");
  assert.equal(voiceConfig.authority.runtimeProjectionId, "projection-1");
  assert.equal(voiceConfig.voiceProfile.businessSummary, "Premium care");
  assert.equal(voiceConfig.operator.phone, "+15550002222");
});

test("voice tenant config consumes unified projected runtime from strict authority", async () => {
  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();
      if (sql.includes("from tenants") && sql.includes("where lower(tenant_key)")) {
        return {
          rows: [
            {
              id: "tenant-1",
              tenant_key: "acme",
              company_name: "Acme Clinic",
              default_language: "en",
              meta: {
                operator: {
                  phone: "+15550002222",
                  callerId: "+15550003333",
                },
                realtime: {
                  model: "gpt-4o-realtime-preview",
                  voice: "alloy",
                },
              },
            },
          ],
        };
      }
      if (sql.includes("from tenant_voice_settings")) {
        return {
          rows: [
            {
              tenant_id: "tenant-1",
              enabled: true,
              provider: "twilio",
              mode: "assistant",
              display_name: "Acme Voice",
              default_language: "en",
              supported_languages: ["en"],
              instructions: "Route calls cleanly.",
              operator_enabled: true,
              operator_phone: "+15550002222",
              operator_label: "operator",
              transfer_strategy: "handoff",
              callback_enabled: true,
              callback_mode: "lead_only",
              max_call_seconds: 180,
              silence_hangup_seconds: 12,
              twilio_phone_number: "+15550001111",
              twilio_phone_sid: "PN123",
              twilio_config: {
                callerId: "+15550003333",
              },
              meta: {
                realtimeModel: "gpt-4o-realtime-preview",
                realtimeVoice: "alloy",
              },
              created_at: "2026-03-26T00:00:00.000Z",
              updated_at: "2026-03-26T00:00:00.000Z",
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await processVoiceTenantConfig({
    db,
    tenantKey: "acme",
    getRuntime: async () => ({
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
      },
      raw: {
        projection: {
          projection_hash: "hash-1",
          identity_json: {
            tenantId: "tenant-1",
            tenantKey: "acme",
            companyName: "Acme Clinic",
            displayName: "Acme Clinic",
            mainLanguage: "en",
            supportedLanguages: ["en"],
          },
          profile_json: {
            summaryShort: "Premium care",
          },
          contacts_json: [
            {
              channel: "phone",
              isPrimary: true,
              value: "+15550001111",
            },
          ],
          services_json: [],
          voice_json: {
            enabled: true,
            supportsCalls: true,
            primaryPhone: "+15550001111",
          },
          lead_capture_json: {
            enabled: false,
          },
          handoff_json: {
            enabled: true,
            escalationMode: "manual",
          },
          inbox_json: {},
          comments_json: {},
          channels_json: [],
        },
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.payload?.authority?.runtimeProjectionId, "projection-1");
  assert.equal(result.payload?.projectedRuntime?.tenant?.tenantKey, "acme");
  assert.equal(result.payload?.operator?.phone, "+15550002222");
});

test("operational channels fail closed when tenant voice settings are missing", async () => {
  const built = await buildOperationalChannels({
    db: {
      query: async () => ({ rows: [] }),
    },
    tenantId: "tenant-1",
    tenantRow: {
      id: "tenant-1",
      company_name: "Acme",
      default_language: "en",
    },
  });

  assert.equal(built.voice.available, false);
  assert.equal(built.voice.ready, false);
  assert.equal(built.voice.reasonCode, "voice_settings_missing");
});

test("voice tenant config fails closed when tenant voice settings are missing", async () => {
  const db = {
    async query(text) {
      const sql = String(text || "").toLowerCase();
      if (sql.includes("from tenants") && sql.includes("where lower(tenant_key)")) {
        return {
          rows: [
            {
              id: "tenant-1",
              tenant_key: "acme",
              company_name: "Acme Clinic",
              default_language: "en",
              meta: {},
            },
          ],
        };
      }
      if (sql.includes("from tenant_voice_settings")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const result = await processVoiceTenantConfig({
    db,
    tenantKey: "acme",
    getRuntime: async () => ({
      authority: {
        mode: "strict",
        required: true,
        available: true,
        source: "approved_runtime_projection",
        tenantId: "tenant-1",
        tenantKey: "acme",
        runtimeProjectionId: "projection-1",
      },
      raw: {
        projection: {
          identity_json: {
            tenantId: "tenant-1",
            tenantKey: "acme",
            companyName: "Acme Clinic",
            mainLanguage: "en",
          },
          profile_json: {},
          contacts_json: [],
          services_json: [],
          voice_json: {
            enabled: true,
            supportsCalls: true,
          },
          lead_capture_json: {},
          handoff_json: {},
          inbox_json: {},
          comments_json: {},
          channels_json: [],
        },
      },
    }),
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, "voice_operational_unavailable");
  assert.equal(result.details?.reasonCode, "voice_settings_missing");
});

test("strict runtime authority failures return structured fail-closed payloads", () => {
  const error = runtimeAuthorityTest.createRuntimeAuthorityError({
    mode: "strict",
    tenantKey: "acme",
    reasonCode: "runtime_projection_missing",
    reason: "runtime_projection_missing",
    message: "No fresh runtime projection exists.",
  });

  const payload = buildRuntimeAuthorityFailurePayload(error, {
    service: "comments.ingest",
    tenantKey: "acme",
  });

  assert.equal(payload.ok, false);
  assert.equal(payload.error, "runtime_authority_unavailable");
  assert.equal(payload.details.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
  assert.equal(payload.details.authority.required, true);
  assert.equal(payload.details.authority.reasonCode, "runtime_projection_missing");
});

test("comments ingest fails closed when strict runtime authority is unavailable", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const handler = ingestCommentHandler({
      db: {
        query: async () => ({ rows: [] }),
      },
      wsHub: null,
      getRuntime: async () => {
        throw runtimeAuthorityTest.createRuntimeAuthorityError({
          mode: "strict",
          tenantKey: "acme",
          reasonCode: "runtime_projection_missing",
          reason: "runtime_projection_missing",
        });
      },
    });

    const req = {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalCommentId: "comment-1",
        text: "hello",
        channel: "instagram",
      },
      query: {},
    };
    const res = createMockRes();

    await handler(req, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.error, "runtime_authority_unavailable");
    assert.equal(res.body?.details?.service, "comments.ingest");
    assert.equal(
      res.body?.details?.authority?.reasonCode,
      "runtime_projection_missing"
    );
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});

test("inbox ingest fails closed when strict runtime authority is unavailable", async () => {
  const previousInternalToken = cfg.security.aihqInternalToken;

  try {
    cfg.security.aihqInternalToken = "internal-secret";

    const mockThread = {
      id: "11111111-1111-4111-8111-111111111111",
      tenant_id: "22222222-2222-4222-8222-222222222222",
      tenant_key: "acme",
      channel: "instagram",
      external_thread_id: "ext-thread-1",
      external_user_id: "ext-user-1",
      external_username: "user1",
      customer_name: "Customer One",
      status: "open",
      last_message_at: new Date().toISOString(),
      last_inbound_at: new Date().toISOString(),
      last_outbound_at: null,
      unread_count: 1,
      assigned_to: null,
      labels: [],
      meta: {},
      handoff_active: false,
      handoff_reason: "",
      handoff_priority: "normal",
      handoff_at: null,
      handoff_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const mockClient = {
      async query(text) {
        const sql = String(text || "").toLowerCase();

        if (
          sql.includes("current_database()") ||
          sql === "begin" ||
          sql === "rollback" ||
          sql === "commit"
        ) {
          return { rows: [{}] };
        }

        if (sql.includes("from tenants")) {
          return {
            rows: [
              {
                id: "22222222-2222-4222-8222-222222222222",
                tenant_key: "acme",
                company_name: "Acme",
                timezone: "Asia/Baku",
                inbox_policy: {},
              },
            ],
          };
        }

        if (sql.includes("from inbox_threads") && sql.includes("select")) {
          return { rows: [] };
        }

        if (sql.includes("insert into inbox_threads")) {
          return { rows: [mockThread] };
        }

        if (sql.includes("insert into inbox_messages")) {
          return {
            rows: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                thread_id: mockThread.id,
                tenant_key: "acme",
                direction: "inbound",
                sender_type: "customer",
                external_message_id: null,
                message_type: "text",
                text: "hello",
                attachments: [],
                meta: {},
                sent_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              },
            ],
          };
        }

        if (sql.includes("from inbox_messages")) {
          return { rows: [] };
        }

        return { rows: [] };
      },
      release() {},
    };

    const router = inboxInternalRoutes({
      db: {
        query: async () => ({ rows: [] }),
        connect: async () => mockClient,
      },
      wsHub: null,
      getRuntime: async () => {
        throw runtimeAuthorityTest.createRuntimeAuthorityError({
          mode: "strict",
          tenantKey: "acme",
          reasonCode: "runtime_projection_missing",
          reason: "runtime_projection_missing",
        });
      },
    });

    const { res } = await invokeRouter(router, "post", "/inbox/ingest", {
      headers: {
        "x-internal-token": "internal-secret",
        "x-tenant-key": "acme",
      },
      body: {
        externalThreadId: "ext-thread-1",
        externalUserId: "ext-user-1",
        text: "hello",
        channel: "instagram",
        timestamp: Date.now(),
      },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.ok, false);
    assert.equal(res.body?.error, "runtime_authority_unavailable");
    assert.equal(res.body?.details?.service, "inbox.ingest");
    assert.equal(
      res.body?.details?.authority?.reasonCode,
      "runtime_projection_missing"
    );
  } finally {
    cfg.security.aihqInternalToken = previousInternalToken;
  }
});
