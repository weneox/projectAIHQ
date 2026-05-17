import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import {
  __test__ as orchestratorTest,
  runSetupAssistantOpenAIOrchestrator,
} from "../src/services/workspace/setup/setupAssistantOpenAIOrchestrator.js";
import {
  buildCompleteBusinessDraft,
  buildDraft,
} from "./setup-assistant-test-helpers.js";

function withOpenAISetupConfig(t, overrides = {}) {
  const previous = {
    openaiApiKey: cfg.ai.openaiApiKey,
    openaiSetupAssistantEnabled: cfg.ai.openaiSetupAssistantEnabled,
    openaiSetupForceFallback: cfg.ai.openaiSetupForceFallback,
    openaiSetupModel: cfg.ai.openaiSetupModel,
    openaiSetupEnableTurnPolisher: cfg.ai.openaiSetupEnableTurnPolisher,
    openaiSetupTurnPolisherReadyOnly: cfg.ai.openaiSetupTurnPolisherReadyOnly,
  };

  Object.assign(cfg.ai, {
    openaiApiKey: "test-key",
    openaiSetupAssistantEnabled: true,
    openaiSetupForceFallback: false,
    openaiSetupModel: "test-model",
    openaiSetupEnableTurnPolisher: false,
    openaiSetupTurnPolisherReadyOnly: true,
    ...overrides,
  });

  t.after(() => {
    Object.assign(cfg.ai, previous);
    orchestratorTest.clearCachedClient();
  });
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

function setReasonerClient(payloadFactory) {
  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => ({
        output_parsed: payloadFactory(request),
      }),
    },
  });
}

test("business-step answers require OpenAI brain and produce hidden preview from acceptedPatch", async (t) => {
  withOpenAISetupConfig(t);
  setReasonerClient(() =>
    reasonerPayload({
      action: "direct_answer",
      targetStep: "services",
      services: ["consultation", "implants"],
    })
  );

  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
      websiteUrl: "https://acme.az",
    },
    progress: {
      currentQuestionKey: "services",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "services" },
    draft,
    review: {
      draft,
      session: { currentStep: "services" },
    },
    latestStep: "services",
    latestMessage: "consultation, implants",
  });

  assert.equal(result.provider, "openai_business_brain");
  assert.deepEqual(result.acceptedPatch.services, ["consultation", "implants"]);
  assert.equal(result.nextQuestion.key, "contacts");
  assert.equal(result.draft.businessName, "Acme Clinic");
  assert.deepEqual(result.draft.coreServices, ["consultation", "implants"]);
  assert.equal(result.sourceSignals.primarySourceUrl, "https://acme.az");
  assert.match(result.assistantMessage, /^Okay\./);
  assert.doesNotMatch(result.assistantMessage, /debug|source/i);
});

test("non-empty setup messages do not use local keyword fallback when OpenAI brain is unavailable", async (t) => {
  withOpenAISetupConfig(t, {
    openaiApiKey: "",
    openaiSetupAssistantEnabled: false,
    openaiSetupForceFallback: true,
  });
  orchestratorTest.clearCachedClient();

  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    progress: {
      currentQuestionKey: "services",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "services" },
    draft,
    review: {
      draft,
      session: { currentStep: "services" },
    },
    latestStep: "services",
    latestMessage: "consultation, implants",
    forceFallback: true,
  });

  assert.equal(result.provider, "setup_brain_unavailable");
  assert.deepEqual(result.acceptedPatch, {});
  assert.equal(result.usedFallback, false);
  assert.match(result.error, /openai_setup_brain_forced_off/);
  assert.match(result.assistantMessage, /OpenAI setup brain/i);
});

