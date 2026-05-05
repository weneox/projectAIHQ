import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import {
  assertTenantQueryAllowed,
  createTenantGuardedDb,
  runWithTenantContext,
  runWithSystemDbContext,
  __test__ as tenantContextTests,
} from "../src/db/tenantContext.js";
import { createTenantSourcesHelpers } from "../src/db/helpers/tenantSources.js";
import {
  getSetupReviewSessionById,
  listSetupReviewSessionSources,
  markSetupReviewSessionProcessing,
  readSetupReviewDraft,
} from "../src/db/helpers/tenantSetupReview.js";
import { createStructuredLogEntry } from "../src/utils/logger.js";
import {
  expireStaleOutboundReservations,
  listRetryableOutboundAttempts,
} from "../src/routes/api/inbox/repository/outboundAttempts.js";
import {
  reconcileExpiredExternalSideEffectReservations,
} from "../src/db/helpers/externalIdempotency.js";
import {
  reconcileStaleTenantUsageReservations,
} from "../src/db/helpers/tenantUsage.js";
import { apiResponseStandardMiddleware } from "../src/utils/apiResponse.js";
import {
  inboundWebhookIdempotencyKey,
  outboundDeliveryIdempotencyKey,
} from "../src/utils/idempotency.js";
import { buildQueueIdempotencyKey } from "../src/services/queue.js";
import { __test__ as apiRouteTests } from "../src/routes/api/index.js";
import { validateLaunchEvidence } from "../../scripts/check-launch-evidence.mjs";

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
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

function getWorkflowJob(workflow, jobName) {
  const jobMatches = [...workflow.matchAll(/^  [A-Za-z0-9_-]+:\s*$/gm)];
  const jobIndex = jobMatches.findIndex((match) =>
    match[0].trim().startsWith(`${jobName}:`)
  );

  assert.notEqual(jobIndex, -1, `workflow job ${jobName} missing`);

  const start = jobMatches[jobIndex].index;
  const end =
    jobIndex + 1 < jobMatches.length
      ? jobMatches[jobIndex + 1].index
      : workflow.length;
  return workflow.slice(start, end);
}

function readSchemaSql() {
  const schemaDir = new URL("../src/db/schema/", import.meta.url);
  return readdirSync(schemaDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(new URL(file, schemaDir), "utf8"));
}

function compactSql(sql = "") {
  return String(sql || "").replace(/\s+/g, " ").trim().toLowerCase();
}

test("tenant DB guard blocks tenant-table queries without context", () => {
  assert.throws(
    () =>
      assertTenantQueryAllowed(
        "select * from inbox_messages where id = $1::uuid",
        ["11111111-1111-4111-8111-111111111111"]
      ),
    /tenant context/i
  );
});

test("tenant DB guard requires an explicit tenant predicate and binding", () => {
  runWithTenantContext({ tenantId: "tenant-1", tenantKey: "acme" }, () => {
    assert.throws(
      () =>
        assertTenantQueryAllowed(
          "select * from inbox_messages where id = $1::uuid",
          ["11111111-1111-4111-8111-111111111111"]
        ),
      /tenant predicate/i
    );

    assert.throws(
      () =>
        assertTenantQueryAllowed(
          "select * from inbox_messages where tenant_key = $1::text",
          ["other"]
        ),
      /tenant binding/i
    );

    assert.equal(
      assertTenantQueryAllowed(
        "select * from inbox_messages where tenant_key = $1::text",
        ["acme"]
      ),
      true
    );
  });
});

test("tenant DB guard allows explicit system DB contexts", () => {
  runWithSystemDbContext("test", () => {
    assert.equal(
      assertTenantQueryAllowed("select * from inbox_messages where id = $1::uuid", [
        "11111111-1111-4111-8111-111111111111",
      ]),
      true
    );
  });
});

test("durable execution control-plane scans require explicit system context", () => {
  const queueClaimSql = `
    with candidate as (
      select id
      from durable_executions
      where status = any($1::text[])
        and tenant_id is not null
        and nullif(btrim(tenant_key), '') is not null
      for update skip locked
      limit 1
    )
    update durable_executions d
    set status = 'in_progress'
    from candidate
    where d.id = candidate.id
    returning d.*
  `;

  assert.throws(
    () => assertTenantQueryAllowed(queueClaimSql, [["pending", "retryable"]]),
    /tenant context/i
  );

  runWithSystemDbContext("durable_worker_claim_test", () => {
    assert.equal(
      assertTenantQueryAllowed(queueClaimSql, [["pending", "retryable"]]),
      true
    );
  });
});

