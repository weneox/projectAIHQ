import { arr, compactObject, obj, s } from "./utils.js";
import {
  buildSetupDraftStateFromSignals,
  buildSetupKnownState,
  buildSetupSourceCoverage,
  buildSetupSourceLead,
  buildSetupSourceSignals,
  detectSetupSignalContradictions,
} from "./setupAssistantApp/sourceSignals.js";

function listPreview(items = [], max = 4) {
  const safe = [...new Set(arr(items).map((item) => s(item)).filter(Boolean))];
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
}

function groupLabel(group = "") {
  return group === "ai_behavior" ? "AI behavior" : "Business truth";
}

function buildConfidenceBuckets({
  draftState,
  sourceSignals,
  contradictions,
  sourceCoverage,
}) {
  const strong = [];
  const unclear = [];

  if (draftState.businessName) {
    strong.push(`Business name confirmed: ${draftState.businessName}`);
  } else if (sourceCoverage.identity) {
    strong.push("There is already enough source evidence for business identity.");
  } else if (arr(sourceSignals.companyNameCandidates).length) {
    unclear.push(
      `Business name is still not locked. One source signal is ${s(
        arr(sourceSignals.companyNameCandidates)[0]
      )}.`
    );
  } else {
    unclear.push("Business name is still missing.");
  }

  if (draftState.description) {
    strong.push("Business description is present.");
  } else if (sourceCoverage.identity) {
    strong.push("Source evidence already covers the business description.");
  } else if (arr(sourceSignals.descriptionCandidates).length) {
    unclear.push("Business description still needs a clean confirmation.");
  } else {
    unclear.push("Business description is still missing.");
  }

  if (draftState.services.length) {
    strong.push(`Core services present: ${listPreview(draftState.services, 4)}`);
  } else if (sourceCoverage.services) {
    strong.push(
      `Source evidence already covers services: ${listPreview(
        sourceSignals.serviceCandidates,
        4
      )}.`
    );
  } else if (sourceSignals.serviceCandidates.length) {
    unclear.push(
      `Service signals exist but are not clean yet: ${listPreview(
        sourceSignals.serviceCandidates,
        4
      )}.`
    );
  } else {
    unclear.push("Core services are still missing.");
  }

  if (draftState.contacts.length) {
    strong.push("A customer contact route is present.");
  } else if (sourceCoverage.contacts) {
    strong.push("Source evidence already covers a public contact route.");
  } else {
    unclear.push("A public customer contact route is still missing.");
  }

  if (draftState.hours.length) {
    strong.push("Public hours are present.");
  } else if (sourceCoverage.hours) {
    strong.push("Source evidence already covers public hours.");
  } else {
    unclear.push("Public hours still need to be confirmed.");
  }

  if (draftState.pricingPosture) {
    strong.push("Pricing posture is present.");
  } else if (sourceCoverage.pricing) {
    strong.push("Source evidence already covers pricing posture.");
  } else {
    unclear.push("Pricing posture is still weak or missing.");
  }

  if (draftState.humanHandoff) {
    strong.push("Human escalation policy is present.");
  } else {
    unclear.push("Human escalation rules still need to be defined.");
  }

  if (!draftState.websiteUrl && !sourceCoverage.primarySourceExists) {
    unclear.push("A reliable public source is still missing.");
  }

  return {
    strong,
    unclear,
    contradictions: arr(contradictions).map((item) => s(item.message)).filter(Boolean),
  };
}

function buildRecommendation({
  draftState,
  sourceSignals,
  contradictions,
  sourceCoverage,
}) {
  const notes = [];

  if (
    !draftState.businessName &&
    !draftState.description &&
    !sourceCoverage.identity
  ) {
    notes.push(
      "Lock the exact public business name and one clean sentence describing what the business does."
    );
  }

  if (!draftState.services.length && !sourceCoverage.services) {
    if (sourceSignals.serviceCandidates.length) {
      notes.push(
        "Clean the service list and keep only real customer-facing services."
      );
    } else {
      notes.push("Define the real customer-facing services.");
    }
  }

  if (!draftState.pricingPosture && !sourceCoverage.pricing) {
    notes.push("Define a safe public pricing posture.");
  }

  if (!draftState.contacts.length && !sourceCoverage.contacts) {
    notes.push("Choose one real public contact route.");
  }

  if (!draftState.hours.length && !sourceCoverage.hours) {
    notes.push("Confirm public weekly hours.");
  }

  if (!draftState.humanHandoff) {
    notes.push("Define when AI should escalate to a human.");
  }

  if (contradictions.length) {
    notes.push("Resolve source-vs-draft contradictions before approval.");
  }

  return notes;
}

