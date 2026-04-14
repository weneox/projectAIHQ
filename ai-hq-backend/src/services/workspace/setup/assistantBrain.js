import { arr, compactObject, lower, obj, s } from "./utils.js";

function uniqueStrings(values = []) {
  return [...new Set(arr(values).map((value) => s(value)).filter(Boolean))];
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

function listPreview(items = [], max = 4) {
  const safe = uniqueStrings(items);
  if (!safe.length) return "";
  if (safe.length <= max) return safe.join(", ");
  return `${safe.slice(0, max).join(", ")} +${safe.length - max}`;
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

function signalStrong(values = [], minCount = 1) {
  return uniqueStrings(values).length >= minCount;
}

function groupLabel(group = "") {
  return group === "ai_behavior" ? "AI behavior" : "Business truth";
}

function extractBehaviorSignals({ draft = {}, review = null } = {}) {
  const safeDraft = obj(draft);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);

  const draftAssistantState = obj(safeDraft.assistantState);
  const reviewAssistantState = obj(reviewDraft.assistantState);

  const greetingCandidates = uniqueStrings([
    draftAssistantState.greeting,
    draftAssistantState.greetingStyle,
    draftAssistantState.openingStyle,
    reviewAssistantState.greeting,
    reviewAssistantState.greetingStyle,
    reviewAssistantState.openingStyle,
  ]);

  const afterHoursCandidates = uniqueStrings([
    draftAssistantState.afterHours,
    draftAssistantState.afterHoursBehavior,
    draftAssistantState.afterHoursReply,
    reviewAssistantState.afterHours,
    reviewAssistantState.afterHoursBehavior,
    reviewAssistantState.afterHoursReply,
  ]);

  return {
    greetingCandidates,
    afterHoursCandidates,
  };
}

function buildSourceSignals({ session = {}, draft = {}, sources = [], review = null } = {}) {
  const businessProfile = obj(draft.businessProfile);
  const sourceSummary = obj(draft.sourceSummary);
  const assistantState = obj(draft.assistantState);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const reviewDebug = obj(reviewRoot.review?.reviewDebug || reviewRoot.reviewDebug);
  const reviewFieldProvenance = obj(
    reviewRoot.fieldProvenance || reviewRoot.review?.fieldProvenance
  );
  const sourceSignalSummary = obj(reviewRoot.sourceSignalSummary);
  const websiteKnowledge = obj(
    sourceSignalSummary.website || reviewDebug.websiteKnowledge
  );
  const behaviorSignals = extractBehaviorSignals({ draft, review });

  const sourceRows = arr(sources).map((item) =>
    compactObject({
      sourceId: s(item.sourceId || item.id),
      sourceType: s(item.sourceType || item.type),
      role: s(item.role),
      label: s(item.label),
      sourceUrl: s(item.sourceUrl || item.url),
      sourceAuthorityClass: s(item.sourceAuthorityClass),
    })
  );

  const primarySource =
    obj(sourceSignalSummary.primarySource).sourceType ||
    obj(sourceSignalSummary.primarySource).sourceUrl
      ? obj(sourceSignalSummary.primarySource)
      : sourceRows.find((item) => lower(item.role) === "primary") || sourceRows[0] || {};

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
    reviewFieldProvenance.companyName?.observedValue,
    reviewFieldProvenance.displayName?.observedValue,
  ]);

  const serviceCandidates = uniqueStrings([
    ...arr(draft.services).map((item) => s(item.title || item.name || item.label)),
    ...arr(reviewDraft.services).map((item) => s(item.title || item.name || item.label)),
    ...arr(draft.serviceCatalog).map((item) => s(item.title || item.name || item.label)),
    ...arr(websiteKnowledge.topPages).map((item) => s(item.title)),
    ...arr(sourceSignalSummary.discoveredPublicClaims),
    reviewFieldProvenance.services?.observedValue,
  ]);

  const contactCandidates = uniqueStrings([
    businessProfile.primaryPhone,
    businessProfile.primaryEmail,
    businessProfile.primaryAddress,
    ...arr(draft.contacts).map((item) => s(item.label || item.value || item.channel)),
    ...arr(reviewDraft.contacts).map((item) => s(item.label || item.value || item.channel)),
    reviewFieldProvenance.primaryPhone?.observedValue,
    reviewFieldProvenance.primaryEmail?.observedValue,
    reviewFieldProvenance.primaryAddress?.observedValue,
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
    reviewFieldProvenance.pricingHints?.observedValue,
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
    reviewFieldProvenance.description?.observedValue,
    reviewFieldProvenance.companySummaryShort?.observedValue,
  ]);

  const languagesCandidates = uniqueStrings([
    ...arr(businessProfile.supportedLanguages),
    ...arr(businessProfile.languages),
    ...arr(reviewDraft.businessProfile?.supportedLanguages),
    ...arr(reviewDraft.businessProfile?.languages),
    reviewFieldProvenance.language?.observedValue,
    reviewFieldProvenance.mainLanguage?.observedValue,
    reviewFieldProvenance.primaryLanguage?.observedValue,
  ]);

  const toneCandidates = uniqueStrings([
    businessProfile.brandTone,
    businessProfile.tone,
    reviewDraft.businessProfile?.brandTone,
    reviewDraft.businessProfile?.tone,
  ]);

  const sourceTypes = uniqueStrings(
    sourceSignalSummary.sourceTypes?.length
      ? sourceSignalSummary.sourceTypes
      : sourceRows.map((item) => item.sourceType)
  );

  const strongestEvidence = uniqueStrings(sourceSignalSummary.strongestEvidence);
  const discoveredPublicClaims = uniqueStrings(
    sourceSignalSummary.discoveredPublicClaims
  );
  const pageCount =
    Number(sourceSignalSummary.website?.pageCount || 0) ||
    Number(websiteKnowledge.pageCount || 0) ||
    0;

  return {
    sourceRows,
    primarySourceType: s(primarySource.sourceType || session.primarySourceType),
    primarySourceLabel:
      s(primarySource.label) || sourceTypeLabel(primarySource.sourceType),
    primarySourceUrl: s(primarySource.sourceUrl || websiteUrl),
    primarySourceAuthorityClass: s(primarySource.sourceAuthorityClass),
    sourceTypes,
    pageCount,
    strongestEvidence,
    discoveredPublicClaims,
    companyNameCandidates,
    serviceCandidates,
    contactCandidates,
    hoursCandidates,
    pricingCandidates,
    handoffCandidates,
    audienceCandidates,
    descriptionCandidates,
    languagesCandidates,
    toneCandidates,
    greetingCandidates: behaviorSignals.greetingCandidates,
    afterHoursCandidates: behaviorSignals.afterHoursCandidates,
  };
}

