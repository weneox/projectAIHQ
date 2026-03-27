import test from "node:test";
import assert from "node:assert/strict";

import { settingsTrustRoutes } from "../src/routes/api/settings/trust.js";

function createCaptureLogger(entries = [], context = {}) {
  return {
    child(extra = {}) {
      return createCaptureLogger(entries, { ...context, ...extra });
    },
    info(event, data = {}) {
      entries.push({ level: "info", event, ...context, ...data });
    },
    warn(event, data = {}) {
      entries.push({ level: "warn", event, ...context, ...data });
    },
    error(event, error = null, data = {}) {
      entries.push({
        level: "error",
        event,
        ...context,
        ...data,
        error: error?.message || String(error || ""),
      });
    },
  };
}

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

class FakeTrustDb {
  constructor() {
    this.projectionRow = null;
    this.projectionRunRow = null;
    this.auditEntries = [];
  }

  async query(input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenants")) {
      const tenantId = String(params[0] || "tenant-1");
      const tenantKey =
        String(params[1] || params[0] || "acme").toLowerCase() === "tenant-1"
          ? "acme"
          : String(params[1] || params[0] || "acme");
      return {
        rows: [
          {
            id: tenantId || "tenant-1",
            tenant_key: tenantKey,
            company_name: "Acme",
            legal_name: "Acme LLC",
            industry_key: "clinic",
            default_language: "en",
            enabled_languages: ["en"],
          },
        ],
      };
    }

    if (text.includes("from tenant_sources")) {
      return { rows: [] };
    }

    if (text.includes("from v_tenant_knowledge_review_queue")) {
      return { rows: [] };
    }

    if (text.includes("from tenant_source_sync_runs")) {
      return { rows: [] };
    }

    if (text.includes("from tenant_business_profile_versions")) {
      return { rows: [] };
    }

    if (text.includes("insert into tenant_business_runtime_projection_runs")) {
      this.projectionRunRow = {
        id: "repair-run-1",
        tenant_id: "tenant-1",
        tenant_key: "acme",
        trigger_type: params[2],
        status: "running",
        projection_version: "runtime_projection_v1",
        started_at: "2026-03-27T00:00:00.000Z",
        requested_by: params[3],
        runner_key: params[4],
        input_summary_json: JSON.parse(params[5]),
        metadata_json: JSON.parse(params[6]),
        created_at: "2026-03-27T00:00:00.000Z",
        updated_at: "2026-03-27T00:00:00.000Z",
      };
      return { rows: [{ id: "repair-run-1" }] };
    }

    if (text.includes("update tenant_business_runtime_projection_runs")) {
      this.projectionRunRow = {
        ...this.projectionRunRow,
        runtime_projection_id: params[1] || this.projectionRunRow?.runtime_projection_id || "",
        source_snapshot_id: params[2] || "",
        status: text.includes("status = 'success'") ? "success" : "failed",
        finished_at: "2026-03-27T00:01:00.000Z",
        error_code: params[1] && text.includes("status = 'failed'") ? params[1] : "",
        error_message: params[2] && text.includes("status = 'failed'") ? params[2] : "",
        output_summary_json:
          params[3] && text.includes("status = 'success'") ? JSON.parse(params[3]) : {},
      };
      return { rows: [] };
    }

    if (text.includes("from public.tenant_setup_review_sessions")) {
      return { rows: [] };
    }