function buildQuestionCandidates({
  draftState,
  sourceSignals,
  contradictions,
  sourceCoverage,
}) {
  const candidates = [];
  const primarySourceLabel =
    s(sourceSignals.primarySourceLabel) || "Source";
  const sourceWebsite = s(sourceSignals.primarySourceUrl);

  const businessNameConflict = arr(contradictions).find(
    (item) => s(item.key) === "business_name_conflict"
  );
  if (businessNameConflict) {
    candidates.push({
      key: "profile",
      step: "profile",
      title: "Confirm the business identity",
      group: "business_truth",
      prompt: `${s(
        businessNameConflict.message
      )} Send the exact public business name and one clean sentence describing what the business does.`,
      priority: 100,
    });
  }

  const websiteConflict = arr(contradictions).find(
    (item) => s(item.key) === "website_conflict"
  );
  if (websiteConflict) {
    candidates.push({
      key: "website",
      step: "website",
      title: "Confirm the main website",
      group: "business_truth",
      prompt: `${s(websiteConflict.message)} Send the correct main website URL.`,
      priority: 98,
    });
  }

  const identityNeedsConfirmation =
    !draftState.businessName && !draftState.description && !sourceCoverage.identity;

  if (identityNeedsConfirmation) {
    const parts = [];
    if (sourceWebsite) parts.push(`${primarySourceLabel}: ${sourceWebsite}`);
    if (arr(sourceSignals.companyNameCandidates).length) {
      parts.push(`name signal: ${s(arr(sourceSignals.companyNameCandidates)[0])}`);
    }
    if (arr(sourceSignals.descriptionCandidates).length) {
      parts.push(
        `description signal: ${s(arr(sourceSignals.descriptionCandidates)[0])}`
      );
    }

    candidates.push({
      key: "profile",
      step: "profile",
      title: "Confirm the business identity",
      group: "business_truth",
      prompt:
        parts.length > 0
          ? `I have partial identity signals (${parts.join(
              " • "
            )}), but they are not strong enough yet. Send the exact business name and one clean public sentence describing what the business does.`
          : "Send the exact business name and one clean public sentence describing what the business does.",
      priority: 96,
    });
  }

  if (!draftState.websiteUrl && !sourceCoverage.primarySourceExists) {
    candidates.push({
      key: "website",
      step: "website",
      title: "Add the main website",
      group: "business_truth",
      prompt: "Send the main website URL if the business has one.",
      priority: 90,
    });
  }

  if (!draftState.services.length && !sourceCoverage.services) {
    candidates.push({
      key: "services",
      step: "services",
      title: "Curate the service menu",
      group: "business_truth",
      prompt:
        sourceSignals.serviceCandidates.length > 0
          ? `These service signals exist: ${listPreview(
              sourceSignals.serviceCandidates,
              5
            )}. Send only the real customer-facing services.`
          : "List the real customer-facing services in plain language.",
      priority: 88,
    });
  }

  if (!draftState.contacts.length && !sourceCoverage.contacts) {
    candidates.push({
      key: "contacts",
      step: "contacts",
      title: "Set the main customer contact lane",
      group: "business_truth",
      prompt:
        sourceSignals.contactCandidates.length > 0
          ? `Possible contact routes found: ${listPreview(
              sourceSignals.contactCandidates,
              3
            )}. Which public contact route should AI use first?`
          : "Send the main public contact route customers should use first.",
      priority: 86,
    });
  }

  if (!draftState.hours.length && !sourceCoverage.hours) {
    candidates.push({
      key: "hours",
      step: "hours",
      title: "Lock the public hours",
      group: "business_truth",
      prompt:
        sourceSignals.hoursCandidates.length > 0
          ? `I found these hour signals: ${listPreview(
              sourceSignals.hoursCandidates,
              2
            )}. Send the public weekly hours only if those are wrong or incomplete.`
          : "Send the public weekly hours in one line.",
      priority: 84,
    });
  }

  if (!draftState.pricingPosture && !sourceCoverage.pricing) {
    candidates.push({
      key: "pricing",
      step: "pricing",
      title: "Define the pricing posture",
      group: "business_truth",
      prompt:
        sourceSignals.pricingCandidates.length > 0
          ? `I found these pricing signals: ${listPreview(
              sourceSignals.pricingCandidates,
              2
            )}. How should AI answer pricing questions publicly if those are not enough?`
          : "How should AI speak publicly about pricing?",
      priority: 82,
    });
  }

  if (!draftState.humanHandoff) {
    candidates.push({
      key: "handoff",
      step: "handoff",
      title: "Define the operator handoff",
      group: "business_truth",
      prompt: "Describe when AI should stop and escalate to a human.",
      priority: 80,
    });
  }

  return candidates.sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
}