test("source sync worker helpers bind active tenant context for ID-based tenant rows", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const sourceId = "22222222-2222-4222-8222-222222222222";
  const runId = "33333333-3333-4333-8333-333333333333";
  const seen = [];

  const db = createTenantGuardedDb({
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      seen.push({ text, params });

      if (text.includes("from tenant_sources")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$2/i);
        assert.deepEqual(params, [sourceId, tenantId]);
        return {
          rows: [
            {
              id: sourceId,
              tenant_id: tenantId,
              tenant_key: "acme",
              source_type: "website",
              source_key: "website:acme",
              display_name: "Acme Website",
              status: "connected",
              auth_status: "authorized",
              sync_status: "idle",
            },
          ],
        };
      }

      if (text.startsWith("update tenant_sources")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$25/i);
        assert.equal(params[0], sourceId);
        assert.equal(params[24], tenantId);
        return {
          rows: [
            {
              id: sourceId,
              tenant_id: tenantId,
              tenant_key: "acme",
              source_type: "website",
              source_key: "website:acme",
              display_name: "Acme Website",
              status: "connected",
              auth_status: "authorized",
              sync_status: "syncing",
            },
          ],
        };
      }

      if (text.includes("from tenant_source_sync_runs")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$2/i);
        assert.deepEqual(params, [runId, tenantId]);
        return {
          rows: [
            {
              id: runId,
              tenant_id: tenantId,
              tenant_key: "acme",
              source_id: sourceId,
              run_type: "sync",
              trigger_type: "manual",
              status: "running",
              attempt_count: 1,
              max_attempts: 3,
            },
          ],
        };
      }

      if (text.startsWith("update tenant_source_sync_runs")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$33/i);
        assert.equal(params[0], runId);
        assert.equal(params[32], tenantId);
        return {
          rows: [
            {
              id: runId,
              tenant_id: tenantId,
              tenant_key: "acme",
              source_id: sourceId,
              run_type: "sync",
              trigger_type: "manual",
              status: "success",
              attempt_count: 1,
              max_attempts: 3,
            },
          ],
        };
      }

      throw new Error(`unexpected source sync query: ${text}`);
    },
  });
  const sources = createTenantSourcesHelpers({ db });

  await runWithTenantContext({ tenantId, tenantKey: "acme" }, async () => {
    await sources.markSourceSyncStarted(sourceId, { updatedBy: "source-sync-worker" });
    await sources.markSyncRunFinished(runId, { status: "success" });
  });

  assert.equal(seen.length, 4);
});

test("source sync claim does not mutate tenant source rows in system context", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const sourceId = "22222222-2222-4222-8222-222222222222";
  const runId = "33333333-3333-4333-8333-333333333333";
  const seen = [];

  const db = createTenantGuardedDb({
    async query(sql, params = []) {
      const text = compactSql(sql);
      seen.push({ text, params });

      if (text.includes("from tenant_sources") || text.startsWith("update tenant_sources")) {
        throw new Error("claimNextSyncRun must not update tenant source rows");
      }

      if (text.includes("with claimable as") && text.includes("update tenant_source_sync_runs")) {
        return {
          rows: [
            {
              id: runId,
              tenant_id: tenantId,
              tenant_key: "acme",
              source_id: sourceId,
              run_type: "sync",
              trigger_type: "manual",
              status: "running",
              attempt_count: 1,
              max_attempts: 3,
            },
          ],
        };
      }

      throw new Error(`unexpected source sync claim query: ${text}`);
    },
  });

  const sources = createTenantSourcesHelpers({ db });
  const claimed = await runWithSystemDbContext("source_sync_worker_claim_test", () =>
    sources.claimNextSyncRun({
      runnerKey: "source-sync-worker:test",
      leaseToken: "source-sync-lease:test",
      leaseMs: 60_000,
    })
  );

  assert.equal(claimed?.id, runId);
  assert.equal(seen.length, 1);
});