    if (text.includes("insert into tenant_business_runtime_projection")) {
      this.projectionRow = {
        id: "projection-1",
        tenant_id: params[0],
        tenant_key: params[1],
        status: params[2],
        source_snapshot_id: params[3],
        source_profile_id: params[4],
        source_capabilities_id: params[5],
        projection_hash: params[6],
        identity_json: JSON.parse(params[7]),
        profile_json: JSON.parse(params[8]),
        capabilities_json: JSON.parse(params[9]),
        contacts_json: JSON.parse(params[10]),
        locations_json: JSON.parse(params[11]),
        hours_json: JSON.parse(params[12]),
        services_json: JSON.parse(params[13]),
        products_json: JSON.parse(params[14]),
        faq_json: JSON.parse(params[15]),
        policies_json: JSON.parse(params[16]),
        social_accounts_json: JSON.parse(params[17]),
        channels_json: JSON.parse(params[18]),
        media_assets_json: JSON.parse(params[19]),
        approved_knowledge_json: JSON.parse(params[20]),
        active_facts_json: JSON.parse(params[21]),
        channel_policies_json: JSON.parse(params[22]),
        inbox_json: JSON.parse(params[23]),
        comments_json: JSON.parse(params[24]),
        content_json: JSON.parse(params[25]),
        voice_json: JSON.parse(params[26]),
        lead_capture_json: JSON.parse(params[27]),
        handoff_json: JSON.parse(params[28]),
        retrieval_corpus_json: JSON.parse(params[29]),
        runtime_context_text: params[30],
        readiness_score: params[31],
        readiness_label: params[32],
        confidence: params[33],
        confidence_label: params[34],
        created_at: "2026-03-27T00:00:30.000Z",
        updated_at: "2026-03-27T00:00:30.000Z",
      };
      return { rows: [this.projectionRow] };
    }

    if (text.includes("from tenant_business_runtime_projection")) {

      if (text.includes("from tenant_business_runtime_projection_runs")) {
        return { rows: this.projectionRunRow ? [this.projectionRunRow] : [] };
      }

      return { rows: this.projectionRow ? [this.projectionRow] : [] };
    }

    if (text.includes("from tenant_business_profile where tenant_id")) {
      return {
        rows: [
          {
            id: "profile-1",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            company_name: "Acme",
            summary_short: "Approved profile",
            website_url: "https://acme.example",
            main_language: "en",
            supported_languages: ["en"],
            profile_json: {
              companyName: "Acme",
              displayName: "Acme",
              mainLanguage: "en",
              supportedLanguages: ["en"],
              summaryShort: "Approved profile",
              websiteUrl: "https://acme.example",
            },
          },
        ],
      };
    }

    if (text.includes("from tenant_business_capabilities where tenant_id")) {
      return {
        rows: [
          {
            id: "capabilities-1",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            primary_language: "en",
            supported_languages: ["en"],
            reply_style: "professional",
            reply_length: "short",
            cta_style: "soft",
            capabilities_json: {
              primaryLanguage: "en",
              supportedLanguages: ["en"],
            },
          },
        ],
      };
    }

    if (text.includes("from tenant_business_synthesis_snapshots")) {
      return { rows: [{ id: "snapshot-1" }] };
    }

    if (text.includes("from tenant_contacts")) {
      return {
        rows: [
          {
            id: "contact-1",
            contact_key: "phone",
            channel: "phone",
            label: "Main",
            value: "+15550001111",
            is_primary: true,
            enabled: true,
            visible_public: true,
            visible_in_ai: true,
            sort_order: 0,
            meta: {},
          },
        ],
      };
    }

    if (text.includes("from tenant_services")) {
      return {
        rows: [
          {
            id: "service-1",
            service_key: "consultation",
            title: "Consultation",
            description: "Approved service",
            category: "general",
            currency: "AZN",
            pricing_model: "custom_quote",
            duration_minutes: 30,
            is_active: true,
            sort_order: 0,
            highlights_json: [],
            metadata_json: {},
          },
        ],
      };
    }

    if (text.includes("from tenant_knowledge_items")) {
      return {
        rows: [
          {
            id: "knowledge-1",
            item_key: "booking",
            category: "booking",
            question: "How do I book?",
            answer: "Send a message.",
            language: "en",
            priority: 1,
            status: "approved",
            metadata_json: {},
          },
        ],
      };
    }

    if (text.includes("from tenant_business_facts")) {
      return {
        rows: [
          {
            id: "fact-1",
            category: "cta",
            fact_key: "contact",
            value_text: "Call us.",
            priority: 1,
            enabled: true,
            metadata_json: {},
          },
        ],
      };
    }

