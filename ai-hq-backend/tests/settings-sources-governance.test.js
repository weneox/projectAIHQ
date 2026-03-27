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
        return [];
      },
      async getCandidateById() {
        return null;
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
