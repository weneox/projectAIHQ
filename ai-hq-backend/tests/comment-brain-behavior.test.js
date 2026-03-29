import test from "node:test";
import assert from "node:assert/strict";

import { fallbackClassification } from "../src/services/commentBrain/fallback.js";
import { makePrivateReply, makePublicReply } from "../src/services/commentBrain/replies.js";
import { resolveCommentRuntime } from "../src/services/commentBrain/runtime.js";

function createBehaviorRuntime(overrides = {}) {
  return {
    language: "en",
    autoReplyEnabled: true,
    createLeadEnabled: true,
    services: ["Consultation"],
    behavior_json: {
      conversionGoal: "book_consultation",
      primaryCta: "book a consultation",
      toneProfile: "warm_reassuring",
      handoffTriggers: ["human_request"],
      disallowedClaims: ["instant_result_guarantees"],
      channelBehavior: {
        comments: {
          primaryAction: "qualify_then_move_to_dm",
          qualificationDepth: "guided",
          handoffBias: "conditional",
        },
      },
    },
    ...overrides,
  };
}

test("comment runtime surfaces approved behavior fields from behavior_json", async () => {
  const runtime = await resolveCommentRuntime({
    tenantKey: "acme",
    runtime: createBehaviorRuntime(),
  });

  assert.equal(runtime.conversionGoal, "book_consultation");
  assert.equal(runtime.primaryCta, "book a consultation");
  assert.equal(runtime.toneProfile, "warm_reassuring");
  assert.deepEqual(runtime.handoffTriggers, ["human_request"]);
  assert.deepEqual(runtime.disallowedClaims, ["instant_result_guarantees"]);
  assert.deepEqual(runtime.channelBehavior.comments, {
    primaryAction: "qualify_then_move_to_dm",
    qualificationDepth: "guided",
    handoffBias: "conditional",
  });
});

test("fallback classification blocks disallowed claims and keeps comments behavior traceable", () => {
  const result = fallbackClassification("Can you guarantee instant results?", {
    tenantKey: "acme",
    runtime: createBehaviorRuntime(),
  });

  assert.equal(result.category, "unknown");
  assert.equal(result.shouldCreateLead, false);
  assert.equal(result.shouldReply, true);
  assert.equal(result.shouldPrivateReply, false);
  assert.equal(result.reason, "disallowed_claim_request");
  assert.match(result.replySuggestion, /do not make unverified claims/i);
  assert.equal(result.meta.matchedDisallowedClaim, "instant_result_guarantees");
});

test("comments sales follow-up changes when channel behavior stops favoring DM", () => {
  const dmRuntime = createBehaviorRuntime();
  const publicRuntime = createBehaviorRuntime({
    behavior_json: {
      conversionGoal: "book_consultation",
      primaryCta: "book a consultation",
      toneProfile: "warm_reassuring",
      handoffTriggers: ["human_request"],
      disallowedClaims: [],
      channelBehavior: {
        comments: {
          primaryAction: "answer_briefly_in_public",
          qualificationDepth: "light",
          handoffBias: "minimal",
        },
      },
    },
  });

  const dmResult = fallbackClassification("Price for consultation?", {
    tenantKey: "acme",
    runtime: dmRuntime,
  });
  const publicResult = fallbackClassification("Price for consultation?", {
    tenantKey: "acme",
    runtime: publicRuntime,
  });

  assert.equal(dmResult.shouldPrivateReply, true);
  assert.equal(publicResult.shouldPrivateReply, false);
  assert.match(makePublicReply({ kind: "sales", runtime: dmRuntime }), /DM/i);
  assert.doesNotMatch(
    makePublicReply({ kind: "sales", runtime: publicRuntime }),
    /DM/i
  );
  assert.match(
    makePrivateReply({ kind: "sales", runtime: dmRuntime }),
    /What would you like help with first\?/i
  );
});
