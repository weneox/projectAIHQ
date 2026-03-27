import test from "node:test";
import assert from "node:assert/strict";

import { runSourceSync, __test__ as sourceSyncTest } from "../src/services/sourceSync/index.js";

function buildBase() {
  const finishCalls = [];
  const markErrorCalls = [];

  const source = {
    id: "source-1",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    source_type: "website",
    source_url: "https://example.com",
  };

  const run = {
    id: "run-1",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    metadata_json: {
      requestId: "req-1",
      correlationId: "corr-1",
    },
  };

  const sources = {
    async finishSourceSync(payload) {
      finishCalls.push(payload);
      return { source, run };
    },
    async markSourceSyncError(payload) {
      markErrorCalls.push(payload);
      return { source, run };
    },
  };

  const knowledge = {
    async createCandidatesBulk() {
      return [];
    },
  };

  const fusion = {
    async createObservationsBulk(items) {
      return items;
    },
    async listObservations() {
      return [];
    },
    async createSynthesisSnapshot() {
      return { id: "snapshot-1" };
    },
  };

  return { source, run, sources, knowledge, fusion, finishCalls, markErrorCalls };
}

function buildStageDeps(overrides = {}) {
  return {
    withTimeout: async (task) => task(),
    extractWebsiteSource: async () => ({ finalUrl: "https://example.com/final", crawl: {}, discovery: {} }),
    buildWebsiteSignals: () => ({ website: true }),
    synthesizeBusinessProfile: () => ({
      summaryShort: "Short summary",
      summaryLong: "Long summary",
      supportMode: "chat",
      pricingPolicy: "fixed",
    }),
    buildWebsiteTrustSummary: () => ({ confidence: "high" }),
    isWeakWebsiteExtraction: () => false,
    buildWebsiteExtractionWarnings: () => [],
    buildWebsiteObservations: () => [{ id: "obs-1" }],
    buildWebsiteSyncQualitySummary: () => ({ stage: "extract" }),
    normalizeObservationRecord: (item) => item,
    loadScopedObservations: async () => ({
      observations: [{ id: "obs-1" }],
      scope: "tenant_recent",
    }),
    normalizeSynthesisResult: (value) => value,
    synthesizeTenantBusinessFromObservations: () => ({
      profile: {
        summaryShort: "Short summary",
        summaryLong: "Long summary",
        supportMode: "chat",
        pricingPolicy: "fixed",
      },
      conflicts: [],
      metrics: { completeness: 0.8 },
    }),
    buildCandidateAdmission: () => ({
      allowCandidateCreation: true,
      reason: "",
    }),
    buildCandidatesFromSynthesis: () => [{ id: "candidate-1" }],
    normalizeCandidateRecord: (item) => item,
    buildFinishWarnings: () => ({
      surfacedWarnings: [],
      debugWarnings: [],
      diagnostics: {},
    }),
    persistSynthesisOutputs: async () => ({
      createdCount: 1,
      createdRows: [{ id: "candidate-1" }],
      snapshot: { id: "snapshot-1" },
    }),
    shouldTreatSyncAsPartial: () => false,
    buildSourceSignalPayload: () => ({ summary: "ok" }),
    buildWebsiteTrustSummaryPayload: (value) => value || {},
    dedupeWarnings: (items) => [...new Set(items)],
    safeWebsitePageCount: () => 3,
    classifyWebsitePartialBarrier: () => null,
    finishWebsiteBarrierAsPartial: async () => ({
      ok: true,
      mode: "partial",
      stage: "barrier",
    }),
    ...overrides,
  };
}

test("source sync context preserves run metadata and initializes staged defaults", () => {
  const { source, run, sources, knowledge, fusion } = buildBase();

  const context = sourceSyncTest.createSourceSyncOrchestratorContext({
    db: null,
    source,
    run,
    requestedBy: "worker",
    sources,
    knowledge,
    fusion,
    stageDeps: buildStageDeps(),
  });

  const state = sourceSyncTest.createSourceSyncStageState(context.sourceType);

  assert.equal(context.sourceType, "website");
  assert.equal(context.sourceUrl, "https://example.com");
  assert.equal(context.run.metadata_json.requestId, "req-1");
  assert.equal(context.run.metadata_json.correlationId, "corr-1");
  assert.equal(state.stage, "start");
  assert.equal(state.candidateAdmission.allowCandidateCreation, true);
});

