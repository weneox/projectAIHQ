import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSetupAssistantResponseBody,
  buildSetupAssistantSessionPayload,
  buildStoredSetupAssistantBrainPayload,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";
import {
  buildCompleteBusinessDraft,
  buildReview,
} from "./setup-assistant-test-helpers.js";

test("session payload keeps behavior sections visible even when default behavior policies already read as ready", () => {
  const setupAssistant = buildCompleteBusinessDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
      websiteUrl: "https://acme.az",
      primaryAddress: "Baku",
    },
    contacts: [
      { value: "https://wa.me/994551112233", preferred: true },
      { value: "https://acme.az/book" },
    ],
    assistantBehaviorDraft: {
      pricingPolicy: {
        mode: "ask_service_first",
        askServiceFirst: true,
      },
    },
  });

  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "booking_behavior",
      setupAssistant,
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  assert.ok(payload.setup.draft.assistantBehaviorDraft);
  assert.equal(payload.setup.assistant.readyForApproval, false);
  assert.equal(payload.setup.review.finalizeAvailable, false);
  assert.deepEqual(payload.setup.assistant.approvalBlockers, []);
  assert.deepEqual(
    payload.setup.assistant.sections
      .filter((item) => item.key.endsWith("_behavior"))
      .map((item) => ({ key: item.key, status: item.status })),
    [
      { key: "pricing_behavior", status: "ready" },
      { key: "location_behavior", status: "ready" },
      { key: "booking_behavior", status: "ready" },
      { key: "contact_behavior", status: "ready" },
      { key: "handoff_behavior", status: "ready" },
    ]
  );
});

test("session payload becomes approval-ready only when business and relevant behavior are both valid", () => {
  const setupAssistant = buildCompleteBusinessDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
      websiteUrl: "https://acme.az",
      primaryAddress: "Baku",
    },
    contacts: [
      { value: "https://wa.me/994551112233", preferred: true },
      { value: "https://acme.az/book" },
    ],
    assistantBehaviorDraft: {
      pricingPolicy: {
        mode: "ask_service_first",
        askServiceFirst: true,
      },
      locationPolicy: {
        mode: "text_then_map",
        preferredTargetUrl: "https://maps.google.com/?q=Acme",
      },
      bookingPolicy: {
        mode: "route_whatsapp",
        preferredTargetUrl: "https://wa.me/994551112233",
      },
      contactPolicy: {
        mode: "whatsapp_first",
        preferredChannel: "whatsapp",
      },
      handoffPolicy: {
        mode: "direct_handoff",
        requiresReason: false,
      },
    },
  });

  const payload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "handoff_behavior",
      setupAssistant,
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: true,
        phase: "ready",
        assistantMessage: "Ready to approve.",
      }),
    })
  );

  assert.equal(payload.setup.assistant.readyForApproval, true);
  assert.equal(payload.setup.review.finalizeAvailable, true);
  assert.deepEqual(payload.setup.assistant.approvalBlockers, []);
  assert.equal(payload.setup.assistant.nextQuestion, null);
});

test("response body keeps finalize guarded when the base payload still has blockers", () => {
  const basePayload = buildSetupAssistantSessionPayload(
    buildReview({
      currentStep: "contact_behavior",
      setupAssistant: buildCompleteBusinessDraft(),
      setupAssistantBrain: buildStoredSetupAssistantBrainPayload({
        readyForApproval: false,
        phase: "interview",
      }),
    })
  );

  const response = buildSetupAssistantResponseBody(basePayload, {
    readyForApproval: true,
    phase: "ready",
    assistantMessage: "Approve it.",
  });

  assert.equal(response.setup.assistant.readyForApproval, false);
  assert.equal(response.setup.review.finalizeAvailable, false);
  assert.deepEqual(response.setup.assistant.approvalBlockers || [], []);
});
