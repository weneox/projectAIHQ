import test from "node:test";
import assert from "node:assert/strict";

import { createChatHandlers } from "../src/routes/api/chat/handlers.js";
import { createRuntimeAuthorityError } from "../src/services/businessBrain/runtimeAuthority.js";

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

function createDb() {
  const queries = [];
  return {
    queries,
    async query(sql, params = []) {
      queries.push({
        text: String(sql?.text || sql || ""),
        params,
      });

      if (String(sql).includes("returning id, thread_id")) {
        return {
          rows: [
            {
              id: "message-1",
              thread_id: params[0],
              role: "assistant",
              agent_key: params[1],
              content: params[2],
              meta: params[3],
              created_at: "2026-03-29T00:00:00.000Z",
            },
          ],
        };
      }

      return { rows: [] };
    },
  };
}

function createRuntime() {
  return {
    authority: {
      mode: "strict",
      required: true,
      available: true,
      source: "approved_runtime_projection",
      tenantId: "tenant-1",
      tenantKey: "acme",
    },
    tenantKey: "acme",
    tenant: {
      id: "tenant-1",
      tenant_key: "acme",
      company_name: "Acme Clinic",
      default_language: "en",
      profile: {
        brand_name: "Acme Clinic",
        tone_of_voice: "warm_premium_reassuring",
      },
      ai_policy: {
        auto_reply_enabled: true,
      },
    },
    displayName: "Acme Clinic",
    industry: "beauty",
    businessSummary: "Premium beauty consultations",
    tone: "warm_premium_reassuring",
    toneProfile: "warm_premium_reassuring",
    services: ["Consultation"],
    qualificationQuestions: [
      "What result are you looking for?",
      "What timeline do you have in mind?",
    ],
    handoffTriggers: ["medical_claim", "human_request"],
    disallowedClaims: ["instant_result_guarantees"],
    conversionGoal: "book_consultation",
    primaryCta: "book your consultation",
    channelBehavior: {
      chat: {
        primaryAction: "qualify_then_route",
        qualificationDepth: "guided",
        ctaMode: "consultation_booking",
      },
    },
  };
}

test("chat handler resolves strict runtime authority and passes chat behavior into shared kernel inputs", async () => {
  const db = createDb();
  const runtimeCalls = [];
  const kernelCalls = [];
  const broadcasts = [];
  const { postChat } = createChatHandlers({
    db,
    wsHub: {
      broadcast(payload) {
        broadcasts.push(payload);
      },
    },
    getRuntime: async (input) => {
      runtimeCalls.push(input);
      return createRuntime();
    },
    runKernel: async (input) => {
      kernelCalls.push(input);
      return {
        ok: true,
        replyText: "Let's get you booked.",
        meta: {
          source: "chatbot",
        },
        promptBundle: {
          event: "sales.chat",
          usecaseKey: "sales.chat",
          channelKey: "chat",
          promptRef: {
            schema: "prompt_ref.v1",
            version: "prompt_bundle.v1",
            id: "prompt_bundle.v1:chat:sales.chat:beauty:default",
          },
          layers: [
            { key: "foundation", title: "Foundation" },
            { key: "runtime_behavior", title: "Approved Runtime Behavior" },
            { key: "channel_behavior", title: "Channel Behavior" },
          ],
        },
      };
    },
  });

  const req = {
    headers: {
      "x-tenant-key": "acme",
    },
    body: {
      message: "Can you help me book?",
      usecase: "sales.chat",
      extra: {
        customerStage: "aware",
      },
    },
  };
  const res = createMockRes();

  await postChat(req, res);

  assert.equal(runtimeCalls.length, 1);
  assert.equal(runtimeCalls[0].authorityMode, "strict");
  assert.equal(runtimeCalls[0].channel, "chat");
  assert.equal(runtimeCalls[0].tenantKey, "acme");
  assert.equal(kernelCalls.length, 1);
  assert.equal(kernelCalls[0].usecase, "sales.chat");
  assert.equal(kernelCalls[0].extra.channel, "chat");
  assert.equal(kernelCalls[0].tenant.behavior.niche, "beauty");
  assert.equal(kernelCalls[0].tenant.behavior.conversionGoal, "book_consultation");
  assert.equal(kernelCalls[0].tenant.behavior.primaryCta, "book your consultation");
  assert.deepEqual(kernelCalls[0].tenant.behavior.qualificationQuestions, [
    "What result are you looking for?",
    "What timeline do you have in mind?",
  ]);
  assert.deepEqual(kernelCalls[0].tenant.behavior.handoffTriggers, [
    "medical_claim",
    "human_request",
  ]);
  assert.deepEqual(kernelCalls[0].tenant.behavior.disallowedClaims, [
    "instant_result_guarantees",
  ]);
  assert.deepEqual(kernelCalls[0].tenant.behavior.channelBehavior.chat, {
    primaryAction: "qualify_then_route",
    qualificationDepth: "guided",
    ctaMode: "consultation_booking",
  });
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(res.body?.meta?.replayTrace?.channel, "chat");
  assert.equal(res.body?.meta?.replayTrace?.usecase, "sales.chat");
  assert.equal(res.body?.meta?.replayTrace?.runtimeRef?.tenantKey, "acme");
  assert.equal(
    res.body?.meta?.replayTrace?.prompt?.promptId,
    "prompt_bundle.v1:chat:sales.chat:beauty:default"
  );
  assert.equal(res.body?.meta?.replayTrace?.evaluation?.outcome, "reply_generated");
  assert.equal(res.body?.meta?.replayTrace?.evaluation?.qualification?.status, "guided");
  assert.equal(
    res.body?.meta?.replayTrace?.decisions?.qualification?.questionCount,
    2
  );
  assert.deepEqual(res.body?.meta?.replayTrace?.prompt?.layerKeys, [
    "foundation",
    "runtime_behavior",
    "channel_behavior",
  ]);
  assert.equal(broadcasts.length, 1);
});

test("chat handler fails closed when strict runtime authority is unavailable", async () => {
  const db = createDb();
  let kernelCalled = false;
  const { postChat } = createChatHandlers({
    db,
    wsHub: null,
    getRuntime: async () => {
      throw createRuntimeAuthorityError({
        mode: "strict",
        tenantKey: "acme",
        reasonCode: "runtime_projection_missing",
        reason: "runtime_projection_missing",
        message: "Approved runtime authority is stale.",
      });
    },
    runKernel: async () => {
      kernelCalled = true;
      return { ok: true, replyText: "should not run" };
    },
  });

  const req = {
    headers: {
      "x-tenant-key": "acme",
    },
    body: {
      message: "Hello",
    },
  };
  const res = createMockRes();

  await postChat(req, res);

  assert.equal(kernelCalled, false);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.error, "runtime_authority_unavailable");
  assert.equal(res.body?.details?.authority?.required, true);
  assert.equal(db.queries.length, 0);
});

test("chat handler surfaces unexpected errors instead of silently swallowing them", async () => {
  const db = createDb();
  const { postChat } = createChatHandlers({
    db,
    wsHub: null,
    getRuntime: async () => createRuntime(),
    runKernel: async () => {
      throw new Error("kernel exploded");
    },
  });

  const req = {
    headers: {
      "x-tenant-key": "acme",
    },
    body: {
      message: "Hello",
    },
  };
  const res = createMockRes();

  await postChat(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body?.ok, false);
  assert.equal(res.body?.details?.message, "kernel exploded");
});
