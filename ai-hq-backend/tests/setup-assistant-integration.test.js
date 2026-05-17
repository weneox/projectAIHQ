import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { __test__ as orchestratorTest } from "../src/services/workspace/setup/setupAssistantOpenAIOrchestrator.js";
import { updateSetupAssistantDraft } from "../src/services/workspace/setup/setupAssistantApp/flows.js";
import {
  FIXED_ISO,
  buildDraft,
  buildReview,
} from "./setup-assistant-test-helpers.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createIntegrationHarness(review = buildReview()) {
  let currentReview = clone(review);

  return {
    getReview() {
      return clone(currentReview);
    },
    async update(body) {
      return updateSetupAssistantDraft(
        {
          db: null,
          actor: {
            tenantId: "tenant-1",
            user: {
              id: "4f08d501-1c8f-4f0b-a7bf-2c924f7dad55",
            },
          },
          body,
        },
        {
          getCurrentSetupReview: async () => clone(currentReview),
          patchSetupReviewDraft: async ({ patch, bumpVersion }) => {
            currentReview = {
              ...currentReview,
              draft: {
                ...currentReview.draft,
                version: bumpVersion
                  ? Number(currentReview.draft.version || 0) + 1
                  : currentReview.draft.version,
                updatedAt: FIXED_ISO,
                draftPayload: clone(patch.draftPayload),
              },
            };
          },
          updateSetupReviewSession: async (_reviewSessionId, patch) => {
            currentReview = {
              ...currentReview,
              session: {
                ...currentReview.session,
                ...clone(patch),
                updatedAt: FIXED_ISO,
              },
            };
          },
          auditSetupAction: async () => {},
        }
      );
    },
  };
}

function reasonerPayload(overrides = {}) {
  return {
    action: "direct_answer",
    targetStep: "",
    reason: "",
    companyName: "",
    description: "",
    services: [],
    contacts: [],
    hours: [],
    pricingPosture: "",
    humanHandoff: "",
    websiteUrl: "",
    ...overrides,
  };
}

test("realistic message turns use OpenAI brain for hidden synthesis while replies stay short", async (t) => {
  const previous = {
    openaiApiKey: cfg.ai.openaiApiKey,
    openaiSetupAssistantEnabled: cfg.ai.openaiSetupAssistantEnabled,
    openaiSetupForceFallback: cfg.ai.openaiSetupForceFallback,
    openaiSetupModel: cfg.ai.openaiSetupModel,
  };

  cfg.ai.openaiApiKey = "test-key";
  cfg.ai.openaiSetupAssistantEnabled = true;
  cfg.ai.openaiSetupForceFallback = false;
  cfg.ai.openaiSetupModel = "test-model";

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        const userPrompt = String(
          request?.input?.find((item) => item?.role === "user")?.content || ""
        );

        const latestMessage =
          userPrompt.match(/"latestUserMessage":\s*"([^"]*)"/)?.[1] || "";

        if (latestMessage.includes("We help patients")) {
          return {
            output_parsed: reasonerPayload({
              targetStep: "description",
              description: "We help patients with cleaning and implants.",
            }),
          };
        }

        if (latestMessage.includes("cleaning, implants")) {
          return {
            output_parsed: reasonerPayload({
              targetStep: "services",
              services: ["cleaning", "implants"],
            }),
          };
        }

        if (latestMessage.includes("+994551112233")) {
          return {
            output_parsed: reasonerPayload({
              targetStep: "contacts",
              contacts: ["WhatsApp +994551112233"],
            }),
          };
        }

        if (latestMessage.includes("Acme Dental")) {
          return {
            output_parsed: reasonerPayload({
              targetStep: "company",
              companyName: "Acme Dental",
              websiteUrl: "https://acme.az",
            }),
          };
        }

        return {
          output_parsed: reasonerPayload({
            targetStep: "pricing",
            pricingPosture: "pricing depends on the service",
          }),
        };
      },
    },
  });

  t.after(() => {
    Object.assign(cfg.ai, previous);
    orchestratorTest.clearCachedClient();
  });

  const harness = createIntegrationHarness(
    buildReview({
      currentStep: "company",
      setupAssistant: buildDraft({
        languages: ["en"],
      }),
    })
  );

  const turns = [
    ["company", "Acme Dental https://acme.az"],
    ["description", "We help patients with cleaning and implants."],
    ["services", "cleaning, implants"],
    ["contacts", "WhatsApp +994551112233"],
    ["pricing", "pricing depends on the service"],
  ];

  const evidenceCounts = [];
  const replyWordCounts = [];

  for (const [step, message] of turns) {
    const result = await harness.update({
      mode: "message",
      step,
      message,
    });

    assert.equal(result.status, 200);
    assert.notEqual(result.body.setup.assistant.provider, "local_reasoning");

    replyWordCounts.push(
      String(result.body.setup.assistant.message || "")
        .split(/\s+/)
        .filter(Boolean).length
    );
    assert.doesNotMatch(result.body.setup.assistant.message, /debug|source/i);

    const persisted =
      harness.getReview().draft.draftPayload.setupAssistant.silentSynthesis;
    evidenceCounts.push(persisted.rawEvidenceLog.length);
  }

  assert.deepEqual(evidenceCounts, [1, 2, 3, 4, 5]);
  assert.ok(replyWordCounts.every((count) => count <= 25));

  const finalPayload = harness.getReview().draft.draftPayload.setupAssistant;
  const finalSilent = finalPayload.silentSynthesis;

  assert.equal(finalSilent.synthesisStatus, "synthesized");
  assert.equal(finalSilent.rawEvidenceLog.length, 5);
  assert.equal(
    finalSilent.structuredDraft.businessProfile.companyName,
    "Acme Dental"
  );
  assert.equal(
    finalSilent.structuredDraft.businessProfile.description,
    "We help patients with cleaning and implants."
  );
  assert.deepEqual(
    finalSilent.structuredDraft.services.map((item) => item.title),
    ["cleaning", "implants"]
  );
  assert.match(
    finalSilent.structuredDraft.pricingPosture.publicSummary,
    /service/i
  );

  assert.equal(finalSilent.polishedDraft.businessName, "Acme Dental");
  assert.equal(finalSilent.polishedDraft.websiteUrl, "https://acme.az");
  assert.ok(!finalSilent.polishedDraft.businessName.includes("http"));
  assert.deepEqual(finalSilent.polishedDraft.coreServices, [
    "cleaning",
    "implants",
  ]);
  assert.match(finalSilent.polishedDraft.pricingSummary, /service|quote|details/i);
  assert.ok(finalSilent.polishedDraft.professionalizedAt);
});