test("source sync ID helpers cannot read or update tenant A rows under tenant B context", async () => {
  const tenantA = "11111111-1111-4111-8111-111111111111";
  const tenantB = "99999999-9999-4999-8999-999999999999";
  const sourceId = "22222222-2222-4222-8222-222222222222";
  const runId = "33333333-3333-4333-8333-333333333333";
  const seen = [];

  const db = createTenantGuardedDb({
    async query(sql, params = []) {
      const text = compactSql(sql);
      seen.push({ text, params });

      if (text.includes("from tenant_sources")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$2/i);
        return {
          rows:
            params[0] === sourceId && params[1] === tenantA
              ? [
                  {
                    id: sourceId,
                    tenant_id: tenantA,
                    tenant_key: "acme",
                    source_type: "website",
                    source_key: "website:acme",
                    display_name: "Acme Website",
                    status: "connected",
                    auth_status: "authorized",
                    sync_status: "idle",
                  },
                ]
              : [],
        };
      }

      if (text.startsWith("update tenant_sources")) {
        throw new Error("tenant B must not update tenant A source rows");
      }

      if (text.includes("from tenant_source_sync_runs")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$2/i);
        return {
          rows:
            params[0] === runId && params[1] === tenantA
              ? [
                  {
                    id: runId,
                    tenant_id: tenantA,
                    tenant_key: "acme",
                    source_id: sourceId,
                    run_type: "sync",
                    trigger_type: "manual",
                    status: "running",
                    attempt_count: 1,
                    max_attempts: 3,
                  },
                ]
              : [],
        };
      }

      if (text.startsWith("update tenant_source_sync_runs")) {
        throw new Error("tenant B must not update tenant A source sync runs");
      }

      throw new Error(`unexpected source sync query: ${text}`);
    },
  });
  const sources = createTenantSourcesHelpers({ db });

  await runWithTenantContext({ tenantId: tenantB, tenantKey: "other" }, async () => {
    assert.equal(await sources.getSourceById(sourceId), null);
    assert.equal(
      await sources.markSourceSyncStarted(sourceId, { updatedBy: "source-sync-worker" }),
      null
    );
    assert.equal(await sources.markSyncRunFinished(runId, { status: "success" }), null);
  });

  assert.ok(seen.every((entry) => entry.params.includes(tenantB)));
});

test("setup review status helpers bind active tenant context for source sync review rows", async () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  const sessionId = "44444444-4444-4444-8444-444444444444";
  const seen = [];

  const client = createTenantGuardedDb({
    async query(sql, params = []) {
      const text = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
      seen.push({ text, params });

      if (text.startsWith("select * from public.tenant_setup_review_sessions")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$2/i);
        assert.deepEqual(params, [sessionId, tenantId]);
        return {
          rows: [
            {
              id: sessionId,
              tenant_id: tenantId,
              status: "draft",
              mode: "setup",
              current_step: "source_sync",
            },
          ],
        };
      }

      if (text.startsWith("update public.tenant_setup_review_sessions")) {
        assert.match(text, /where id = \$\d+\s+and tenant_id = \$\d+/i);
        assert.equal(params.at(-2), sessionId);
        assert.equal(params.at(-1), tenantId);
        return {
          rows: [
            {
              id: sessionId,
              tenant_id: tenantId,
              status: "processing",
              mode: "setup",
              current_step: "source_sync",
            },
          ],
        };
      }

      if (text.startsWith("insert into public.tenant_setup_review_events")) {
        assert.equal(params[0], sessionId);
        assert.equal(params[1], tenantId);
        return {
          rows: [
            {
              id: "55555555-5555-4555-8555-555555555555",
              session_id: sessionId,
              tenant_id: tenantId,
              event_type: params[2],
              payload: JSON.parse(params[3] || "{}"),
            },
          ],
        };
      }

      throw new Error(`unexpected setup review query: ${text}`);
    },
  });

  await runWithTenantContext({ tenantId, tenantKey: "acme" }, () =>
    markSetupReviewSessionProcessing(
      sessionId,
      {
        currentStep: "source_sync",
        payload: { runId: "run-1" },
      },
      client
    )
  );

  assert.equal(seen.length, 3);
});