function buildAiBehaviorPolicy(draftState = {}) {
  return compactObject({
    languages: arr(draftState.languages),
    tone: s(draftState.tone),
    greetingStyle: s(draftState.greetingStyle),
    afterHoursBehavior: s(draftState.afterHoursBehavior),
    escalationPolicy: s(draftState.humanHandoff),
    pricingDisclosurePolicy: s(draftState.pricingPosture),
    contactRoutingPolicy: arr(draftState.contacts),
  });
}

function buildInterviewPlan(questionCandidates = [], nextQuestion = null) {
  const activeQuestions = arr(questionCandidates).map((item) =>
    compactObject({
      key: s(item.key),
      step: s(item.step),
      title: s(item.title),
      group: s(item.group),
      groupLabel: groupLabel(item.group),
      priority: Number(item.priority || 0) || 0,
    })
  );

  return {
    activeQuestionKeys: activeQuestions.map((item) => item.key),
    activeQuestions,
    remainingQuestionKeys: activeQuestions
      .filter((item) => item.key !== s(nextQuestion?.key))
      .map((item) => item.key),
    nextGroup: s(nextQuestion?.group),
    nextGroupLabel: groupLabel(nextQuestion?.group),
  };
}

const SOURCE_CAPTURE_OPENING_MESSAGE =
  "Salam. Gəlin bunu normal, ağıllı şəkildə yığaq. Mən məqsəd olaraq biznesi anlamağa çalışıram, formanı doldurtmağa yox. Başlamaq üçün ən yaxşı public source-u göndər: website, Google Maps, Instagram, Facebook və ya qısa biznes qeydi.";

function getSourceCaptureOpeningMessage() {
  return `${SOURCE_CAPTURE_OPENING_MESSAGE} You can write freely. I will extract what I can before I ask anything else.`;
}

