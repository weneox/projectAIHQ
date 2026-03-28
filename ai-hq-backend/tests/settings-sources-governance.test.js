import test from "node:test";
import assert from "node:assert/strict";

import { settingsSourcesRoutes } from "../src/routes/api/settings/sources.js";

function createMockRes(onFinish) {
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
      Object.entries(req.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value])
    );

    const fullReq = {
      method: String(method || "GET").toUpperCase(),
      path,
      originalUrl: path,
      url: path,
      headers: normalizedHeaders,
      query: req.query || {},
      body: req.body || {},
      params: req.params || {},
      protocol: req.protocol || "https",
      app: req.app || { locals: {} },
      log: req.log || { info() {}, error() {} },
      get(name) {
        return this.headers[String(name || "").toLowerCase()];
      },
      ...req,
    };

    const res = createMockRes(finish);

    try {
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
    } catch (err) {
      reject(err);
    }
  });
}

function buildTenantAuth(role = "member") {
  return {
    userId: "user-1",
    email: `${role}@acme.test`,
    tenantId: "tenant-1",
    tenantKey: "acme",
    role,
  };
}

function createHarness() {
  const auditActions = [];
  const state = {
    listFilters: null,
    createPayload: null,
    updatePayload: null,
    syncPayload: null,
    refreshPayloads: [],
    approvalsByCandidateId: {
      "candidate-1": [
        {
          id: "approval-1",
          action: "approve",
          decision: "approved",
          reviewer_name: "owner@acme.test",
          reviewer_id: "user-1",
          created_at: "2026-03-28T10:00:00.000Z",
        },
      ],
    },
    activeKnowledge: [
      {
        id: "knowledge-1",
        category: "contact",
        item_key: "phone_primary",
        title: "Primary phone",
        value_text: "+15550000000",
        approved_at: "2026-03-27T10:00:00.000Z",
        metadata_json: {
          approvalPolicy: {
            outcome: "review_required",
            requiredRole: "reviewer",
            risk: {
              level: "medium",
            },
          },
        },
      },
    ],
    candidatesById: {
      "candidate-1": {
        id: "candidate-1",
        tenant_id: "tenant-1",
        tenant_key: "acme",
        source_id: "source-1",
        source_run_id: "run-1",
        category: "contact",
        item_key: "phone_primary",
        title: "Primary phone",
        value_text: "+15551112222",
        value_json: { phone: "+15551112222" },
        normalized_text: "+15551112222",
        normalized_json: { phone: "+15551112222" },
        confidence: 0.93,
        confidence_label: "high",
        status: "conflict",
        review_reason: "Competing phone values require operator review.",
        conflict_hash: "conflict-phone-1",
        source_evidence_json: [
          {
            source_type: "website",
            source_id: "source-1",
            source_run_id: "run-1",
            last_seen_at: "2026-03-28T09:00:00.000Z",
          },
          {
            source_type: "instagram",
            source_id: "source-ig",
            source_run_id: "run-ig",
            last_seen_at: "2026-03-27T09:00:00.000Z",
          },
        ],
        first_seen_at: "2026-03-28T09:00:00.000Z",
        last_seen_at: "2026-03-28T09:00:00.000Z",
        created_at: "2026-03-28T09:00:00.000Z",
        updated_at: "2026-03-28T09:05:00.000Z",
        reviewed_by: "",
        reviewed_at: "",
      },
      "candidate-2": {
        id: "candidate-2",
        tenant_id: "tenant-1",
        tenant_key: "acme",
        source_id: "source-1",
        source_run_id: "run-1",
        category: "contact",
        item_key: "phone_primary",
        title: "Primary phone",
        value_text: "+15553334444",
        value_json: { phone: "+15553334444" },
        normalized_text: "+15553334444",
        normalized_json: { phone: "+15553334444" },
        confidence: 0.81,
        confidence_label: "medium",
        status: "conflict",
        review_reason: "Competing phone values require operator review.",
        conflict_hash: "conflict-phone-1",
        source_evidence_json: [
          {
            source_type: "google_maps",
            source_id: "source-gmaps",
            source_run_id: "run-gmaps",
            last_seen_at: "2026-01-01T09:00:00.000Z",
          },
        ],
        first_seen_at: "2026-03-28T09:00:00.000Z",
        last_seen_at: "2026-03-28T09:00:00.000Z",
        created_at: "2026-03-28T09:00:00.000Z",
        updated_at: "2026-03-28T09:05:00.000Z",
        reviewed_by: "",
        reviewed_at: "",
      },
    },
    sourcesById: {
      "source-1": {
        id: "source-1",
        tenant_id: "tenant-1",
        tenant_key: "acme",
        source_type: "website",
        source_key: "website_main",
        display_name: "Main Website",
        status: "connected",
        auth_status: "not_required",
        sync_status: "idle",
        connection_mode: "manual",
        access_scope: "public",
        source_url: "https://example.com",
        external_account_id: "",
        external_page_id: "",
        external_username: "",
        is_enabled: true,
        is_primary: true,
        permissions_json: {},
        settings_json: {},
        metadata_json: {},
      },
    },
  };

  const db = {
    async query(text, params = []) {
      if (String(text).includes("insert into audit_log")) {
        auditActions.push({
          action: params[3],
          objectType: params[4],
          objectId: params[5],
          meta: params[6],
        });
        return { rows: [] };
      }
      throw new Error(`Unexpected query: ${text}`);
    },
  };

  function createSourcesHelpers() {
    return {
      async resolveTenantIdentity({ tenantId, tenantKey }) {
        if (tenantId === "tenant-1" || tenantKey === "acme") {
          return { tenant_id: "tenant-1", tenant_key: "acme" };
        }
        return null;
      },
      async listSources(filters) {
        state.listFilters = filters;
        return [state.sourcesById["source-1"]];
      },
      async upsertSource(payload) {
        state.createPayload = payload;
        const item = {
          id: "source-2",
          tenant_id: payload.tenantId,
          tenant_key: payload.tenantKey,
          source_type: payload.sourceType,
          source_key: payload.sourceKey || "source-2",
          display_name: payload.displayName || "New Source",
          status: payload.status || "pending",
          sync_status: payload.syncStatus || "idle",
          is_enabled: payload.isEnabled,
          is_primary: payload.isPrimary,
        };
        state.sourcesById[item.id] = item;
        return item;
      },
      async getSourceById(sourceId) {
        return state.sourcesById[sourceId] || null;
      },
      async updateSource(sourceId, payload) {
        state.updatePayload = { sourceId, payload };
        const current = state.sourcesById[sourceId];
        const item = {
          ...current,
          display_name: payload.displayName,
          status: payload.status,
          auth_status: payload.authStatus,
          sync_status: payload.syncStatus,
          connection_mode: payload.connectionMode,
          access_scope: payload.accessScope,
          source_url: payload.sourceUrl,
          external_account_id: payload.externalAccountId,
          external_page_id: payload.externalPageId,
          external_username: payload.externalUsername,
          is_enabled: payload.isEnabled,
          is_primary: payload.isPrimary,
          permissions_json: payload.permissionsJson,
          settings_json: payload.settingsJson,
          metadata_json: payload.metadataJson,
        };
        state.sourcesById[sourceId] = item;
        return item;
      },
      async listSyncRuns({ sourceId }) {
        return [
          {
            id: "run-1",
            source_id: sourceId,
            status: "queued",
          },
        ];
      },
      async beginSourceSync(payload) {
        state.syncPayload = payload;
        return {
          source: state.sourcesById[payload.sourceId],
          run: {
            id: "run-2",
            source_id: payload.sourceId,
            review_session_id: "session-1",
            projection_status: "review_required",
            candidate_draft_count: 2,
            candidate_created_count: 1,
            canonical_projection: "deferred_to_review",
          },
        };
      },
    };
  }

  function createKnowledgeHelpers() {
    return {
      async refreshChannelCapabilitiesFromSources(payload) {
        state.refreshPayloads.push(payload);
      },
      async listReviewQueue() {
        return [
          {
            ...state.candidatesById["candidate-1"],
            source_type: "website",
            source_display_name: "Main Website",
          },
          {
            ...state.candidatesById["candidate-2"],
            source_type: "google_maps",
            source_display_name: "Maps Listing",
          },
        ];
      },
      async getCandidateById(candidateId) {
        return state.candidatesById[candidateId] || null;
      },
      async listActiveKnowledge() {
        return state.activeKnowledge;
      },
      async listApprovals({ candidateId }) {
        return state.approvalsByCandidateId[candidateId] || [];
      },
      async approveCandidate(candidateId, payload) {
        state.approvePayload = { candidateId, payload };
        const candidate = {
          ...state.candidatesById[candidateId],
          status: "approved",
          reviewed_by: payload.reviewerId,
          reviewed_at: payload.reviewedAt || "2026-03-28T10:10:00.000Z",
        };
        state.candidatesById[candidateId] = candidate;
        return {
          candidate,
          knowledge: {
            id: "knowledge-approved-1",
            category: "signal_only",
            item_key: candidate.item_key,
            title: candidate.title,
            value_text: candidate.value_text,
          },
          approval: {
            id: "approval-2",
            action: "approve",
            decision: "approved",
            created_at: "2026-03-28T10:10:00.000Z",
            reviewer_name: payload.reviewerName,
          },
          supersededConflictPeers: [
            {
              id: "candidate-2",
              status: "superseded",
            },
          ],
          projection: {
            profile: {
              id: "truth-version-7",
              version_id: "truth-version-7",
            },
            capabilities: null,
            runtimeProjection: {
              id: "runtime-projection-9",
              status: "refreshed",
              affected_surfaces: ["voice", "inbox"],
              health: {
                status: "healthy",
                warnings: [],
              },
            },
          },
        };
      },
      async markCandidateNeedsReview(candidateId, payload) {
        state.candidatesById[candidateId] = {
          ...state.candidatesById[candidateId],
          status: "needs_review",
          review_reason: payload.reason,
          reviewed_by: payload.reviewerId,
          reviewed_at: payload.reviewedAt,
        };
        return {
          candidate: state.candidatesById[candidateId],
        };
      },
    };
  }

  const router = settingsSourcesRoutes({
    db,
    createSourcesHelpers,
    createKnowledgeHelpers,
  });

  return { router, state, auditActions };
}

