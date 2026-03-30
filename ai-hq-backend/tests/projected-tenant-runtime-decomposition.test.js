import test from "node:test";
import assert from "node:assert/strict";

import {
  healthAffectsConsumerSurface,
  resolveConsumerSurface,
} from "../src/services/projectedRuntime/consumerSurface.js";
import { shouldBlockForProjectionHealth } from "../src/services/projectedRuntime/healthPolicy.js";

test("consumer surface treats twilio and voice as the same affected surface", () => {
  assert.equal(healthAffectsConsumerSurface(["voice"], "twilio"), true);
  assert.equal(healthAffectsConsumerSurface(["twilio"], "voice"), true);
});

test("consumer surface treats meta provider channels as the same affected surface family", () => {
  assert.equal(healthAffectsConsumerSurface(["instagram"], "meta"), true);
  assert.equal(healthAffectsConsumerSurface(["meta"], "messenger"), true);
  assert.equal(healthAffectsConsumerSurface(["facebook"], "voice"), false);
});

test("consumer surface resolves meta when operational identity or channel type points to meta", () => {
  assert.equal(
    resolveConsumerSurface({
      matchedChannel: {
        channel_type: "instagram",
      },
      operationalChannels: {
        voice: {
          available: true,
          provider: "twilio",
        },
      },
    }),
    "meta"
  );
});

test("blocked meta health remains fail-closed when the affected surface is unrelated", () => {
  assert.equal(
    shouldBlockForProjectionHealth({
      authority: {
        available: true,
        source: "approved_runtime_projection",
      },
      projectionId: "projection-1",
      health: {
        status: "blocked",
        reasonCode: "provider_secret_missing",
        affectedSurfaces: ["voice"],
      },
      consumerSurface: "meta",
      operationalChannels: {
        meta: {
          ready: true,
          pageId: "page-1",
        },
      },
      providerSecrets: {
        page_access_token: "secret",
      },
    }),
    false
  );
});

test("blocked meta health allows recovered operational meta consumers for meta-only blockers", () => {
  assert.equal(
    shouldBlockForProjectionHealth({
      authority: {
        available: true,
        source: "approved_runtime_projection",
      },
      projectionId: "projection-1",
      health: {
        status: "blocked",
        reasonCode: "provider_secret_missing",
        affectedSurfaces: ["meta"],
      },
      consumerSurface: "meta",
      operationalChannels: {
        meta: {
          ready: true,
          pageId: "page-1",
        },
      },
      providerSecrets: {
        page_access_token: "secret",
      },
    }),
    false
  );
});