test("contact-step answers carry contacts without fake cross-step behavior chatter", async (t) => {
  withOpenAISetupConfig(t);
  setReasonerClient(() =>
    reasonerPayload({
      action: "direct_answer",
      targetStep: "contacts",
      contacts: ["WhatsApp +994551112233"],
    })
  );

  const draft = buildCompleteBusinessDraft({
    languages: ["en"],
    contacts: [],
    progress: {
      currentQuestionKey: "contacts",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "contacts" },
    draft,
    review: {
      draft,
      session: { currentStep: "contacts" },
    },
    latestStep: "contacts",
    latestMessage: "WhatsApp +994551112233, WhatsApp first",
  });

  assert.ok(result.acceptedPatch.contacts.some((item) => /\+994551112233/.test(item)));
  assert.equal(Object.prototype.hasOwnProperty.call(result.acceptedPatch, "assistantBehaviorDraft"), false);
  assert.equal(result.readyForApproval, true);
  assert.equal(result.nextQuestion, null);
  assert.doesNotMatch(
    result.assistantMessage,
    /behavior|preference|pricing page|contact policy/i
  );
});

test("correction flow works through OpenAI acceptedPatch without leaking unrelated updates", async (t) => {
  withOpenAISetupConfig(t);
  setReasonerClient(() =>
    reasonerPayload({
      action: "correction",
      targetStep: "company",
      companyName: "Alpha Clinic",
    })
  );

  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Old Brand",
      description: "Dental clinic in Baku",
    },
    progress: {
      currentQuestionKey: "services",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "services" },
    draft,
    review: {
      draft,
      session: { currentStep: "services" },
    },
    latestStep: "services",
    latestMessage: "actually company Alpha Clinic",
  });

  assert.match(result.acceptedPatch.identity.businessName, /Alpha Clinic/i);
  assert.deepEqual(result.acceptedPatch.services || [], []);
  assert.equal(result.nextQuestion.key, "services");
  assert.match(result.assistantMessage, /^Updated\./);
});

test("pricing answers like 'xidmete gore deyisir' are accepted by OpenAI brain as pricing posture", async (t) => {
  withOpenAISetupConfig(t);
  setReasonerClient(() =>
    reasonerPayload({
      action: "direct_answer",
      targetStep: "pricing",
      pricingPosture: "xidmete gore deyisir",
    })
  );

  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    services: [{ title: "Consultation" }],
    contacts: [{ type: "phone", value: "+994551112233", preferred: true }],
    hours: [
      {
        day: "monday",
        enabled: true,
        closed: false,
        openTime: "09:00",
        closeTime: "18:00",
      },
    ],
    progress: {
      currentQuestionKey: "pricing",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "pricing" },
    draft,
    review: {
      draft,
      session: { currentStep: "pricing" },
    },
    latestStep: "pricing",
    latestMessage: "xidmete gore deyisir",
  });

  assert.equal(result.provider, "openai_business_brain");
  assert.match(result.acceptedPatch.pricingPosture, /deyisir/i);
  assert.equal(result.readyForApproval, true);
  assert.equal(result.nextQuestion, null);
});

test("unclear OpenAI turns stay short and move on instead of getting noisy", async (t) => {
  withOpenAISetupConfig(t);
  setReasonerClient(() =>
    reasonerPayload({
      action: "unclear",
      targetStep: "pricing",
      reason: "off topic",
    })
  );

  const draft = buildDraft({
    languages: ["en"],
    businessProfile: {
      companyName: "Acme Clinic",
      description: "Dental clinic in Baku",
    },
    services: [{ title: "Consultation" }],
    progress: {
      currentQuestionKey: "pricing",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "pricing" },
    draft,
    review: {
      draft,
      session: { currentStep: "pricing" },
      timeline: [
        {
          role: "assistant",
          questionKey: "pricing",
          text: "What core pricing fact should AI share?",
        },
        {
          role: "assistant",
          questionKey: "pricing",
          text: "Please answer pricing in one short sentence.",
        },
      ],
    },
    latestStep: "pricing",
    latestMessage: "how are you?",
  });

  assert.deepEqual(result.acceptedPatch, {});
  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.rejectedInputs.length, 1);
  assert.equal(result.nextQuestion.key, "contacts");
  assert.match(result.assistantMessage, /move to the next part/i);
  assert.ok(result.assistantMessage.split(/\s+/).filter(Boolean).length <= 25);
  assert.doesNotMatch(result.assistantMessage, /http|debug|source/i);
});

