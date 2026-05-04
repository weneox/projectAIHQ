import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createStructuredLogger } from "@aihq/shared-contracts/logger";

import { validateLaunchEvidence } from "../../scripts/check-launch-evidence.mjs";
import { cfg } from "../src/config.js";
import {
  buildApiHealthResponse,
  buildObservabilityHealthStatus,
} from "../src/routes/api/health/builders.js";
import { createStructuredLogEntry } from "../src/utils/logger.js";

function readLaunchEvidence() {
  return JSON.parse(
    readFileSync(
      new URL("../../docs/launch/production-launch-evidence.json", import.meta.url),
      "utf8"
    )
  );
}

function makeEvidenceReadyExcept(evidence, excludedId) {
  return {
    ...evidence,
    items: evidence.items
      .filter((item) => item.id !== excludedId)
      .map((item) => ({
        ...item,
        status: "READY",
        evidence: item.evidence || "test evidence",
        reasonMissing: "",
        approver: "test approver",
      })),
  };
}

test("launch evidence requires P1-006 observability and alerting proof for every launch target", () => {
  const evidence = readLaunchEvidence();
  const item = evidence.items.find((entry) => entry.id === "P1-006");

  assert.ok(item, "P1-006 launch evidence item must exist");
  assert.equal(item.status, "BLOCKED");
  assert.equal(item.blocksLimitedLaunch, true);
  assert.equal(item.blocksPaidLaunch, true);
  assert.equal(item.blocksPublicLaunch, true);
  assert.equal(item.acceptedRiskAllowed, false);
  assert.match(item.evidence, /v1-production-observability\.md/);
  assert.match(item.reasonMissing, /OBS_INCIDENT_OWNER/);
  assert.match(item.reasonMissing, /OBS_INCIDENT_CONTACT/);
  assert.match(item.reasonMissing, /OBS_ALERT_DESTINATION/);
  assert.match(item.reasonMissing, /test alert/i);
  assert.notEqual(item.status, "READY");

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidence, { target });
    assert.equal(result.ok, false, target);
    assert.match(result.errors.join("\n"), /P1-006/, target);
  }
});

test("launch evidence checker fails closed when P1-006 is missing", () => {
  const evidenceWithoutObservability = makeEvidenceReadyExcept(
    readLaunchEvidence(),
    "P1-006"
  );

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidenceWithoutObservability, {
      target,
    });

    assert.equal(result.ok, false, target);
    assert.match(result.errors.join("\n"), /Missing required launch evidence item "P1-006"/);
  }
});

test("health payload exposes observability readiness without leaking alert contacts", async () => {
  const previous = { ...cfg.observability };

  try {
    cfg.observability.incidentOwner = "launch-owner-should-not-leak";
    cfg.observability.incidentContact = "pager-channel-should-not-leak";
    cfg.observability.alertDestination = "alert-route-should-not-leak";
    cfg.observability.alertProvider = "vendor-neutral";
    cfg.observability.alertRunbookUrl =
      "docs/runbooks/v1-production-observability.md";
    cfg.observability.alertEvidenceUrl = "provider-proof-should-not-leak";

    const status = buildObservabilityHealthStatus();
    const response = await buildApiHealthResponse({ db: null });
    const serialized = JSON.stringify(response);

    assert.equal(status.status, "configured");
    assert.equal(response.observability.status, "configured");
    assert.equal(response.observability.safeForPublicHealth, true);
    assert.equal(response.observability.incidentOwnerConfigured, true);
    assert.equal(response.observability.incidentContactConfigured, true);
    assert.equal(response.observability.alertDestinationConfigured, true);
    assert.equal(response.observability.alertRunbookConfigured, true);
    assert.ok(
      response.observability.requiredCoverage.includes(
        "meta_webhook_ingestion_failures"
      )
    );
    assert.ok(
      response.observability.requiredCoverage.includes(
        "website_widget_inbound_failures"
      )
    );
    assert.ok(
      response.observability.requiredCoverage.includes(
        "outbound_manual_reply_failures"
      )
    );
    assert.ok(
      response.observability.requiredCoverage.includes(
        "database_connectivity_readiness"
      )
    );
    assert.ok(
      response.observability.requiredCoverage.includes("launch_smoke_failures")
    );

    assert.doesNotMatch(serialized, /launch-owner-should-not-leak/);
    assert.doesNotMatch(serialized, /pager-channel-should-not-leak/);
    assert.doesNotMatch(serialized, /alert-route-should-not-leak/);
    assert.doesNotMatch(serialized, /provider-proof-should-not-leak/);
  } finally {
    Object.assign(cfg.observability, previous);
  }
});

