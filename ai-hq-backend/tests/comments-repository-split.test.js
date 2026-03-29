import test from "node:test";
import assert from "node:assert/strict";

import {
  getTenantByKey,
  insertComment,
  updateCommentState,
  listComments,
  insertLeadFromComment,
} from "../src/routes/api/comments/repository.js";
import { createRuntimeAuthorityError } from "../src/services/businessBrain/runtimeAuthority.js";

function createDb(handler) {
  return {
    query: handler,
  };
}

test("getTenantByKey uses strict runtime authority loader and returns tenant", async () => {
  const calls = [];
  const db = createDb(async () => {
    throw new Error("db fallback should not execute");
  });

  const tenant = await getTenantByKey(db, " acme ", {
    runtimeLoader: async (input) => {
      calls.push(input);
      return {
        tenant: {
          id: "tenant-1",
          tenant_key: "acme",
          company_name: "Acme",
        },
      };
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].tenantKey, "acme");
  assert.equal(calls[0].authorityMode, "strict");
  assert.equal(tenant.id, "tenant-1");
  assert.equal(tenant.tenant_key, "acme");
});

test("getTenantByKey fails closed when strict runtime authority returns no tenant", async () => {
  const db = createDb(async () => {
    throw new Error("db fallback should not execute");
  });

  const tenant = await getTenantByKey(db, "acme", {
    runtimeLoader: async () => ({ tenant: null }),
  });

  assert.equal(tenant, null);
});

test("getTenantByKey fails closed when strict runtime authority is unavailable", async () => {
  const tenant = await getTenantByKey(createDb(async () => ({ rows: [] })), "acme", {
    runtimeLoader: async () => {
      throw createRuntimeAuthorityError({
        tenantKey: "acme",
        reasonCode: "runtime_projection_stale",
        message: "Approved runtime authority is stale.",
      });
    },
  });

  assert.equal(tenant, null);
});

test("getTenantByKey rethrows unexpected runtime loader errors", async () => {
  await assert.rejects(
    () =>
      getTenantByKey(createDb(async () => ({ rows: [] })), "acme", {
        runtimeLoader: async () => {
          throw new Error("unexpected loader failure");
        },
      }),
    /unexpected loader failure/
  );
});

test("insertComment normalizes inserted comment payload", async () => {
  let values = null;
  const db = createDb(async (_sql, params) => {
    values = params;
    return {
      rows: [
        {
          id: "comment-1",
          tenant_key: params[0],
          channel: params[1],
          source: params[2],
          external_comment_id: params[3],
          external_parent_comment_id: params[4],
          external_post_id: params[5],
          external_user_id: params[6],
          external_username: params[7],
          customer_name: params[8],
          text: params[9],
          classification: JSON.parse(params[10]),
          raw: JSON.parse(params[11]),
          created_at: new Date("2026-03-27T00:00:00.000Z"),
          updated_at: new Date("2026-03-27T00:00:00.000Z"),
        },
      ],
    };
  });

  const result = await insertComment(db, {
    tenantKey: " acme ",
    channel: "instagram",
    source: "meta",
    externalCommentId: "ext-1",
    externalParentCommentId: "parent-1",
    externalPostId: "post-1",
    externalUserId: "user-1",
    externalUsername: "customer",
    customerName: "Customer",
    text: "Need pricing",
    classification: { category: "sales" },
    raw: { body: "Need pricing" },
    timestampMs: 1711497600000,
  });

  assert.equal(values[0], "acme");
  assert.equal(result.tenant_key, "acme");
  assert.equal(result.external_comment_id, "ext-1");
  assert.equal(result.classification.category, "sales");
  assert.equal(result.raw.body, "Need pricing");
});

test("updateCommentState returns normalized updated comment", async () => {
  const db = createDb(async (_sql, params) => ({
    rows: [
      {
        id: params[0],
        tenant_key: "acme",
        channel: "instagram",
        source: "meta",
        external_comment_id: "ext-1",
        external_parent_comment_id: "",
        external_post_id: "post-1",
        external_user_id: "user-1",
        external_username: "customer",
        customer_name: "Customer",
        text: "Need pricing",
        classification: JSON.parse(params[1]),
        raw: JSON.parse(params[2]),
        created_at: new Date("2026-03-27T00:00:00.000Z"),
        updated_at: new Date("2026-03-27T00:05:00.000Z"),
      },
    ],
  }));

  const result = await updateCommentState(
    db,
    "comment-1",
    { category: "qualified" },
    { review: "complete" }
  );

  assert.equal(result.id, "comment-1");
  assert.equal(result.classification.category, "qualified");
  assert.equal(result.raw.review, "complete");
});

test("listComments preserves tenant filtering and normalizes rows", async () => {
  const captured = [];
  const db = createDb(async (_sql, params) => {
    captured.push(params);
    return {
      rows: [
        {
          id: "comment-1",
          tenant_key: "acme",
          channel: "instagram",
          source: "meta",
          external_comment_id: "ext-1",
          external_parent_comment_id: "",
          external_post_id: "post-1",
          external_user_id: "user-1",
          external_username: "customer",
          customer_name: "Customer",
          text: "Question about pricing",
          classification: { category: "sales" },
          raw: { body: "Question about pricing" },
          created_at: new Date("2026-03-27T00:00:00.000Z"),
          updated_at: new Date("2026-03-27T00:00:00.000Z"),
        },
      ],
    };
  });

  const result = await listComments(db, {
    tenantKey: "acme",
    channel: "instagram",
    category: "sales",
    q: "pricing",
    limit: 10,
  });

  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0], ["acme", "instagram", "sales", "%pricing%", 10]);
  assert.equal(result.length, 1);
  assert.equal(result[0].classification.category, "sales");
});

test("insertLeadFromComment resolves authoritative tenant scope before persisting", async () => {
  let values = null;
  const db = createDb(async (_sql, params) => {
    values = params;
    return {
      rows: [
        {
          id: "lead-1",
          tenant_id: params[0],
          tenant_key: params[1],
          source: params[2],
          source_ref: params[3],
          inbox_thread_id: null,
          proposal_id: null,
          full_name: params[4],
          username: params[5],
          company: params[6],
          phone: params[7],
          email: params[8],
          interest: params[9],
          notes: params[10],
          stage: params[11],
          score: params[12],
          status: params[13],
          owner: null,
          priority: params[14],
          value_azn: null,
          follow_up_at: null,
          next_action: null,
          won_reason: null,
          lost_reason: null,
          extra: JSON.parse(params[15]),
          created_at: new Date("2026-03-27T00:00:00.000Z"),
          updated_at: new Date("2026-03-27T00:00:00.000Z"),
        },
      ],
    };
  });

  const result = await insertLeadFromComment(
    db,
    {
      tenantKey: "acme",
      leadPayload: {
        sourceRef: "ext-1",
        username: "customer",
        notes: "Asked for pricing",
        score: 74.5,
        priority: "medium",
        channel: "instagram",
        externalUserId: "user-1",
      },
    },
    {
      resolveTenantScope: async () => ({
        tenantId: "tenant-1",
        tenantKey: "acme",
        companyName: "Acme",
      }),
    }
  );

  assert.equal(values[0], "tenant-1");
  assert.equal(values[1], "acme");
  assert.equal(values[14], "normal");
  assert.equal(result.tenant_key, "acme");
  assert.equal(result.company, "Acme");
  assert.equal(result.extra.channel, "instagram");
});