test("polished draft override path replaces the hidden preview when the polisher succeeds", async (t) => {
  withOpenAISetupConfig(t, {
    openaiSetupEnableTurnPolisher: true,
    openaiSetupTurnPolisherReadyOnly: false,
  });

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        const name = request?.text?.format?.name;

        if (name === "setup_assistant_polished_draft") {
          return {
            output_parsed: {
              businessName: "Acme Clinic",
              whatThisBusinessIs: "Professional dental clinic focused on implants.",
              websiteUrl: "https://acme.az",
              coreServices: ["Consultation", "Implants"],
              contactRoutes: ["WhatsApp"],
              hours: ["Mon-Fri 09:00-18:00"],
              pricingPosture: "Pricing depends on the service.",
              humanHandoff: "Escalate urgent or complaint cases.",
              languages: ["en"],
            },
          };
        }

        return {
          output_parsed: reasonerPayload({
            action: "direct_answer",
            targetStep: "services",
            services: ["Consultation", "Implants"],
            websiteUrl: "https://acme.az",
          }),
        };
      },
    },
  });

  const draft = buildCompleteBusinessDraft({
    languages: ["en"],
    progress: {
      currentQuestionKey: "services",
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "services" },
    draft,
    review: {
      draft,
      session: { currentStep: "services" },
    },
    latestStep: "services",
    latestMessage: "consultation, implants",
  });

  assert.equal(result.provider, "openai_business_brain");
  assert.equal(
    result.draft.whatThisBusinessIs,
    "Professional dental clinic focused on implants."
  );
  assert.deepEqual(result.draft.coreServices, ["Consultation", "Implants"]);
  assert.equal(Object.prototype.hasOwnProperty.call(result.draft, "pricingBehavior"), false);
  assert.equal(result.sourceSignals.primarySourceUrl, "https://acme.az");
});


test("golden source evidence produces complete hidden business draft", async (t) => {
  withOpenAISetupConfig(t);

  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        capturedRequest = request;

        return {
          output_parsed: reasonerPayload({
            action: "business_brief",
            targetStep: "company",
            reason: "Official website evidence contains the setup facts.",
            companyName: "Nova Dental Studio",
            description: "Dental studio in Baku focused on implants, cleaning, and orthodontic consultations.",
            services: ["Dental implants", "Teeth cleaning", "Orthodontic consultation"],
            contacts: ["WhatsApp +994551112233", "hello@novadental.az"],
            hours: ["Monday-Friday 09:00-18:00", "Saturday 10:00-15:00"],
            pricingPosture: "Pricing depends on the selected service and case complexity.",
            humanHandoff: "Route urgent pain, complaints, exact quotes, and appointment changes to a human operator.",
            websiteUrl: "https://novadental.az",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      progress: {
        currentQuestionKey: "company",
      },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Share your website or business details.",
        },
      ],
    },
    sources: [
      {
        sourceType: "website",
        role: "primary",
        label: "Official website",
        sourceUrl: "https://novadental.az",
        text:
          "Nova Dental Studio is a dental studio in Baku focused on implants, teeth cleaning, and orthodontic consultations. Contact WhatsApp +994551112233 or hello@novadental.az. Working hours are Monday-Friday 09:00-18:00 and Saturday 10:00-15:00. Pricing depends on the selected service and case complexity. Urgent pain, complaints, exact quotes, and appointment changes should go to a human operator.",
      },
    ],
    latestStep: "company",
    latestMessage: "Use the website source and prepare the setup.",
  });

  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );

  assert.match(userPrompt, /sourceEvidence/);
  assert.match(userPrompt, /Official website/);
  assert.match(userPrompt, /Nova Dental Studio/);
  assert.match(userPrompt, /recentContext/);
  assert.match(userPrompt, /extractFromSourceEvidenceWithoutAskingAgainWhenFactsAreExplicit/);

  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.readyForApproval, true);
  assert.equal(result.nextQuestion, null);
  assert.equal(result.draft.businessName, "Nova Dental Studio");
  assert.match(result.draft.whatThisBusinessIs, /dental studio/i);
  assert.deepEqual(result.draft.coreServices, [
    "Dental implants",
    "Teeth cleaning",
    "Orthodontic consultation",
  ]);
  assert.ok(result.draft.contactRoutes.some((item) => /\+994551112233/.test(item)));
  assert.ok(result.draft.contactRoutes.some((item) => /hello@novadental\.az/.test(item)));
  assert.ok(result.draft.hours.some((item) => /monday/i.test(item)));
  assert.match(result.draft.pricingPosture, /depends on the selected service/i);
  assert.match(result.draft.humanHandoff, /urgent pain/i);
  assert.equal(result.sourceSignals.primarySourceUrl, "https://novadental.az");
  assert.equal(Object.prototype.hasOwnProperty.call(result, "assistantBehaviorDraft"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result.acceptedPatch, "assistantBehaviorDraft"), false);
});