test("setup review ID helpers cannot read or update tenant A rows under tenant B context", async () => {
  const tenantA = "11111111-1111-4111-8111-111111111111";
  const tenantB = "99999999-9999-4999-8999-999999999999";
  const sessionId = "44444444-4444-4444-8444-444444444444";
  const sourceId = "22222222-2222-4222-8222-222222222222";
  const draftId = "66666666-6666-4666-8666-666666666666";
  const seen = [];

  const client = createTenantGuardedDb({
    async query(sql, params = []) {
      const text = compactSql(sql);
      seen.push({ text, params });

      if (text.startsWith("select * from public.tenant_setup_review_sessions")) {
        assert.match(text, /where id = \$1\s+and tenant_id = \$2/i);
        return {
          rows:
            params[0] === sessionId && params[1] === tenantA
              ? [
                  {
                    id: sessionId,
                    tenant_id: tenantA,
                    status: "draft",
                    mode: "setup",
                    current_step: "source_sync",
                  },
                ]
              : [],
        };
      }

      if (text.startsWith("update public.tenant_setup_review_sessions")) {
        throw new Error("tenant B must not update tenant A setup review sessions");
      }

      if (text.startsWith("select * from public.tenant_setup_review_session_sources")) {
        assert.match(text, /where session_id = \$1\s+and tenant_id = \$2/i);
        return {
          rows:
            params[0] === sessionId && params[1] === tenantA
              ? [
                  {
                    id: sourceId,
                    session_id: sessionId,
                    tenant_id: tenantA,
                    source_id: sourceId,
                    source_type: "website",
                    role: "primary",
                  },
                ]
              : [],
        };
      }

      if (text.startsWith("select * from public.tenant_setup_review_drafts")) {
        assert.match(text, /where session_id = \$1\s+and tenant_id = \$2/i);
        return {
          rows:
            params[0] === sessionId && params[1] === tenantA
              ? [
                  {
                    id: draftId,
                    session_id: sessionId,
                    tenant_id: tenantA,
                    draft_payload: {},
                    business_profile: {},
                    capabilities: {},
                    services: [],
                    knowledge_items: [],
                    channels: [],
                  },
                ]
              : [],
        };
      }

      if (text.startsWith("insert into public.tenant_setup_review_events")) {
        throw new Error("tenant B must not write tenant A setup review events");
      }

      throw new Error(`unexpected setup review query: ${text}`);
    },
  });

  await runWithTenantContext({ tenantId: tenantB, tenantKey: "other" }, async () => {
    assert.equal(await getSetupReviewSessionById(sessionId, client), null);
    assert.deepEqual(await listSetupReviewSessionSources(sessionId, client), []);
    assert.equal(
      await readSetupReviewDraft({ sessionId, tenantId: tenantA }, client),
      null
    );
    assert.equal(
      await markSetupReviewSessionProcessing(
        sessionId,
        { currentStep: "source_sync", payload: { runId: "run-1" } },
        client
      ),
      null
    );
  });

  assert.ok(seen.every((entry) => entry.params.includes(tenantB)));
});

test("critical multi-tenant tables are registered as tenant-scoped", () => {
  const scoped = new Set(tenantContextTests.TENANT_SCOPED_TABLES);
  for (const table of [
    "inbox_messages",
    "inbox_threads",
    "proposals",
    "jobs",
    "inbox_outbound_attempts",
    "tenant_profiles",
    "tenant_voice_settings",
    "tenant_business_runtime_projection",
    "tenant_setup_review_drafts",
    "voice_calls",
    "content_items",
  ]) {
    assert.equal(scoped.has(table), true, `${table} must be tenant guarded`);
    assert.equal(
      tenantContextTests.SYSTEM_LEVEL_TABLES.includes(table),
      false,
      `${table} must not bypass tenant guard as a system table`
    );
  }
});

test("tenant DB guard coverage follows tenant-shaped schema tables", () => {
  const discovered = new Set(
    readSchemaSql().flatMap((sql) =>
      tenantContextTests.discoverTenantShapedTablesFromSql(sql)
    )
  );
  const scoped = new Set(tenantContextTests.TENANT_SCOPED_TABLES);
  const systemExempt = new Set(
    tenantContextTests.TENANT_CONTEXT_EXEMPT_SYSTEM_TABLES
  );

  assert.ok(discovered.size > 40, "schema discovery must find tenant-shaped tables");

  const missing = [...discovered]
    .filter((table) => !scoped.has(table) && !systemExempt.has(table))
    .sort();
  assert.deepEqual(
    missing,
    [],
    `tenant-shaped schema tables missing guard coverage: ${missing.join(", ")}`
  );

  for (const table of scoped) {
    assert.equal(
      tenantContextTests.SYSTEM_LEVEL_TABLES.includes(table),
      false,
      `${table} must not bypass tenant guard as a system table`
    );
  }

  for (const table of systemExempt) {
    assert.equal(
      tenantContextTests.SYSTEM_LEVEL_TABLES.includes(table),
      true,
      `${table} must be explicit when exempted from tenant-scoped guard checks`
    );
  }
});

