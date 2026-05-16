import test from "node:test";
import assert from "node:assert/strict";

import { __test__ as setupAssistantTest } from "../src/services/workspace/setup/setupAssistantApp.js";

const { buildSetupAssistantSessionPayload } = setupAssistantTest;

function buildReviewWithSetup(setupAssistant = {}) {
  return {
    session: {
      id: "setup-session-1",
      status: "draft",
      mode: "setup",
      currentStep: "company",
    },
    draft: {
      version: 1,
      draftPayload: {
        setupAssistant,
      },
    },
    sources: [],
  };
}

test("setup source strategy is website-first but website is optional", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReviewWithSetup({
      businessProfile: {
        companyName: "Demo Clinic",
        description: "Stomatoloji klinika",
        websiteUrl: "https://demo-clinic.example",
      },
      services: [{ title: "İmplant" }, { title: "Estetik plomb" }],
      contacts: [{ type: "whatsapp", value: "+994501112233" }],
      pricingPosture: {
        publicSummary: "Qiymətlər müayinədən sonra dəyişir.",
      },
      handoffRules: {
        summary: "Tibbi risk və şikayətdə operatora ötür.",
      },
      sourceMetadata: {
        primarySourceType: "website",
        primarySourceUrl: "https://demo-clinic.example",
        evidenceSummary: ["Website source imported"],
      },
      languages: ["az-AZ"],
    })
  );

  assert.equal(payload.setup.sourceStrategy.primaryMode, "website");
  assert.equal(payload.setup.sourceStrategy.website.required, false);
  assert.equal(payload.setup.sourceStrategy.website.status, "captured");
  assert.deepEqual(payload.setup.sourceStrategy.disabledSources, ["google_maps"]);
  assert.equal(payload.setup.sourceStrategy.manualBrief.status, "available_as_fallback");
  assert.equal(payload.setup.aiProfilePreview.sourceStrategy.primaryMode, "website");
  assert.ok(payload.setup.aiProfilePreview.knows.some((item) => item.key === "services"));
  assert.ok(payload.setup.aiProfilePreview.willNotInvent.length >= 3);
});

test("setup source strategy falls back to manual brief when website is skipped or absent", () => {
  const payload = buildSetupAssistantSessionPayload(
    buildReviewWithSetup({
      businessProfile: {
        companyName: "Manual Dental",
        description: "Stomatoloji klinika",
      },
      websitePrefill: {
        status: "skipped",
      },
      services: [{ title: "Kanal müalicəsi" }],
      contacts: [],
      languages: ["az-AZ"],
    })
  );

  assert.equal(payload.setup.sourceStrategy.primaryMode, "manual_brief");
  assert.equal(payload.setup.sourceStrategy.website.required, false);
  assert.equal(payload.setup.sourceStrategy.website.status, "skipped");
  assert.equal(payload.setup.sourceStrategy.manualBrief.required, true);
  assert.equal(payload.setup.sourceStrategy.nextAction, "collect_manual_brief");
  assert.equal(payload.setup.sourceStrategy.googleMaps.enabled, false);
  assert.equal(payload.setup.aiProfilePreview.sourceStrategy.primaryMode, "manual_brief");
});