function buildConversationalAssistantMessage({
  phase,
  nextQuestion,
  draftState,
  sourceSignals,
  readyForApproval,
}) {
  const sourceLead = buildSetupSourceLead(sourceSignals);
  const businessName = s(draftState.businessName);
  const description = s(draftState.description);
  const services = arr(draftState.services);
  const contacts = arr(draftState.contacts);
  const hours = arr(draftState.hours);
  const pricing = s(draftState.pricingPosture);
  const handoff = s(draftState.humanHandoff);

  if (phase === "source_capture") {
    return getSourceCaptureOpeningMessage();
  }

  if (readyForApproval) {
    const parts = [];
    if (businessName) parts.push(businessName);
    if (description) parts.push(description);
    if (services.length) parts.push(`services: ${listPreview(services, 4)}`);
    if (contacts.length) parts.push(`contact: ${listPreview(contacts, 2)}`);
    if (hours.length) parts.push("hours confirmed");
    if (pricing) parts.push("pricing posture confirmed");
    if (handoff) parts.push("handoff rules confirmed");

    return parts.length
      ? `Setup draft looks strong now — ${parts.join(", ")}. Review it once, then finalize if it looks correct.`
      : "Setup draft looks strong now. Review it once, then finalize if it looks correct.";
  }

  const sentences = [];

  if (sourceLead) {
    sentences.push(sourceLead);
  }

  if (businessName && description) {
    sentences.push(`I already understand the business as: ${businessName} — ${description}`);
  } else if (businessName) {
    sentences.push(`I already have the business name: ${businessName}.`);
  } else if (description) {
    sentences.push(`I already have a business description.`);
  }

  if (services.length) {
    sentences.push(`Current service draft: ${listPreview(services, 4)}.`);
  }

  if (contacts.length) {
    sentences.push(`Main contact route is already present.`);
  }

  if (hours.length) {
    sentences.push(`Public hours are already present.`);
  }

  if (pricing) {
    sentences.push(`Pricing posture is already present.`);
  }

  if (handoff) {
    sentences.push(`Human escalation policy is already present.`);
  }

  if (nextQuestion?.prompt) {
    sentences.push(nextQuestion.prompt);
  } else {
    sentences.push("Continue with the next most important missing business detail.");
  }

  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

export function buildSetupAssistantBrainState({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const sourceSignals = buildSetupSourceSignals({ session, draft, sources, review });
  const sourceCoverage = buildSetupSourceCoverage(sourceSignals);
  const draftState = buildSetupDraftStateFromSignals({
    draft,
    review,
    sourceSignals,
  });
  const contradictions = detectSetupSignalContradictions({
    draftState,
    sourceSignals,
  });

  const confidence = buildConfidenceBuckets({
    draftState,
    sourceSignals,
    contradictions,
    sourceCoverage,
  });

  const recommendations = buildRecommendation({
    draftState,
    sourceSignals,
    contradictions,
    sourceCoverage,
  });

  const questionCandidates = buildQuestionCandidates({
    draftState,
    sourceSignals,
    contradictions,
    sourceCoverage,
  });

  const nextQuestion = questionCandidates[0] || null;

  const hasAnySignal = Boolean(
    s(draftState.businessName) ||
      s(draftState.description) ||
      s(draftState.websiteUrl) ||
      arr(draftState.services).length ||
      arr(draftState.contacts).length ||
      arr(draftState.hours).length ||
      s(draftState.pricingPosture) ||
      s(draftState.humanHandoff) ||
      s(sourceSignals.primarySourceUrl) ||
      arr(sourceSignals.sourceTypes).length
  );

  const readyForApproval =
    !nextQuestion &&
    !arr(contradictions).some((item) => s(item.severity).toLowerCase() === "high") &&
    Boolean(
      draftState.businessName &&
        draftState.description &&
        (draftState.websiteUrl || sourceSignals.primarySourceUrl) &&
        draftState.services.length &&
        draftState.contacts.length &&
        draftState.hours.length &&
        draftState.pricingPosture &&
        draftState.humanHandoff
    );

  const phase = !hasAnySignal
    ? "source_capture"
    : readyForApproval
      ? "ready"
      : "interview";

  return {
    phase,
    nextQuestion: nextQuestion
      ? compactObject({
          key: s(nextQuestion.key),
          step: s(nextQuestion.step),
          title: s(nextQuestion.title),
          prompt: s(nextQuestion.prompt),
          priority: Number(nextQuestion.priority || 0) || 0,
          group: s(nextQuestion.group),
          groupLabel: groupLabel(nextQuestion.group),
        })
      : null,
    draft: compactObject({
      businessName: draftState.businessName,
      whatThisBusinessIs: draftState.description,
      websiteUrl: draftState.websiteUrl,
      coreServices: draftState.services,
      audience: draftState.audience,
      pricingPosture: draftState.pricingPosture,
      contactRoutes: draftState.contacts,
      humanHandoff: draftState.humanHandoff,
      languages: draftState.languages,
      tone: draftState.tone,
      hours: draftState.hours,
      greetingStyle: draftState.greetingStyle,
      afterHoursBehavior: draftState.afterHoursBehavior,
    }),
    aiBehavior: buildAiBehaviorPolicy(draftState),
    interviewPlan: buildInterviewPlan(questionCandidates, nextQuestion),
    confidence,
    recommendation: {
      notes: recommendations,
    },
    sourceSignals: {
      primarySourceType: s(sourceSignals.primarySourceType),
      primarySourceLabel: s(sourceSignals.primarySourceLabel),
      primarySourceUrl: s(sourceSignals.primarySourceUrl),
      primarySourceAuthorityClass: s(sourceSignals.primarySourceAuthorityClass),
      pageCount: Number(sourceSignals.pageCount || 0) || 0,
      sourceTypes: arr(sourceSignals.sourceTypes),
      strongestEvidence: arr(sourceSignals.strongestEvidence),
      discoveredPublicClaims: arr(sourceSignals.discoveredPublicClaims),
      companyNameCandidates: arr(sourceSignals.companyNameCandidates),
      descriptionCandidates: arr(sourceSignals.descriptionCandidates),
      serviceCandidates: arr(sourceSignals.serviceCandidates),
      contactCandidates: arr(sourceSignals.contactCandidates),
      hoursCandidates: arr(sourceSignals.hoursCandidates),
      pricingCandidates: arr(sourceSignals.pricingCandidates),
      audienceCandidates: arr(sourceSignals.audienceCandidates),
      languagesCandidates: arr(sourceSignals.languagesCandidates),
      coverage: sourceCoverage,
    },
    readyForApproval,
    assistantMessage: buildConversationalAssistantMessage({
      phase,
      nextQuestion,
      draftState,
      sourceSignals,
      readyForApproval,
    }),
  };
}

export function buildSetupAssistantFirstPrompt() {
  return {
    phase: "source_capture",
    assistantMessage: getSourceCaptureOpeningMessage(),
    nextQuestion: {
      key: "source_capture",
      step: "source_capture",
      title: "Ən rahat bildiyin yerdən başlayaq",
      prompt:
        "Website, Google Maps, Instagram, Facebook və ya qısa biznes qeydi göndər. Mən əvvəl başa düşdüklərimi çıxaracağam, sonra yalnız həqiqətən çatmayan şeyi soruşacağam.",
      group: "business_truth",
      groupLabel: "Business truth",
    },
    interviewPlan: {
      activeQuestionKeys: [],
      activeQuestions: [],
      remainingQuestionKeys: [],
      nextGroup: "business_truth",
      nextGroupLabel: "Business truth",
    },
    aiBehavior: {},
    readyForApproval: false,
  };
}