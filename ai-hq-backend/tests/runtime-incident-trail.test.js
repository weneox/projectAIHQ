import test from "node:test";
import assert from "node:assert/strict";

import {
  __test__ as runtimeIncidentHelpersTest,
  createRuntimeIncidentHelpers,
} from "../src/db/helpers/runtimeIncidents.js";
import {
  listRecentRuntimeIncidents,
  pruneRuntimeIncidentTrail,
  persistRuntimeIncident,
} from "../src/services/runtimeIncidentTrail.js";
import { __test__ as incidentsRouteTest } from "../src/routes/api/incidents/index.js";

test("runtime incident helper records a sanitized durable incident shape", async () => {
  const calls = [];
  const db = {
    async query(sql, args = []) {
      calls.push({ sql, args });
      return {
        rows: [
          {
            id: "incident-1",
            service: args[0],
            area: args[1],
            severity: args[2],
            code: args[3],
            reason_code: args[4],
            request_id: args[5],
            correlation_id: args[6],
            tenant_id: args[7],
            tenant_key: args[8],
            detail_summary: args[9],
            context: JSON.parse(args[10]),
            occurred_at: args[11],
            created_at: "2026-03-26T00:00:00.000Z",
          },
        ],
      };
    },
  };

  const helpers = createRuntimeIncidentHelpers({ db });
  const incident = await helpers.recordIncident({
    service: "twilio-voice-backend",
    area: "voice_public",
    severity: "warning",
    code: "voice_operator_join_failed",
    reasonCode: "tenant_config_not_found",
    tenantKey: "ACME",
    detailSummary:
      "x".repeat(400),
    context: {
      status: 404,
      safe: true,
      nested: { nope: true },
      token: "y".repeat(500),
    },
    occurredAt: "2026-03-26T01:02:03.000Z",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /insert into runtime_incidents/i);
  assert.equal(incident.service, "twilio-voice-backend");
  assert.equal(incident.severity, "warn");
  assert.equal(incident.tenantKey, "acme");
  assert.equal(incident.detailSummary.length, 320);
  assert.deepEqual(incident.context, {
    status: 404,
    safe: true,
    token: "y".repeat(240),
  });
});

test("runtime incident service maps runtime signal fields into durable incident rows", async () => {
  const db = {
    async query(_sql, args = []) {
      return {
        rows: [
          {
            id: "incident-2",
            service: args[0],
            area: args[1],
            severity: args[2],
            code: args[3],
            reason_code: args[4],
            request_id: args[5],
            correlation_id: args[6],
            tenant_id: args[7],
            tenant_key: args[8],
            detail_summary: args[9],
            context: JSON.parse(args[10]),
            occurred_at: args[11],
            created_at: "2026-03-26T00:00:00.000Z",
          },
        ],
      };
    },
  };

  const incident = await persistRuntimeIncident({
    db,
    incident: {
      service: "meta-bot-backend",
      category: "execution",
      level: "error",
      code: "meta_execution_failure",
      reasonCode: "retryable",
      message: "provider timeout",
      requestId: "req-1",
      correlationId: "corr-1",
      tenantKey: "acme",
      context: {
        status: 503,
        retryable: true,
      },
      ts: "2026-03-26T02:00:00.000Z",
    },
  });

  assert.equal(incident.service, "meta-bot-backend");
  assert.equal(incident.area, "execution");
  assert.equal(incident.severity, "error");
  assert.equal(incident.requestId, "req-1");
  assert.equal(incident.correlationId, "corr-1");
  assert.equal(incident.context.status, 503);
});

test("recent durable incident listing can be filtered by service", async () => {
  const db = {
    async query(_sql, args = []) {
      return {
        rows: [
          {
            id: "incident-3",
            service: args[0],
            area: "voice_sync",
            severity: "warn",
            code: "voice_sync_request_failed",
            reason_code: "request_failed",
            request_id: "req-2",
            correlation_id: "corr-2",
            tenant_id: null,
            tenant_key: "acme",
            detail_summary: "voice sync timeout",
            context: { status: 504 },
            occurred_at: "2026-03-26T03:00:00.000Z",
            created_at: "2026-03-26T03:00:00.000Z",
          },
        ],
      };
    },
  };

  const incidents = await listRecentRuntimeIncidents({
    db,
    service: "twilio-voice-backend",
    limit: 5,
  });

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].service, "twilio-voice-backend");
  assert.equal(incidents[0].code, "voice_sync_request_failed");
});

test("runtime incident helper normalizes list filters for service, severity, reason, and time window", () => {
  const filters = runtimeIncidentHelpersTest.normalizeFilters({
    limit: 500,
    service: "twilio-voice-backend",
    severity: "warning",
    reasonCode: "voice_sync_request_failed",
    sinceHours: 9999,
  });

  assert.deepEqual(filters, {
    limit: 100,
    service: "twilio-voice-backend",
    severity: "warn",
    reasonCode: "voice_sync_request_failed",
    sinceHours: 720,
  });
});

test("runtime incident trail pruning enforces age and capped row retention", async () => {
  const calls = [];
  const db = {
    async query(sql, args = []) {
      calls.push({ sql, args });
      return {
        rowCount: calls.length === 1 ? 7 : 3,
      };
    },
  };

  const result = await pruneRuntimeIncidentTrail({
    db,
    retainDays: 21,
    maxRows: 9000,
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].sql, /delete from runtime_incidents/i);
  assert.match(calls[1].sql, /offset \$1/i);
  assert.equal(result.deletedByAge, 7);
  assert.equal(result.deletedByCount, 3);
  assert.equal(result.retainDays, 21);
  assert.equal(result.maxRows, 9000);
});

test("incident route retention policy stays explicit and bounded", () => {
  const policy = incidentsRouteTest.getIncidentRetentionPolicy();
  assert.deepEqual(policy, {
    retainDays: 14,
    maxRows: 5000,
    pruneIntervalHours: 6,
  });
});
