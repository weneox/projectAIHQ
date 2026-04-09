import test from "node:test";
import assert from "node:assert/strict";

import { registerSetupReadRoutes } from "../src/routes/api/workspace/setupRoutesReads.js";
import { registerSetupReviewRoutes } from "../src/routes/api/workspace/setupRoutesReview.js";
import { registerSetupImportRoutes } from "../src/routes/api/workspace/setupRoutesImports.js";
import { registerSetupStagingRoutes } from "../src/routes/api/workspace/setupRoutesStaging.js";

function createRouter() {
  const routes = new Map();
  const register = (method) => (path, handler) => {
    routes.set(`${method} ${path}`, handler);
  };
  return {
    routes,
    get: register("GET"),
    post: register("POST"),
    patch: register("PATCH"),
    put: register("PUT"),
    delete: register("DELETE"),
  };
}

function getRoute(router, method, path) {
  const handler = router.routes.get(`${method} ${path}`);
  assert.ok(handler, `missing route ${method} ${path}`);
  return handler;
}

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createReq(overrides = {}) {
  return {
    body: {},
    query: {},
    params: {},
    requestId: "req-1",
    log: {
      info() {},
      error() {},
    },
    ...overrides,
  };
}

test("setup read routes register only the canonical setup state endpoint", () => {
  const router = createRouter();

  registerSetupReadRoutes(router, {
    db: {},
    handleSetupState() {
      throw new Error("not expected");
    },
    requireSetupActor() {
      return { tenantId: "tenant-1" };
    },
    async loadSetupTruthCurrent() {
      throw new Error("not expected");
    },
    async loadCurrentReview() {
      throw new Error("not expected");
    },
    async loadSetupTruthVersion() {
      throw new Error("not expected");
    },
    async loadSetupReviewDraft() {
      throw new Error("not expected");
    },
    s(value) {
      return String(value ?? "").trim();
    },
  });

  assert.equal(router.routes.has("GET /setup/status"), true);
  assert.equal(router.routes.has("GET /setup/overview"), false);
});