function buildDraftState({ draft = {}, review = null } = {}) {
  const businessProfile = obj(draft.businessProfile);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const draftAssistantState = obj(draft.assistantState);
  const reviewAssistantState = obj(reviewDraft.assistantState);

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
    greetingStyle: s(
      draftAssistantState.greeting ||
        draftAssistantState.greetingStyle ||
        draftAssistantState.openingStyle ||
        reviewAssistantState.greeting ||
        reviewAssistantState.greetingStyle ||
        reviewAssistantState.openingStyle
    ),
    afterHoursBehavior: s(
      draftAssistantState.afterHours ||
        draftAssistantState.afterHoursBehavior ||
        draftAssistantState.afterHoursReply ||
        reviewAssistantState.afterHours ||
        reviewAssistantState.afterHoursBehavior ||
        reviewAssistantState.afterHoursReply
    ),
  };
}

function mergeSourceInferredDraft(draftState, sourceSignals) {
  return {
    businessName:
      s(draftState.businessName) || s(sourceSignals.companyNameCandidates[0]),
    description:
      s(draftState.description) || s(sourceSignals.descriptionCandidates[0]),
    websiteUrl:
      s(draftState.websiteUrl) || s(sourceSignals.primarySourceUrl),
    services: draftState.services.length
      ? draftState.services
      : sourceSignals.serviceCandidates.slice(0, 6),
    audience:
      s(draftState.audience) || s(sourceSignals.audienceCandidates[0]),
    pricingPosture:
      s(draftState.pricingPosture) || s(sourceSignals.pricingCandidates[0]),
    contacts: draftState.contacts.length
      ? draftState.contacts
      : sourceSignals.contactCandidates.slice(0, 6),
    hours: draftState.hours.length
      ? draftState.hours
      : sourceSignals.hoursCandidates.slice(0, 4),
    humanHandoff:
      s(draftState.humanHandoff) || s(sourceSignals.handoffCandidates[0]),
    languages: draftState.languages.length
      ? draftState.languages
      : sourceSignals.languagesCandidates.slice(0, 4),
    tone: s(draftState.tone) || s(sourceSignals.toneCandidates[0]),
    greetingStyle:
      s(draftState.greetingStyle) || s(sourceSignals.greetingCandidates[0]),
    afterHoursBehavior:
      s(draftState.afterHoursBehavior) || s(sourceSignals.afterHoursCandidates[0]),
  };
}

