import test from "node:test";
import assert from "node:assert/strict";

import { operationalSettingsRoutes } from "../src/routes/api/settings/operational.js";
import {
  buildOperationalReadinessBlockerError,
  shouldEnforceOperationalReadinessOnStartup,
} from "../src/services/operationalReadiness.js";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    finished: false,
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
  };
}

async function invokeRoute(router, method, path, req = {}) {
  const layer = router.stack.find(
    (item) => item.route?.path === path && item.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((item) => item.handle);
  const res = createMockRes();
  const fullReq = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    url: path,
    headers: {},
    query: {},
    body: {},
    app: { locals: {} },
    ...req,
  };

  async function runAt(index) {
    if (index >= handlers.length || res.finished) return;
    const handler = handlers[index];

    if (handler.length >= 3) {
      await new Promise((resolve, reject) => {
        let settled = false;
        const next = (err) => {
          if (settled) return;
          settled = true;
          if (err) {
            reject(err);
            return;
          }
          resolve(runAt(index + 1));
        };

        Promise.resolve(handler(fullReq, res, next))
          .then(() => {
            if (!settled && res.finished) {
              settled = true;
              resolve();
            }
          })
          .catch(reject);
      });
      return;
    }

    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);
  return { req: fullReq, res };
}

class FakeOperationalDb {
  constructor() {
    this.tenant = {
      id: "tenant-1",
      tenant_key: "acme",
      company_name: "Acme",
      default_language: "en",
      active: true,
      status: "active",
    };
    this.voiceSettings = {
      tenant_id: "tenant-1",
      enabled: true,
      provider: "twilio",
      mode: "assistant",
      display_name: "Acme Voice",
      default_language: "en",
      supported_languages: ["en"],
      greeting: {},
      fallback_greeting: {},
      business_context: "",
      instructions: "Be helpful",
      business_hours_enabled: false,
      business_hours: {},
      operator_enabled: true,
      operator_phone: "+15550001111",
      operator_label: "operator",
      transfer_strategy: "handoff",
      callback_enabled: true,
      callback_mode: "lead_only",
      max_call_seconds: 180,
      silence_hangup_seconds: 12,
      capture_rules: {},
      lead_rules: {},
      escalation_rules: {},
      reporting_rules: {},
      twilio_phone_number: "+15550001111",
      twilio_phone_sid: "PN123",
      twilio_config: { callerId: "+15550001111" },
      cost_control: {},
      meta: {
        realtimeModel: "gpt-4o-realtime-preview",
        realtimeVoice: "alloy",
      },
      created_at: "2026-03-26T10:00:00.000Z",
      updated_at: "2026-03-26T10:00:00.000Z",
    };
    this.channel = {
      id: "channel-1",
      tenant_id: "tenant-1",
      channel_type: "instagram",
      provider: "meta",
      display_name: "Instagram",
      external_account_id: "acct-1",
      external_page_id: "page-1",
      external_user_id: "ig-1",
      external_username: "acme",
      status: "connected",
      is_primary: true,
      config: {},
      secrets_ref: "meta",
      health: {},
      last_sync_at: "2026-03-26T10:00:00.000Z",
      created_at: "2026-03-26T10:00:00.000Z",
      updated_at: "2026-03-26T10:00:00.000Z",
    };
    this.secretRows = [
      {
        id: "secret-1",
        tenant_id: "tenant-1",
        provider: "meta",
        secret_key: "page_access_token",
        is_active: true,
      },
    ];
    this.auditEntries = [];
  }

  async query(input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenants") && text.includes("tenant_key")) {
      return { rows: [this.tenant] };
    }

    if (text.includes("from tenant_voice_settings")) {
      return { rows: this.voiceSettings ? [this.voiceSettings] : [] };
    }