test("tenant DB guard blocks mixed system plus tenant-shaped joins without context", () => {
  assert.throws(
    () =>
      assertTenantQueryAllowed(
        `select t.id, tp.profile_json
         from tenants t
         left join tenant_profiles tp on tp.tenant_id = t.id
         where t.tenant_key = $1`,
        ["acme"]
      ),
    /tenant context/i
  );

  assert.throws(
    () =>
      assertTenantQueryAllowed(
        `select *
         from public."tenants" t
         join public."tenant_profiles" tp on tp."tenant_id" = t."id"
         where tp."tenant_key" = $1::text`,
        ["acme"]
      ),
    /tenant context/i
  );
});

test("tenant DB guard fails closed for unknown tenant namespace tables", () => {
  assert.throws(
    () =>
      assertTenantQueryAllowed(
        `select *
         from tenants t
         join tenant_new_runtime_state s on s.tenant_id = t.id
         where t.tenant_key = $1`,
        ["acme"]
      ),
    /tenant context/i
  );
});

test("tenant DB guard still allows valid system-only queries", () => {
  assert.equal(
    assertTenantQueryAllowed(
      "select id, tenant_key from tenants where tenant_key = $1::text",
      ["acme"]
    ),
    true
  );
  assert.equal(
    assertTenantQueryAllowed(
      "select version, checksum from schema_migrations order by version desc limit 1",
      []
    ),
    true
  );
});

test("tenant DB guard allows realistic tenant-scoped SQL with tenant context", () => {
  const tenantId = "11111111-1111-4111-8111-111111111111";
  runWithTenantContext({ tenantId, tenantKey: "acme" }, () => {
    assert.equal(
      assertTenantQueryAllowed(
        `select tp.*
         from public."tenant_profiles" tp
         join tenants t on t.id = tp.tenant_id
         where tp.tenant_key = $1::text`,
        ["acme"]
      ),
      true
    );

    assert.equal(
      assertTenantQueryAllowed(
        `insert into tenant_profiles (tenant_id, tenant_key, profile_json)
         values ($1::uuid, $2::text, $3::jsonb)`,
        [tenantId, "acme", "{}"]
      ),
      true
    );

    assert.equal(
      assertTenantQueryAllowed(
        `update public.tenant_profiles
         set profile_json = $2::jsonb
         where tenant_id = $1::uuid`,
        [tenantId, "{}"]
      ),
      true
    );

    assert.equal(
      assertTenantQueryAllowed(
        `delete from public."tenant_profiles"
         where tenant_key = $1::text`,
        ["acme"]
      ),
      true
    );
  });
});

test("API response middleware maps ok false payloads away from HTTP 200", () => {
  const req = { requestId: "req-1" };
  const res = createMockRes();
  apiResponseStandardMiddleware(req, res, () => {});

  res.json({
    ok: false,
    error: "tenant not found",
  });

  assert.equal(res.statusCode, 404);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.requestId, "req-1");
  assert.equal(res.body.code, "request_failed");
});

test("idempotency helpers are stable and scoped by namespace", () => {
  const inboundA = inboundWebhookIdempotencyKey({
    tenantKey: "acme",
    channel: "instagram",
    externalThreadId: "thread-1",
    externalMessageId: "msg-1",
  });
  const inboundB = inboundWebhookIdempotencyKey({
    externalMessageId: "msg-1",
    externalThreadId: "thread-1",
    channel: "instagram",
    tenantKey: "acme",
  });
  const outbound = outboundDeliveryIdempotencyKey({
    tenantKey: "acme",
    channel: "instagram",
    threadId: "thread-1",
    messageId: "msg-1",
  });

  assert.equal(inboundA, inboundB);
  assert.notEqual(inboundA, outbound);
});

test("queue idempotency key is stable across property order", () => {
  assert.equal(
    buildQueueIdempotencyKey({ tenantKey: "acme", actionType: "x", targetId: "1" }),
    buildQueueIdempotencyKey({ targetId: "1", actionType: "x", tenantKey: "acme" })
  );
});