test("setup read routes load current review with explicit event limit", async () => {
  const router = createRouter();
  let receivedEventLimit = null;

  registerSetupReadRoutes(router, {
    db: { name: "db" },
    handleSetupState() {
      throw new Error("not expected");
    },
    requireSetupActor() {
      return { tenantId: "tenant-1" };
    },
    async loadSetupTruthCurrent() {
      throw new Error("not expected");
    },
    async loadCurrentReview({ eventLimit }) {
      receivedEventLimit = eventLimit;
      return {
        status: 200,
        body: {
          ok: true,
          review: { draft: { version: 9 } },
          setup: { status: "ready" },
        },
      };
    },
    async loadSetupTruthVersion() {
      throw new Error("not expected");
    },
    async loadSetupReviewDraft() {
      throw new Error("not expected");
    },
    s(value) {
      return String(value ?? "").trim();
    },
  });

  const handler = getRoute(router, "GET", "/setup/review/current");
  const req = createReq({ query: { eventLimit: "17" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(receivedEventLimit, 17);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.review.draft.version, 9);
});

test("setup read routes preserve truth-version 404 shaping", async () => {
  const router = createRouter();

  registerSetupReadRoutes(router, {
    db: {},
    handleSetupState() {
      throw new Error("not expected");
    },
    requireSetupActor() {
      return { tenantId: "tenant-1" };
    },
    async loadSetupTruthCurrent() {
      throw new Error("not expected");
    },
    async loadCurrentReview() {
      throw new Error("not expected");
    },
    async loadSetupTruthVersion() {
      return {
        status: 404,
        body: {
          ok: false,
          error: "SetupTruthVersionNotFound",
          reason: "truth version not found",
        },
      };
    },
    async loadSetupReviewDraft() {
      throw new Error("not expected");
    },
    s(value) {
      return String(value ?? "").trim();
    },
  });

  const handler = getRoute(router, "GET", "/setup/truth/history/:versionId");
  const req = createReq({ params: { versionId: "version-1" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.error, "SetupTruthVersionNotFound");
});

test("setup read routes preserve review-draft response shaping", async () => {
  const router = createRouter();

  registerSetupReadRoutes(router, {
    db: {},
    handleSetupState() {
      throw new Error("not expected");
    },
    requireSetupActor() {
      return { tenantId: "tenant-1" };
    },
    async loadSetupTruthCurrent() {
      throw new Error("not expected");
    },
    async loadCurrentReview() {
      throw new Error("not expected");
    },
    async loadSetupTruthVersion() {
      throw new Error("not expected");
    },
    async loadSetupReviewDraft() {
      return {
        status: 200,
        body: {
          ok: true,
          draft: { version: 4 },
          session: { id: "session-1" },
          sources: [{ sourceType: "website" }],
          events: [{ kind: "draft_patched" }],
          setup: { status: "review_required" },
        },
      };
    },
    s(value) {
      return String(value ?? "").trim();
    },
  });

  const handler = getRoute(router, "GET", "/setup/review-draft");
  const req = createReq();
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.session.id, "session-1");
  assert.equal(res.body.setup.status, "review_required");
});

test("setup review patch returns lock conflict payload unchanged", async () => {
  const router = createRouter();

  registerSetupReviewRoutes(router, {
    db: {},
    requireSetupActor() {
      return { tenantId: "tenant-1", tenantKey: "alpha" };
    },
    handleSetupAnalyze() {
      throw new Error("not expected");
    },
    async applySetupReviewPatch() {
      return {
        status: 409,
        body: {
          ok: false,
          error: "SetupReviewDraftVersionMismatch",
          reason: "draft version mismatch",
          code: "SETUP_REVIEW_DRAFT_VERSION_MISMATCH",
          requested: { draftVersion: 3 },
          concurrency: { sessionId: "session-1", draftVersion: 7 },
          finalizeProtection: { protectionMode: "canonical_baseline_drift" },
        },
      };
    },
    s(value) {
      return String(value ?? "").trim();
    },
    obj(value) {
      return value && typeof value === "object" ? value : {};
    },
    compactObject(value) {
      return value;
    },
    safeUuidOrNull() {
      return null;
    },
    async discardSetupReviewSession() {
      throw new Error("not expected");
    },
    async buildSetupState() {
      throw new Error("not expected");
    },
    async finalizeSetupReview() {
      throw new Error("not expected");
    },
    buildReviewConcurrencyInfo() {
      return {};
    },
    buildFinalizeProtectionInfo() {
      return {};
    },
  });

  const handler = getRoute(router, "PATCH", "/setup/review/current");
  const req = createReq({ body: { metadata: { draftVersion: 3 } } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, "SETUP_REVIEW_DRAFT_VERSION_MISMATCH");
  assert.deepEqual(res.body.concurrency, {
    sessionId: "session-1",
    draftVersion: 7,
  });
});

test("setup finalize failure keeps concurrency and finalize protection fail-closed", async () => {
  const router = createRouter();

  registerSetupReviewRoutes(router, {
    db: {},
    requireSetupActor() {
      return {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        user: { id: "not-a-uuid", email: "ops@example.com" },
      };
    },
    handleSetupAnalyze() {
      throw new Error("not expected");
    },
    async applySetupReviewPatch() {
      throw new Error("not expected");
    },
    s(value) {
      return String(value ?? "").trim();
    },
    obj(value) {
      return value && typeof value === "object" ? value : {};
    },
    compactObject(value) {
      return value;
    },
    safeUuidOrNull() {
      return null;
    },
    async discardSetupReviewSession() {
      throw new Error("not expected");
    },
    async buildSetupState() {
      throw new Error("not expected");
    },
    async finalizeSetupReview() {
      const err = new Error("finalize blocked");
      err.code = "SETUP_REVIEW_BASELINE_DRIFT";
      err.baseline = { capturedAt: "2026-03-25T00:00:00.000Z" };
      err.current = { capturedAt: "2026-03-25T00:05:00.000Z" };
      err.currentReview = {
        session: { id: "session-1", status: "ready" },
        draft: { version: 11 },
      };
      throw err;
    },
    buildReviewConcurrencyInfo(current) {
      return {
        sessionId: current?.session?.id || null,
        draftVersion: current?.draft?.version || 0,
      };
    },
    buildFinalizeProtectionInfo(current) {
      return {
        sessionStatus: current?.session?.status || "unknown",
      };
    },
  });

  const handler = getRoute(router, "POST", "/setup/review/current/finalize");
  const req = createReq({ body: { reason: "ship it" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, "SETUP_REVIEW_BASELINE_DRIFT");
  assert.deepEqual(res.body.concurrency, {
    sessionId: "session-1",
    draftVersion: 11,
  });
  assert.deepEqual(res.body.finalizeProtection, {
    sessionStatus: "ready",
  });
});

test("setup finalize runtime authority failure returns a truthful 409 payload", async () => {
  const router = createRouter();

  registerSetupReviewRoutes(router, {
    db: {},
    requireSetupActor() {
      return {
        tenantId: "tenant-1",
        tenantKey: "alpha",
      };
    },
    handleSetupAnalyze() {
      throw new Error("not expected");
    },
    async applySetupReviewPatch() {
      throw new Error("not expected");
    },
    async discardSetupReview() {
      throw new Error("not expected");
    },
    async finalizeSetupReview() {
      const err = new Error("approved truth is required before runtime can refresh");
      err.code = "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE";
      err.statusCode = 409;
      err.reasonCode = "approved_truth_unavailable";
      err.runtimeAuthority = {
        mode: "strict",
        required: true,
        available: false,
        tenantId: "tenant-1",
        tenantKey: "alpha",
        reasonCode: "approved_truth_unavailable",
        reason: "approved_truth_unavailable",
      };
      err.freshness = {
        stale: true,
        reasons: ["approved_truth_unavailable"],
      };
      err.currentReview = {
        session: { id: "session-1", status: "ready" },
        draft: { version: 11 },
      };
      throw err;
    },
    s(value) {
      return String(value ?? "").trim();
    },
    obj(value) {
      return value && typeof value === "object" ? value : {};
    },
    buildReviewConcurrencyInfo(current) {
      return {
        sessionId: current?.session?.id || null,
        draftVersion: current?.draft?.version || 0,
      };
    },
    buildFinalizeProtectionInfo(current) {
      return {
        sessionStatus: current?.session?.status || "unknown",
      };
    },
  });

  const handler = getRoute(router, "POST", "/setup/review/current/finalize");
  const req = createReq({ body: { reason: "ship it" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 409);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.code, "TENANT_RUNTIME_AUTHORITY_UNAVAILABLE");
  assert.equal(res.body.reasonCode, "approved_truth_unavailable");
  assert.equal(res.body.authority?.reasonCode, "approved_truth_unavailable");
  assert.deepEqual(res.body.freshness?.reasons, ["approved_truth_unavailable"]);
  assert.deepEqual(res.body.concurrency, {
    sessionId: "session-1",
    draftVersion: 11,
  });
});

test("setup discard route preserves discard response composition", async () => {
  const router = createRouter();

  registerSetupReviewRoutes(router, {
    db: {},
    requireSetupActor() {
      return { tenantId: "tenant-1", tenantKey: "alpha" };
    },
    handleSetupAnalyze() {
      throw new Error("not expected");
    },
    async applySetupReviewPatch() {
      throw new Error("not expected");
    },
    async discardSetupReview() {
      return {
        status: 200,
        body: {
          ok: true,
          message: "Setup review session discarded",
          session: { id: "session-1" },
          setup: { status: "ready" },
        },
      };
    },
    async finalizeSetupReview() {
      throw new Error("not expected");
    },
    s(value) {
      return String(value ?? "").trim();
    },
    obj(value) {
      return value && typeof value === "object" ? value : {};
    },
    buildReviewConcurrencyInfo() {
      return {};
    },
    buildFinalizeProtectionInfo() {
      return {};
    },
  });

  const handler = getRoute(router, "POST", "/setup/review/current/discard");
  const req = createReq({ body: { reason: "restart" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Setup review session discarded");
  assert.equal(res.body.session.id, "session-1");
});

test("setup import routes validate source type before import execution", async () => {
  const router = createRouter();

  registerSetupImportRoutes(router, {
    db: {},
    requireSetupActor() {
      return { tenantId: "tenant-1" };
    },
    resolveSourceUrlFromBody(body) {
      return body.url || "";
    },
    resolveInstagramBundleUrl() {
      return "";
    },
    normalizeIncomingSourceType() {
      return "";
    },
    async importWebsiteSource() {
      throw new Error("not expected");
    },
    async importGoogleMapsSource() {
      throw new Error("not expected");
    },
    async importSource() {
      throw new Error("not expected");
    },
    async importSourceBundle() {
      throw new Error("not expected");
    },
    async executeSetupImport() {
      throw new Error("not expected");
    },
    s(value) {
      return String(value ?? "").trim();
    },
  });

  const handler = getRoute(router, "POST", "/setup/import/source");
  const req = createReq({ body: { url: "https://alpha.example" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, "SourceImportFailed");
  assert.deepEqual(res.body.supportedSourceTypes, ["website", "google_maps"]);
});

test("setup import routes pass website imports through the shared import executor", async () => {
  const router = createRouter();

  registerSetupImportRoutes(router, {
    db: {},
    requireSetupActor() {
      return { tenantId: "tenant-1" };
    },
    resolveSourceUrlFromBody(body) {
      return body.url || "";
    },
    resolveInstagramBundleUrl() {
      return "";
    },
    normalizeIncomingSourceType() {
      return "";
    },
    async importWebsiteSource() {},
    async importGoogleMapsSource() {
      throw new Error("not expected");
    },
    async importSource() {
      throw new Error("not expected");
    },
    async importSourceBundle() {
      throw new Error("not expected");
    },
    async executeSetupImport(input) {
      assert.equal(input.executeImport.name, "importWebsiteSource");
      assert.equal(input.executeArgs.url, "https://alpha.example");
      return {
        status: 202,
        body: {
          ok: true,
          accepted: true,
          message: "Website import accepted",
        },
      };
    },
    s(value) {
      return String(value ?? "").trim();
    },
  });

  const handler = getRoute(router, "POST", "/setup/import/website");
  const req = createReq({ body: { url: "https://alpha.example" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.accepted, true);
  assert.equal(res.body.message, "Website import accepted");
});

test("setup import routes keep sourceType in generic import responses", async () => {
  const router = createRouter();

  registerSetupImportRoutes(router, {
    db: {},
    requireSetupActor() {
      return { tenantId: "tenant-1" };
    },
    resolveSourceUrlFromBody(body) {
      return body.url || "";
    },
    resolveInstagramBundleUrl() {
      return "";
    },
    normalizeIncomingSourceType() {
      return "website";
    },
    async importWebsiteSource() {
      throw new Error("not expected");
    },
    async importGoogleMapsSource() {
      throw new Error("not expected");
    },
    async importSource() {},
    async importSourceBundle() {
      throw new Error("not expected");
    },
    async executeSetupImport(input) {
      return {
        status: 200,
        body: input.responseBody({
          ok: true,
          message: "website import completed",
        }),
      };
    },
    s(value) {
      return String(value ?? "").trim();
    },
  });

  const handler = getRoute(router, "POST", "/setup/import/source");
  const req = createReq({ body: { sourceType: "website", url: "https://alpha.example" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.sourceType, "website");
  assert.equal(res.body.message, "website import completed");
});

test("setup staging routes keep canonical writes deferred for service creation", async () => {
  const router = createRouter();

  registerSetupStagingRoutes(router, {
    db: {},
    requireSetupActor() {
      return { tenantId: "tenant-1", tenantKey: "alpha" };
    },
    async stageSetupBusinessProfileMutation() {
      throw new Error("not expected");
    },
    async stageSetupRuntimePreferencesMutation() {
      throw new Error("not expected");
    },
    async patchSetupReviewDraft() {
      throw new Error("not expected");
    },
    async loadCurrentReviewPayload() {
      throw new Error("not expected");
    },
    async auditSetupAction() {},
    s(value) {
      return String(value ?? "").trim();
    },
    arr(value) {
      return Array.isArray(value) ? value : [];
    },
    async listSetupServicesFromDraftOrCanonical() {
      throw new Error("not expected");
    },
    async stageSetupServiceMutation() {
      return {
        review: {
          draft: { version: 4 },
          session: { id: "session-1" },
          sources: [{ sourceType: "website" }],
          events: [{ kind: "setup.service.created" }],
        },
        setup: { status: "review_required" },
      };
    },
  });

  const handler = getRoute(router, "POST", "/setup/services");
  const req = createReq({ body: { title: "Branding" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.canonicalWriteDeferred, true);
  assert.equal(res.body.session.id, "session-1");
  assert.equal(res.body.setup.status, "review_required");
});

test("setup staging routes keep canonical writes deferred for business profile staging", async () => {
  const router = createRouter();
  const auditCalls = [];

  registerSetupStagingRoutes(router, {
    db: {},
    requireSetupActor() {
      return { tenantId: "tenant-1", tenantKey: "alpha" };
    },
    async stageSetupBusinessProfileMutation() {
      return {
        current: {
          session: {
            id: "session-1",
            currentStep: "review",
          },
        },
        draft: { version: 5 },
        staged: {
          saved: {
            companyName: "Alpha Studio",
          },
        },
        data: {
          review: {
            draft: { version: 5 },
            session: { id: "session-1", currentStep: "review" },
            sources: [{ sourceType: "website" }],
            events: [{ kind: "draft_patched" }],
          },
          setup: { status: "review_required" },
        },
      };
    },
    async stageSetupRuntimePreferencesMutation() {
      throw new Error("not expected");
    },
    async patchSetupReviewDraft() {
      throw new Error("not expected");
    },
    async loadCurrentReviewPayload() {
      throw new Error("not expected");
    },
    async auditSetupAction(...args) {
      auditCalls.push(args);
    },
    s(value) {
      return String(value ?? "").trim();
    },
    arr(value) {
      return Array.isArray(value) ? value : [];
    },
    async listSetupServicesFromDraftOrCanonical() {
      throw new Error("not expected");
    },
    async stageSetupServiceMutation() {
      throw new Error("not expected");
    },
  });

  const handler = getRoute(router, "PUT", "/setup/business-profile");
  const req = createReq({ body: { companyName: "Alpha Studio" } });
  const res = createRes();

  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.canonicalWriteDeferred, true);
  assert.equal(res.body.saved.companyName, "Alpha Studio");
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0][2], "setup.review.updated");
});