test("source governance read path stays available and preserves filters after route split", async () => {
  const { router, state } = createHarness();

  const result = await invokeRouter(router, "get", "/sources", {
    auth: buildTenantAuth("member"),
    query: {
      sourceType: "website",
      status: "connected",
      isEnabled: "false",
      limit: "20",
      offset: "5",
    },
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.count, 1);
  assert.deepEqual(state.listFilters, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    sourceType: "website",
    status: "connected",
    isEnabled: false,
    limit: 20,
    offset: 5,
  });
});

test("source creation stays owner-admin gated and refreshes capabilities with audit metadata", async () => {
  const { router, state, auditActions } = createHarness();

  const forbidden = await invokeRouter(router, "post", "/sources", {
    auth: buildTenantAuth("member"),
    body: { sourceType: "website" },
  });
  assert.equal(forbidden.res.statusCode, 403);

  const created = await invokeRouter(router, "post", "/sources", {
    auth: buildTenantAuth("owner"),
    body: {
      sourceType: "website",
      sourceKey: "website_new",
      displayName: "New Website",
      isEnabled: true,
    },
  });

  assert.equal(created.res.statusCode, 200);
  assert.equal(state.createPayload?.tenantId, "tenant-1");
  assert.equal(state.createPayload?.sourceType, "website");
  assert.equal(state.refreshPayloads.length, 1);
  assert.equal(auditActions.at(-1)?.action, "settings.source.created");
});