test("authenticated API rejects client identity override attempts", () => {
  const req = {
    requestId: "req-identity",
    originalUrl: "/api/settings",
    headers: {
      "x-user-id": "attacker",
    },
    body: {},
    query: {},
    auth: {
      userId: "user-1",
      identityId: "identity-1",
      membershipId: "membership-1",
    },
    log: {
      warn() {},
    },
  };
  const res = createMockRes();
  let nextCalled = false;

  apiRouteTests.enforceServerControlledIdentityMiddleware(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "client_identity_override_rejected");
});

test("structured logs expose production-required reliability fields", () => {
  const entry = createStructuredLogEntry({
    level: "info",
    event: "outbound.send.finalized",
    context: {
      tenantId: "11111111-1111-4111-8111-111111111111",
      requestId: "req-123",
    },
    data: {
      operationType: "outbound_execution",
      executionState: "sent",
    },
  });

  assert.equal(entry.tenant_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(entry.request_id, "req-123");
  assert.equal(entry.operation_type, "outbound_execution");
  assert.equal(entry.execution_state, "sent");
});

test("release gate requires Website lane smoke for production deployment", () => {
  const workflow = readFileSync(
    new URL("../../.github/workflows/release-gate.yml", import.meta.url),
    "utf8"
  );
  const validationDeployPreflight = getWorkflowJob(
    workflow,
    "validation-deploy-security-preflight"
  );
  const limitedApproval = getWorkflowJob(workflow, "limited-pilot-approval");
  const publicApproval = getWorkflowJob(workflow, "public-launch-approval");
  const frontendDeploy = getWorkflowJob(
    workflow,
    "trigger-ai-hq-frontend-cloudflare-pages-deploy"
  );
  const backendDeploy = getWorkflowJob(
    workflow,
    "trigger-ai-hq-backend-railway-deploy"
  );

  assert.match(workflow, /POSTDEPLOY_REQUIRE_WEBSITE_LANE:\s*"1"/);
  assert.match(workflow, /PROD_SPINE_REQUIRE_WEBSITE_LANE:\s*"1"/);
  assert.doesNotMatch(workflow, /POSTDEPLOY_REQUIRE_WEBSITE_LANE:\s*"0"/);
  assert.doesNotMatch(workflow, /PROD_SPINE_REQUIRE_WEBSITE_LANE:\s*"0"/);

  assert.match(frontendDeploy, /validation-deploy-security-preflight/);
  assert.match(backendDeploy, /validation-deploy-security-preflight/);
  assert.doesNotMatch(frontendDeploy, /public-launch-approval/);
  assert.doesNotMatch(backendDeploy, /public-launch-approval/);
  assert.doesNotMatch(frontendDeploy, /limited-pilot-approval/);
  assert.doesNotMatch(backendDeploy, /limited-pilot-approval/);

  assert.doesNotMatch(
    validationDeployPreflight,
    /npm run launch:evidence:check/
  );
  assert.match(
    validationDeployPreflight,
    /Launch evidence approval.*not evaluated here/
  );
  assert.doesNotMatch(validationDeployPreflight, /production-launch-evidence\.json/);

  assert.match(limitedApproval, /LAUNCH_GATE_TARGET:\s*limited/);
  assert.match(limitedApproval, /APP_ENV:\s*production/);
  assert.match(limitedApproval, /NODE_ENV:\s*production/);
  assert.match(limitedApproval, /npm run launch:evidence:check/);

  assert.match(publicApproval, /LAUNCH_GATE_TARGET:\s*public/);
  assert.match(publicApproval, /APP_ENV:\s*production/);
  assert.match(publicApproval, /NODE_ENV:\s*production/);
  assert.match(publicApproval, /npm run launch:evidence:check/);

  assert.doesNotMatch(workflow, /git\s+add\s+docs\/launch\/production-launch-evidence\.json/);
  assert.doesNotMatch(workflow, /status.*READY/);
  assert.match(workflow, /Strict website lane tenant smoke \| \\`true\\`/);
});

test("production launch evidence supports READY proof and BLOCKED gates safely", () => {
  const evidence = JSON.parse(
    readFileSync(
      new URL("../../docs/launch/production-launch-evidence.json", import.meta.url),
      "utf8"
    )
  );

  assert.equal(Array.isArray(evidence.items), true);

  for (const item of evidence.items) {
    for (const field of [
      "id",
      "item",
      "owner",
      "status",
      "evidence",
      "reasonMissing",
      "date",
      "approver",
      "blocksLimitedLaunch",
      "blocksPaidLaunch",
      "blocksPublicLaunch",
    ]) {
      assert.equal(field in item, true, `${item.id} missing ${field}`);
    }

    assert.ok(
      ["READY", "BLOCKED"].includes(item.status),
      `${item.id} must be READY or BLOCKED`
    );

    if (item.status === "BLOCKED") {
      assert.match(
        String(item.reasonMissing || ""),
        /\S/,
        `${item.id} is BLOCKED without reasonMissing`
      );
      assert.equal(
        [
          item.blocksLimitedLaunch,
          item.blocksPaidLaunch,
          item.blocksPublicLaunch,
        ].some(Boolean),
        true,
        `${item.id} is BLOCKED but does not block any launch target`
      );
    }

    if (item.status === "READY") {
      assert.match(
        String(item.evidence || ""),
        /\S/,
        `${item.id} is READY without evidence`
      );
      assert.match(
        String(item.approver || ""),
        /\S/,
        `${item.id} is READY without approver`
      );
      assert.notEqual(
        String(item.approver || "").trim().toLowerCase(),
        "tbd",
        `${item.id} is READY with TBD approver`
      );
      assert.equal(
        String(item.reasonMissing || "").trim(),
        "",
        `${item.id} is READY but still has reasonMissing`
      );
    }
  }

  for (const [target, blockingField] of [
    ["limited", "blocksLimitedLaunch"],
    ["paid", "blocksPaidLaunch"],
    ["public", "blocksPublicLaunch"],
  ]) {
    const expectedOk = !evidence.items.some(
      (item) => item[blockingField] === true && item.status !== "READY"
    );
    const result = validateLaunchEvidence(evidence, { target });

    assert.equal(result.ok, expectedOk, target);
  }
});

test("launch evidence gate requires deployment environment classification proof", () => {
  const evidence = JSON.parse(
    readFileSync(
      new URL("../../docs/launch/production-launch-evidence.json", import.meta.url),
      "utf8"
    )
  );
  const evidenceWithoutEnvClassification = {
    ...evidence,
    items: evidence.items
      .filter((item) => item.id !== "P0-001-ENV")
      .map((item) => ({
        ...item,
        status: "READY",
        evidence: item.evidence || "test evidence",
        reasonMissing: "",
        approver: "test",
      })),
  };

  for (const target of ["limited", "paid", "public"]) {
    const result = validateLaunchEvidence(evidenceWithoutEnvClassification, {
      target,
    });

    assert.equal(result.ok, false, target);
    assert.match(result.errors.join("\n"), /P0-001-ENV/, target);
  }
});

test("outbound retry query includes expired reserved/sending recovery path", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /status in \('reserved','sending'\)/);
      assert.match(text, /reserved_until/);
      assert.equal(params[0], 25);
      return { rows: [] };
    },
  };

  await listRetryableOutboundAttempts(db, 25);
});

