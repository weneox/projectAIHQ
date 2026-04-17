import test from "node:test";
import assert from "node:assert/strict";

import { loadCurrentReviewPayload } from "../src/services/workspace/setup/reviewFlow.js";

function createReviewDraft(overrides = {}) {
  return {
    session: {
      id: "session-1",
      status: "draft",
      mode: "setup",
      currentStep: "handoff",
    },
    draft: {
      version: 5,
      draftPayload: {
        setupAssistant: {
          businessProfile: {
            companyName: "Alpha Clinic",
            description: "Dental clinic in Baku",
            websiteUrl: "",
          },
          services: [{ key: "consultation", title: "Consultation" }],
          contacts: [{ type: "phone", label: "Phone", value: "+994555555555" }],
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
    sources: [],
    ...overrides,
  };
}

test("review flow keeps AI-native setup authority while surfacing the current assistant finalize semantics", async () => {
  const payload = await loadCurrentReviewPayload(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
      },
      eventLimit: 12,
    },
    {
      async getCurrentSetupReview() {
        return createReviewDraft();
      },
      async buildSetupState() {
        return {
          progress: {
            nextRoute: "/home?assistant=setup",
          },
        };
      },
      async listSetupReviewEvents() {
        return [];
      },
    }
  );

  const activeQuestionKeys =
    payload?.assistant?.interviewPlan?.activeQuestionKeys || [];

  assert.equal(payload.assistant.nextQuestion, null);
  assert.equal(payload.assistant.readyForApproval, true);
  assert.ok(!("assistantBrain" in payload));
  assert.equal(payload.assistant.sourceSignals.primarySourceType, "google_maps");
  assert.ok(!activeQuestionKeys.includes("languages"));
  assert.ok(!activeQuestionKeys.includes("tone"));
  assert.ok(!activeQuestionKeys.includes("greeting"));
  assert.ok(!activeQuestionKeys.includes("after_hours"));
  assert.ok(!activeQuestionKeys.includes("audience"));
});

test("review flow marks setup ready from the canonical launch-critical scope only", async () => {
  const payload = await loadCurrentReviewPayload(
    {
      db: {},
      actor: {
        tenantId: "tenant-1",
        tenantKey: "alpha",
        role: "owner",
      },
    },
    {
      async getCurrentSetupReview() {
        return createReviewDraft({
          draft: {
            version: 6,
            draftPayload: {
              setupAssistant: {
                ...createReviewDraft().draft.draftPayload.setupAssistant,
                handoffRules: {
                  enabled: true,
                  summary: "Complaints and custom quotes go to an operator.",
                  triggers: ["complaints", "custom quotes"],
                },
                assistantState: {
                  languages: [],
                  tone: "",
                  greeting: "",
                  afterHoursBehavior: "",
                },
              },
            },
          },
        });
      },
      async buildSetupState() {
        return {
          progress: {
            nextRoute: "/home?assistant=setup",
          },
        };
      },
      async listSetupReviewEvents() {
        return [];
      },
    }
  );

  assert.equal(payload.assistant.readyForApproval, true);
  assert.equal(payload.assistant.nextQuestion, null);
  assert.equal(payload.assistant.phase, "ready");
  assert.equal(payload.assistant.sourceSignals.primarySourceType, "google_maps");
  assert.deepEqual(payload.assistant.confidence.contradictions, []);
});
