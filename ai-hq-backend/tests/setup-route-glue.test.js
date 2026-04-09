import test from "node:test";
import assert from "node:assert/strict";

import {
  loadSetupStatusResponse,
  requireSetupActor,
} from "../src/services/workspace/setup/actorApp.js";
import {
  auditSetupAction,
  getSetupAuditActor,
} from "../src/services/workspace/setup/auditApp.js";
import {
  loadCurrentSetupReviewResponse,
  loadSetupReviewDraftResponse,
  loadSetupTruthCurrentResponse,
  loadSetupTruthVersionResponse,
} from "../src/services/workspace/setup/readApp.js";
import { discardSetupReviewComposition } from "../src/services/workspace/setup/discardApp.js";

function createRes() {
  return {
    statusCode: 200,
    body: null,
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

test("actor app fails closed when authenticated user is missing", () => {
  const res = createRes();
  const actor = requireSetupActor(
    {},
    res,
    {
      pickWorkspaceActor() {
        return { tenantId: "tenant-1" };
      },
    }
  );

  assert.equal(actor, null);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, "Unauthorized");
});

test("actor app loads setup status with unchanged response shape", async () => {
  const result = await loadSetupStatusResponse(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
      errorCode: "SetupStatusFailed",
    },
    {
      async buildSetupStatus() {
        return {
          progress: {
            nextRoute: "/home?assistant=setup",
          },
        };
      },
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.progress.nextRoute, "/home?assistant=setup");
});

test("audit app derives setup audit actor and swallows audit failures", async () => {
  const actorName = getSetupAuditActor({
    user: { email: "ops@example.com" },
  });
  assert.equal(actorName, "ops@example.com");

  await auditSetupAction(
    {},
    {
      tenantId: "tenant-1",
      tenantKey: "alpha",
      role: "owner",
      user: { email: "ops@example.com" },
    },
    "setup.review.updated",
    "tenant_setup_review_session",
    "session-1",
    {
      sessionId: "session-1",
    },
    {
      async dbAudit() {
        throw new Error("audit unavailable");
      },
    }
  );
});

test("read app preserves truth and review error shaping", async () => {
  const truth = await loadSetupTruthCurrentResponse(
    {
      db: {},
      actor: { tenantId: "tenant-1" },
    },
    {
      async loadSetupTruthPayload() {
        throw new Error("truth failed");
      },
    }
  );

  assert.equal(truth.status, 400);
  assert.equal(truth.body.error, "SetupTruthLoadFailed");

  const review = await loadCurrentSetupReviewResponse(
    {
      db: {},
      actor: { tenantId: "tenant-1" },
      eventLimit: 17,
    },
    {
      async loadCurrentReviewPayload({ eventLimit }) {
        assert.equal(eventLimit, 17);
        return {
          review: { draft: { version: 7 } },
          setup: { status: "ready" },
        };
      },
    }
  );

  assert.equal(review.status, 200);
  assert.equal(review.body.review.draft.version, 7);
});

test("read app preserves truth version 404 and review-draft shaping", async () => {
  const version = await loadSetupTruthVersionResponse(
    {
      db: {},
      actor: { tenantId: "tenant-1" },
      versionId: "version-1",
    },
    {
      async loadSetupTruthVersionPayload() {
        return {
          truthVersion: null,
        };
      },
    }
  );

  assert.equal(version.status, 404);
  assert.equal(version.body.error, "SetupTruthVersionNotFound");

  const reviewDraft = await loadSetupReviewDraftResponse(
    {
      db: {},
      actor: { tenantId: "tenant-1" },
    },
    {
      async loadCurrentReviewPayload() {
        return {
          review: {
            draft: { version: 4 },
            session: { id: "session-1" },
            sources: [{ sourceType: "website" }],
            events: [{ kind: "draft_patched" }],
          },
          setup: { status: "review_required" },
        };
      },
    }
  );

  assert.equal(reviewDraft.status, 200);
  assert.equal(reviewDraft.body.session.id, "session-1");
  assert.equal(reviewDraft.body.setup.status, "review_required");
});

test("discard app preserves discard response and audit behavior", async () => {
  const auditCalls = [];
  const result = await discardSetupReviewComposition(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
        tenant: null,
      },
      body: {
        reason: "restart",
      },
    },
    {
      async discardSetupReviewSession() {
        return { id: "session-1" };
      },
      async buildSetupStatus() {
        return { status: "ready" };
      },
      async auditSetupAction(...args) {
        auditCalls.push(args);
      },
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.session.id, "session-1");
  assert.equal(result.body.setup.status, "ready");
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0][2], "setup.review.discarded");
});
