import test from "node:test";
import assert from "node:assert/strict";

import {
  assessTenantRuntimeProjectionFreshness,
  buildTenantRuntimeProjection,
  createRuntimeProjectionStaleError,
} from "../src/db/helpers/tenantRuntimeProjection.js";

function buildCanonicalGraph(overrides = {}) {
  return {
    tenant: {
      id: "tenant-1",
      tenant_key: "alpha",
    },
    synthesis: {
      id: "snapshot-1",
    },
    profile: {
      id: "profile-1",
      tenant_id: "tenant-1",
      tenant_key: "alpha",
      company_name: "Alpha Studio",
      summary_short: "Brand strategy studio",
      profile_json: {
        companyName: "Alpha Studio",
        displayName: "Alpha Studio",
        mainLanguage: "en",
        supportedLanguages: ["en"],
      },
    },
    capabilities: {
      id: "capabilities-1",
      tenant_id: "tenant-1",
      tenant_key: "alpha",
      capabilities_json: {
        primaryLanguage: "en",
        supportedLanguages: ["en"],
        replyStyle: "professional",
        replyLength: "medium",
        emojiLevel: "low",
        ctaStyle: "soft",
      },
    },
    contacts: [],
    locations: [],
    hours: [],
    services: [],
    products: [],
    faq: [],
    policies: [],
    socialAccounts: [],
    channels: [],
    mediaAssets: [],
    knowledge: [],
    facts: [],
    channelPolicies: [],
    publishedTruthVersion: {
      id: "truth-version-1",
      business_profile_id: "profile-1",
      business_capabilities_id: "capabilities-1",
      profile_snapshot_json: {
        companyName: "Alpha Studio",
        displayName: "Alpha Studio",
        mainLanguage: "en",
        supportedLanguages: ["en"],
        summaryShort: "Brand strategy studio",
      },
      capabilities_snapshot_json: {
        primaryLanguage: "en",
        supportedLanguages: ["en"],
        replyStyle: "professional",
        replyLength: "medium",
        emojiLevel: "low",
        ctaStyle: "soft",
      },
    },
    ...overrides,
  };
}

test("stale runtime projection is detected when canonical source refs drift", () => {
  const graph = buildCanonicalGraph();
  const expectedProjection = buildTenantRuntimeProjection(graph);

  const freshness = assessTenantRuntimeProjectionFreshness({
    runtimeProjection: {
      id: "runtime-1",
      tenant_id: "tenant-1",
      tenant_key: "alpha",
      status: "ready",
      source_snapshot_id: "snapshot-old",
      source_profile_id: "profile-old",
      source_capabilities_id: "capabilities-old",
      projection_hash: "old-hash",
      metadata_json: {
        publishedTruthVersionId: "truth-version-old",
      },
    },
    graph,
    expectedProjection,
  });

  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.reasons, [
    "source_profile_mismatch",
    "source_capabilities_mismatch",
    "projection_hash_mismatch",
    "published_truth_version_mismatch",
  ]);
  assert.equal(
    createRuntimeProjectionStaleError(freshness).code,
    "TENANT_RUNTIME_PROJECTION_STALE"
  );
});

test("runtime projection is fresh when canonical refs and projection hash match", () => {
  const graph = buildCanonicalGraph();
  const expectedProjection = buildTenantRuntimeProjection(graph);

  const freshness = assessTenantRuntimeProjectionFreshness({
    runtimeProjection: {
      id: "runtime-1",
      tenant_id: "tenant-1",
      tenant_key: "alpha",
      status: "ready",
      source_snapshot_id: "snapshot-1",
      source_profile_id: "profile-1",
      source_capabilities_id: "capabilities-1",
      projection_hash: expectedProjection.projection_hash,
      metadata_json: {
        publishedTruthVersionId: "truth-version-1",
      },
    },
    graph,
    expectedProjection,
  });

  assert.equal(freshness.stale, false);
  assert.equal(freshness.ok, true);
  assert.deepEqual(freshness.reasons, []);
});

test("freshness fails when runtime projection points at a different published truth version", () => {
  const graph = buildCanonicalGraph();
  const expectedProjection = buildTenantRuntimeProjection(graph);

  const freshness = assessTenantRuntimeProjectionFreshness({
    runtimeProjection: {
      id: "runtime-1",
      tenant_id: "tenant-1",
      tenant_key: "alpha",
      status: "ready",
      source_profile_id: "profile-1",
      source_capabilities_id: "capabilities-1",
      projection_hash: expectedProjection.projection_hash,
      metadata_json: {
        publishedTruthVersionId: "truth-version-old",
      },
    },
    graph,
    expectedProjection,
  });

  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.reasons, ["published_truth_version_mismatch"]);
});

test("non-ready runtime projection is treated as stale even when hashes match", () => {
  const graph = buildCanonicalGraph();
  const expectedProjection = buildTenantRuntimeProjection(graph);

  const freshness = assessTenantRuntimeProjectionFreshness({
    runtimeProjection: {
      id: "runtime-1",
      tenant_id: "tenant-1",
      tenant_key: "alpha",
      status: "draft",
      source_snapshot_id: "snapshot-1",
      source_profile_id: "profile-1",
      source_capabilities_id: "capabilities-1",
      projection_hash: expectedProjection.projection_hash,
      metadata_json: {
        publishedTruthVersionId: "truth-version-1",
      },
    },
    graph,
    expectedProjection,
  });

  assert.equal(freshness.stale, true);
  assert.deepEqual(freshness.reasons, ["runtime_status_not_ready"]);
});
