import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

import {
  describeSchemaMigrations,
  runSchemaMigrations,
} from "../src/db/runSchemaMigrations.js";
import { dbUpsertTenantCore } from "../src/db/helpers/settings.js";
import {
  createOutboundAttempt,
  markOutboundAttemptSending,
  expireStaleOutboundReservations,
} from "../src/routes/api/inbox/repository/outboundAttempts.js";
import {
  reserveTenantUsageQuota,
  commitTenantUsageReservation,
  reconcileStaleTenantUsageReservations,
} from "../src/db/helpers/tenantUsage.js";
import {
  reserveExternalSideEffect,
  reconcileExpiredExternalSideEffectReservations,
} from "../src/db/helpers/externalIdempotency.js";

const { Pool } = pg;

function s(value = "", fallback = "") {
  return String(value ?? fallback).trim();
}

function hasRealDb() {
  return Boolean(s(process.env.DATABASE_URL));
}

let pool = null;

test.before(async () => {
  if (!hasRealDb()) return;
  pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
  await runSchemaMigrations(pool);
});

test.after(async () => {
  if (pool) await pool.end().catch(() => {});
  pool = null;
});

test(
  "fresh Postgres migration replay is complete and checksum-clean",
  { skip: !hasRealDb() ? "DATABASE_URL not configured for integration test" : false },
  async () => {
    const replay = await runSchemaMigrations(pool);
    assert.equal(replay.ok, true);

    const status = await describeSchemaMigrations(pool);
    assert.equal(status.pendingCount, 0);
    assert.equal(status.drifted.length, 0);
    assert.equal(status.missingRequiredRelationCount, 0);

    for (const relation of [
      "tenants",
      "inbox_threads",
      "inbox_messages",
      "inbox_outbound_attempts",
      "external_idempotency_keys",
      "tenant_usage_daily",
      "schema_migrations",
    ]) {
      const check = await pool.query("select to_regclass($1) as regclass", [relation]);
      assert.equal(check.rows[0]?.regclass, relation);
    }
  }
);

test(
  "real Postgres enforces tenant isolation, idempotency, quota reservation, and outbound finality",
  { skip: !hasRealDb() ? "DATABASE_URL not configured for integration test" : false },
  async () => {
    const client = await pool.connect();
    try {
      await client.query("begin");

      const tenantA = await dbUpsertTenantCore(client, `cert-a-${randomUUID().slice(0, 8)}`, {
        company_name: "Certification A",
        legal_name: "Certification A LLC",
      });
      const tenantB = await dbUpsertTenantCore(client, `cert-b-${randomUUID().slice(0, 8)}`, {
        company_name: "Certification B",
        legal_name: "Certification B LLC",
      });

      const threadA = await client.query(
        `
        insert into inbox_threads (tenant_id, tenant_key, channel, external_thread_id)
        values ($1::uuid, $2::text, 'instagram', $3::text)
        returning *
        `,
        [tenantA.id, tenantA.tenant_key, `thread-${randomUUID()}`]
      );
      const messageA = await client.query(
        `
        insert into inbox_messages (tenant_id, tenant_key, thread_id, sender_type, text, message_type)
        values ($1::uuid, $2::text, $3::uuid, 'ai', 'certification send', 'text')
        returning *
        `,
        [tenantA.id, tenantA.tenant_key, threadA.rows[0].id]
      );

      const firstAttempt = await createOutboundAttempt({
        db: client,
        tenantId: tenantA.id,
        tenantKey: tenantA.tenant_key,
        threadId: threadA.rows[0].id,
        messageId: messageA.rows[0].id,
        idempotencyKey: "cert-idempotency-key",
      });
      const duplicateAttempt = await createOutboundAttempt({
        db: client,
        tenantId: tenantA.id,
        tenantKey: tenantA.tenant_key,
        threadId: threadA.rows[0].id,
        messageId: messageA.rows[0].id,
        idempotencyKey: "cert-idempotency-key",
      });
      assert.equal(duplicateAttempt.id, firstAttempt.id);

      const hidden = await client.query(
        "select count(*)::int as count from inbox_messages where tenant_key = $1::text and tenant_key = $2::text",
        [tenantA.tenant_key, tenantB.tenant_key]
      );
      assert.equal(hidden.rows[0].count, 0);

      const reservation = await reserveTenantUsageQuota(client, {
        tenantId: tenantA.id,
        tenantKey: tenantA.tenant_key,
        planKey: "starter",
        reservations: [{ metric: "api_calls", quantity: 1, limit: 2 }],
      });
      assert.ok(reservation.reservation);
      await commitTenantUsageReservation(client, reservation.reservation);
      const usage = await client.query(
        "select api_calls, reserved_api_calls from tenant_usage_daily where tenant_id = $1::uuid",
        [tenantA.id]
      );
      assert.equal(usage.rows[0].api_calls, 1);
      assert.equal(usage.rows[0].reserved_api_calls, 0);

      const reserved = await markOutboundAttemptSending(client, firstAttempt.id, tenantA.tenant_key);
      assert.equal(reserved.status, "reserved");
      await client.query(
        "update inbox_outbound_attempts set reserved_until = now() - interval '1 second' where id = $1::uuid",
        [reserved.id]
      );
      const expired = await expireStaleOutboundReservations(client, { limit: 10 });
      assert.equal(expired.find((item) => item.id === reserved.id)?.status, "retrying");

      const sideEffect = await reserveExternalSideEffect(client, {
        tenantId: tenantA.id,
        tenantKey: tenantA.tenant_key,
        provider: "meta",
        actionType: "outbound.send",
        idempotencyKey: "cert-side-effect",
        leaseMs: 10_000,
      });
      assert.equal(sideEffect.acquired, true);
      await client.query(
        "update external_idempotency_keys set lease_expires_at = now() - interval '1 second' where id = $1::uuid",
        [sideEffect.record.id]
      );
      const reconciled = await reconcileExpiredExternalSideEffectReservations(client, {
        provider: "meta",
        actionType: "outbound.send",
      });
      assert.equal(reconciled.find((item) => item.id === sideEffect.record.id)?.state, "retrying");

      // reconcileStaleTenantUsageReservations uses FOR UPDATE SKIP LOCKED which
      // cannot see rows locked by the current transaction. We commit the usage
      // row first via a dedicated connection, run the reconciler, then clean up.
      await client.query(
        "update tenant_usage_daily set reserved_api_calls = 3, updated_at = now() - interval '1 hour' where tenant_id = $1::uuid",
        [tenantA.id]
      );
      await client.query("commit");

      const reconcileClient = await pool.connect();
      let quotaRows = [];
      try {
        quotaRows = await reconcileStaleTenantUsageReservations(reconcileClient, {
          olderThanMinutes: 30,
        });
      } finally {
        reconcileClient.release();
      }

      assert.equal(quotaRows.find((item) => String(item.tenant_id) === tenantA.id)?.reserved_api_calls, 0);

      // Clean up tenant rows created outside the rolled-back transaction
      await pool.query("delete from tenants where tenant_key like 'cert-%'");

    } finally {
      client.release();
    }
  }
);