test("runtime source evidence creates review-ready hidden synthesis without behavior leftovers", async (t) => {
  const previous = {
    openaiApiKey: cfg.ai.openaiApiKey,
    openaiSetupAssistantEnabled: cfg.ai.openaiSetupAssistantEnabled,
    openaiSetupForceFallback: cfg.ai.openaiSetupForceFallback,
    openaiSetupModel: cfg.ai.openaiSetupModel,
  };

  cfg.ai.openaiApiKey = "test-key";
  cfg.ai.openaiSetupAssistantEnabled = true;
  cfg.ai.openaiSetupForceFallback = false;
  cfg.ai.openaiSetupModel = "test-model";

  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        capturedRequest = request;

        return {
          output_parsed: reasonerPayload({
            action: "business_brief",
            targetStep: "company",
            reason: "Official website evidence contains the complete setup facts.",
            companyName: "Runtime Dental",
            description: "Dental clinic in Baku focused on implants and cleaning.",
            services: ["Implants", "Cleaning"],
            contacts: ["WhatsApp +994551112233", "hello@runtime.az"],
            hours: ["Monday-Friday 09:00-18:00"],
            pricingPosture: "Pricing depends on the service and case complexity.",
            humanHandoff: "Route urgent pain, complaints, appointment changes, and exact quotes to a human operator.",
            websiteUrl: "https://runtime.az",
          }),
        };
      },
    },
  });

  t.after(() => {
    Object.assign(cfg.ai, previous);
    orchestratorTest.clearCachedClient();
  });

  const harness = createIntegrationHarness(
    buildReview({
      currentStep: "company",
      setupAssistant: buildDraft({
        languages: ["en"],
        progress: {
          currentQuestionKey: "company",
          lastAnsweredStep: "",
          skippedQuestions: [],
          updatedAt: FIXED_ISO,
        },
      }),
      sources: [
        {
          sourceType: "website",
          role: "primary",
          label: "Official website",
          sourceUrl: "https://runtime.az",
          text:
            "Runtime Dental is a dental clinic in Baku focused on implants and cleaning. Contact WhatsApp +994551112233 or hello@runtime.az. Working hours are Monday-Friday 09:00-18:00. Pricing depends on the service and case complexity. Urgent pain, complaints, appointment changes, and exact quotes should go to a human operator.",
        },
      ],
    })
  );

  const result = await harness.update({
    mode: "message",
    step: "company",
    message: "Use the website source and prepare the setup.",
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.setup.assistant.provider, "openai_business_brain");
  assert.equal(result.body.setup.assistant.readyForApproval, true);
  assert.equal(result.body.setup.assistant.nextQuestion ?? null, null);

  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );

  assert.match(userPrompt, /sourceEvidence/);
  assert.match(userPrompt, /Runtime Dental/);
  assert.match(userPrompt, /sourceEvidenceCanFillMissingBusinessFacts/);

  const finalPayload = harness.getReview().draft.draftPayload.setupAssistant;
  const finalBrain = harness.getReview().draft.draftPayload.setupAssistantBrain;
  const finalSilent = finalPayload.silentSynthesis;

  assert.equal(finalSilent.synthesisStatus, "synthesized");
  assert.equal(finalSilent.structuredDraft.businessProfile.companyName, "Runtime Dental");
  assert.equal(finalSilent.structuredDraft.businessProfile.websiteUrl, "https://runtime.az");
  assert.deepEqual(
    finalSilent.structuredDraft.services.map((item) => item.title),
    ["Implants", "Cleaning"]
  );
  assert.ok(
    finalSilent.structuredDraft.contacts.some((item) =>
      String(item.value || item.label || "").includes("+994551112233")
    )
  );
  assert.match(finalSilent.structuredDraft.pricingPosture.publicSummary, /case complexity/i);
  assert.match(finalSilent.structuredDraft.handoffRules.summary, /urgent pain/i);

  assert.equal(finalSilent.polishedDraft.businessName, "Runtime Dental");
  assert.deepEqual(finalSilent.polishedDraft.coreServices, ["Implants", "Cleaning"]);
  assert.match(finalSilent.polishedDraft.pricingSummary, /case complexity/i);

  assert.deepEqual(finalBrain.aiBehavior || {}, {});
  assert.equal(Object.prototype.hasOwnProperty.call(finalPayload, "assistantBehaviorDraft"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(finalSilent.structuredDraft, "assistantBehaviorDraft"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(finalSilent.polishedDraft, "assistantBehaviorDraft"), false);

  const serialized = JSON.stringify({
    setupAssistant: finalPayload,
    setupAssistantBrain: finalBrain,
  });

  assert.doesNotMatch(
    serialized,
    /pricingBehavior|locationBehavior|bookingBehavior|contactBehavior|handoffBehavior|greetingStyle|afterHoursBehavior/
  );
});
