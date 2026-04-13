import { arr, compactObject, lower, obj, s } from "./utils.js";

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((v) => s(v)).filter(Boolean))];
}

function tokenize(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\u0400-\u04FF\u0600-\u06FF\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function overlapScore(a = "", b = "") {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (!ta.size || !tb.size) return 0;
  let hits = 0;
  for (const token of ta) {
    if (tb.has(token)) hits += 1;
  }
  return hits / Math.max(ta.size, tb.size);
}

function parseCsvLike(value = "") {
  return uniqueStrings(
    s(value)
      .split(/[,;\n]/)
      .map((item) => s(item))
  );
}

function urlHost(value = "") {
  const raw = s(value);
  if (!raw) return "";
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(normalized).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function sourceTypeLabel(type = "") {
  const key = lower(type);
  if (key === "instagram") return "Instagram";
  if (key === "facebook" || key === "facebook_page") return "Facebook";
  if (key === "google_maps") return "Google Maps";
  if (key === "manual") return "Manual note";
  return "Website";
}

function buildSourceSignals({ session = {}, draft = {}, sources = [], review = null } = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceSummary = obj(draft.sourceSummary);
  const assistantState = obj(draft.assistantState);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const reviewDebug = obj(reviewRoot.review?.reviewDebug || reviewRoot.reviewDebug);
  const websiteKnowledge = obj(reviewDebug.websiteKnowledge);

  const sourceRows = arr(sources).map((item) =>
    compactObject({
      sourceId: s(item.sourceId || item.id),
      sourceType: s(item.sourceType || item.type),
      role: s(item.role),
      label: s(item.label),
      sourceUrl: s(item.sourceUrl || item.url),
    })
  );

  const primarySource =
    sourceRows.find((item) => lower(item.role) === "primary") || sourceRows[0] || {};

  const websiteUrl =
    s(businessProfile.websiteUrl) ||
    s(reviewDraft.businessProfile?.websiteUrl) ||
    s(sourceSummary.primarySourceUrl) ||
    s(primarySource.sourceUrl);

  const companyNameCandidates = uniqueStrings([
    businessProfile.companyName,
    businessProfile.displayName,
    reviewDraft.businessProfile?.companyName,
    reviewDraft.businessProfile?.displayName,
    sourceSummary.businessName,
    primarySource.label,
    session.businessName,
    assistantState.inferredBusinessName,
  ]);

  const serviceCandidates = uniqueStrings([
    ...arr(draft.services).map((item) => s(item.title || item.name || item.label)),
    ...arr(reviewDraft.services).map((item) => s(item.title || item.name || item.label)),
    ...arr(draft.serviceCatalog).map((item) => s(item.title || item.name || item.label)),
    ...arr(websiteKnowledge.topPages).map((item) => s(item.title)),
  ]);

  const contactCandidates = uniqueStrings([
    businessProfile.primaryPhone,
    businessProfile.primaryEmail,
    businessProfile.primaryAddress,
    ...arr(draft.contacts).map((item) => s(item.label || item.value || item.channel)),
    ...arr(reviewDraft.contacts).map((item) => s(item.label || item.value || item.channel)),
  ]);

  const hoursCandidates = uniqueStrings([
    ...arr(businessProfile.hours),
    ...arr(reviewDraft.businessProfile?.hours),
    ...arr(draft.hours).map((item) => {
      if (item?.allDay) return `${item.day} 24 hours`;
      if (item?.appointmentOnly) return `${item.day} appointment only`;
      if (item?.closed) return `${item.day} closed`;
      if (s(item?.notes)) return `${item.day} ${s(item.notes)}`;
      if (s(item?.openTime) || s(item?.closeTime)) {
        return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
      }
      return "";
    }),
  ]);

  const pricingCandidates = uniqueStrings([
    businessProfile.pricingPolicy,
    draft.pricingPosture?.publicSummary,
    draft.pricingPosture?.note,
    reviewDraft.businessProfile?.pricingPolicy,
  ]);

  const handoffCandidates = uniqueStrings([
    draft.handoffRules?.summary,
    ...arr(draft.handoffRules?.triggers),
    reviewDraft.handoffRules?.summary,
    ...arr(reviewDraft.handoffRules?.triggers),
  ]);

  const audienceCandidates = uniqueStrings([
    businessProfile.targetAudience,
    businessProfile.audience,
    reviewDraft.businessProfile?.targetAudience,
    reviewDraft.businessProfile?.audience,
  ]);

  const descriptionCandidates = uniqueStrings([
    businessProfile.description,
    businessProfile.companySummaryShort,
    businessProfile.companySummary,
    reviewDraft.businessProfile?.description,
    reviewDraft.businessProfile?.companySummaryShort,
    reviewDraft.businessProfile?.companySummary,
  ]);

  const sourceTypes = uniqueStrings(sourceRows.map((item) => item.sourceType));
  const pageCount = Number(websiteKnowledge.pageCount || 0) || 0;

  return {
    sourceRows,
    primarySourceType: s(primarySource.sourceType || session.primarySourceType),
    primarySourceLabel: sourceTypeLabel(primarySource.sourceType),
    primarySourceUrl: s(primarySource.sourceUrl || websiteUrl),
    sourceTypes,
    pageCount,
    companyNameCandidates,
    serviceCandidates,
    contactCandidates,
    hoursCandidates,
    pricingCandidates,
    handoffCandidates,
    audienceCandidates,
    descriptionCandidates,
  };
}

function buildDraftState({ draft = {}, review = null } = {}) {
  const businessProfile = obj(draft.businessProfile);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);

  const mergedProfile = {
    ...obj(reviewDraft.businessProfile),
    ...businessProfile,
  };

  const services = uniqueStrings([
    ...arr(reviewDraft.services).map((item) => s(item.title || item.name || item.label)),
    ...arr(draft.services).map((item) => s(item.title || item.name || item.label)),
  ]);

  const contacts = uniqueStrings([
    mergedProfile.primaryPhone,
    mergedProfile.primaryEmail,
    mergedProfile.primaryAddress,
    ...arr(reviewDraft.contacts).map((item) => s(item.label || item.value || item.channel)),
    ...arr(draft.contacts).map((item) => s(item.label || item.value || item.channel)),
  ]);

  const hours = uniqueStrings([
    ...arr(mergedProfile.hours),
    ...arr(draft.hours).map((item) => {
      if (item?.allDay) return `${item.day} 24 hours`;
      if (item?.appointmentOnly) return `${item.day} appointment only`;
      if (item?.closed) return `${item.day} closed`;
      if (s(item?.notes)) return `${item.day} ${s(item.notes)}`;
      if (s(item?.openTime) || s(item?.closeTime)) {
        return `${item.day} ${s(item.openTime)}-${s(item.closeTime)}`;
      }
      return "";
    }),
  ]);

  return {
    businessName: s(mergedProfile.companyName || mergedProfile.displayName),
    description: s(
      mergedProfile.description ||
        mergedProfile.companySummaryShort ||
        mergedProfile.companySummary
    ),
    websiteUrl: s(mergedProfile.websiteUrl),
    services,
    audience: s(
      mergedProfile.targetAudience ||
        mergedProfile.audience ||
        mergedProfile.customerType ||
        mergedProfile.customerTypes
    ),
    pricingPosture: s(
      mergedProfile.pricingPolicy ||
        draft.pricingPosture?.publicSummary ||
        draft.pricingPosture?.note ||
        draft.pricingPosture?.summary
    ),
    contacts,
    hours,
    humanHandoff: s(
      draft.handoffRules?.summary || arr(draft.handoffRules?.triggers).join(", ")
    ),
    languages: uniqueStrings([
      ...arr(mergedProfile.supportedLanguages),
      ...arr(mergedProfile.languages),
    ]),
    tone: s(mergedProfile.brandTone || mergedProfile.tone),
  };
}

function detectContradictions({ draftState, sourceSignals }) {
  const contradictions = [];

  const draftName = draftState.businessName;
  const sourceName = sourceSignals.companyNameCandidates[0];
  if (
    draftName &&
    sourceName &&
    overlapScore(draftName, sourceName) < 0.35
  ) {
    contradictions.push({
      key: "business_name_conflict",
      severity: "medium",
      message: `Mənbədə görünən ad "${sourceName}" kimi görünür, draft isə "${draftName}" deyir.`,
    });
  }

  const draftHost = urlHost(draftState.websiteUrl);
  const sourceHost = urlHost(sourceSignals.primarySourceUrl);
  if (draftHost && sourceHost && draftHost !== sourceHost) {
    contradictions.push({
      key: "website_conflict",
      severity: "medium",
      message: `Draft website "${draftHost}" kimi görünür, əsas source isə "${sourceHost}" göstərir.`,
    });
  }

  if (draftState.services.length && sourceSignals.serviceCandidates.length) {
    const overlap = draftState.services.some((service) =>
      sourceSignals.serviceCandidates.some(
        (candidate) => overlapScore(service, candidate) >= 0.4
      )
    );

    if (!overlap) {
      contradictions.push({
        key: "services_conflict",
        severity: "medium",
        message:
          "Mənbələrdən görünən xidmətlər ilə draft xidmətləri arasında güclü uyğunluq görünmür.",
      });
    }
  }

  return contradictions;
}

function buildConfidenceBuckets({ draftState, sourceSignals, contradictions }) {
  const strong = [];
  const unclear = [];

  if (draftState.businessName) {
    strong.push(`Biznes adı formalaşıb: ${draftState.businessName}`);
  } else {
    unclear.push("Biznes adı hələ dəqiq deyil.");
  }

  if (draftState.description) {
    strong.push("Biznesin təqdimat cümləsi formalaşıb.");
  } else {
    unclear.push("Biznesin qısa təqdimatı hələ aydın deyil.");
  }

  if (draftState.services.length) {
    strong.push(`Əsas xidmətlər görünür: ${listPreview(draftState.services, 4)}`);
  } else {
    unclear.push("Əsas xidmətlər hələ təsdiqlənməyib.");
  }

  if (draftState.contacts.length) {
    strong.push("Əlaqə/booking yönləndirməsi görünür.");
  } else {
    unclear.push("Müştərinin hara yönləndiriləcəyi hələ aydın deyil.");
  }

  if (!draftState.humanHandoff) {
    unclear.push("AI-nin hansı hallarda insana ötürəcəyi hələ müəyyənləşməyib.");
  }

  if (!draftState.pricingPosture) {
    unclear.push("Qiymət siyasətinin necə təqdim olunacağı hələ aydın deyil.");
  }

  if (
    sourceSignals.primarySourceType === "website" &&
    sourceSignals.pageCount > 0 &&
    !draftState.websiteUrl
  ) {
    unclear.push("Website source var, amma public website draftda hələ oturmayıb.");
  }

  return {
    strong,
    unclear,
    contradictions: contradictions.map((item) => item.message),
  };
}

function buildRecommendation({ draftState, sourceSignals, contradictions }) {
  const notes = [];

  if (draftState.services.length) {
    notes.push(
      `Məncə AI ilk növbədə "${draftState.services[0]}" xətti üzərindən danışmalıdır.`
    );
  }

  if (!draftState.pricingPosture) {
    notes.push(
      "Qiymət hissəsi dəqiq deyilsə, AI sərt rəqəm vermək əvəzinə operatora və ya sorğuya yönləndirməlidir."
    );
  }

  if (!draftState.humanHandoff) {
    notes.push(
      "Voice receptionist və chatbot üçün şikayət, fərdi qiymət, təcili hal və ödəniş kimi mövzular ayrıca handoff qaydası istəyir."
    );
  }

  if (!draftState.contacts.length) {
    notes.push(
      "Booking və ya əlaqə marşrutu olmadan AI son addımda zəif görünəcək; bir əsas kontakt yolu mütləq lazımdır."
    );
  }

  if (contradictions.length) {
    notes.push(
      "Source ilə verilən cavablar arasında uyğunsuzluq var; təsdiqdən əvvəl bunları bağlamaq daha doğrudur."
    );
  }

  if (
    sourceSignals.primarySourceType === "website" &&
    sourceSignals.pageCount >= 3 &&
    draftState.description &&
    draftState.services.length
  ) {
    notes.push(
      "Website siqnalları kifayət qədərdirsə, əlavə sualları minimum saxlamaq və tez draft çıxarmaq daha professional görünür."
    );
  }

  return notes;
}

function buildQuestionCandidates({ draftState, sourceSignals, contradictions }) {
  const needsHours =
    sourceSignals.primarySourceType === "google_maps" ||
    draftState.contacts.some((item) => /address|street|office|baku|az/i.test(item));

  const candidates = [
    {
      key: "business_name_conflict",
      step: "company",
      title: "Business name",
      prompt: contradictions.find((item) => item.key === "business_name_conflict")
        ?.message,
      priority: 100,
      when: contradictions.some((item) => item.key === "business_name_conflict"),
    },
    {
      key: "website_conflict",
      step: "website",
      title: "Main website",
      prompt: contradictions.find((item) => item.key === "website_conflict")
        ?.message,
      priority: 98,
      when: contradictions.some((item) => item.key === "website_conflict"),
    },
    {
      key: "services_conflict",
      step: "services",
      title: "Core services",
      prompt:
        contradictions.find((item) => item.key === "services_conflict")?.message ||
        "Əsas xidmətlər source ilə tam oturmur. Düz xidmətləri yaz.",
      priority: 96,
      when: contradictions.some((item) => item.key === "services_conflict"),
    },
    {
      key: "business_name",
      step: "company",
      title: "Business name",
      prompt: "Biznesin adı necə görünməlidir?",
      priority: 90,
      when: !draftState.businessName,
    },
    {
      key: "positioning",
      step: "description",
      title: "What the business is",
      prompt: "Bu biznesi bir-iki cümlə ilə necə təqdim etməliyəm?",
      priority: 88,
      when: !draftState.description,
    },
    {
      key: "services",
      step: "services",
      title: "Core services",
      prompt: "Əsas xidmətləri yaz.",
      priority: 86,
      when: !draftState.services.length,
    },
    {
      key: "booking_route",
      step: "contacts",
      title: "Contact route",
      prompt: "Müştəri sonda hara yönləndirilməlidir? (WhatsApp, telefon, DM, email və s.)",
      priority: 84,
      when: !draftState.contacts.length,
    },
    {
      key: "pricing_posture",
      step: "pricing",
      title: "Pricing posture",
      prompt: "Qiymət necə təqdim olunmalıdır? AI birbaşa rəqəm desin, yoxsa sorğuya/operatora yönləndirsin?",
      priority: 82,
      when: !draftState.pricingPosture,
    },
    {
      key: "handoff_rules",
      step: "handoff",
      title: "Human handoff",
      prompt: "AI hansı hallarda mütləq insana ötürməlidir?",
      priority: 80,
      when: !draftState.humanHandoff,
    },
    {
      key: "audience",
      step: "profile",
      title: "Audience",
      prompt: "Əsasən kimlərə xidmət göstərirsiniz?",
      priority: 76,
      when: !draftState.audience,
    },
    {
      key: "hours",
      step: "hours",
      title: "Hours",
      prompt: "İş saatları və ya qəbul saatları necə göstərilməlidir?",
      priority: 70,
      when: needsHours && !draftState.hours.length,
    },
    {
      key: "languages",
      step: "profile",
      title: "Languages",
      prompt: "AI hansı dillərdə danışmalıdır?",
      priority: 66,
      when: !draftState.languages.length,
    },
    {
      key: "tone",
      step: "profile",
      title: "Tone",
      prompt: "AI-nin tonu necə olmalıdır? (premium, mehriban, qısa, satış yönümlü və s.)",
      priority: 60,
      when: !draftState.tone,
    },
  ];

  return candidates
    .filter((item) => item.when)
    .sort((a, b) => b.priority - a.priority);
}

function buildAssistantMessage({
  phase,
  nextQuestion,
  draftState,
  confidence,
  recommendations,
}) {
  if (phase === "interview" && nextQuestion) {
    return nextQuestion.prompt;
  }

  const draftLines = [
    draftState.businessName ? `Business name: ${draftState.businessName}` : "",
    draftState.description ? `What this business is: ${draftState.description}` : "",
    draftState.services.length
      ? `Core services: ${listPreview(draftState.services, 6)}`
      : "",
    draftState.audience ? `Audience: ${draftState.audience}` : "",
    draftState.pricingPosture ? `Pricing posture: ${draftState.pricingPosture}` : "",
    draftState.contacts.length
      ? `Contact routes: ${listPreview(draftState.contacts, 6)}`
      : "",
    draftState.humanHandoff ? `Human handoff: ${draftState.humanHandoff}` : "",
  ].filter(Boolean);

  const guidance = [
    confidence.strong.length ? `What I’m confident about:\n- ${confidence.strong.join("\n- ")}` : "",
    confidence.unclear.length ? `What still looks unclear:\n- ${confidence.unclear.join("\n- ")}` : "",
    confidence.contradictions.length
      ? `What may be inconsistent:\n- ${confidence.contradictions.join("\n- ")}`
      : "",
    recommendations.length ? `My recommendation:\n- ${recommendations.join("\n- ")}` : "",
  ].filter(Boolean);

  return [draftLines.join("\n"), guidance.join("\n\n")]
    .filter(Boolean)
    .join("\n\n");
}

export function buildSetupAssistantBrainState({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const sourceSignals = buildSourceSignals({ session, draft, sources, review });
  const draftState = buildDraftState({ draft, review });
  const contradictions = detectContradictions({ draftState, sourceSignals });
  const confidence = buildConfidenceBuckets({
    draftState,
    sourceSignals,
    contradictions,
  });
  const recommendations = buildRecommendation({
    draftState,
    sourceSignals,
    contradictions,
  });
  const questionCandidates = buildQuestionCandidates({
    draftState,
    sourceSignals,
    contradictions,
  });

  const nextQuestion = questionCandidates[0] || null;
  const readyForApproval =
    !nextQuestion &&
    Boolean(
      draftState.businessName &&
        draftState.description &&
        draftState.services.length &&
        draftState.contacts.length &&
        draftState.humanHandoff
    );

  const phase = readyForApproval ? "ready" : "interview";

  return {
    phase,
    nextQuestion: nextQuestion
      ? compactObject({
          key: nextQuestion.key,
          step: nextQuestion.step,
          title: nextQuestion.title,
          prompt: nextQuestion.prompt,
          priority: nextQuestion.priority,
        })
      : null,
    draft: compactObject({
      businessName: draftState.businessName,
      whatThisBusinessIs: draftState.description,
      coreServices: draftState.services,
      audience: draftState.audience,
      pricingPosture: draftState.pricingPosture,
      contactRoutes: draftState.contacts,
      humanHandoff: draftState.humanHandoff,
      languages: draftState.languages,
      tone: draftState.tone,
      hours: draftState.hours,
    }),
    confidence,
    recommendation: {
      notes: recommendations,
    },
    sourceSignals: {
      primarySourceType: sourceSignals.primarySourceType,
      primarySourceLabel: sourceSignals.primarySourceLabel,
      primarySourceUrl: sourceSignals.primarySourceUrl,
      pageCount: sourceSignals.pageCount,
      sourceTypes: sourceSignals.sourceTypes,
    },
    readyForApproval,
    assistantMessage: buildAssistantMessage({
      phase,
      nextQuestion,
      draftState,
      confidence,
      recommendations,
    }),
  };
}

export function buildSetupAssistantFirstPrompt() {
  return {
    phase: "source_capture",
    assistantMessage:
      "Biznesin linkini və ya qısa izahını göndər. (website, instagram, facebook, qısa qeyd)",
    nextQuestion: {
      key: "source_capture",
      step: "source_capture",
      title: "Source",
      prompt:
        "Biznesin linkini və ya qısa izahını göndər. (website, instagram, facebook, qısa qeyd)",
    },
    readyForApproval: false,
  };
}