test("staged source sync success preserves finish semantics and persistence output", async () => {
  const { source, run, sources, knowledge, fusion, finishCalls, markErrorCalls } = buildBase();

  const result = await runSourceSync({
    db: null,
    source,
    run,
    requestedBy: "worker",
    sources,
    knowledge,
    fusion,
    stageDeps: buildStageDeps(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "success");
  assert.equal(result.stage, "finish_sync");
  assert.equal(result.candidateCount, 1);
  assert.equal(result.snapshot?.id, "snapshot-1");
  assert.equal(finishCalls.length, 1);
  assert.equal(finishCalls[0].runStatus, "success");
  assert.equal(finishCalls[0].resultSummaryJson.candidateCount, 1);
  assert.equal(markErrorCalls.length, 0);
});

test("unsupported source types still finish as partial through the staged runner", async () => {
  const { run, sources, knowledge, fusion, finishCalls } = buildBase();
  const source = {
    id: "source-2",
    tenant_id: "tenant-1",
    tenant_key: "acme",
    source_type: "pdf",
    source_url: "https://example.com/file.pdf",
  };

  const result = await runSourceSync({
    db: null,
    source,
    run,
    requestedBy: "worker",
    sources,
    knowledge,
    fusion,
    stageDeps: buildStageDeps(),
  });

  assert.equal(result.mode, "partial");
  assert.equal(result.stage, "unsupported_source_type");
  assert.equal(finishCalls.length, 1);
  assert.equal(finishCalls[0].runStatus, "partial");
});

test("website timeout failures still finish as partial with timeout metadata", async () => {
  const { source, run, sources, knowledge, fusion, finishCalls, markErrorCalls } = buildBase();

  const timeoutError = new Error("website extract timed out after 1200ms");
  timeoutError.isTimeout = true;
  timeoutError.timeoutMs = 1200;
  timeoutError.step = "extract";

  const result = await runSourceSync({
    db: null,
    source,
    run,
    requestedBy: "worker",
    sources,
    knowledge,
    fusion,
    stageDeps: buildStageDeps({
      extractWebsiteSource: async () => {
        throw timeoutError;
      },
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, "partial");
  assert.equal(result.stage, "extract");
  assert.ok(result.warnings.some((item) => item.includes("website_extract_timeout")));
  assert.equal(finishCalls.length, 1);
  assert.equal(finishCalls[0].runStatus, "partial");
  assert.equal(markErrorCalls.length, 0);
});

test("quarantined weak claims surface explicit warnings and skip promotion", async () => {
  const { source, run, sources, knowledge, fusion } = buildBase();

  const result = await runSourceSync({
    db: null,
    source,
    run,
    requestedBy: "worker",
    sources,
    knowledge,
    fusion,
    stageDeps: buildStageDeps({
      synthesizeTenantBusinessFromObservations: () => ({
        profile: {
          summaryShort: "Noisy scrape summary",
        },
        conflicts: [],
        governance: {
          quarantinedClaims: [
            {
              claimType: "summary_short",
              reasons: ["weak_only_sources", "low_score"],
            },
          ],
        },
        selectedClaims: {
          summary_short: [
            {
              valueText: "Noisy scrape summary",
              score: 0.41,
              evidence: [{ source_type: "google_maps" }],
              governance: {
                quarantine: true,
                quarantineReasons: ["weak_only_sources", "low_score"],
              },
              status: "quarantined",
            },
          ],
        },
      }),
      buildCandidatesFromSynthesis: () => [],
      persistSynthesisOutputs: async ({ synthesis }) => ({
        createdCount: 0,
        createdRows: [],
        snapshot: {
          id: "snapshot-1",
          metadataJson: {
            governance: synthesis?.governance,
          },
        },
      }),
    }),
  });

  assert.equal(result.ok, true);
  assert.equal(result.candidateCount, 0);
  assert.ok(
    result.rawWarnings.some((item) =>
      item.includes("weak or conflicting claim(s) were quarantined from candidate promotion")
    )
  );
});