test("structured observability logs redact secret-like fields", () => {
  const entries = [];
  const logger = createStructuredLogger({ service: "ai-hq-backend" }, (entry) => {
    entries.push(entry);
  });

  logger.error(
    "widget.inbound.failed",
    new Error("send failed token=runtime-secret-should-not-leak"),
    {
      tenantKey: "acme",
      webhookSecret: "runtime-secret-should-not-leak",
      authorization: "Bearer runtime-secret-should-not-leak",
      message: "forward failed authorization=runtime-secret-should-not-leak",
      nested: {
        alertWebhookToken: "runtime-secret-should-not-leak",
        reasonCode: "widget_ingest_failed",
      },
    }
  );

  const serialized = JSON.stringify(entries[0]);
  assert.equal(entries[0].webhookSecret, "[REDACTED]");
  assert.equal(entries[0].authorization, "[REDACTED]");
  assert.equal(entries[0].message, "forward failed authorization=[REDACTED]");
  assert.equal(entries[0].nested.alertWebhookToken, "[REDACTED]");
  assert.equal(entries[0].nested.reasonCode, "widget_ingest_failed");
  assert.equal(entries[0].error.message, "send failed token=[REDACTED]");
  assert.doesNotMatch(serialized, /runtime-secret-should-not-leak/);

  const backendEntry = createStructuredLogEntry({
    level: "error",
    event: "inbox.ingest.failed",
    data: {
      authorization: "Bearer backend-secret-should-not-leak",
      secretSource: "META_WEBHOOK_APP_SECRET",
      secretFingerprint: "sha256:observability",
      message: "failed api_key=backend-secret-should-not-leak",
    },
    error: new Error("secret=backend-secret-should-not-leak"),
  });
  const backendSerialized = JSON.stringify(backendEntry);
  assert.equal(backendEntry.authorization, "[REDACTED]");
  assert.equal(backendEntry.secretSource, "META_WEBHOOK_APP_SECRET");
  assert.equal(backendEntry.secretFingerprint, "sha256:observability");
  assert.equal(backendEntry.message, "failed api_key=[REDACTED]");
  assert.equal(backendEntry.error.message, "secret=[REDACTED]");
  assert.doesNotMatch(backendSerialized, /backend-secret-should-not-leak/);
});

test("v1 observability runbook defines owner, contact, alerts, and first step", () => {
  const runbook = readFileSync(
    new URL("../../docs/runbooks/v1-production-observability.md", import.meta.url),
    "utf8"
  );

  assert.match(runbook, /OBS_INCIDENT_OWNER/);
  assert.match(runbook, /OBS_INCIDENT_CONTACT/);
  assert.match(runbook, /OBS_ALERT_DESTINATION/);
  assert.match(runbook, /First step for every incident/i);
  assert.match(runbook, /health\/readiness/i);
  assert.match(runbook, /Webhook Failures/i);
  assert.match(runbook, /Inbox Not Receiving Messages/i);
  assert.match(runbook, /Database Readiness Failure/i);
  assert.match(runbook, /Widget Smoke Failure/i);
  assert.match(runbook, /High 5xx Or Error Rate/i);
});
