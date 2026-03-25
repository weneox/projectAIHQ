import { WEBSITE_SOFT_WARNING_CODES } from "./constants.js";
import { arr, obj, s } from "../shared.js";
import { dedupeWarnings } from "./helpers.js";

function buildWebsiteSignalStrength({
  extracted = null,
  signals = null,
  profile = null,
  observationsDraft = [],
  synthesis = null,
}) {
  const site = obj(extracted?.site);
  const identity = obj(site.identitySignals);
  const websiteSignals = obj(signals);
  const synthesisProfile = obj(synthesis?.profile);

  const nameCount = Math.max(
    arr(identity.nameCandidates).length,
    arr(synthesisProfile.businessNames).length,
    s(profile?.companyTitle || profile?.companyName) ? 1 : 0
  );

  const descriptionCount = Math.max(
    arr(identity.descriptionCandidates).length,
    s(profile?.companySummaryShort || profile?.summaryShort) ? 1 : 0,
    s(profile?.companySummaryLong || profile?.summaryLong) ? 1 : 0,
    s(synthesisProfile.summaryShort || synthesisProfile.companySummaryShort) ? 1 : 0,
    s(synthesisProfile.summaryLong || synthesisProfile.companySummaryLong) ? 1 : 0
  );

  const contactCount =
    arr(identity.contactEmails).length +
    arr(identity.contactPhones).length +
    arr(identity.addresses).length +
    arr(identity.hours).length;

  const serviceCount =
    arr(identity.serviceHints).length +
    arr(websiteSignals.offerings?.services).length +
    arr(profile?.services).length +
    arr(synthesisProfile.services).length;

  const pricingCount =
    arr(identity.pricingHints).length + arr(profile?.pricingHints).length;

  const faqCount = arr(identity.faqPreview).length + arr(profile?.faqItems).length;

  const pageCount = Math.max(
    Number(site.pagesScanned || 0),
    arr(extracted?.pages).length
  );

  const observationCount = arr(observationsDraft).length;
  const socialCount = arr(site.socialLinks).length + arr(profile?.socialLinks).length;
  const trustScore = Number(site?.quality?.score || 0);

  const totalSignalScore =
    nameCount * 4 +
    descriptionCount * 2 +
    Math.min(contactCount, 6) * 3 +
    Math.min(serviceCount, 8) * 2 +
    Math.min(pricingCount, 4) +
    Math.min(faqCount, 4) +
    Math.min(observationCount, 10) +
    Math.min(socialCount, 5) +
    Math.min(pageCount, 6) +
    (trustScore >= 60 ? 6 : trustScore >= 35 ? 3 : 0);

  return {
    nameCount,
    descriptionCount,
    contactCount,
    serviceCount,
    pricingCount,
    faqCount,
    pageCount,
    observationCount,
    socialCount,
    trustScore,
    totalSignalScore,
    hasUsableIdentity: nameCount > 0 && (descriptionCount > 0 || serviceCount > 0),
    hasUsableBusinessSignals:
      nameCount > 0 &&
      (serviceCount > 0 || contactCount > 0 || descriptionCount > 0),
    isClearlyUsable:
      totalSignalScore >= 12 &&
      nameCount > 0 &&
      (serviceCount > 0 || contactCount > 0 || descriptionCount > 0),
  };
}

function classifyWebsiteWarnings({
  warnings = [],
  extracted = null,
  signals = null,
  profile = null,
  observationsDraft = [],
  synthesis = null,
  weakWebsiteExtraction = false,
  websiteTrust = null,
  candidateAdmission = null,
}) {
  const signalStrength = buildWebsiteSignalStrength({
    extracted,
    signals,
    profile,
    observationsDraft,
    synthesis,
  });

  const trustWarnings = arr(websiteTrust?.warnings);
  const trustCriticalWarnings = arr(websiteTrust?.criticalWarnings);
  const siteWarnings = arr(extracted?.site?.quality?.warnings);
  const crawlWarnings = arr(extracted?.crawl?.warnings);

  const hardWebsiteWarnings = dedupeWarnings([
    ...trustCriticalWarnings,
    ...trustWarnings.filter(
      (x) =>
        !WEBSITE_SOFT_WARNING_CODES.has(x) &&
        !["thin_visible_content", "very_thin_visible_content"].includes(x)
    ),
    ...siteWarnings.filter(
      (x) =>
        !WEBSITE_SOFT_WARNING_CODES.has(x) &&
        !["thin_visible_content", "very_thin_visible_content"].includes(x)
    ),
    ...crawlWarnings.filter(
      (x) =>
        !WEBSITE_SOFT_WARNING_CODES.has(x) &&
        !["thin_visible_content", "very_thin_visible_content"].includes(x)
    ),
  ]);

  const rawWarnings = dedupeWarnings(warnings);
  const surfacedWarnings = [];
  const debugOnlyWarnings = [];

  const forceSurfaceBecauseBlocked =
    candidateAdmission &&
    candidateAdmission.allowCandidateCreation === false &&
    [
      "weak_website_extraction",
      "website_trust_guard_blocked_candidate_creation",
    ].includes(s(candidateAdmission.reason));

  for (const warning of rawWarnings) {
    const code = s(warning);
    const isSoft = WEBSITE_SOFT_WARNING_CODES.has(code);

    if (
      (code === "very_thin_visible_content" || code === "thin_visible_content") &&
      signalStrength.isClearlyUsable &&
      !weakWebsiteExtraction
    ) {
      debugOnlyWarnings.push(code);
      continue;
    }

    if (
      isSoft &&
      signalStrength.isClearlyUsable &&
      !weakWebsiteExtraction &&
      !forceSurfaceBecauseBlocked &&
      hardWebsiteWarnings.length === 0
    ) {
      debugOnlyWarnings.push(code);
      continue;
    }

    surfacedWarnings.push(code);
  }

  if (
    surfacedWarnings.length === 0 &&
    forceSurfaceBecauseBlocked &&
    candidateAdmission?.reason
  ) {
    surfacedWarnings.push(s(candidateAdmission.reason));
  }

  if (
    surfacedWarnings.length === 0 &&
    weakWebsiteExtraction &&
    !signalStrength.isClearlyUsable
  ) {
    surfacedWarnings.push("weak_website_extraction");
  }

  return {
    signalStrength,
    surfacedWarnings: dedupeWarnings(surfacedWarnings),
    debugOnlyWarnings: dedupeWarnings(debugOnlyWarnings),
    hardWebsiteWarnings,
  };
}

export function buildFinishWarnings({
  sourceType = "",
  warnings = [],
  extracted = null,
  rawSignals = null,
  sourceProfile = null,
  observationsDraft = [],
  synthesis = null,
  weakWebsiteExtraction = false,
  websiteTrust = null,
  candidateAdmission = null,
}) {
  if (sourceType !== "website") {
    return {
      surfacedWarnings: dedupeWarnings(warnings),
      debugWarnings: [],
      diagnostics: null,
    };
  }

  const diagnostics = classifyWebsiteWarnings({
    warnings,
    extracted,
    signals: rawSignals,
    profile: sourceProfile,
    observationsDraft,
    synthesis,
    weakWebsiteExtraction,
    websiteTrust,
    candidateAdmission,
  });

  return {
    surfacedWarnings: arr(diagnostics.surfacedWarnings),
    debugWarnings: arr(diagnostics.debugOnlyWarnings),
    diagnostics,
  };
}