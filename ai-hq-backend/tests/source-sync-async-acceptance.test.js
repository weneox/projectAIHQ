import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as setupTest } from "../src/routes/api/workspace/setup.js";
import { __test__ as settingsSourcesTest } from "../src/routes/api/settings/sources.js";
import { __test__ as importTest } from "../src/services/workspace/import.js";
import { ensureSource } from "../src/services/workspace/import/records.js";
import {
  __test__ as asyncTaskTest,
  dispatchDetachedTask,
} from "../src/services/asyncTasks.js";

test("buildImportResponse returns 202 for accepted source imports", () => {
  const result = setupTest.buildImportResponse({
    data: {
      ok: true,
      accepted: true,
      mode: "accepted",
      reviewSessionId: "session-1",
      reviewSessionStatus: "processing",
      run: { id: "run-1" },
    },
    successMessage: "Website import completed",
    acceptedMessage: "Website import accepted",
    partialMessage: "Website import finished with warnings",
    errorCode: "WebsiteImportFailed",
    errorMessage: "website import failed",
  });

  assert.equal(result.status, 202);
  assert.equal(result.body.accepted, true);
  assert.equal(result.body.message, "Website import accepted");
  assert.equal(result.body.reviewSessionStatus, "processing");
  assert.equal(result.body.run.id, "run-1");
});

test("accepted import payload keeps durable source run identifiers", async () => {
  const accepted = await importTest.buildAcceptedImportResult({
    db: {},
    scope: {
      tenantId: "tenant-1",
      tenantKey: "tenant-key-1",
    },
    role: "owner",
    tenant: null,
    normalizedType: "website",
    normalizedUrl: "https://example.com",
    intakeContext: {
      sourceCount: 1,
      sourceTypes: ["website"],
    },
    requestId: "req-1",
    session: {
      id: "session-1",
      status: "processing",
    },
    ensured: {
      source: {
        id: "source-1",
      },
      table: "tenant_sources",
    },
    createdRun: {
      run: {
        id: "run-1",
      },
      table: "tenant_source_sync_runs",
    },
    collector: {},
    reuseExistingSession: false,
    promoteImportedSourceToPrimary: true,
    setup: {},
  });

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.mode, "accepted");
  assert.equal(accepted.stage, "source_sync");
  assert.equal(accepted.reviewSessionId, "session-1");
  assert.equal(accepted.source.id, "source-1");
  assert.equal(accepted.run.id, "run-1");
});

test("dispatchDetachedTask defers source sync work past the request stack", async () => {
  let ran = false;

  dispatchDetachedTask("source-sync-test", async () => {
    ran = true;
  });

  assert.equal(ran, false);

  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(ran, true);
});

test("running source sync with an active lease is not claimable twice", () => {
  const now = new Date("2026-03-25T10:00:00.000Z");

  const claimable = asyncTaskTest.isSourceSyncRunClaimable(
    {
      status: "queued",
      next_retry_at: "2026-03-25T09:59:00.000Z",
    },
    now
  );

  const leased = asyncTaskTest.isSourceSyncRunClaimable(
    {
      status: "running",
      lease_expires_at: "2026-03-25T10:05:00.000Z",
    },
    now
  );

  const expiredLease = asyncTaskTest.isSourceSyncRunClaimable(
    {
      status: "running",
      lease_expires_at: "2026-03-25T09:55:00.000Z",
    },
    now
  );

  assert.equal(claimable, true);
  assert.equal(leased, false);
  assert.equal(expiredLease, true);
});

test("retry plan requeues retryable source sync failures before max attempts", () => {
  const plan = asyncTaskTest.buildSourceSyncRetryPlan({
    attemptCount: 1,
    maxAttempts: 3,
    now: new Date("2026-03-25T10:00:00.000Z"),
    resultOrError: {
      message: "website extract timed out after 120000ms",
      stage: "extract",
    },
  });

  assert.equal(plan.retryable, true);
  assert.equal(plan.terminal, false);
  assert.equal(plan.nextStatus, "queued");
  assert.equal(typeof plan.nextRetryAt, "string");
  assert.ok(plan.nextRetryAt.includes("2026-03-25T"));
});

test("retry plan marks terminal failure after max attempts", () => {
  const plan = asyncTaskTest.buildSourceSyncRetryPlan({
    attemptCount: 3,
    maxAttempts: 3,
    resultOrError: {
      message: "website extract timed out after 120000ms",
      stage: "extract",
    },
  });

  assert.equal(plan.retryable, true);
  assert.equal(plan.terminal, true);
  assert.equal(plan.nextStatus, "failed");
  assert.equal(plan.nextRetryAt, "");
});

