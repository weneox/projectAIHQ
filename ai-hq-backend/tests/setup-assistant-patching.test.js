import test from "node:test";
import assert from "node:assert/strict";

import {
  buildSetupAssistantPatchFromAcceptedPatch,
  mergeSetupAssistantDraft,
  normalizeSetupAssistantDraftPatchBody,
} from "../src/services/workspace/setup/setupAssistantApp/patching.js";
import { buildCompleteBusinessDraft, buildDraft } from "./setup-assistant-test-helpers.js";

test("direct structured patch updates business fields", () => {
  const patch = normalizeSetupAssistantDraftPatchBody({
    businessProfile: {
      companyName: "Acme Clinic",
      websiteUrl: "https://acme.az",
      description: "Dental clinic.",
    },
    services: [{ title: "Implant" }],
    contacts: [{ type: "whatsapp", value: "+994501112233" }],
    pricingPosture: {
      publicSummary: "Pricing depends on the service.",
    },
  });

  assert.equal(patch.businessProfile.companyName, "Acme Clinic");
  assert.equal(patch.businessProfile.websiteUrl, "https://acme.az");
  assert.equal(patch.businessProfile.description, "Dental clinic.");
  assert.equal(patch.services[0].title, "Implant");
  assert.equal(patch.contacts[0].value, "+994501112233");
  assert.equal(patch.pricingPosture.publicSummary, "Pricing depends on the service.");
});

test("step answer bodies no longer create keyword business patches", () => {
  const patch = normalizeSetupAssistantDraftPatchBody(
    {
      step: "company",
      answer: "Acme Clinic acme.az",
    },
    buildDraft()
  );

  assert.deepEqual(patch, {});
});

test("behavior answer bodies no longer create keyword policy patches", () => {
  const patch = normalizeSetupAssistantDraftPatchBody(
    {
      step: "pricing_behavior",
      answer: "ask service first",
    },
    buildDraft()
  );

  assert.deepEqual(patch, {});
});

test("mergeSetupAssistantDraft preserves business data and ignores structured behavior patch", () => {
  const merged = mergeSetupAssistantDraft(
    buildCompleteBusinessDraft(),
    normalizeSetupAssistantDraftPatchBody({
      contacts: [{ type: "whatsapp", value: "+994551112233" }],
      assistantBehaviorDraft: {
        contactPolicy: {
          mode: "whatsapp_first",
          preferredChannel: "whatsapp",
        },
      },
    }),
    {}
  );

  assert.equal(merged.businessProfile.companyName, "Acme Clinic");
  assert.equal(merged.pricingPosture.publicSummary, "Starts from 20 AZN.");
  assert.equal(merged.contacts[0].value, "+994551112233");
  assert.notEqual(merged.assistantBehaviorDraft?.contactPolicy?.mode, "whatsapp_first");
});

test("mergeSetupAssistantDraft keeps existing hidden synthesis while structured patches update raw setup fields", () => {
  const current = buildCompleteBusinessDraft({
    silentSynthesis: {
      synthesisStatus: "synthesized",
      rawEvidenceLog: [
        {
          kind: "user_answer",
          step: "company",
          text: "Acme Clinic",
          createdAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      polishedDraft: {
        businessName: "Acme Clinic",
      },
    },
  });

  const merged = mergeSetupAssistantDraft(
    current,
    normalizeSetupAssistantDraftPatchBody({
      pricingPosture: {
        publicSummary: "Pricing depends on the service.",
      },
    }),
    {}
  );

  assert.equal(merged.pricingPosture.publicSummary, "Pricing depends on the service.");
  assert.equal(merged.silentSynthesis.synthesisStatus, "synthesized");
  assert.equal(merged.silentSynthesis.rawEvidenceLog.length, 1);
  assert.equal(merged.silentSynthesis.polishedDraft.businessName, "Acme Clinic");
});

test("buildSetupAssistantPatchFromAcceptedPatch ignores legacy LLM behavior policies", () => {
  const patch = buildSetupAssistantPatchFromAcceptedPatch(
    {
      latestUserInput: {
        step: "booking_behavior",
      },
      nextQuestion: {
        key: "contact_behavior",
      },
      acceptedPatch: {
        bookingPolicy: {
          mode: "route_whatsapp",
          preferredTargetUrl: "https://wa.me/994551112233",
        },
      },
    },
    buildDraft()
  );

  assert.equal(patch.assistantBehaviorDraft, undefined);
  assert.equal(patch.progress.lastAnsweredStep, "booking_behavior");
  assert.equal(patch.progress.currentQuestionKey, "contact_behavior");
  assert.equal(patch.assistantState.activeSection, "contact_behavior");
  assert.equal(patch.assistantState?.activeBehaviorPolicy || "", "");
});
