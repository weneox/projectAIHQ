import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeSetupAssistantCore,
  sanitizeAssistantBehaviorDraft,
  sanitizeSetupAssistantCore,
  sanitizeSilentSynthesis,
} from "../src/services/workspace/setup/setupAssistantApp/sanitize.js";

test("setup sanitizer ignores legacy assistant behavior draft", () => {
  const sanitized = sanitizeSetupAssistantCore({
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic",
    },
    assistantBehaviorDraft: {
      contactPolicy: {
        mode: "whatsapp_first",
      },
    },
    assistantState: {
      activeSection: "pricing",
      activeBehaviorPolicy: "contact",
    },
  });

  assert.equal(sanitized.businessProfile.companyName, "Acme Clinic");
  assert.equal(sanitized.assistantBehaviorDraft, undefined);
  assert.equal(sanitized.assistantState.activeSection, "pricing");
  assert.equal(sanitized.assistantState.activeBehaviorPolicy, undefined);
});

test("legacy behavior draft sanitizer is a compatibility no-op", () => {
  assert.deepEqual(
    sanitizeAssistantBehaviorDraft({
      pricingPolicy: {
        mode: "ask_service_first",
      },
    }),
    {}
  );
});

test("silent synthesis keeps business draft only", () => {
  const sanitized = sanitizeSilentSynthesis({
    structuredDraft: {
      businessProfile: {
        companyName: "Acme Clinic",
      },
      assistantBehaviorDraft: {
        pricingPolicy: {
          mode: "ask_service_first",
        },
      },
    },
    polishedDraft: {
      businessName: "Acme Clinic",
      pricingBehaviorSummary: "ask service first",
    },
  });

  assert.equal(
    sanitized.structuredDraft.businessProfile.companyName,
    "Acme Clinic"
  );
  assert.equal(sanitized.structuredDraft.assistantBehaviorDraft, undefined);
  assert.equal(sanitized.polishedDraft.businessName, "Acme Clinic");
  assert.equal(sanitized.polishedDraft.pricingBehaviorSummary, undefined);
});

test("mergeSetupAssistantCore ignores incoming behavior draft", () => {
  const merged = mergeSetupAssistantCore(
    {
      businessProfile: {
        companyName: "Acme Clinic",
      },
    },
    {
      assistantBehaviorDraft: {
        contactPolicy: {
          mode: "whatsapp_first",
        },
      },
      assistantState: {
        activeBehaviorPolicy: "contact",
      },
    }
  );

  assert.equal(merged.businessProfile.companyName, "Acme Clinic");
  assert.equal(merged.assistantBehaviorDraft, undefined);
  assert.equal(merged.assistantState.activeBehaviorPolicy, undefined);
});
