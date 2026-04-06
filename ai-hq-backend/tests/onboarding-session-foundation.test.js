import test from "node:test";
import assert from "node:assert/strict";

import { workspaceOnboardingRoutes } from "../src/routes/api/workspace/onboarding.js";
import {
  __test__ as onboardingTest,
  loadCurrentOnboardingSession,
  startOnboardingSession,
  updateOnboardingDraft,
} from "../src/services/workspace/setup/onboardingApp.js";

function createActor(overrides = {}) {
  return {
    tenantId: "tenant-1",
    tenantKey: "acme",
    role: "owner",
    user: {
      id: "11111111-1111-4111-8111-111111111111",
      email: "owner@acme.test",
      role: "owner",
    },
    ...overrides,
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    finished: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.finished = true;
      return this;
    },
  };
}

async function invokeRoute(router, method, path, req = {}) {
  const layer = router.stack.find(
    (item) => item.route?.path === path && item.route.methods?.[method]
  );

  if (!layer) {
    throw new Error(`Route not found for ${method.toUpperCase()} ${path}`);
  }

  const handlers = layer.route.stack.map((item) => item.handle);
  const res = createMockRes();
  const fullReq = {
    method: method.toUpperCase(),
    path,
    originalUrl: path,
    url: path,
    headers: {},
    query: {},
    body: {},
    app: { locals: {} },
    get(name) {
      return this.headers?.[String(name || "").toLowerCase()] || "";
    },
    ...req,
  };

  async function runAt(index) {
    if (index >= handlers.length || res.finished) return;
    const handler = handlers[index];
    await Promise.resolve(handler(fullReq, res));
    if (!res.finished) {
      await runAt(index + 1);
    }
  }

  await runAt(0);
  return { req: fullReq, res };
}

test("onboarding draft patch normalization keeps the website-first fields structured", () => {
  const patch = onboardingTest.normalizeOnboardingDraftPatchBody({
    draft: {
      businessProfile: {
        companyName: "Acme Clinic",
        websiteUrl: "https://acme.example",
        description: "Cosmetic dentistry and consultations",
      },
      services: [
        {
          title: "Initial consultation",
          priceLabel: "From $50",
        },
      ],
      contacts: [
        {
          type: "phone",
          value: "+994501112233",
        },
      ],
      hours: [
        {
          day: "Mon-Fri",
          open: "09:00",
          close: "18:00",
        },
      ],
      pricingPosture: {
        mode: "quote_based",
      },
      handoffRules: {
        enabled: true,
        triggers: ["medical_urgency", "human_request"],
      },
    },
  });

  assert.deepEqual(patch.businessProfile, {
    companyName: "Acme Clinic",
    description: "Cosmetic dentistry and consultations",
    websiteUrl: "https://acme.example",
  });
  assert.deepEqual(patch.services, [
    {
      key: "initial-consultation",
      title: "Initial consultation",
      priceLabel: "From $50",
    },
  ]);
  assert.deepEqual(patch.contacts, [
    {
      type: "phone",
      value: "+994501112233",
      preferred: false,
    },
  ]);
  assert.deepEqual(patch.hours, [
    {
      day: "Mon-Fri",
      open: "09:00",
      close: "18:00",
      closed: false,
    },
  ]);
  assert.deepEqual(patch.pricingPosture, {
    mode: "quote_based",
  });
  assert.deepEqual(patch.handoffRules, {
    enabled: true,
    triggers: ["medical_urgency", "human_request"],
  });
});

