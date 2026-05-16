import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import {
  normalizeSourceType,
  normalizeWebsiteUrl,
  sourceTypeLabel,
  uniqueStrings,
} from "./shared.js";

function compactText(value = "", max = 420) {
  const text = s(value).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function urlHost(value = "") {
  const raw = normalizeWebsiteUrl(s(value));
  if (!raw) return "";

  try {
    return new URL(raw).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
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

function topCandidate(values = []) {
  return arr(values)[0] || "";
}

function sourceUrlFrom(value = {}) {
  return s(value.sourceUrl || value.url || obj(value.metadata).sourceUrl);
}

function sourceTextFrom(value = {}) {
  return compactText(
    s(
      value.text ||
        value.content ||
        value.summary ||
        value.excerpt ||
        value.description ||
        obj(value.metadata).summary
    ),
    700
  );
}

function buildSourceRows({ draft = {}, sources = [], review = null } = {}) {
  const safeDraft = obj(draft);
  const sourceMetadata = obj(safeDraft.sourceMetadata);
  const reviewRoot = obj(review);
  const sourceSignalSummary = obj(reviewRoot.sourceSignalSummary);
  const rows = [];

  const pushRow = (value = {}) => {
    const row = compactDraftObject({
      sourceId: s(value.sourceId || value.id),
      sourceType: normalizeSourceType(value.sourceType || value.type),
      role: s(value.role),
      label: s(value.label || value.title || value.name),
      sourceUrl: sourceUrlFrom(value),
      sourceAuthorityClass: s(
        value.sourceAuthorityClass || obj(value.metadata).sourceAuthorityClass
      ),
      text: sourceTextFrom(value),
    });

    if (s(row.sourceType) || s(row.sourceUrl) || s(row.label) || s(row.text)) {
      rows.push(row);
    }
  };

  for (const source of arr(sources)) {
    pushRow(source);
  }

  const metadataPrimaryType = normalizeSourceType(sourceMetadata.primarySourceType);
  const metadataPrimaryUrl = s(sourceMetadata.primarySourceUrl);

  if (metadataPrimaryType || metadataPrimaryUrl) {
    pushRow({
      sourceType: metadataPrimaryType,
      role: "primary",
      label: sourceTypeLabel(metadataPrimaryType),
      sourceUrl: metadataPrimaryUrl,
      text: arr(sourceMetadata.evidenceSummary).join(" | "),
    });
  }

  const signalPrimary = obj(sourceSignalSummary.primarySource);
  if (s(signalPrimary.sourceType) || s(signalPrimary.sourceUrl)) {
    pushRow({
      sourceType: signalPrimary.sourceType,
      role: s(signalPrimary.role || "primary"),
      label: signalPrimary.label,
      sourceUrl: signalPrimary.sourceUrl,
      sourceAuthorityClass: signalPrimary.sourceAuthorityClass,
    });
  }

  const seen = new Set();
  return rows.filter((row) => {
    const key = [row.sourceType, row.role, row.label, row.sourceUrl, row.text]
      .map((item) => s(item).toLowerCase())
      .join("|");

    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickPrimarySource({ session = {}, draft = {}, sourceRows = [], review = null } = {}) {
  const safeDraft = obj(draft);
  const sourceMetadata = obj(safeDraft.sourceMetadata);
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const sourceSummary = obj(safeDraft.sourceSummary);
  const sourceSignalSummary = obj(reviewRoot.sourceSignalSummary);

  if (
    s(obj(sourceSignalSummary.primarySource).sourceType) ||
    s(obj(sourceSignalSummary.primarySource).sourceUrl)
  ) {
    return obj(sourceSignalSummary.primarySource);
  }

  const explicitPrimary =
    sourceRows.find((item) => s(item.role).toLowerCase() === "primary") ||
    sourceRows[0];

  if (explicitPrimary) return explicitPrimary;

  return compactDraftObject({
    sourceType: normalizeSourceType(
      sourceSummary.primarySourceType ||
        session.primarySourceType ||
        sourceMetadata.primarySourceType
    ),
    sourceUrl:
      s(sourceSummary.primarySourceUrl) ||
      s(sourceMetadata.primarySourceUrl) ||
      s(reviewDraft.businessProfile?.websiteUrl) ||
      s(obj(safeDraft.businessProfile).websiteUrl),
    label: sourceTypeLabel(
      sourceSummary.primarySourceType ||
        session.primarySourceType ||
        sourceMetadata.primarySourceType
    ),
  });
}

function evidenceFromReview(review = null) {
  const root = obj(review);
  const reviewDebug = obj(root.review?.reviewDebug || root.reviewDebug);
  const sourceSignalSummary = obj(root.sourceSignalSummary);
  const websiteKnowledge = obj(
    sourceSignalSummary.website || reviewDebug.websiteKnowledge
  );

  return uniqueStrings(
    [
      ...arr(sourceSignalSummary.discoveredPublicClaims),
      ...arr(websiteKnowledge.topPages).map((page) =>
        [s(page.title), s(page.summary || page.description || page.text)]
          .filter(Boolean)
          .join(": ")
      ),
    ],
    24
  );
}

function businessProfileFrom(draft = {}, review = null) {
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);

  return {
    ...obj(reviewDraft.businessProfile),
    ...obj(draft.businessProfile),
  };
}

function servicesFrom(draft = {}, review = null) {
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);

  return uniqueStrings(
    [
      ...arr(reviewDraft.services).map((item) =>
        s(item.title || item.name || item.label || item.value_text)
      ),
      ...arr(draft.services).map((item) => s(item.title || item.name || item.label)),
    ],
    24
  );
}

function contactsFrom(draft = {}, review = null) {
  const reviewRoot = obj(review);
  const reviewDraft = obj(reviewRoot.review?.draft || reviewRoot.draft);
  const profile = businessProfileFrom(draft, review);

  return uniqueStrings(
    [
      profile.primaryPhone,
      profile.primaryEmail,
      profile.primaryAddress,
      ...arr(reviewDraft.contacts).map((item) =>
        s(item.value || item.label || item.channel || item.type)
      ),
      ...arr(draft.contacts).map((item) =>
        s(item.value || item.label || item.channel || item.type)
      ),
    ],
    24
  );
}

function hoursFrom(draft = {}, review = null) {
  const profile = businessProfileFrom(draft, review);

  return uniqueStrings(
    [
      ...arr(profile.hours),
      ...arr(draft.hours).map((item) => {
        const row = obj(item);
        if (!s(row.day)) return "";
        if (row.allDay === true) return `${s(row.day)} 24 hours`;
        if (row.appointmentOnly === true) return `${s(row.day)} appointment only`;
        if (row.closed === true) return `${s(row.day)} closed`;
        if (s(row.notes)) return `${s(row.day)} ${s(row.notes)}`;
        if (s(row.openTime) || s(row.closeTime)) {
          return `${s(row.day)} ${s(row.openTime)}-${s(row.closeTime)}`;
        }
        return "";
      }),
    ],
    16
  );
}

function pricingFrom(draft = {}, review = null) {
  const profile = businessProfileFrom(draft, review);
  const pricing = obj(draft.pricingPosture);

  return s(
    profile.pricingPolicy ||
      pricing.publicSummary ||
      pricing.note ||
      pricing.summary ||
      pricing.pricingNotes
  );
}

function handoffFrom(draft = {}) {
  const handoff = obj(draft.handoffRules);
  return s(handoff.summary || arr(handoff.triggers).join(", "));
}

function languagesFrom(draft = {}, review = null) {
  const profile = businessProfileFrom(draft, review);

  return uniqueStrings(
    [
      ...arr(profile.supportedLanguages),
      ...arr(profile.languages),
      ...arr(draft.languages),
    ],
    8
  );
}

export function buildSetupSourceSignals({
  session = {},
  draft = {},
  sources = [],
  review = null,
} = {}) {
  const profile = businessProfileFrom(draft, review);
  const sourceMetadata = obj(draft.sourceMetadata);
  const sourceRows = buildSourceRows({ draft, sources, review });
  const primarySource = pickPrimarySource({ session, draft, sourceRows, review });
  const evidence = uniqueStrings(
    [...arr(sourceMetadata.evidenceSummary), ...evidenceFromReview(review)],
    24
  );

  const companyNameCandidates = uniqueStrings(
    [profile.companyName || profile.displayName || profile.name],
    8
  );
  const descriptionCandidates = uniqueStrings(
    [profile.description || profile.companySummaryShort || profile.companySummary],
    8
  );
  const serviceCandidates = servicesFrom(draft, review);
  const contactCandidates = contactsFrom(draft, review);
  const hoursCandidates = hoursFrom(draft, review);
  const pricingCandidates = uniqueStrings([pricingFrom(draft, review)], 8);
  const languagesCandidates = languagesFrom(draft, review);

  const strongestEvidence = uniqueStrings(
    [
      s(primarySource.sourceUrl)
        ? `${sourceTypeLabel(primarySource.sourceType)} source: ${primarySource.sourceUrl}`
        : "",
      companyNameCandidates.length
        ? `Business name already drafted: ${companyNameCandidates[0]}`
        : "",
      descriptionCandidates.length ? "Description already drafted" : "",
      serviceCandidates.length
        ? `${serviceCandidates.length} service draft value(s)`
        : "",
      contactCandidates.length ? "Contact route present" : "",
      hoursCandidates.length ? "Hours present" : "",
      pricingCandidates.length ? "Pricing posture present" : "",
      ...evidence,
    ],
    12
  );

  return {
    sourceRows,
    primarySourceType: normalizeSourceType(primarySource.sourceType || session.primarySourceType),
    primarySourceLabel:
      s(primarySource.label) || sourceTypeLabel(primarySource.sourceType),
    primarySourceUrl: s(primarySource.sourceUrl),
    primarySourceAuthorityClass: s(primarySource.sourceAuthorityClass),
    sourceTypes: uniqueStrings(
      [
        primarySource.sourceType,
        ...sourceRows.map((item) => item.sourceType),
      ],
      8
    ),
    pageCount:
      Number(obj(obj(review).sourceSignalSummary).website?.pageCount || 0) ||
      Number(sourceMetadata.pageCount || 0) ||
      0,
    strongestEvidence,
    discoveredPublicClaims: evidence,
    companyNameCandidates,
    descriptionCandidates,
    serviceCandidates,
    contactCandidates,
    hoursCandidates,
    pricingCandidates,
    audienceCandidates: uniqueStrings(
      [profile.targetAudience || profile.audience],
      8
    ),
    languagesCandidates,
  };
}

export function buildSetupSourceCoverage(sourceSignals = {}) {
  const primarySourceExists = Boolean(
    s(sourceSignals.primarySourceType) || s(sourceSignals.primarySourceUrl)
  );

  return {
    primarySourceExists,
    identity: Boolean(
      primarySourceExists &&
        arr(sourceSignals.companyNameCandidates).length &&
        arr(sourceSignals.descriptionCandidates).length
    ),
    services: arr(sourceSignals.serviceCandidates).length >= 1,
    contacts: arr(sourceSignals.contactCandidates).length >= 1,
    hours: arr(sourceSignals.hoursCandidates).length >= 1,
    pricing: arr(sourceSignals.pricingCandidates).length >= 1,
    audience: arr(sourceSignals.audienceCandidates).length >= 1,
    languages: arr(sourceSignals.languagesCandidates).length >= 1,
  };
}

export function buildSetupDraftStateFromSignals({
  draft = {},
  review = null,
  sourceSignals = {},
} = {}) {
  const profile = businessProfileFrom(draft, review);

  return {
    businessName:
      s(profile.companyName || profile.displayName || profile.name) ||
      topCandidate(sourceSignals.companyNameCandidates),
    description:
      s(profile.description || profile.companySummaryShort || profile.companySummary) ||
      topCandidate(sourceSignals.descriptionCandidates),
    websiteUrl:
      normalizeWebsiteUrl(s(profile.websiteUrl)) ||
      (s(sourceSignals.primarySourceType).toLowerCase() === "website"
        ? normalizeWebsiteUrl(s(sourceSignals.primarySourceUrl))
        : ""),
    services: uniqueStrings([
      ...servicesFrom(draft, review),
      ...arr(sourceSignals.serviceCandidates),
    ]),
    audience:
      s(profile.targetAudience || profile.audience) ||
      topCandidate(sourceSignals.audienceCandidates),
    pricingPosture: pricingFrom(draft, review) || topCandidate(sourceSignals.pricingCandidates),
    contacts: uniqueStrings([
      ...contactsFrom(draft, review),
      ...arr(sourceSignals.contactCandidates),
    ]),
    hours: uniqueStrings([
      ...hoursFrom(draft, review),
      ...arr(sourceSignals.hoursCandidates),
    ]),
    humanHandoff: handoffFrom(draft),
    languages: uniqueStrings([
      ...languagesFrom(draft, review),
      ...arr(sourceSignals.languagesCandidates),
    ]),
  };
}

export function detectSetupSignalContradictions({
  draftState = {},
  sourceSignals = {},
}) {
  const contradictions = [];
  const sourceName = topCandidate(sourceSignals.companyNameCandidates);
  const draftWebsiteHost = urlHost(draftState.websiteUrl);
  const sourceWebsiteHost = urlHost(sourceSignals.primarySourceUrl);

  if (
    draftState.businessName &&
    sourceName &&
    overlapScore(draftState.businessName, sourceName) < 0.4
  ) {
    contradictions.push({
      key: "business_name_conflict",
      severity: "high",
      message: `Source business-name signal looks like "${sourceName}", but the current draft says "${draftState.businessName}".`,
    });
  }

  if (draftWebsiteHost && sourceWebsiteHost && draftWebsiteHost !== sourceWebsiteHost) {
    contradictions.push({
      key: "website_conflict",
      severity: "high",
      message: `The draft website looks like "${draftWebsiteHost}", while the main source looks like "${sourceWebsiteHost}".`,
    });
  }

  if (arr(draftState.services).length && arr(sourceSignals.serviceCandidates).length) {
    const overlapFound = arr(draftState.services).some((service) =>
      arr(sourceSignals.serviceCandidates).some(
        (candidate) => overlapScore(service, candidate) >= 0.45
      )
    );

    if (!overlapFound) {
      contradictions.push({
        key: "services_conflict",
        severity: "medium",
        message:
          "The current service list does not line up with the strongest service values coming from the current draft/source state.",
      });
    }
  }

  return contradictions;
}

export function buildSetupSourceLead(sourceSignals = {}) {
  const label = s(sourceSignals.primarySourceLabel);
  const url = s(sourceSignals.primarySourceUrl);

  if (label && url) return `${label} source is already attached (${url})`;
  if (label) return `${label} source is already attached`;
  if (url) return `A source URL is already attached (${url})`;
  return "";
}

export function buildSetupKnownState(draftState = {}) {
  const bits = [];

  if (s(draftState.businessName)) bits.push(`name: ${draftState.businessName}`);
  if (s(draftState.description)) bits.push("description present");
  if (arr(draftState.services).length) {
    bits.push(`${arr(draftState.services).length} service signals`);
  }
  if (arr(draftState.contacts).length) bits.push("contact route present");
  if (arr(draftState.hours).length) bits.push("hours present");
  if (s(draftState.pricingPosture)) bits.push("pricing posture present");
  if (s(draftState.humanHandoff)) bits.push("handoff rules present");

  return bits.slice(0, 6);
}