    if (text.includes("from tenant_channel_policies")) {
      return { rows: [] };
    }

    if (text.includes("from tenant_business_channels")) {
      return {
        rows: [
          {
            id: "channel-1",
            channel_type: "instagram",
            display_name: "Instagram",
            endpoint: "instagram",
            is_active: true,
            is_primary: true,
            config_json: {},
            metadata_json: {},
          },
        ],
      };
    }

    if (
      text.includes("from tenant_locations") ||
      text.includes("from tenant_business_hours") ||
      text.includes("from tenant_business_products") ||
      text.includes("from tenant_business_faq") ||
      text.includes("from tenant_business_policies") ||
      text.includes("from tenant_business_social_accounts") ||
      text.includes("from tenant_business_media_assets")
    ) {
      return { rows: [] };
    }

    if (text.includes("from audit_log")) {
      return { rows: this.auditEntries };
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
        created_at: "2026-03-27T00:02:00.000Z",
      });
      return { rows: [] };
    }

    throw new Error(`Unhandled trust query: ${text}`);
  }
}

test("settings trust route exposes normalized trust readiness blockers", async () => {
  const router = settingsTrustRoutes({ db: new FakeTrustDb() });
  const { res } = await invokeRoute(router, "get", "/settings/trust", {
    auth: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      role: "operator",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.summary?.readiness?.status, "blocked");
  assert.equal(
    res.body?.summary?.runtimeProjection?.readiness?.blockers?.[0]?.reasonCode,
    "projection_missing"
  );
  assert.equal(
    res.body?.summary?.runtimeProjection?.readiness?.blockers?.[0]?.nextAction?.id,
    "open_setup_route"
  );
  assert.equal(
    res.body?.summary?.truth?.readiness?.blockers?.[0]?.reasonCode,
    "approved_truth_unavailable"
  );
  assert.equal(res.body?.summary?.runtimeProjection?.health?.primaryReasonCode, "projection_missing");
  assert.equal(res.body?.summary?.runtimeProjection?.health?.autonomousAllowed, false);
  assert.ok(
    res.body?.summary?.runtimeProjection?.health?.affectedSurfaces?.includes("inbox")
  );
  assert.equal(res.body?.summary?.runtimeProjection?.repair?.canRepair, false);
});

test("settings trust route hides projection repair action from non-admin operators", async () => {
  const db = new FakeTrustDb();
  db.query = async function (input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenant_business_profile_versions")) {
      return {
        rows: [
          {
            id: "truth-v1",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            approved_at: "2026-03-27T00:00:00.000Z",
            approved_by: "owner@aihq.test",
          },
        ],
      };
    }

    return FakeTrustDb.prototype.query.call(this, input, params);
  };

  const router = settingsTrustRoutes({ db });
  const { res } = await invokeRoute(router, "get", "/settings/trust", {
    auth: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      role: "operator",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.capabilities?.canRepairRuntimeProjection, false);
  assert.equal(res.body?.summary?.runtimeProjection?.repair?.action || null, null);
  assert.deepEqual(res.body?.audit || [], []);
  assert.equal(res.body?.permissions?.auditHistoryRead?.allowed, false);
});

test("settings trust route surfaces projection repairability for owner/admin when approved truth exists", async () => {
  const db = new FakeTrustDb();
  db.query = async function (input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenant_business_profile_versions")) {
      return {
        rows: [
          {
            id: "truth-v1",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            approved_at: "2026-03-27T00:00:00.000Z",
            approved_by: "owner@aihq.test",
          },
        ],
      };
    }

    return FakeTrustDb.prototype.query.call(this, input, params);
  };

  const router = settingsTrustRoutes({ db });
  const { res } = await invokeRoute(router, "get", "/settings/trust", {
    auth: {
      tenantId: "tenant-1",
      tenantKey: "acme",
      role: "owner",
    },
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.capabilities?.canRepairRuntimeProjection, true);
  assert.equal(
    res.body?.summary?.runtimeProjection?.repair?.action?.id,
    "rebuild_runtime_projection"
  );
});

test("runtime projection repair blocks non-admin operators with audited permission semantics", async () => {
  const db = new FakeTrustDb();
  const router = settingsTrustRoutes({ db });
  const { res } = await invokeRoute(
    router,
    "post",
    "/settings/trust/runtime-projection/repair",
    {
      auth: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        role: "operator",
      },
    }
  );

  assert.equal(res.statusCode, 403);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.error, "Only owner/admin can repair runtime projection");
  assert.equal(res.body?.reasonCode, "insufficient_role");
  assert.equal(db.auditEntries.length, 1);
  assert.equal(db.auditEntries[0].action, "settings.trust.runtime_projection.repair");
  assert.equal(db.auditEntries[0].meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0].meta?.reasonCode, "insufficient_role");
  assert.equal(db.auditEntries[0].meta?.attemptedRole, "operator");
});

