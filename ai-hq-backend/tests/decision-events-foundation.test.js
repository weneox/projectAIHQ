import test from "node:test";
import assert from "node:assert/strict";

import {
  appendDecisionEvent,
  listDecisionEvents,
} from "../src/db/helpers/decisionEvents.js";
import { finalizeSetupReviewComposition } from "../src/services/workspace/setup/reviewApp.js";

function createDecisionEventsDb() {
  const rows = [];

  return {
    rows,
    async query(input, values = []) {
      const text = String(input?.text || input || "").trim().toLowerCase();
      const params = Array.isArray(input?.values) ? input.values : values;

      if (text.includes("insert into tenant_decision_events")) {
        const row = {
          id: `decision-${rows.length + 1}`,
          tenant_id: params[0],
          tenant_key: params[1],
          event_type: params[2],
          actor: params[3],
          source: params[4],
          surface: params[5],
          channel_type: params[6],
          policy_outcome: params[7],
          reason_codes: JSON.parse(params[8]),
          health_state_json: JSON.parse(params[9]),
          approval_posture_json: JSON.parse(params[10]),
          execution_posture_json: JSON.parse(params[11]),
          control_state_json: JSON.parse(params[12]),
          truth_version_id: params[13],
          runtime_projection_id: params[14],
          affected_surfaces: JSON.parse(params[15]),
          recommended_next_action_json: JSON.parse(params[16]),
          decision_context_json: JSON.parse(params[17]),
          event_at: params[18],
          created_at: params[18],
        };
        rows.unshift(row);
        return { rows: [row] };
      }

      if (text.includes("from tenant_decision_events")) {
        const tenantId = String(params[0] || "");
        const tenantKey = String(params[1] || "").toLowerCase();
        const eventTypes = Array.isArray(params[2]) ? params[2] : [];
        const surfaces = Array.isArray(params[3]) ? params[3] : [];
        const limit = Number(params[4] || 25);
        return {
          rows: rows
            .filter(
              (row) =>
                (!tenantId || String(row.tenant_id) === tenantId) &&
                (!tenantKey || String(row.tenant_key).toLowerCase() === tenantKey) &&
                (!eventTypes.length || eventTypes.includes(String(row.event_type).toLowerCase())) &&
                (!surfaces.length || surfaces.includes(String(row.surface).toLowerCase()))
            )
            .slice(0, limit),
        };
      }

      return { rows: [] };
    },
  };
}

test("decision events are append-only, queryable, and sanitize secret-like fields", async () => {
  const db = createDecisionEventsDb();

  await appendDecisionEvent(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    eventType: "execution_policy_decision",
    actor: "system",
    source: "inbox.ingest",
    surface: "inbox",
    channelType: "instagram",
    policyOutcome: "blocked_until_repair",
    reasonCodes: ["projection_stale"],
    healthState: {
      status: "stale",
      accessToken: "should-not-be-stored",
    },
    decisionContext: {
      threadId: "thread-1",
      authorization: "hidden",
    },
    runtimeProjectionId: "projection-1",
  });

  const events = await listDecisionEvents(db, {
    tenantId: "tenant-1",
    tenantKey: "acme",
    eventTypes: ["execution_policy_decision"],
  });

  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "execution_policy_decision");
  assert.equal(events[0].runtimeProjectionId, "projection-1");
  assert.equal(events[0].healthState.accessToken, undefined);
  assert.equal(events[0].decisionContext.authorization, undefined);
});

test("finalize setup review emits truth publication and approval policy decision events", async () => {
  const db = createDecisionEventsDb();

  const result = await finalizeSetupReviewComposition(
    {
      db,
      actor: {
        tenantId: "tenant-1",
        tenantKey: "acme",
        role: "owner",
        user: {
          email: "owner@aihq.test",
          name: "Owner",
        },
      },
      body: {
        reason: "approve reviewed truth",
      },
    },
    {
      getCurrentSetupReview: async () => ({
        session: {
          id: "review-1",
          currentStep: "ready",
        },
      }),
      finalizeSetupReviewSession: async (input) => {
        await input.projectDraftToCanonical({
          client: db,
          tenantId: "tenant-1",
          session: { id: "review-1" },
          draft: {},
          sources: [],
        });
        return {
          session: {
            id: "review-1",
          },
          reviewSessionId: "review-1",
        };
      },
      buildSetupStatus: async () => ({ setupCompleted: true }),
      projectSetupReviewDraftToCanonical: async () => ({
        truthVersion: {
          id: "truth-v1",
        },
        runtimeProjection: {
          id: "projection-1",
        },
        impactSummary: {
          affectedSurfaces: ["inbox", "voice"],
        },
        approvalPolicy: {
          strictestOutcome: "approved",
          reasonCodes: ["auto_approvable"],
        },
      }),
      auditSetupAction: async () => {},
    }
  );

  assert.equal(result.status, 200);
  assert.equal(db.rows.length, 2);
  assert.equal(db.rows[0].event_type, "approval_policy_decision");
  assert.equal(db.rows[0].truth_version_id, "truth-v1");
  assert.equal(db.rows[1].event_type, "truth_publication_decision");
  assert.equal(db.rows[1].runtime_projection_id, "projection-1");
});