function detectContradictions({ draftState, sourceSignals }) {
  const contradictions = [];

  const draftName = draftState.businessName;
  const sourceName = sourceSignals.companyNameCandidates[0];
  if (draftName && sourceName && overlapScore(draftName, sourceName) < 0.35) {
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

  if (draftState.contacts.length && sourceSignals.contactCandidates.length) {
    const contactOverlap = draftState.contacts.some((contact) =>
      sourceSignals.contactCandidates.some(
        (candidate) => overlapScore(contact, candidate) >= 0.45
      )
    );

    if (!contactOverlap) {
      contradictions.push({
        key: "contact_conflict",
        severity: "low",
        message:
          "Draft contact marşrutu ilə source-lardan görünən əlaqə siqnalları tam üst-üstə düşmür.",
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

  if (draftState.pricingPosture) {
    strong.push("Qiymətin necə təqdim olunacağı müəyyənləşib.");
  } else {
    unclear.push("Qiymət siyasətinin necə təqdim olunacağı hələ aydın deyil.");
  }

  if (draftState.humanHandoff) {
    strong.push("İnsana ötürmə qaydaları müəyyənləşib.");
  } else {
    unclear.push("AI-nin hansı hallarda insana ötürəcəyi hələ müəyyənləşməyib.");
  }

  if (draftState.hours.length) {
    strong.push("İş/cavab saatları görünür.");
  } else {
    unclear.push("İş və ya cavab saatları hələ aydın deyil.");
  }

  if (draftState.languages.length) {
    strong.push(`İşləmə dilləri görünür: ${listPreview(draftState.languages, 3)}`);
  } else {
    unclear.push("AI-nin hansı dillərdə işləyəcəyi hələ dəqiq deyil.");
  }

  if (draftState.tone) {
    strong.push("AI tonu formalaşıb.");
  } else {
    unclear.push("AI tonu hələ dəqiq formalaşmayıb.");
  }

  if (draftState.greetingStyle) {
    strong.push("Açılış davranışı görünür.");
  } else {
    unclear.push("AI-nin söhbətə necə başlayacağı hələ aydın deyil.");
  }

  if (draftState.afterHoursBehavior) {
    strong.push("İş saatından kənar davranış formalaşıb.");
  } else {
    unclear.push("İş saatından kənar cavab qaydası hələ müəyyənləşməyib.");
  }

  if (
    sourceSignals.primarySourceType === "website" &&
    sourceSignals.pageCount > 0 &&
    !draftState.websiteUrl
  ) {
    unclear.push("Website source var, amma public website draftda hələ oturmayıb.");
  }

  if (
    sourceSignals.primarySourceType === "website" &&
    sourceSignals.pageCount >= 3
  ) {
    strong.push(
      `Website source kifayət qədər siqnal verib (${sourceSignals.pageCount} səhifə).`
    );
  }

  if (sourceSignals.strongestEvidence.length) {
    strong.push("Source-lardan konkret dəlillər çıxarılıb.");
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

  if (draftState.services.length > 3) {
    notes.push(
      "Çox xidmət varsa, AI ilk cavablarda yalnız əsas xidmət klasterini vurğulayıb, qalanlarını sonradan açmalıdır."
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

  if (!draftState.hours.length) {
    notes.push(
      "Voice receptionist üçün iş/cavab saatı ayrıca göstərilməlidir; əks halda zəng tərəfdə qeyri-müəyyənlik yaranacaq."
    );
  }

  if (!draftState.languages.length) {
    notes.push(
      "AI və voice receptionist üçün dil seçimi ayrıca dəqiqləşdirilməlidir; əks halda cavablar qeyri-sabit görünə bilər."
    );
  }

  if (!draftState.tone) {
    notes.push(
      "Brand tonu göstərilməyibsə, sistem default olaraq qısa, aydın və professional tonla işləməlidir."
    );
  }

  if (!draftState.greetingStyle) {
    notes.push(
      "AI ilk cavabda qısa salam verib birbaşa kömək mövzusuna keçməlidir; greeting ayrıca formalaşdırılmalıdır."
    );
  }

  if (!draftState.afterHoursBehavior) {
    notes.push(
      "İş saatından kənar yazan və ya zəng edən istifadəçi üçün ayrıca after-hours cavab qaydası lazımdır."
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

  if (
    sourceSignals.primarySourceAuthorityClass &&
    lower(sourceSignals.primarySourceAuthorityClass) === "high"
  ) {
    notes.push(
      "Əsas source yüksək authority göstərirsə, public təqdimatda həmin source siqnallarına daha çox güvənmək olar."
    );
  }

  return notes;
}

function buildQuestionCandidates({ draftState, sourceSignals, contradictions }) {
  const strongWebsite =
    sourceSignals.primarySourceType === "website" && sourceSignals.pageCount >= 4;
  const strongNameSource = signalStrong(sourceSignals.companyNameCandidates, 1);
  const strongDescriptionSource = signalStrong(sourceSignals.descriptionCandidates, 1);
  const strongServicesSource = signalStrong(sourceSignals.serviceCandidates, 2);
  const strongContactSource = signalStrong(sourceSignals.contactCandidates, 1);
  const strongHoursSource = signalStrong(sourceSignals.hoursCandidates, 1);
  const strongPricingSource = signalStrong(sourceSignals.pricingCandidates, 1);
  const strongLanguageSource = signalStrong(sourceSignals.languagesCandidates, 1);
  const strongToneSource = signalStrong(sourceSignals.toneCandidates, 1);
  const strongGreetingSource = signalStrong(sourceSignals.greetingCandidates, 1);
  const strongAfterHoursSource = signalStrong(sourceSignals.afterHoursCandidates, 1);

  const needsHours =
    sourceSignals.primarySourceType === "google_maps" ||
    draftState.contacts.some((item) => /address|street|office|baku|az/i.test(item));

  const candidates = [
    {
      key: "business_name_conflict",
      step: "company",
      title: "Business name",
      group: "business_truth",
      prompt: contradictions.find((item) => item.key === "business_name_conflict")
        ?.message,
      priority: 100,
      when: contradictions.some((item) => item.key === "business_name_conflict"),
    },
    {
      key: "website_conflict",
      step: "website",
      title: "Main website",
      group: "business_truth",
      prompt: contradictions.find((item) => item.key === "website_conflict")
        ?.message,
      priority: 98,
      when: contradictions.some((item) => item.key === "website_conflict"),
    },
    {
      key: "services_conflict",
      step: "services",
      title: "Core services",
      group: "business_truth",
      prompt:
        contradictions.find((item) => item.key === "services_conflict")?.message ||
        "Əsas xidmətlər source ilə tam oturmur. Düz xidmətləri yaz.",
      priority: 96,
      when: contradictions.some((item) => item.key === "services_conflict"),
    },
    {
      key: "contact_conflict",
      step: "contacts",
      title: "Contact route",
      group: "business_truth",
      prompt:
        contradictions.find((item) => item.key === "contact_conflict")?.message ||
        "Əsas əlaqə marşrutunu dəqiqləşdir.",
      priority: 92,
      when: contradictions.some((item) => item.key === "contact_conflict"),
    },
    {
      key: "contact_route",
      step: "contacts",
      title: "Primary conversion route",
      group: "business_truth",
      prompt:
        "Müştəri sonda əsasən hara yönləndirilməlidir? Birinci prioritet route-u yaz.",
      priority: 90,
      when: !draftState.contacts.length && !strongContactSource,
    },
    {
      key: "handoff_rules",
      step: "handoff",
      title: "Human handoff",
      group: "ai_behavior",
      prompt: "AI hansı hallarda mütləq insana ötürməlidir?",
      priority: 88,
      when: !draftState.humanHandoff,
    },
    {
      key: "availability",
      step: "hours",
      title: "Hours",
      group: "business_truth",
      prompt:
        "İş və ya cavab saatları necə göstərilməlidir? Voice receptionist bunu necə deməlidir?",
      priority: 86,
      when: !draftState.hours.length && needsHours && !strongHoursSource,
    },
    {
      key: "pricing_posture",
      step: "pricing",
      title: "Pricing posture",
      group: "business_truth",
      prompt:
        "Qiymət necə təqdim olunmalıdır? AI birbaşa rəqəm desin, yoxsa sorğuya/operatora yönləndirsin?",
      priority: 84,
      when: !draftState.pricingPosture && !strongPricingSource,
    },
    {
      key: "languages",
      step: "profile",
      title: "Languages",
      group: "ai_behavior",
      prompt: "AI hansı dillərdə danışmalıdır?",
      priority: 82,
      when: !draftState.languages.length && !strongLanguageSource,
    },
    {
      key: "tone",
      step: "profile",
      title: "Tone",
      group: "ai_behavior",
      prompt:
        "AI-nin tonu necə olmalıdır? (premium, mehriban, qısa, satış yönümlü və s.)",
      priority: 80,
      when: !draftState.tone && !strongToneSource,
    },
    {
      key: "greeting",
      step: "profile",
      title: "Opening style",
      group: "ai_behavior",
      prompt:
        "AI söhbətə necə başlamalıdır? Qısa qarşılamanı necə hiss etdirmək istəyirsən?",
      priority: 78,
      when: !draftState.greetingStyle && !strongGreetingSource,
    },
    {
      key: "after_hours",
      step: "handoff",
      title: "After-hours behavior",
      group: "ai_behavior",
      prompt:
        "İş saatından kənar yazan və ya zəng edən istifadəçiyə AI necə cavab verməlidir?",
      priority: 77,
      when: !draftState.afterHoursBehavior && !strongAfterHoursSource,
    },
    {
      key: "business_name",
      step: "company",
      title: "Business name",
      group: "business_truth",
      prompt: "Biznesin adı necə görünməlidir?",
      priority: 76,
      when: !draftState.businessName && !strongNameSource,
    },
    {
      key: "positioning",
      step: "description",
      title: "What the business is",
      group: "business_truth",
      prompt: "Bu biznesi bir-iki cümlə ilə necə təqdim etməliyəm?",
      priority: 74,
      when: !draftState.description && !(strongDescriptionSource && strongWebsite),
    },
    {
      key: "services",
      step: "services",
      title: "Core services",
      group: "business_truth",
      prompt: "Əsas xidmətləri yaz.",
      priority: 72,
      when: !draftState.services.length && !(strongServicesSource && strongWebsite),
    },
    {
      key: "audience",
      step: "profile",
      title: "Audience",
      group: "business_truth",
      prompt: "Əsasən kimlərə xidmət göstərirsiniz?",
      priority: 70,
      when: !draftState.audience,
    },
  ];

  return candidates
    .filter((item) => item.when)
    .sort((a, b) => b.priority - a.priority);
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
      key: item.key,
      step: item.step,
      title: item.title,
      group: item.group,
      groupLabel: groupLabel(item.group),
      priority: item.priority,
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
    draftState.hours.length
      ? `Availability: ${listPreview(draftState.hours, 4)}`
      : "",
    draftState.humanHandoff ? `Human handoff: ${draftState.humanHandoff}` : "",
    draftState.languages.length
      ? `Languages: ${listPreview(draftState.languages, 4)}`
      : "",
    draftState.tone ? `Tone: ${draftState.tone}` : "",
    draftState.greetingStyle ? `Opening style: ${draftState.greetingStyle}` : "",
    draftState.afterHoursBehavior
      ? `After-hours behavior: ${draftState.afterHoursBehavior}`
      : "",
  ].filter(Boolean);

  const guidance = [
    confidence.strong.length
      ? `What I’m confident about:\n- ${confidence.strong.join("\n- ")}`
      : "",
    confidence.unclear.length
      ? `What still looks unclear:\n- ${confidence.unclear.join("\n- ")}`
      : "",
    confidence.contradictions.length
      ? `What may be inconsistent:\n- ${confidence.contradictions.join("\n- ")}`
      : "",
    recommendations.length
      ? `My recommendation:\n- ${recommendations.join("\n- ")}`
      : "",
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
  const rawDraftState = buildDraftState({ draft, review });
  const draftState = mergeSourceInferredDraft(rawDraftState, sourceSignals);
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
  const blockingContradictions = contradictions.filter(
    (item) => lower(item.severity) !== "low"
  );

  const readyForApproval =
    !nextQuestion &&
    !blockingContradictions.length &&
    Boolean(
      draftState.businessName &&
        draftState.description &&
        draftState.services.length &&
        draftState.contacts.length &&
        draftState.pricingPosture &&
        draftState.humanHandoff &&
        draftState.greetingStyle &&
        draftState.afterHoursBehavior
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
          group: nextQuestion.group,
          groupLabel: groupLabel(nextQuestion.group),
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
      primarySourceType: sourceSignals.primarySourceType,
      primarySourceLabel: sourceSignals.primarySourceLabel,
      primarySourceUrl: sourceSignals.primarySourceUrl,
      primarySourceAuthorityClass: sourceSignals.primarySourceAuthorityClass,
      pageCount: sourceSignals.pageCount,
      sourceTypes: sourceSignals.sourceTypes,
      strongestEvidence: sourceSignals.strongestEvidence,
      discoveredPublicClaims: sourceSignals.discoveredPublicClaims,
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