test("source update and sync actions keep their existing response semantics after module split", async () => {
  const { router, state, auditActions } = createHarness();

  const updated = await invokeRouter(router, "patch", "/sources/source-1", {
    auth: buildTenantAuth("admin"),
    body: {
      displayName: "Primary Website",
      status: "connected",
      syncStatus: "running",
      isPrimary: false,
    },
  });

  assert.equal(updated.res.statusCode, 200);
  assert.equal(state.updatePayload?.sourceId, "source-1");
  assert.equal(state.updatePayload?.payload.displayName, "Primary Website");
  assert.equal(auditActions.at(-1)?.action, "settings.source.updated");

  const sync = await invokeRouter(router, "post", "/sources/source-1/sync", {
    auth: buildTenantAuth("admin"),
    body: {
      runnerKey: "settings.manual",
      runType: "sync",
      triggerType: "manual",
    },
    requestId: "req-1",
    correlationId: "corr-1",
  });

  assert.equal(sync.res.statusCode, 202);
  assert.equal(sync.res.body?.accepted, true);
  assert.equal(sync.res.body?.review?.required, true);
  assert.equal(sync.res.body?.review?.sessionId, "session-1");
  assert.equal(state.syncPayload?.metadataJson?.requestId, "req-1");
  assert.equal(auditActions.at(-1)?.action, "settings.source.sync.requested");
});

