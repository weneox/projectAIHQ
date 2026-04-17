import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeSetupAssistantCore,
  mergeSilentSynthesis,
  sanitizeSilentSynthesis,
} from "../src/services/workspace/setup/setupAssistantApp/sanitize.js";

test("sanitizeSilentSynthesis normalizes and dedupes hidden synthesis state", () => {
  const silent = sanitizeSilentSynthesis({
    hiddenSynthesis: {
      displayMode: "HIDDEN_UNTIL_REVIEW",
      status: "SYNTHESIZED",
      updatedAt: "2026-04-18T10:00:00.000Z",
      rawInputs: [
        {
          kind: "user_answer",
          step: "company",
          text: "Acme Clinic https://acme.az",
          createdAt: "2026-04-18T09:58:00.000Z",
        },
        {
          kind: "user_answer",
          step: "company",
          text: "Acme Clinic https://acme.az",
          createdAt: "2026-04-18T09:58:00.000Z",
        },
        {
          kind: "user_answer",
          step: "description",
          text: "Dental clinic in Baku",
          created_at: "2026-04-18T09:59:00.000Z",
        },
        {},
      ],
      workingDraft: {
        business_profile: {
          company_name: "Acme Clinic",
          description: "Dental clinic in Baku",
          website: "acme.az",
        },
        services: [
          { title: "Consultation" },
          { title: "Consultation" },
          { title: "Implants", service_key: "implants" },
        ],
        pricing: {
          pricing_mode: "variable_by_service",
          public_summary: "Pricing depends on the service.",
        },
      },
      reviewDraft: {
        businessName: "Acme Clinic",
        whatThisBusinessIs: "Professional dental clinic in Baku.",
        services: ["Consultation", "Implants", "Consultation"],
        pricing: "Pricing depends on the service.",
        professionalized_at: "2026-04-18T10:00:00.000Z",
      },
      unresolvedNotes: ["Confirm weekend hours", "Confirm weekend hours"],
      recommendationNotes: ["Add WhatsApp route", "Add WhatsApp route"],
    },
  });

  assert.equal(silent.visibilityMode, "hidden_until_review");
  assert.equal(silent.synthesisStatus, "synthesized");
  assert.equal(silent.lastSynthesizedAt, "2026-04-18T10:00:00.000Z");
  assert.equal(silent.rawEvidenceLog.length, 2);
  assert.deepEqual(
    silent.rawEvidenceLog.map((item) => ({
      step: item.step,
      text: item.text,
      hidden: item.hidden,
    })),
    [
      {
        step: "company",
        text: "Acme Clinic https://acme.az",
        hidden: true,
      },
      {
        step: "description",
        text: "Dental clinic in Baku",
        hidden: true,
      },
    ]
  );

  assert.equal(silent.structuredDraft.businessProfile.companyName, "Acme Clinic");
  assert.equal(
    silent.structuredDraft.businessProfile.websiteUrl,
    "https://acme.az"
  );
  assert.deepEqual(
    silent.structuredDraft.services.map((item) => item.title),
    ["Consultation", "Implants"]
  );
  assert.equal(
    silent.structuredDraft.pricingPosture.publicSummary,
    "Pricing depends on the service."
  );

  assert.equal(silent.polishedDraft.businessName, "Acme Clinic");
  assert.equal(
    silent.polishedDraft.businessDescription,
    "Professional dental clinic in Baku."
  );
  assert.deepEqual(silent.polishedDraft.coreServices, [
    "Consultation",
    "Implants",
  ]);
  assert.equal(
    silent.polishedDraft.pricingSummary,
    "Pricing depends on the service."
  );
  assert.equal(
    silent.polishedDraft.professionalizedAt,
    "2026-04-18T10:00:00.000Z"
  );
  assert.deepEqual(silent.unresolvedNotes, ["Confirm weekend hours"]);
  assert.deepEqual(silent.recommendationNotes, ["Add WhatsApp route"]);
});