test("reasoner prompt encodes source priority and business-only rules", async (t) => {
  withOpenAISetupConfig(t);

  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        capturedRequest = request;
        return {
          output_parsed: reasonerPayload({
            action: "unclear",
            targetStep: "company",
            reason: "contract inspection only",
          }),
        };
      },
    },
  });

  await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      progress: { currentQuestionKey: "company" },
    }),
    sources: [
      {
        sourceType: "website",
        role: "primary",
        label: "Official website",
        sourceUrl: "https://contract.example",
        text: "Contract Clinic is a clinic in Baku.",
      },
    ],
    latestStep: "company",
    latestMessage: "Use the website.",
  });

  const systemPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "system")?.content || ""
  );
  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );

  assert.match(systemPrompt, /extract facts from sourceEvidence instead of asking again/i);
  assert.match(systemPrompt, /Never output behavior\/tone\/greeting\/after-hours policy/i);
  assert.match(userPrompt, /priorityRules/);
  assert.match(userPrompt, /sourceEvidenceCanFillMissingBusinessFacts/);
  assert.match(userPrompt, /doNotCreateAssistantBehaviorPolicy/);
});


test("latest user correction wins over conflicting source evidence", async (t) => {
  withOpenAISetupConfig(t);

  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        capturedRequest = request;

        return {
          output_parsed: reasonerPayload({
            action: "correction",
            targetStep: "company",
            reason: "The latest user message corrects the website evidence.",
            companyName: "Corrected Dental Studio",
            description: "Dental studio corrected by the owner.",
            services: ["Implants"],
            contacts: ["WhatsApp +994551112233"],
            hours: ["Monday-Friday 09:00-18:00"],
            pricingPosture: "Pricing depends on the case.",
            humanHandoff: "Exact quotes go to a human operator.",
            websiteUrl: "https://old-source.example",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      businessProfile: {
        companyName: "Old Website Clinic",
        description: "Old source description.",
        websiteUrl: "https://old-source.example",
      },
      progress: {
        currentQuestionKey: "company",
      },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Use the website source?",
        },
      ],
    },
    sources: [
      {
        sourceType: "website",
        role: "primary",
        label: "Old official website",
        sourceUrl: "https://old-source.example",
        text:
          "Old Website Clinic is a clinic. Services include cleaning. Contact +994000000000.",
      },
    ],
    latestStep: "company",
    latestMessage:
      "Correction: the business name is Corrected Dental Studio, not Old Website Clinic. Service is implants.",
  });

  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );

  assert.match(userPrompt, /latestUserMessageBeatsSourceEvidenceWhenContradicting/);
  assert.match(userPrompt, /Old Website Clinic/);
  assert.match(userPrompt, /Corrected Dental Studio/);

  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.acceptedPatch.identity.businessName, "Corrected Dental Studio");
  assert.equal(result.draft.businessName, "Corrected Dental Studio");
  assert.deepEqual(result.draft.coreServices, ["Implants"]);
  assert.doesNotMatch(JSON.stringify(result), /assistantBehaviorDraft|pricingBehavior|bookingBehavior|greetingStyle/);
});