test("knowledge review queue returns a shaped workbench payload with conflict, policy, and impact context", async () => {
  const { router } = createHarness();

  const result = await invokeRouter(router, "get", "/knowledge/review-queue", {
    auth: buildTenantAuth("admin"),
  });

  assert.equal(result.res.statusCode, 200);
  assert.equal(result.res.body?.summary?.total, 2);
  assert.equal(result.res.body?.summary?.conflicting, 2);
  assert.equal(result.res.body?.items?.[0]?.approvalPolicy?.requiredRole, "reviewer");
  assert.equal(result.res.body?.items?.[0]?.conflictResolution?.peerCount, 2);
  assert.ok(
    result.res.body?.items?.[0]?.impactPreview?.canonicalAreas?.includes("business_profile")
  );
  assert.equal(
    result.res.body?.items?.[0]?.publishPreview?.values?.currentApprovedValue?.valueText,
    "+15550000000"
  );
  assert.equal(
    result.res.body?.items?.[0]?.publishPreview?.runtime?.readinessDelta,
    "projection_refresh_required"
  );
  assert.equal(
    result.res.body?.items?.[0]?.conflictResolution?.previewChoices?.length,
    2
  );
  assert.equal(result.res.body?.items?.[0]?.currentTruth?.valueText, "+15550000000");
  assert.equal(result.res.body?.items?.[0]?.auditContext?.latestAction, "approve");
});

test("knowledge workbench follow-up and quarantine actions stay safe and auditable", async () => {
  const { router, state, auditActions } = createHarness();

  const followUp = await invokeRouter(router, "post", "/knowledge/candidate-1/needs-review", {
    auth: buildTenantAuth("admin"),
    params: {
      candidateId: "candidate-1",
    },
    body: {
      reason: "Needs stronger evidence before approval",
    },
  });

  assert.equal(followUp.res.statusCode, 200);
  assert.equal(state.candidatesById["candidate-1"]?.status, "needs_review");
  assert.match(state.candidatesById["candidate-1"]?.review_reason, /stronger evidence/i);
  assert.equal(auditActions.at(-1)?.action, "settings.knowledge.needs_review_marked");

  const quarantine = await invokeRouter(router, "post", "/knowledge/candidate-2/quarantine", {
    auth: buildTenantAuth("owner"),
    params: {
      candidateId: "candidate-2",
    },
    body: {
      reason: "Keep quarantined until operator validates the source",
    },
  });

  assert.equal(quarantine.res.statusCode, 200);
  assert.equal(state.candidatesById["candidate-2"]?.status, "needs_review");
  assert.match(state.candidatesById["candidate-2"]?.review_reason, /keep quarantined/i);
  assert.equal(auditActions.at(-1)?.action, "settings.knowledge.quarantine_retained");
});

test("knowledge approval returns a publish receipt with preview-vs-actual verification", async () => {
  const { router, state, auditActions } = createHarness();

  const approval = await invokeRouter(router, "post", "/knowledge/candidate-1/approve", {
    auth: buildTenantAuth("admin"),
    params: {
      candidateId: "candidate-1",
    },
    body: {
      reason: "Approve reviewed contact change",
      metadataJson: {
        publishPreview: {
          canonical: {
            areas: ["business_profile"],
          },
          runtime: {
            areas: ["contact_channels"],
          },
          channels: {
            affectedSurfaces: ["voice", "inbox"],
          },
        },
      },
    },
  });

  assert.equal(approval.res.statusCode, 200);
  assert.equal(state.approvePayload?.candidateId, "candidate-1");
  assert.equal(
    approval.res.body?.publishReceipt?.truthVersionId,
    "truth-version-7"
  );
  assert.equal(
    approval.res.body?.publishReceipt?.runtimeProjectionId,
    "runtime-projection-9"
  );
  assert.equal(approval.res.body?.publishReceipt?.publishStatus, "success");
  assert.equal(
    approval.res.body?.publishReceipt?.previewComparison?.status,
    "matched"
  );
  assert.deepEqual(
    approval.res.body?.publishReceipt?.actual?.channels?.affectedSurfaces,
    ["voice", "inbox"]
  );
  assert.equal(
    auditActions.at(-1)?.meta?.publishReceipt?.runtimeProjectionId,
    "runtime-projection-9"
  );
});