test("mergeSilentSynthesis merges evidence, structured draft, and polished draft cleanly", () => {
  const merged = mergeSilentSynthesis(
    {
      visibilityMode: "hidden_until_review",
      synthesisStatus: "partial",
      lastSynthesizedAt: "2026-04-18T10:00:00.000Z",
      rawEvidenceLog: [
        {
          kind: "user_answer",
          step: "company",
          text: "Acme Clinic https://acme.az",
          createdAt: "2026-04-18T09:58:00.000Z",
        },
      ],
      structuredDraft: {
        businessProfile: {
          companyName: "Acme Clinic",
        },
        services: [{ title: "Consultation" }],
      },
      polishedDraft: {
        businessName: "Acme Clinic",
        coreServices: ["Consultation"],
      },
      unresolvedNotes: ["Need pricing"],
      recommendationNotes: ["Confirm hours"],
    },
    {
      synthesisStatus: "synthesized",
      lastSynthesizedAt: "2026-04-18T10:05:00.000Z",
      rawEvidenceLog: [
        {
          kind: "user_answer",
          step: "company",
          text: "Acme Clinic https://acme.az",
          createdAt: "2026-04-18T09:58:00.000Z",
        },
        {
          kind: "user_answer",
          step: "pricing",
          text: "Pricing depends on the service.",
          createdAt: "2026-04-18T10:04:00.000Z",
        },
      ],
      structuredDraft: {
        pricingPosture: {
          publicSummary: "Pricing depends on the service.",
        },
        services: [{ title: "Consultation" }, { title: "Implants" }],
      },
      polishedDraft: {
        businessDescription: "Professional dental clinic in Baku.",
        coreServices: ["Consultation", "Implants"],
        pricingSummary: "Pricing depends on the service.",
      },
      unresolvedNotes: ["Need pricing"],
      recommendationNotes: ["Add WhatsApp"],
    }
  );

  assert.equal(merged.synthesisStatus, "synthesized");
  assert.equal(merged.lastSynthesizedAt, "2026-04-18T10:05:00.000Z");
  assert.equal(merged.rawEvidenceLog.length, 2);
  assert.deepEqual(
    merged.rawEvidenceLog.map((item) => item.step),
    ["company", "pricing"]
  );

  assert.equal(merged.structuredDraft.businessProfile.companyName, "Acme Clinic");
  assert.equal(
    merged.structuredDraft.pricingPosture.publicSummary,
    "Pricing depends on the service."
  );
  assert.deepEqual(
    merged.structuredDraft.services.map((item) => item.title),
    ["Consultation", "Implants"]
  );

  assert.equal(merged.polishedDraft.businessName, "Acme Clinic");
  assert.equal(
    merged.polishedDraft.businessDescription,
    "Professional dental clinic in Baku."
  );
  assert.deepEqual(merged.polishedDraft.coreServices, [
    "Consultation",
    "Implants",
  ]);
  assert.equal(
    merged.polishedDraft.pricingSummary,
    "Pricing depends on the service."
  );
  assert.deepEqual(merged.unresolvedNotes, ["Need pricing"]);
  assert.deepEqual(merged.recommendationNotes, ["Confirm hours", "Add WhatsApp"]);
});

test("mergeSetupAssistantCore preserves silentSynthesis alongside normal setup updates", () => {
  const merged = mergeSetupAssistantCore(
    {
      businessProfile: {
        companyName: "Acme Clinic",
      },
      silentSynthesis: {
        rawEvidenceLog: [
          {
            kind: "user_answer",
            step: "company",
            text: "Acme Clinic",
            createdAt: "2026-04-18T09:58:00.000Z",
          },
        ],
        structuredDraft: {
          businessProfile: {
            companyName: "Acme Clinic",
          },
        },
        polishedDraft: {
          businessName: "Acme Clinic",
        },
      },
    },
    {
      pricingPosture: {
        publicSummary: "Pricing depends on the service.",
      },
    }
  );

  assert.equal(
    merged.pricingPosture.publicSummary,
    "Pricing depends on the service."
  );
  assert.equal(merged.silentSynthesis.rawEvidenceLog.length, 1);
  assert.equal(
    merged.silentSynthesis.structuredDraft.businessProfile.companyName,
    "Acme Clinic"
  );
  assert.equal(merged.silentSynthesis.polishedDraft.businessName, "Acme Clinic");
});