test("reasoner evidence payload is deduped and budgeted", async (t) => {
  withOpenAISetupConfig(t);

  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        capturedRequest = request;
        return {
          output_parsed: reasonerPayload({
            action: "unclear",
            targetStep: "company",
            reason: "budget inspection only",
          }),
        };
      },
    },
  });

  const longText = "Runtime Dental evidence. " + "x".repeat(2400);

  await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      progress: { currentQuestionKey: "company" },
    }),
    review: {
      timeline: Array.from({ length: 12 }, (_, index) => ({
        role: index % 2 ? "user" : "assistant",
        questionKey: "company",
        text: `turn-${index} ${"y".repeat(900)}`,
      })),
      sourceSignalSummary: {
        primarySource: {
          sourceType: "website",
          sourceUrl: "https://evidence.example",
        },
        discoveredPublicClaims: Array.from(
          { length: 10 },
          (_, index) => `claim-${index} ${longText}`
        ),
      },
      reviewDebug: {
        websiteKnowledge: {
          topPages: Array.from({ length: 10 }, (_, index) => ({
            title: `Page ${index}`,
            url: `https://evidence.example/page-${index}`,
            summary: longText,
          })),
        },
      },
    },
    sources: Array.from({ length: 20 }, (_, index) => ({
      sourceType: "website",
      role: index === 0 ? "primary" : "supporting",
      label: `Source ${index % 6}`,
      sourceUrl: `https://evidence.example/source-${index % 6}`,
      text: longText,
    })),
    latestStep: "company",
    latestMessage: "Use the website evidence.",
  });

  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );
  const payload = JSON.parse(userPrompt.slice(userPrompt.indexOf("{")));

  assert.equal(payload.sourceEvidence.length, 16);
  assert.equal(payload.recentContext.length, 8);

  assert.ok(
    payload.sourceEvidence.every((row) => String(row.text || "").length <= 920)
  );
  assert.ok(
    payload.recentContext.every((turn) => String(turn.text || "").length <= 380)
  );

  const evidenceKeys = payload.sourceEvidence.map((row) =>
    [row.sourceType, row.sourceUrl, row.label, row.text]
      .map((item) => String(item || "").toLowerCase())
      .join("|")
  );

  assert.equal(new Set(evidenceKeys).size, evidenceKeys.length);
});


test("stored source metadata reaches brain without live sources", async (t) => {
  withOpenAISetupConfig(t);

  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        capturedRequest = request;

        return {
          output_parsed: reasonerPayload({
            action: "business_brief",
            targetStep: "company",
            companyName: "Metadata Dental",
            description: "Dental clinic from stored metadata evidence.",
            services: ["Implants"],
            contacts: ["WhatsApp +994551112233"],
            pricingPosture: "Pricing depends on the case.",
            websiteUrl: "https://metadata.example",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      sourceMetadata: {
        primarySourceType: "website",
        primarySourceUrl: "https://metadata.example",
        sourceLabels: ["Stored website source"],
        evidenceSummary: [
          "Metadata Dental is a dental clinic. Services include implants. WhatsApp +994551112233.",
        ],
      },
      progress: { currentQuestionKey: "company" },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Use stored source metadata?",
        },
      ],
    },
    sources: [],
    latestStep: "company",
    latestMessage: "Use the stored website evidence.",
  });

  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );
  const payload = JSON.parse(userPrompt.slice(userPrompt.indexOf("{")));

  assert.equal(payload.sourceEvidence.length, 1);
  assert.equal(payload.sourceEvidence[0].sourceType, "website");
  assert.equal(payload.sourceEvidence[0].sourceUrl, "https://metadata.example");
  assert.match(payload.sourceEvidence[0].text, /Metadata Dental/);

  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.draft.businessName, "Metadata Dental");
  assert.deepEqual(result.draft.coreServices, ["Implants"]);
  assert.doesNotMatch(JSON.stringify(result), /assistantBehaviorDraft|pricingBehavior|bookingBehavior|greetingStyle/);
});