test("outbound reservation expiry requeues retryable attempts or dead-letters exhausted attempts", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /for update skip locked/i);
      assert.match(text, /when coalesce\(a\.attempt_count, 0\) >= coalesce\(a\.max_attempts, 5\) then 'dead'/i);
      assert.match(text, /else 'retrying'/i);
      assert.equal(params[1], 12);
      return { rows: [] };
    },
  };

  await expireStaleOutboundReservations(db, { limit: 12 });
});

test("external idempotency reconciliation converts expired reservations to retrying", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /state = 'reserved'/);
      assert.match(text, /lease_expires_at/);
      assert.match(text, /state = 'retrying'/);
      assert.equal(params.at(-1), 7);
      return { rows: [] };
    },
  };

  await reconcileExpiredExternalSideEffectReservations(db, { provider: "meta", limit: 7 });
});

test("quota reconciliation releases stale durable reservation counters", async () => {
  const db = {
    async query(sql, params) {
      const text = String(sql);
      assert.match(text, /reserved_api_calls = 0/);
      assert.match(text, /reserved_ai_units = 0/);
      assert.match(text, /for update skip locked/i);
      assert.equal(params[0], 45);
      assert.equal(params[1], 9);
      return { rows: [] };
    },
  };

  await reconcileStaleTenantUsageReservations(db, {
    olderThanMinutes: 45,
    limit: 9,
  });
});
