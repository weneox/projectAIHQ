import test from "node:test";
import assert from "node:assert/strict";

import {
  executeMetaActions,
} from "../src/services/actionExecutor.js";
import {
  __test__ as reliabilityTest,
  getRuntimeMetricsSnapshot,
  listExecutionFailures,
  markInboundEventProcessed,
} from "../src/services/runtimeReliability.js";

test("duplicate inbound events are suppressed by dedupe key", () => {
  reliabilityTest.inboundWebhookCache.clear();
  reliabilityTest.metrics.clear();

  const ev = {
    channel: "instagram",
    eventType: "text",
    pageId: "page-1",
    userId: "user-1",
    messageId: "mid-1",
    timestamp: 12345,
  };

  const first = markInboundEventProcessed(ev);
  const second = markInboundEventProcessed(ev);

  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(second.key, reliabilityTest.buildInboundEventKey(ev));
  assert.equal(getRuntimeMetricsSnapshot().meta_duplicate_suppressions_total, 1);
});

test("duplicate passive actions are suppressed without re-execution", async () => {
  reliabilityTest.outboundActionCache.clear();

  const action = {
    type: "handoff",
    tenantKey: "acme",
    meta: {
      threadId: "thread-1",
    },
  };
  const ctx = {
    tenantKey: "acme",
    channel: "instagram",
    threadId: "thread-1",
  };

  const first = await executeMetaActions([action], ctx);
  const second = await executeMetaActions([action], ctx);

  assert.equal(first.results[0]?.ok, true);
  assert.equal(second.results[0]?.meta?.duplicateSuppressed, true);
});

test("terminal execution failures are classified and recorded", async () => {
  reliabilityTest.failureBuffer.clear();
  reliabilityTest.outboundActionCache.clear();

  const result = await executeMetaActions(
    [
      {
        type: "send_message",
        channel: "whatsapp",
        tenantKey: "acme",
      },
    ],
    { tenantKey: "acme" }
  );

  assert.equal(result.ok, false);
  assert.equal(result.results[0]?.meta?.failureClass, "terminal");
  assert.equal(result.results[0]?.meta?.retryable, false);
  assert.equal(listExecutionFailures().length, 1);
});
