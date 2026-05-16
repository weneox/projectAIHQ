import test from "node:test";
import assert from "node:assert/strict";

import {
  SETUP_SUMMARY_SECTION_ORDER,
  buildConfirmationBlockers,
  buildReviewState,
  buildSectionStatus,
  buildSummary,
} from "../src/services/workspace/setup/setupAssistantApp/summary.js";
import { buildDraft } from "./setup-assistant-test-helpers.js";

function buildBusinessReadyDraft(extra = {}) {
  return buildDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    services: [{ title: "Consultation" }],
    contacts: [{ type: "whatsapp", value: "+994551112233" }],
    pricingPosture: {
      publicSummary: "Starts from 20 AZN.",
    },
    ...extra,
  });
}

test("setup summary tracks business sections only", () => {
  const summary = buildSummary(buildBusinessReadyDraft(), { sources: [] });

  assert.deepEqual(SETUP_SUMMARY_SECTION_ORDER, [
    "profile",
    "services",
    "pricing",
    "contacts",
    "hours",
    "handoff",
  ]);
  assert.equal(summary.totalSections, 6);
  assert.equal(summary.conversationPolicyReady, true);
  assert.equal(summary.businessTruthReady, true);
  assert.equal(summary.blockerCount, 0);
  assert.equal(summary.sectionStatus.greeting_behavior, undefined);
  assert.equal(summary.sectionStatus.tone_behavior, undefined);
});

test("setup review state is ready when required business facts are present", () => {
  const summary = buildSummary(buildBusinessReadyDraft(), { sources: [] });
  const review = buildReviewState({}, summary, {});

  assert.equal(review.readyForApproval, true);
  assert.equal(review.finalizeAvailable, true);
  assert.equal(review.status, "ready_for_review");
});

test("setup summary blockers require only profile services pricing contacts", () => {
  const summary = buildSummary(
    buildDraft({
      businessProfile: {
        companyName: "Acme Clinic",
        description: "Dental clinic",
      },
    }),
    { sources: [] }
  );

  assert.equal(summary.businessTruthReady, false);
  assert.deepEqual(
    summary.confirmationBlockers.map((item) => item.key),
    ["services", "pricing", "contacts"]
  );
  assert.equal(summary.sectionStatus.hours.required, false);
  assert.equal(summary.sectionStatus.handoff.required, false);
  assert.equal(
    summary.confirmationBlockers.some((item) => item.key === "hours"),
    false
  );
  assert.equal(
    summary.confirmationBlockers.some((item) => item.key === "handoff"),
    false
  );
});

test("setup confirmation blockers ignore optional hours and handoff", () => {
  const draft = buildBusinessReadyDraft();
  const sectionStatus = buildSectionStatus(draft, { sources: [] });
  const blockers = buildConfirmationBlockers(draft, sectionStatus, { sources: [] });

  assert.deepEqual(blockers, []);
  assert.equal(sectionStatus.hours.required, false);
  assert.equal(sectionStatus.handoff.required, false);
});
