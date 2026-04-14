import test from "node:test";
import assert from "node:assert/strict";
import express from "express";

import { registerSetupAssistantRoutes } from "../src/routes/api/workspace/setupRoutesAssistant.js";
import {
  __test__ as setupAssistantTest,
  loadCurrentSetupAssistantSession,
  startSetupAssistantSession,
  updateSetupAssistantDraft,
} from "../src/services/workspace/setup/setupAssistantApp.js";

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

test("setup assistant session start reuses setup review storage but returns canonical setup payloads", async () => {
  let currentReview = null;
  let createdSessionInput = null;
  const auditCalls = [];

  const result = await startSetupAssistantSession(
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
            currentStep: "setup_assistant",
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
  assert.equal(createdSessionInput.currentStep, "setup_assistant");
  assert.equal(createdSessionInput.metadata.setupAssistantShell, true);
  assert.equal(
    createdSessionInput.metadata.setupAssistantNamespace,
    "draftPayload.setupAssistant"
  );
  assert.equal(result.body.session.namespace, "setup_assistant");
  assert.equal(result.body.setup.draftOnly, true);
  assert.equal(
    result.body.setup.draft.businessProfile.websiteUrl,
    "https://acme.example"
  );
  assert.equal(result.body.setup.assistant.mode, "structured_v2");
  assert.ok(Array.isArray(result.body.setup.assistant.confirmationBlockers));
  assert.equal(result.body.message, "Setup assistant session started");
  assert.equal(auditCalls.length, 1);
});

test("setup assistant current returns a safe not-found shape until a session exists", async () => {
  const result = await loadCurrentSetupAssistantSession(
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
  assert.equal(result.body.error, "SetupAssistantSessionNotFound");
  assert.equal(result.body.setup, null);
});

test("setup assistant draft update stays inside setup review storage and returns the canonical setup payload", async () => {
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
        setupAssistant: {
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

  const result = await updateSetupAssistantDraft(
    {
      db: {},
      actor: createActor(),
      body: {
        draft: {
          businessProfile: {
            companyName: "Acme Clinic",
            websiteUrl: "https://acme.example",
            description: "Draft-only setup profile",
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
    patchInput.patch.draftPayload.setupAssistant.businessProfile.companyName,
    "Acme Clinic"
  );
  assert.equal("onboarding" in patchInput.patch.draftPayload, false);
  assert.equal(result.status, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.setup.draft.version, 3);
  assert.equal(result.body.setup.draft.services[0].title, "Consultation");
  assert.equal(
    result.body.setup.draft.pricingPosture.pricingMode,
    "quote_required"
  );
  assert.equal(
    result.body.setup.draft.pricingPosture.publicSummary,
    "Pricing depends on treatment complexity."
  );
  assert.equal(result.body.session.namespace, "setup_assistant");
  assert.equal(result.body.message, "Setup assistant draft updated");
  assert.equal(auditCalls.length, 1);
});

test("setup assistant message mode parses rough hours into structured weekly rows", async () => {
  let currentReview = {
    session: {
      id: "session-1",
      status: "draft",
      mode: "setup",
      currentStep: "hours",
    },
    draft: {
      version: 1,
      draftPayload: {
        setupAssistant: {
          businessProfile: {
            companyName: "Acme Clinic",
            websiteUrl: "https://acme.example",
            description: "Dental clinic",
          },
          services: [{ key: "consultation", title: "Consultation" }],
          contacts: [{ type: "phone", label: "Phone", value: "+994555555555" }],
          hours: [],
          pricingPosture: {},
          handoffRules: {},
        },
      },
    },
  };

  const result = await updateSetupAssistantDraft(
    {
      db: {},
      actor: createActor(),
      body: {
        step: "hours",
        answer: "Mon-Fri 09:00-18:00; Sat 10:00-14:00; Sun closed",
      },
    },
    {
      async getCurrentSetupReview() {
        return currentReview;
      },
      async patchSetupReviewDraft(input) {
        currentReview = {
          ...currentReview,
          draft: {
            ...currentReview.draft,
            version: currentReview.draft.version + 1,
            draftPayload: input.patch.draftPayload,
          },
        };
        return currentReview.draft;
      },
      async auditSetupAction() {},
    }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.setup.draft.hours[0].day, "monday");
  assert.equal(result.body.setup.draft.hours[0].enabled, true);
  assert.equal(result.body.setup.draft.hours[0].openTime, "09:00");
  assert.equal(result.body.setup.draft.hours[6].closed, true);
});

test("setup assistant routes wire start, current, and update through the tenant-scoped actor", async () => {
  const routeCalls = [];
  const router = express.Router();

  registerSetupAssistantRoutes(router, {
    db: { name: "db" },
    requireSetupActor(req) {
      return {
        user: req.user,
        tenantId: req.tenantId,
        tenantKey: req.tenantKey,
      };
    },
    async startSetupAssistantSession({ db, actor }) {
      routeCalls.push({ type: "start", db, actor });
      return {
        status: 200,
        body: {
          ok: true,
          session: { id: "session-1" },
          setup: { draft: {} },
        },
      };
    },
    async loadCurrentSetupAssistantSession({ db, actor }) {
      routeCalls.push({ type: "current", db, actor });
      return {
        status: 404,
        body: {
          ok: false,
          error: "SetupAssistantSessionNotFound",
          setup: null,
        },
      };
    },
    async updateSetupAssistantDraft({ db, actor, body }) {
      routeCalls.push({ type: "update", db, actor, body });
      return {
        status: 200,
        body: {
          ok: true,
          setup: {
            draft: {
              businessProfile: {
                companyName: "Acme Clinic",
              },
            },
          },
        },
      };
    },
    s(value, fallback = "") {
      return String(value ?? fallback).trim();
    },
  });

  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@acme.test",
    role: "owner",
  };

  const startRes = await invokeRoute(
    router,
    "post",
    "/setup/assistant/session/start",
    {
      user,
      tenantId: "tenant-1",
      tenantKey: "acme",
    }
  );
  const currentRes = await invokeRoute(
    router,
    "get",
    "/setup/assistant/session/current",
    {
      user,
      tenantId: "tenant-1",
      tenantKey: "acme",
    }
  );
  const updateRes = await invokeRoute(
    router,
    "patch",
    "/setup/assistant/session/current",
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
  assert.equal(routeCalls[1].type, "current");
  assert.equal(routeCalls[2].type, "update");
});

test("setup assistant source answers never store instagram, facebook, or google maps as website URLs", () => {
  const instagramPatch = setupAssistantTest.patchFromAnswer(
    "website",
    "https://instagram.com/acmeclinic",
    { sourceMetadata: {} }
  );
  const facebookPatch = setupAssistantTest.patchFromAnswer(
    "website",
    "https://facebook.com/acmeclinic",
    { sourceMetadata: {} }
  );
  const mapsPatch = setupAssistantTest.patchFromAnswer(
    "website",
    "https://maps.google.com/?cid=123",
    { sourceMetadata: {} }
  );

  assert.equal(instagramPatch.businessProfile?.websiteUrl || "", "");
  assert.equal(instagramPatch.sourceMetadata?.primarySourceType, "instagram");
  assert.equal(
    instagramPatch.sourceMetadata?.primarySourceUrl,
    "https://instagram.com/acmeclinic"
  );

  assert.equal(facebookPatch.businessProfile?.websiteUrl || "", "");
  assert.equal(facebookPatch.sourceMetadata?.primarySourceType, "facebook");
  assert.equal(
    facebookPatch.sourceMetadata?.primarySourceUrl,
    "https://facebook.com/acmeclinic"
  );

  assert.equal(mapsPatch.businessProfile?.websiteUrl || "", "");
  assert.equal(mapsPatch.sourceMetadata?.primarySourceType, "google_maps");
  assert.equal(
    mapsPatch.sourceMetadata?.primarySourceUrl,
    "https://maps.google.com/?cid=123"
  );

  assert.deepEqual(
    setupAssistantTest.parseProfileAnswer("https://instagram.com/acmeclinic", {
      businessProfile: {},
    }),
    {}
  );
});

test("setup assistant treats google maps as a valid source identity but still requires handoff before finalize", () => {
  const reviewBase = {
    session: {
      id: "session-1",
      status: "draft",
      mode: "setup",
      currentStep: "handoff",
    },
    draft: {
      version: 4,
      draftPayload: {
        setupAssistant: {
          businessProfile: {
            companyName: "Acme Clinic",
            description: "Dental clinic in Baku",
            websiteUrl: "",
          },
          services: [{ key: "consultation", title: "Consultation" }],
          contacts: [
            {
              type: "phone",
              label: "Phone",
              value: "+994555555555",
              preferred: true,
            },
          ],
          hours: [
            {
              day: "monday",
              enabled: true,
              closed: false,
              allDay: false,
              appointmentOnly: false,
              openTime: "09:00",
              closeTime: "18:00",
              notes: "",
            },
          ],
          pricingPosture: {
            pricingMode: "quote_required",
            publicSummary: "Exact pricing requires a quote.",
          },
          sourceMetadata: {
            primarySourceType: "google_maps",
            primarySourceUrl: "https://maps.google.com/?cid=123",
            sourceLabels: ["Google Maps"],
          },
        },
      },
    },
  };

  const withoutHandoff = setupAssistantTest.buildSetupAssistantSessionPayload(
    reviewBase
  );
  const withHandoff = setupAssistantTest.buildSetupAssistantSessionPayload({
    ...reviewBase,
    draft: {
      ...reviewBase.draft,
      draftPayload: {
        setupAssistant: {
          ...reviewBase.draft.draftPayload.setupAssistant,
          handoffRules: {
            enabled: true,
            summary: "Complaints and custom quotes go to an operator.",
            triggers: ["complaints", "custom quotes"],
          },
        },
      },
    },
  });

  assert.equal(withoutHandoff.setup.review.finalizeAvailable, false);
  assert.equal(withoutHandoff.setup.assistant.nextQuestion?.key, "handoff");
  assert.equal(withoutHandoff.setup.websitePrefill.status, "awaiting_input");
  assert.equal(
    withoutHandoff.setup.draft.sourceMetadata.primarySourceType,
    "google_maps"
  );

  assert.equal(withHandoff.setup.review.finalizeAvailable, true);
  assert.equal(withHandoff.setup.assistant.nextQuestion, null);
  assert.equal(withHandoff.setup.draft.businessProfile.websiteUrl || "", "");
});