    if (text.includes("insert into tenant_voice_settings")) {
      this.voiceSettings = {
        ...this.voiceSettings,
        tenant_id: params[0],
        enabled: params[1],
        provider: params[2],
        mode: params[3],
        display_name: params[4],
        default_language: params[5],
        supported_languages: JSON.parse(params[6]),
        greeting: JSON.parse(params[7]),
        fallback_greeting: JSON.parse(params[8]),
        business_context: params[9],
        instructions: params[10],
        business_hours_enabled: params[11],
        business_hours: JSON.parse(params[12]),
        operator_enabled: params[13],
        operator_phone: params[14],
        operator_label: params[15],
        transfer_strategy: params[16],
        callback_enabled: params[17],
        callback_mode: params[18],
        max_call_seconds: params[19],
        silence_hangup_seconds: params[20],
        capture_rules: JSON.parse(params[21]),
        lead_rules: JSON.parse(params[22]),
        escalation_rules: JSON.parse(params[23]),
        reporting_rules: JSON.parse(params[24]),
        twilio_phone_number: params[25],
        twilio_phone_sid: params[26],
        twilio_config: JSON.parse(params[27]),
        cost_control: JSON.parse(params[28]),
        meta: JSON.parse(params[29]),
        updated_at: "2026-03-26T11:00:00.000Z",
      };
      return { rows: [this.voiceSettings] };
    }

    if (
      text.includes("from tenant_channels") &&
      text.includes("order by channel_type")
    ) {
      return { rows: this.channel ? [this.channel] : [] };
    }

    if (text.includes("select id") && text.includes("from tenant_channels")) {
      return { rows: this.channel ? [{ id: this.channel.id }] : [] };
    }

    if (text.includes("update tenant_channels")) {
      this.channel = {
        ...this.channel,
        provider: params[1],
        display_name: params[2],
        external_account_id: params[3],
        external_page_id: params[4],
        external_user_id: params[5],
        external_username: params[6],
        status: params[7],
        is_primary: params[8],
        config: JSON.parse(params[9]),
        secrets_ref: params[10],
        health: JSON.parse(params[11]),
        last_sync_at: params[12],
      };
      return { rows: [this.channel] };
    }

    if (text.includes("from tenant_secrets")) {
      return { rows: this.secretRows };
    }