test("source-only instruction without evidence does not call OpenAI brain", async (t) => {
  withOpenAISetupConfig(t);

  let callCount = 0;

  orchestratorTest.setCachedClient({
    responses: {
      create: async () => {
        callCount += 1;
        return {
          output_parsed: reasonerPayload({
            action: "business_brief",
            targetStep: "company",
            companyName: "Hallucinated Clinic",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      progress: { currentQuestionKey: "company" },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Share the website source.",
        },
      ],
    },
    sources: [],
    latestStep: "company",
    latestMessage: "Use the website source.",
  });

  assert.equal(callCount, 0);
  assert.equal(result.provider, "setup_source_evidence_missing");
  assert.equal(result.readyForApproval, false);
  assert.equal(result.acceptedPatch.identity, undefined);
  assert.match(JSON.stringify(result.rejectedInputs), /source_evidence_missing/);
  assert.doesNotMatch(JSON.stringify(result), /Hallucinated Clinic|assistantBehaviorDraft|pricingBehavior|bookingBehavior|greetingStyle/);
});

test("source-only guard does not block explicit URLs or contact facts", () => {
  assert.equal(
    orchestratorTest.isSourceOnlyInstructionMessage("Use the website source."),
    true
  );
  assert.equal(
    orchestratorTest.isSourceOnlyInstructionMessage("Use https://acme.az as the website."),
    false
  );
  assert.equal(
    orchestratorTest.isSourceOnlyInstructionMessage("WhatsApp +994551112233"),
    false
  );
});


test("manual rich business brief without source still reaches OpenAI brain", async (t) => {
  withOpenAISetupConfig(t);

  let callCount = 0;
  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        callCount += 1;
        capturedRequest = request;

        return {
          output_parsed: reasonerPayload({
            action: "business_brief",
            targetStep: "company",
            reason: "The user provided explicit manual business facts.",
            companyName: "Manual Dental",
            description: "Dental clinic in Baku.",
            services: ["Cleaning", "Implants"],
            contacts: ["WhatsApp +994551112233"],
            hours: ["Monday-Friday 09:00-18:00"],
            pricingPosture: "Pricing depends on the case.",
            humanHandoff: "Exact quotes go to a human operator.",
            websiteUrl: "",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      progress: { currentQuestionKey: "company" },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Tell me about the business.",
        },
      ],
    },
    sources: [],
    latestStep: "company",
    latestMessage:
      "No website yet. Business name is Manual Dental. We are a dental clinic in Baku. Services are cleaning and implants. WhatsApp +994551112233. Monday-Friday 09:00-18:00. Pricing depends on the case.",
  });

  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );

  assert.equal(callCount, 1);
  assert.match(userPrompt, /Manual Dental/);
  assert.deepEqual(JSON.parse(userPrompt.slice(userPrompt.indexOf("{"))).sourceEvidence, []);

  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.draft.businessName, "Manual Dental");
  assert.deepEqual(result.draft.coreServices, ["Cleaning", "Implants"]);
  assert.equal(result.draft.websiteUrl || "", "");
  assert.doesNotMatch(JSON.stringify(result), /assistantBehaviorDraft|pricingBehavior|bookingBehavior|greetingStyle/);
});