test("onboarding session start reuses setup review storage but stays draft-only", async () => {
  let currentReview = null;
  let createdSessionInput = null;
  const auditCalls = [];

  const result = await startOnboardingSession(
    {
      db: {},
      actor: createActor(),
    },
    {
      async getCurrentSetupReview() {
        return currentReview;
      },
      async getOrCreateActiveSetupReviewSession(input) {
        createdSessionInput = input;
        currentReview = {
          session: {
            id: "session-1",
            status: "draft",
            mode: "setup",
            currentStep: "onboarding",
            started_at: "2026-04-06T09:00:00.000Z",
          },
          draft: {
            version: 1,
            updated_at: "2026-04-06T09:00:00.000Z",
            draftPayload: {
              businessProfile: {
                companyName: "Existing staged setup payload",
              },
              onboarding: {
                businessProfile: {
                  websiteUrl: "https://acme.example",
                },
              },
            },
          },
        };
        return currentReview;
      },
      async auditSetupAction(...args) {
        auditCalls.push(args);
      },
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.created, true);
  assert.equal(createdSessionInput.currentStep, "onboarding");
  assert.equal(createdSessionInput.metadata.onboardingShell, true);
  assert.equal(createdSessionInput.metadata.truthApprovalDeferred, true);
  assert.equal(result.body.session.draftOnly, true);
  assert.equal(result.body.onboarding.draftOnly, true);
  assert.equal(
    result.body.onboarding.draft.businessProfile.websiteUrl,
    "https://acme.example"
  );
  assert.equal(
    result.body.onboarding.review.message,
    "Draft answers stay separate from approved truth and the strict runtime until a later approval step is completed."
  );
  assert.equal(auditCalls.length, 1);
});

test("onboarding session current returns a safe not-found shape until a session exists", async () => {
  const result = await loadCurrentOnboardingSession(
    {
      db: {},
      actor: createActor(),
    },
    {
      async getCurrentSetupReview() {
        return null;
      },
    }
  );

  assert.equal(result.status, 404);
  assert.equal(result.body.ok, false);
  assert.equal(result.body.error, "OnboardingSessionNotFound");
});

test("onboarding draft update stays inside the onboarding namespace and preserves existing setup draft data", async () => {
  let currentReview = {
    session: {
      id: "session-1",
      status: "draft",
      mode: "setup",
      currentStep: "review",
      updated_at: "2026-04-06T09:00:00.000Z",
    },
    draft: {
      version: 2,
      updated_at: "2026-04-06T09:00:00.000Z",
      draftPayload: {
        businessProfile: {
          companyName: "Existing setup review draft",
        },
        draftPayload: {
          importRunId: "run-1",
        },
        onboarding: {
          businessProfile: {
            companyName: "Acme",
          },
          services: [],
          contacts: [],
          hours: [],
          pricingPosture: {},
          handoffRules: {},
        },
      },
    },
  };
  let patchInput = null;
  const auditCalls = [];

  const result = await updateOnboardingDraft(
    {
      db: {},
      actor: createActor(),
      body: {
        draft: {
          businessProfile: {
            companyName: "Acme Clinic",
            websiteUrl: "https://acme.example",
            description: "Draft-only onboarding profile",
          },
          services: [
            {
              title: "Consultation",
              summary: "Initial intake and planning",
            },
          ],
          pricingPosture: {
            mode: "quote_based",
            summary: "Pricing depends on treatment complexity.",
          },
          handoffRules: {
            enabled: true,
            triggers: ["human_request"],
            channels: ["telegram"],
          },
        },
      },
    },
    {
      async getCurrentSetupReview() {
        return currentReview;
      },
      async patchSetupReviewDraft(input) {
        patchInput = input;
        currentReview = {
          ...currentReview,
          draft: {
            ...currentReview.draft,
            version: currentReview.draft.version + 1,
            updated_at: "2026-04-06T10:00:00.000Z",
            draftPayload: input.patch.draftPayload,
          },
        };
        return currentReview.draft;
      },
      async auditSetupAction(...args) {
        auditCalls.push(args);
      },
    }
  );

  assert.equal(patchInput.sessionId, "session-1");
  assert.equal(patchInput.tenantId, "tenant-1");
  assert.equal(patchInput.bumpVersion, true);
  assert.equal(
    patchInput.patch.draftPayload.businessProfile.companyName,
    "Existing setup review draft"
  );
  assert.equal(
    patchInput.patch.draftPayload.draftPayload.importRunId,
    "run-1"
  );
  assert.equal(
    patchInput.patch.draftPayload.onboarding.businessProfile.companyName,
    "Acme Clinic"
  );
  assert.equal(
    patchInput.patch.draftPayload.onboarding.businessProfile.websiteUrl,
    "https://acme.example"
  );
  assert.equal(
    patchInput.patch.draftPayload.onboarding.review.readyForApproval,
    false
  );
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.onboarding.draft.version, 3);
  assert.equal(
    result.body.onboarding.draft.services[0].title,
    "Consultation"
  );
  assert.equal(
    result.body.onboarding.draft.pricingPosture.mode,
    "quote_based"
  );
  assert.equal(result.body.onboarding.draft.handoffRules.enabled, true);
  assert.equal(auditCalls.length, 1);
});

test("onboarding routes wire start, current, and update through the tenant-scoped actor", async () => {
  const routeCalls = [];
  const router = workspaceOnboardingRoutes({
    db: { name: "db" },
    services: {
      async startOnboardingSession({ db, actor }) {
        routeCalls.push({ type: "start", db, actor });
        return {
          status: 200,
          body: {
            ok: true,
            session: { id: "session-1" },
          },
        };
      },
      async loadCurrentOnboardingSession({ db, actor }) {
        routeCalls.push({ type: "current", db, actor });
        return {
          status: 404,
          body: {
            ok: false,
            error: "OnboardingSessionNotFound",
          },
        };
      },
      async updateOnboardingDraft({ db, actor, body }) {
        routeCalls.push({ type: "update", db, actor, body });
        return {
          status: 200,
          body: {
            ok: true,
            onboarding: {
              draft: {
                businessProfile: {
                  companyName: "Acme Clinic",
                },
              },
            },
          },
        };
      },
    },
  });

  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@acme.test",
    role: "owner",
  };

  const startRes = await invokeRoute(router, "post", "/onboarding/session/start", {
    user,
    tenantId: "tenant-1",
    tenantKey: "acme",
  });
  const currentRes = await invokeRoute(
    router,
    "get",
    "/onboarding/session/current",
    {
      user,
      tenantId: "tenant-1",
      tenantKey: "acme",
    }
  );
  const updateRes = await invokeRoute(
    router,
    "patch",
    "/onboarding/session/current",
    {
      user,
      tenantId: "tenant-1",
      tenantKey: "acme",
      body: {
        draft: {
          businessProfile: {
            companyName: "Acme Clinic",
          },
        },
      },
    }
  );

  assert.equal(startRes.res.statusCode, 200);
  assert.equal(currentRes.res.statusCode, 404);
  assert.equal(updateRes.res.statusCode, 200);
  assert.equal(routeCalls.length, 3);
  assert.equal(routeCalls[0].type, "start");
  assert.equal(routeCalls[0].actor.tenantId, "tenant-1");
  assert.equal(routeCalls[1].type, "current");
  assert.equal(routeCalls[2].type, "update");
  assert.equal(
    routeCalls[2].body.draft.businessProfile.companyName,
    "Acme Clinic"
  );
});