test("ensureSource reuses an existing tenant source when insert hits duplicate source_key", async () => {
  const existingSource = {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "22222222-2222-4222-8222-222222222222",
    tenant_key: "tenant-key",
    source_key: "website_example_com_abcd1234",
    source_type: "website",
    type: "website",
    source_url: "https://example.com/",
    url: "https://example.com/",
    name: "Website - example.com",
    display_name: "Website - example.com",
    label: "Website - example.com",
    source_name: "Website - example.com",
    status: "connected",
    sync_status: "queued",
    is_enabled: true,
    enabled: true,
    requested_by: "existing-user",
  };

  const updatedSource = {
    ...existingSource,
    review_session_id: "33333333-3333-4333-8333-333333333333",
    requested_by: "44444444-4444-4444-8444-444444444444",
  };

  let exactLookupCount = 0;
  let updateCount = 0;

  const db = {
    async query(text, params = []) {
      if (text.includes("select to_regclass")) {
        return { rows: [{ regclass: "public.tenant_sources" }] };
      }

      if (text.includes("from information_schema.columns")) {
        return {
          rows: [
            { column_name: "id", data_type: "uuid", udt_name: "uuid" },
            { column_name: "tenant_id", data_type: "uuid", udt_name: "uuid" },
            { column_name: "tenant_key", data_type: "text", udt_name: "text" },
            { column_name: "source_key", data_type: "text", udt_name: "text" },
            { column_name: "source_type", data_type: "text", udt_name: "text" },
            { column_name: "type", data_type: "text", udt_name: "text" },
            { column_name: "source_url", data_type: "text", udt_name: "text" },
            { column_name: "url", data_type: "text", udt_name: "text" },
            { column_name: "name", data_type: "text", udt_name: "text" },
            { column_name: "display_name", data_type: "text", udt_name: "text" },
            { column_name: "label", data_type: "text", udt_name: "text" },
            { column_name: "source_name", data_type: "text", udt_name: "text" },
            {
              column_name: "review_session_id",
              data_type: "uuid",
              udt_name: "uuid",
            },
            { column_name: "status", data_type: "text", udt_name: "text" },
            { column_name: "sync_status", data_type: "text", udt_name: "text" },
            { column_name: "is_enabled", data_type: "boolean", udt_name: "bool" },
            { column_name: "enabled", data_type: "boolean", udt_name: "bool" },
            { column_name: "requested_by", data_type: "text", udt_name: "text" },
            { column_name: "created_by", data_type: "text", udt_name: "text" },
            {
              column_name: "last_sync_requested_at",
              data_type: "timestamp with time zone",
              udt_name: "timestamptz",
            },
            {
              column_name: "created_at",
              data_type: "timestamp with time zone",
              udt_name: "timestamptz",
            },
            {
              column_name: "updated_at",
              data_type: "timestamp with time zone",
              udt_name: "timestamptz",
            },
            {
              column_name: "metadata_json",
              data_type: "jsonb",
              udt_name: "jsonb",
            },
            { column_name: "meta_json", data_type: "jsonb", udt_name: "jsonb" },
            {
              column_name: "source_metadata_json",
              data_type: "jsonb",
              udt_name: "jsonb",
            },
            {
              column_name: "context_json",
              data_type: "jsonb",
              udt_name: "jsonb",
            },
            {
              column_name: "input_summary_json",
              data_type: "jsonb",
              udt_name: "jsonb",
            },
          ],
        };
      }

      if (text.includes("from pg_constraint")) {
        if (params[1] === "status") {
          return {
            rows: [
              {
                def: "CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text])))",
              },
            ],
          };
        }

        if (params[1] === "sync_status") {
          return {
            rows: [
              {
                def: "CHECK ((sync_status = ANY (ARRAY['idle'::text, 'queued'::text, 'running'::text, 'success'::text, 'error'::text])))",
              },
            ],
          };
        }

        return { rows: [] };
      }

      if (
        text.includes("select * from tenant_sources where") &&
        text.includes("lower(source_type)") &&
        text.includes("source_url =")
      ) {
        exactLookupCount += 1;
        return { rows: exactLookupCount === 1 ? [] : [existingSource] };
      }

      if (
        text.includes("select * from tenant_sources where") &&
        text.includes("source_key =")
      ) {
        return { rows: [existingSource] };
      }

      if (text.startsWith("insert into tenant_sources")) {
        const error = new Error(
          'duplicate key value violates unique constraint "ux_tenant_sources_tenant_source_key"'
        );
        error.code = "23505";
        error.constraint = "ux_tenant_sources_tenant_source_key";
        throw error;
      }

      if (text.startsWith("update tenant_sources set")) {
        updateCount += 1;
        return { rows: [updatedSource] };
      }

      throw new Error(`Unexpected query in test: ${text}`);
    },
  };

  const result = await ensureSource(db, {
    tenantId: existingSource.tenant_id,
    tenantKey: existingSource.tenant_key,
    sourceType: "website",
    url: "https://example.com",
    requestedBy: "44444444-4444-4444-8444-444444444444",
    requestId: "req-1",
    reviewSessionId: "33333333-3333-4333-8333-333333333333",
    intakeContext: {
      primarySource: {
        sourceType: "website",
        url: "https://example.com",
      },
      sourceCount: 1,
    },
  });

  assert.equal(result.created, false);
  assert.equal(result.source.id, existingSource.id);
  assert.equal(result.source.review_session_id, updatedSource.review_session_id);
  assert.equal(updateCount, 1);
});

test("source sync accepted response exposes explicit review implications", () => {
  const review = settingsSourcesTest.buildSourceSyncReviewState({
    run: {
      id: "run-1",
      review_session_id: "session-1",
      candidate_draft_count: 3,
      candidate_created_count: 2,
      projection_status: "review_required",
      canonical_projection: "deferred_to_review",
    },
  });

  assert.deepEqual(review, {
    required: true,
    sessionId: "session-1",
    projectionStatus: "review_required",
    candidateDraftCount: 3,
    candidateCreatedCount: 2,
    canonicalProjection: "deferred_to_review",
  });
});