test("runtime projection repair fails closed for owner/admin when approved truth is unavailable", async () => {
  const db = new FakeTrustDb();
  const router = settingsTrustRoutes({ db });
  const { res } = await invokeRoute(
    router,
    "post",
    "/settings/trust/runtime-projection/repair",
    {
      auth: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        role: "owner",
      },
    }
  );

  assert.equal(res.statusCode, 409);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.error, "approved_truth_unavailable");
  assert.equal(res.body?.reasonCode, "approved_truth_unavailable");
  assert.equal(db.auditEntries.length, 1);
  assert.equal(db.auditEntries[0].action, "settings.trust.runtime_projection.repair");
  assert.equal(db.auditEntries[0].meta?.outcome, "blocked");
  assert.equal(db.auditEntries[0].meta?.reasonCode, "approved_truth_unavailable");
});

test("runtime projection repair succeeds for owner/admin when approved truth exists", async () => {
  const db = new FakeTrustDb();
  const entries = [];
  db.query = async function (input, values = []) {
    const text = String(input?.text || input || "").trim().toLowerCase();
    const params = Array.isArray(input?.values) ? input.values : values;

    if (text.includes("from tenant_business_profile_versions")) {
      return {
        rows: [
          {
            id: "truth-v1",
            tenant_id: "tenant-1",
            tenant_key: "acme",
            approved_at: "2026-03-27T00:00:00.000Z",
            approved_by: "owner@aihq.test",
          },
        ],
      };
    }

    return FakeTrustDb.prototype.query.call(this, input, params);
  };

  const router = settingsTrustRoutes({ db });
  const { res } = await invokeRoute(
    router,
    "post",
    "/settings/trust/runtime-projection/repair",
    {
      auth: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        role: "owner",
      },
      requestId: "req-repair-1",
      correlationId: "corr-repair-1",
      log: createCaptureLogger(entries, {
        requestId: "req-repair-1",
        correlationId: "corr-repair-1",
      }),
    }
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.repaired, true);
  assert.equal(res.body?.projection?.status, "ready");
  assert.equal(Array.isArray(res.body?.freshness?.reasons), true);
  assert.equal(res.body?.freshness?.stale, false);
  assert.equal(db.auditEntries[0]?.action, "settings.trust.runtime_projection.repaired");
  assert.equal(db.auditEntries[0]?.meta?.outcome, "succeeded");
  assert.equal(db.auditEntries[0]?.meta?.requestId, "req-repair-1");
  assert.equal(db.auditEntries[0]?.meta?.correlationId, "corr-repair-1");
  assert.equal(
    entries.some(
      (entry) =>
        entry.event === "runtime_projection.repair.requested" &&
        entry.requestId === "req-repair-1" &&
        entry.correlationId === "corr-repair-1" &&
        entry.flow === "runtime_projection_repair"
    ),
    true
  );
  assert.equal(
    entries.some(
      (entry) =>
        entry.event === "runtime_projection.repair.completed" &&
        entry.repairRunId === "repair-run-1" &&
        entry.runtimeProjectionId === "projection-1"
    ),
    true
  );
});
