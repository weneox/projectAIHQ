import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSetupDraftStateFromSignals,
  buildSetupKnownState,
  buildSetupSourceSignals,
  detectSetupSignalContradictions,
} from "../src/services/workspace/setup/setupAssistantApp/sourceSignals.js";
import {
  buildBehaviorTargetCandidate,
  buildDefaultAssistantBehaviorDraft,
  normalizeBehaviorPolicyKey,
} from "../src/services/workspace/setup/setupAssistantApp/shared.js";
import { buildDraft } from "./setup-assistant-test-helpers.js";

function createSourceRichDraft() {
  return buildDraft({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
      websiteUrl: "https://acme.az",
    },
    services: [{ title: "Consultation" }],
    contacts: [{ label: "WhatsApp", value: "https://wa.me/994551112233" }],
    hours: [
      {
        day: "monday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
    ],
    pricingPosture: {
      publicSummary: "Starts from 20 AZN.",
    },
    handoffRules: {
      enabled: true,
      summary:
        "If the customer asks for an operator, there is a complaint, or it is urgent, route to a human.",
    },
    sourceMetadata: {
      primarySourceType: "website",
      primarySourceUrl: "https://acme.az",
      evidenceSummary: ["Consultation available"],
    },
  });
}

test("source signals are evidence-only and do not infer business facts by keywords", () => {
  const draft = createSourceRichDraft();

  const signals = buildSetupSourceSignals({
    draft,
    sources: [
      {
        sourceType: "website",
        role: "primary",
        label: "Website",
        sourceUrl: "https://acme.az",
        text: "This source text may mention implants, cleaning, pricing, and hours.",
      },
      {
        sourceType: "website",
        role: "supporting",
        label: "Pricing",
        sourceUrl: "https://acme.az/pricing",
      },
    ],
  });

  assert.equal(signals.primarySourceUrl, "https://acme.az");
  assert.equal(signals.companyNameCandidates[0], "Acme Clinic");
  assert.deepEqual(signals.serviceCandidates, ["Consultation"]);
  assert.equal(
    signals.serviceCandidates.includes("This source text may mention implants, cleaning, pricing, and hours."),
    false
  );
  assert.equal(Object.prototype.hasOwnProperty.call(signals, "suggestedAssistantBehaviorDraft"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(signals, "pricingTargetCandidates"), false);
});

test("shared behavior helpers are compatibility no-ops", () => {
  assert.deepEqual(buildDefaultAssistantBehaviorDraft(), {});
  assert.equal(normalizeBehaviorPolicyKey("pricing_policy"), "");
  assert.equal(buildBehaviorTargetCandidate("https://acme.az/pricing"), null);
});

test("draft state stays grounded in draft and source metadata only", () => {
  const draft = createSourceRichDraft();
  const signals = buildSetupSourceSignals({
    draft,
    sources: [
      {
        sourceType: "website",
        role: "primary",
        label: "Website",
        sourceUrl: "https://acme.az",
      },
    ],
  });

  const draftState = buildSetupDraftStateFromSignals({
    draft,
    sourceSignals: signals,
  });

  assert.equal(draftState.businessName, "Acme Clinic");
  assert.equal(draftState.locationTargetUrl, undefined);
  assert.equal(
    Object.prototype.hasOwnProperty.call(draftState, "suggestedAssistantBehaviorDraft"),
    false
  );

  const contradictions = detectSetupSignalContradictions({
    draftState: {
      businessName: "Other Brand",
      websiteUrl: "https://other.example",
      services: ["Surgery"],
    },
    sourceSignals: signals,
  });

  assert.deepEqual(
    contradictions.map((item) => item.key),
    ["business_name_conflict", "website_conflict", "services_conflict"]
  );
  assert.deepEqual(buildSetupKnownState(draftState), [
    "name: Acme Clinic",
    "description present",
    "1 service signals",
    "contact route present",
    "hours present",
    "pricing posture present",
  ]);
});

test("generic source labels do not become candidate business facts", () => {
  const signals = buildSetupSourceSignals({
    draft: buildDraft({
      sourceMetadata: {
        primarySourceType: "website",
        primarySourceUrl: "https://acme.az",
        sourceLabels: ["website", "contact", "services"],
        evidenceSummary: ["website", "contact", "services"],
      },
    }),
    sources: [
      {
        sourceType: "website",
        role: "primary",
        label: "website",
        sourceUrl: "https://acme.az",
      },
    ],
  });

  assert.deepEqual(signals.companyNameCandidates, []);
  assert.deepEqual(signals.serviceCandidates, []);
  assert.ok(signals.strongestEvidence.some((item) => /website/i.test(item)));
});
