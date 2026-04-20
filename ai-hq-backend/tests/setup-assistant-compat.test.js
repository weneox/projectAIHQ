import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAssistantCompatBusinessFacts,
} from "../src/services/workspace/setup/setupAssistantApp/compat.js";
import {
  buildSetupAssistantResponseBody,
} from "../src/services/workspace/setup/setupAssistantApp/sessionPayload.js";

const BUSINESS_NAME = "Mand Klinika";
const BUSINESS_DESCRIPTION = "Klinika i\u015Fl\u0259ri g\u00F6r\u00FCr";
const PRICING_SUMMARY = "Xidm\u0259t\u0259 g\u00F6r\u0259 d\u0259yi\u015Fir";

function createAssistant(overrides = {}) {
  return {
    phase: "interview",
    readyForApproval: false,
    draft: {
      businessName: BUSINESS_NAME,
    },
    reviewDraft: {
      businessName: BUSINESS_NAME,
      businessDescription: BUSINESS_DESCRIPTION,
      websiteUrl: "https://mand.az",
      contactRoutes: [
        "+994 51 400 55 88",
        "support@mand.az",
        "Bak\u0131 \u015F\u0259h\u0259ri",
      ],
      workingHoursLines: [
        "Mon-Fri 09:00-18:00",
      ],
      pricingSummary: PRICING_SUMMARY,
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
        businessName: BUSINESS_NAME,
      },
    })
  );

  assert.equal(facts.companyName, BUSINESS_NAME);
  assert.equal(facts.summaryShort, BUSINESS_DESCRIPTION);
  assert.equal(facts.summaryLong, BUSINESS_DESCRIPTION);
  assert.equal(facts.primaryPhone, "+994 51 400 55 88");
  assert.equal(facts.primaryEmail, "support@mand.az");
  assert.equal(facts.websiteUrl, "https://mand.az");
  assert.equal(facts.pricingPolicy, PRICING_SUMMARY);
  assert.deepEqual(facts.pricingHints, [PRICING_SUMMARY]);
  assert.deepEqual(facts.hours, ["Mon-Fri 09:00-18:00"]);
  assert.deepEqual(facts.languages, ["az"]);
});

test("setup assistant response body keeps compat businessFacts derivable from assistant reviewDraft even when draft preview is hidden", () => {
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
          businessName: BUSINESS_NAME,
        },
        reviewDraft: {
          businessName: BUSINESS_NAME,
          businessDescription: BUSINESS_DESCRIPTION,
          websiteUrl: "https://mand.az",
          contactRoutes: [
            "0514005588",
            "support@mand.az",
          ],
          workingHoursLines: [
            "Mon-Fri 09:00-18:00",
          ],
          pricingSummary: PRICING_SUMMARY,
          languages: ["az"],
        },
      }),
      draft: {},
      reviewDraft: {
        businessName: BUSINESS_NAME,
        businessDescription: BUSINESS_DESCRIPTION,
      },
      timeline: [],
    },
    timeline: [],
  };

  const response = buildSetupAssistantResponseBody(basePayload, null);
  const facts = buildAssistantCompatBusinessFacts(response.assistant);

  assert.equal(response.ok, true);
  assert.deepEqual(response.setup.draft, {});
  assert.equal(facts.companyName, BUSINESS_NAME);
  assert.equal(facts.summaryShort, BUSINESS_DESCRIPTION);
  assert.equal(facts.primaryPhone, "0514005588");
  assert.equal(facts.primaryEmail, "support@mand.az");
  assert.equal(facts.websiteUrl, "https://mand.az");
  assert.equal(facts.pricingPolicy, PRICING_SUMMARY);
  assert.deepEqual(facts.hours, ["Mon-Fri 09:00-18:00"]);
  assert.deepEqual(facts.languages, ["az"]);
});

test("setup assistant compat facts still fall back to sourceSignals when reviewDraft is also incomplete", () => {
  const facts = buildAssistantCompatBusinessFacts(
    createAssistant({
      draft: {
        businessName: BUSINESS_NAME,
      },
      reviewDraft: {
        businessName: BUSINESS_NAME,
      },
      sourceSignals: {
        primarySourceType: "website",
        primarySourceUrl: "https://mand.az",
        companyNameCandidates: [BUSINESS_NAME],
        descriptionCandidates: [BUSINESS_DESCRIPTION],
        contactCandidates: ["+994514005588", "support@mand.az"],
        hoursCandidates: ["Every day 09:00-18:00"],
        pricingCandidates: [PRICING_SUMMARY],
        serviceCandidates: ["M\u00FCayin\u0259"],
        languagesCandidates: ["az"],
      },
    })
  );

  assert.equal(facts.companyName, BUSINESS_NAME);
  assert.equal(facts.summaryShort, BUSINESS_DESCRIPTION);
  assert.equal(facts.primaryPhone, "+994514005588");
  assert.equal(facts.primaryEmail, "support@mand.az");
  assert.equal(facts.websiteUrl, "https://mand.az");
  assert.equal(facts.pricingPolicy, PRICING_SUMMARY);
  assert.deepEqual(facts.services, ["M\u00FCayin\u0259"]);
  assert.deepEqual(facts.hours, ["Every day 09:00-18:00"]);
  assert.deepEqual(facts.languages, ["az"]);
});