test("explicit website url without source evidence still reaches OpenAI brain", async (t) => {
  withOpenAISetupConfig(t);

  let callCount = 0;
  let capturedRequest = null;

  orchestratorTest.setCachedClient({
    responses: {
      create: async (request = {}) => {
        callCount += 1;
        capturedRequest = request;

        return {
          output_parsed: reasonerPayload({
            action: "direct_answer",
            targetStep: "company",
            reason: "The user provided an explicit website URL.",
            companyName: "Url Dental",
            description: "",
            services: [],
            contacts: [],
            hours: [],
            pricingPosture: "",
            humanHandoff: "",
            websiteUrl: "https://urldental.az",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      progress: { currentQuestionKey: "company" },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Share your website.",
        },
      ],
    },
    sources: [],
    latestStep: "company",
    latestMessage: "Use https://urldental.az as the website.",
  });

  const userPrompt = String(
    capturedRequest?.input?.find((item) => item?.role === "user")?.content || ""
  );

  assert.equal(callCount, 1);
  assert.match(userPrompt, /https:\/\/urldental\.az/);
  assert.deepEqual(JSON.parse(userPrompt.slice(userPrompt.indexOf("{"))).sourceEvidence, []);

  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.draft.websiteUrl, "https://urldental.az");
  assert.doesNotMatch(JSON.stringify(result), /setup_source_evidence_missing|assistantBehaviorDraft|pricingBehavior|bookingBehavior|greetingStyle/);
});


test("off-topic brain response does not mutate setup draft", async (t) => {
  withOpenAISetupConfig(t);

  let callCount = 0;

  orchestratorTest.setCachedClient({
    responses: {
      create: async () => {
        callCount += 1;

        return {
          output_parsed: reasonerPayload({
            action: "off_topic",
            targetStep: "company",
            reason: "The message is not about business setup.",
            companyName: "Should Not Be Saved",
            description: "This must not mutate the draft.",
            services: ["Fake Service"],
            contacts: ["fake@example.com"],
            pricingPosture: "Fake pricing",
            websiteUrl: "https://fake.example",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      businessProfile: {
        companyName: "Original Clinic",
        description: "Original description.",
        websiteUrl: "https://original.example",
      },
      services: [{ title: "Original Service" }],
      progress: { currentQuestionKey: "company" },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Tell me about the business.",
        },
      ],
    },
    sources: [],
    latestStep: "company",
    latestMessage: "Who won the football match yesterday?",
  });

  assert.equal(callCount, 1);
  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.readyForApproval, false);
  assert.deepEqual(result.acceptedPatch || {}, {});
  assert.equal(result.draft.businessName, "Original Clinic");
  assert.equal(result.draft.websiteUrl, "https://original.example");
  assert.deepEqual(result.draft.coreServices, ["Original Service"]);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /Should Not Be Saved|Fake Service|fake@example\.com|https:\/\/fake\.example/);
  assert.doesNotMatch(serialized, /assistantBehaviorDraft|pricingBehavior|bookingBehavior|greetingStyle/);
});


test("unclear brain response does not mutate setup draft", async (t) => {
  withOpenAISetupConfig(t);

  let callCount = 0;

  orchestratorTest.setCachedClient({
    responses: {
      create: async () => {
        callCount += 1;

        return {
          output_parsed: reasonerPayload({
            action: "unclear",
            targetStep: "company",
            reason: "Not enough reliable business facts.",
            companyName: "Should Not Mutate",
            description: "Should not be saved.",
            services: ["Ghost Service"],
            contacts: ["ghost@example.com"],
            pricingPosture: "Ghost pricing",
            websiteUrl: "https://ghost.example",
          }),
        };
      },
    },
  });

  const result = await runSetupAssistantOpenAIOrchestrator({
    session: { currentStep: "company" },
    draft: buildDraft({
      languages: ["en"],
      businessProfile: {
        companyName: "Original Business",
        description: "Original business description.",
        websiteUrl: "https://original.example",
      },
      services: [{ title: "Original Service" }],
      progress: { currentQuestionKey: "company" },
    }),
    review: {
      timeline: [
        {
          role: "assistant",
          questionKey: "company",
          text: "Tell me about the business.",
        },
      ],
    },
    sources: [],
    latestStep: "company",
    latestMessage: "hmm maybe later not sure",
  });

  assert.equal(callCount, 1);
  assert.equal(result.provider, "openai_business_brain");
  assert.equal(result.readyForApproval, false);
  assert.deepEqual(result.acceptedPatch || {}, {});
  assert.equal(result.draft.businessName, "Original Business");
  assert.equal(result.draft.websiteUrl, "https://original.example");
  assert.deepEqual(result.draft.coreServices, ["Original Service"]);

  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /Should Not Mutate|Ghost Service|ghost@example\.com|https:\/\/ghost\.example/);
  assert.doesNotMatch(serialized, /assistantBehaviorDraft|pricingBehavior|bookingBehavior|greetingStyle/);
});