    if (text.includes("insert into audit_log")) {
      this.auditEntries.unshift({
        tenant_id: params[0],
        tenant_key: params[1],
        actor: params[2],
        action: params[3],
        object_type: params[4],
        object_id: params[5],
        meta: params[6],
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled query: ${text}`);
  }
}

test("operational settings route returns sanitized readiness metadata", async () => {
  const router = operationalSettingsRoutes({ db: new FakeOperationalDb() });
  const { res } = await invokeRoute(router, "get", "/settings/operational", {
    auth: {
      tenantKey: "acme",
      role: "operator",
      userId: "user-1",
      email: "ops@example.com",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.voice?.operational?.ready, true);
  assert.equal(res.body?.channels?.meta?.providerSecrets?.ready, true);
  assert.deepEqual(res.body?.channels?.meta?.providerSecrets?.missingSecretKeys, []);
  assert.equal(res.body?.readiness?.status, "ready");
  assert.equal(res.body?.readiness?.blockers?.length, 0);
  assert.equal(res.body?.dataGovernance?.retention?.items?.[0]?.key, "runtime_incidents");
  assert.equal(res.body?.dataGovernance?.retention?.items?.[0]?.retainDays, 14);
  assert.equal(
    res.body?.dataGovernance?.retention?.items?.find((item) => item.key === "audit_log")?.status,
    "unbounded_in_repo"
  );
  assert.equal(res.body?.dataGovernance?.backupRestore?.status, "runbook_only");
  assert.match(
    res.body?.dataGovernance?.backupRestore?.message || "",
    /does not create backups or provide self-serve restore/i
  );
});

test("operational voice settings route blocks non-admin operators with audited permission semantics", async () => {
  const db = new FakeOperationalDb();
  const router = operationalSettingsRoutes({ db });
  const { res } = await invokeRoute(router, "post", "/settings/operational/voice", {
    auth: {
      tenantKey: "acme",
      role: "operator",
      userId: "user-1",
      email: "ops@example.com",
    },
    requestId: "req-op-1",
    correlationId: "corr-op-1",
    body: {
      enabled: true,
      twilioPhoneNumber: "",
    },
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error, "Only owner/admin can manage operational settings");
  assert.equal(db.auditEntries[0]?.action, "settings.operational.voice.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0]?.meta?.reasonCode, "insufficient_role");
  assert.equal(db.auditEntries[0]?.meta?.attemptedRole, "operator");
  assert.equal(db.auditEntries[0]?.meta?.requestId, "req-op-1");
});

test("operational settings route returns guided repair metadata for blocked dependencies", async () => {
  const db = new FakeOperationalDb();
  db.voiceSettings.twilio_phone_number = "";
  db.secretRows = [];
  db.channel.external_page_id = "";
  db.channel.external_user_id = "";

  const router = operationalSettingsRoutes({ db });
  const { res } = await invokeRoute(router, "get", "/settings/operational", {
    auth: {
      tenantKey: "acme",
      role: "operator",
      userId: "user-1",
      email: "ops@example.com",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.voice?.repair?.blocked, true);
  assert.equal(res.body?.voice?.repair?.nextAction?.id, "repair_voice_phone_number");
  assert.equal(res.body?.channels?.meta?.repair?.blocked, true);
  assert.equal(res.body?.channels?.meta?.repair?.nextAction?.id, "repair_channel_identifiers");
  assert.equal(res.body?.readiness?.status, "blocked");
  assert.equal(res.body?.readiness?.blockers?.length, 2);
});

test("owner/admin can update voice operational settings", async () => {
  const db = new FakeOperationalDb();
  const router = operationalSettingsRoutes({ db });
  const { res } = await invokeRoute(router, "post", "/settings/operational/voice", {
    auth: {
      tenantKey: "acme",
      role: "owner",
      userId: "user-1",
      email: "ops@example.com",
    },
    body: {
      enabled: true,
      displayName: "Acme Operator Voice",
      defaultLanguage: "en",
      supportedLanguages: ["en", "az"],
      twilioPhoneNumber: "+15550002222",
      twilioPhoneSid: "PN222",
      operatorEnabled: true,
      operatorPhone: "+15550003333",
      operatorLabel: "front desk",
      transferStrategy: "handoff",
      callbackEnabled: true,
      callbackMode: "lead_only",
      maxCallSeconds: 200,
      silenceHangupSeconds: 14,
      instructions: "Stay concise",
      twilioConfig: {
        callerId: "+15550004444",
      },
      meta: {
        realtimeModel: "gpt-4o-realtime-preview",
        realtimeVoice: "alloy",
      },
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.voice?.settings?.twilioPhoneNumber, "+15550002222");
  assert.equal(res.body?.voice?.operational?.ready, true);
  assert.equal(db.auditEntries[0]?.action, "settings.operational.voice.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "succeeded");
  assert.equal(db.auditEntries[0]?.meta?.targetArea, "operational_voice");
});

test("operational channel route rejects meta channel without persisted identifiers", async () => {
  const router = operationalSettingsRoutes({ db: new FakeOperationalDb() });
  const { res } = await invokeRoute(
    router,
    "post",
    "/settings/operational/channels/:type",
    {
      params: { type: "instagram" },
      auth: {
        tenantKey: "acme",
        role: "owner",
        userId: "user-1",
        email: "ops@example.com",
      },
      body: {
        provider: "meta",
        status: "connected",
        external_page_id: "",
        external_user_id: "",
      },
    }
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body?.error, "channel_identifiers_required");
});

test("operational channel route blocks non-admin operators with audited permission semantics", async () => {
  const db = new FakeOperationalDb();
  const router = operationalSettingsRoutes({ db });
  const { res } = await invokeRoute(
    router,
    "post",
    "/settings/operational/channels/:type",
    {
      params: { type: "instagram" },
      auth: {
        tenantKey: "acme",
        role: "operator",
        userId: "user-1",
        email: "ops@example.com",
      },
      requestId: "req-op-channel-1",
      correlationId: "corr-op-channel-1",
      body: {
        provider: "meta",
        status: "connected",
        external_page_id: "page-2",
        external_user_id: "ig-2",
      },
    }
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.error, "Only owner/admin can manage operational settings");
  assert.equal(db.auditEntries[0]?.action, "settings.operational.channel.updated");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0]?.meta?.reasonCode, "insufficient_role");
  assert.equal(db.auditEntries[0]?.meta?.attemptedRole, "operator");
});

test("startup readiness helpers block prod-like boot when enforcement is enabled", () => {
  assert.equal(
    shouldEnforceOperationalReadinessOnStartup({
      appEnv: "production",
      enforceFlag: true,
    }),
    true
  );

  const error = buildOperationalReadinessBlockerError({
    blockers: {
      voice: {
        missingSettings: 1,
        disabledSettings: 0,
        missingPhoneNumber: 2,
      },
      meta: {
        missingChannelIds: 1,
        missingPageAccessToken: 1,
      },
    },
  });

  assert.match(error.message, /voice settings missing: 1/i);
  assert.match(error.message, /meta provider secrets missing: 1/i);
});
