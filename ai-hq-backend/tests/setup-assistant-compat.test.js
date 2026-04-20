import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssistantCompatBusinessFacts,
} from "../src/services/workspace/setup/setupAssistantApp/compat.js";
import {
  buildSetupAssistantResponseBody,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";

function createAssistant(overrides = {}) {
  return {
    phase: "interview",
    readyForApproval: false,
    draft: {
      businessName: "Mand Klinika",
    },
    reviewDraft: {
      businessName: "Mand Klinika",
      businessDescription: "Klinika işləri görür",
      websiteUrl: "https://mand.az",
      contactRoutes: [
        "+994 51 400 55 88",
        "support@mand.az",
        "Bakı şəhəri",
      ],
      workingHoursLines: [
        "Mon-Fri 09:00-18:00",
      ],
      pricingSummary: "Xidmətə görə dəyişir",
      languages: ["az"],
    },
    sourceSignals: {
      contactCandidates: [],
      serviceCandidates: [],
      hoursCandidates: [],
      pricingCandidates: [],
      companyNameCandidates: [],
      descriptionCandidates: [],
      languagesCandidates: [],
      primarySourceType: "website",
      primarySourceUrl: "https://mand.az",
    },
    recommendation: {
      notes: [],
    },
    confidence: {
      strong: [],
      unclear: [],
      contradictions: [],
    },
    interviewPlan: {
      activeQuestions: [],
    },
    ...overrides,
  };
}

test("setup assistant compat facts use reviewDraft fallback when user-facing draft is sparse", () => {
  const facts = buildAssistantCompatBusinessFacts(
    createAssistant({
      draft: {
        businessName: "Mand Klinika",
      },
    })
  );

  assert.equal(facts.companyName, "Mand Klinika");
  assert.equal(facts.summaryShort, "Klinika işləri görür");
  assert.equal(facts.summaryLong, "Klinika işləri görür");
  assert.equal(facts.primaryPhone, "+994 51 400 55 88");
  assert.equal(facts.primaryEmail, "support@mand.az");
  assert.equal(facts.websiteUrl, "https://mand.az");
  assert.equal(facts.pricingPolicy, "Xidmətə görə dəyişir");
  assert.deepEqual(facts.pricingHints, ["Xidmətə görə dəyişir"]);
  assert.deepEqual(facts.hours, ["Mon-Fri 09:00-18:00"]);
  assert.deepEqual(facts.languages, ["az"]);
});

test("setup assistant response body exposes compat businessFacts from reviewDraft even when draft preview is hidden", () => {
  const basePayload = {
    session: {
      id: "session-1",
      status: "draft",
      mode: "setup",
      currentStep: "contacts",
      draftVersion: 3,
    },
    setup: {
      status: "draft_in_progress",
      draftOnly: true,
      sourceType: "setup_assistant",
      namespace: "setup_assistant",
      review: {
        status: "draft_in_progress",
        readyForReview: false,
        readyForApproval: false,
        finalizeAvailable: false,
        finalized: false,
        message: "",
      },
      assistant: createAssistant({
        draft: {
          businessName: "Mand Klinika",
        },
        reviewDraft: {
          businessName: "Mand Klinika",
          businessDescription: "Klinika işləri görür",
          websiteUrl: "https://mand.az",
          contactRoutes: [
            "0514005588",
            "support@mand.az",
          ],
          workingHoursLines: [
            "Mon-Fri 09:00-18:00",
          ],
          pricingSummary: "Xidmətə görə dəyişir",
          languages: ["az"],
        },
      }),
      draft: {},
      reviewDraft: {
        businessName: "Mand Klinika",
        businessDescription: "Klinika işləri görür",
      },
      timeline: [],
    },
    timeline: [],
  };

  const response = buildSetupAssistantResponseBody(basePayload, null);

  assert.equal(response.ok, true);
  assert.equal(response.businessFacts.companyName, "Mand Klinika");
  assert.equal(response.businessFacts.summaryShort, "Klinika işləri görür");
  assert.equal(response.businessFacts.primaryPhone, "0514005588");
  assert.equal(response.businessFacts.primaryEmail, "support@mand.az");
  assert.equal(response.businessFacts.websiteUrl, "https://mand.az");
  assert.equal(response.businessFacts.pricingPolicy, "Xidmətə görə dəyişir");
  assert.deepEqual(response.businessFacts.hours, ["Mon-Fri 09:00-18:00"]);
  assert.deepEqual(response.businessFacts.languages, ["az"]);
});

test("setup assistant compat facts still fall back to sourceSignals when reviewDraft is also incomplete", () => {
  const facts = buildAssistantCompatBusinessFacts(
    createAssistant({
      draft: {
        businessName: "Mand Klinika",
      },
      reviewDraft: {
        businessName: "Mand Klinika",
      },
      sourceSignals: {
        primarySourceType: "website",
        primarySourceUrl: "https://mand.az",
        companyNameCandidates: ["Mand Klinika"],
        descriptionCandidates: ["Klinika işləri görür"],
        contactCandidates: ["+994514005588", "support@mand.az"],
        hoursCandidates: ["Every day 09:00-18:00"],
        pricingCandidates: ["Xidmətə görə dəyişir"],
        serviceCandidates: ["Müayinə"],
        languagesCandidates: ["az"],
      },
    })
  );

  assert.equal(facts.companyName, "Mand Klinika");
  assert.equal(facts.summaryShort, "Klinika işləri görür");
  assert.equal(facts.primaryPhone, "+994514005588");
  assert.equal(facts.primaryEmail, "support@mand.az");
  assert.equal(facts.websiteUrl, "https://mand.az");
  assert.equal(facts.pricingPolicy, "Xidmətə görə dəyişir");
  assert.deepEqual(facts.services, ["Müayinə"]);
  assert.deepEqual(facts.hours, ["Every day 09:00-18:00"]);
  assert.deepEqual(facts.languages, ["az"]);
});