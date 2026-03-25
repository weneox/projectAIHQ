import { normalizeSynthesisResult } from "../normalize.js";
import { arr, obj, s } from "../shared.js";
import {
  buildWebsiteSignals,
  synthesizeBusinessProfile,
} from "../websiteHelpers.js";
import {
  SOURCE_FUSION_VERSION,
  SOURCE_SYNC_VERSION,
  WEBSITE_PARTIAL_STAGE_SET,
} from "./constants.js";
import { buildCandidateAdmission } from "./admission.js";
import {
  buildSourceSignalPayload,
  dedupeWarnings,
  safeWebsitePageCount,
} from "./helpers.js";

function parseHttpBarrierStatus(code = "") {
  const m = s(code).match(/^http_(\d{3})$/i);
  return m ? Number(m[1]) : 0;
}

function collectErrorHints(err = null) {
  return dedupeWarnings([
    err?.code,
    err?.error,
    err?.message,
    err?.statusText,
    err?.cause?.code,
    err?.cause?.message,
    err?.errorDetail?.code,
    err?.errorDetail?.message,
    ...arr(err?.errors).flatMap((x) => [x?.code, x?.message]),
    ...arr(err?.attempts).flatMap((x) => [
      x?.error,
      x?.status ? `http_${x.status}` : "",
      x?.statusText,
    ]),
  ]);
}

function classifyHttpStatus(status = 0) {
  const code = Number(status || 0);
  if (!code) return "";

  if ([401, 403, 406, 451].includes(code)) return "blocked";
  if (code === 429) return "rate_limited";
  if (code === 404) return "not_found";
  if (code === 422) return "unprocessable";
  if (code >= 500) return "remote_unavailable";
  if (code >= 400) return "http_error";
  return "";
}

export function classifyWebsiteExtractBarrier(err) {
  const hints = collectErrorHints(err);
  const joined = hints.join(" | ").toLowerCase();

  const directStatus = Number(err?.status || err?.statusCode || 0);
  if (directStatus > 0) {
    return {
      code: `http_${directStatus}`,
      status: directStatus,
      message: s(err?.message || err?.error || `http_${directStatus}`),
      barrierType: classifyHttpStatus(directStatus) || "http_error",
    };
  }

  for (const hint of hints) {
    const code = s(hint);
    const inlineHttpMatch = code.match(/http_(\d{3})/i);
    if (inlineHttpMatch?.[1]) {
      const status = Number(inlineHttpMatch[1]);
      return {
        code: `http_${status}`,
        status,
        message: s(err?.message || code),
        barrierType: classifyHttpStatus(status) || "http_error",
      };
    }
  }

  if (/website response is not a valid html page/i.test(joined)) {
    return {
      code: "non_html_response",
      status: 0,
      message: s(err?.message || "website response is not a valid HTML page"),
      barrierType: "non_html_response",
    };
  }

  if (
    /(timeout|timed out|abort|fetch failed|network|socket|econnreset|enotfound|eai_again|econnrefused|tls|ssl|certificate|headers timeout|body timeout)/i.test(
      joined
    )
  ) {
    return {
      code: "fetch_failed",
      status: 0,
      message: s(err?.message || err?.error || "fetch_failed"),
      barrierType: "network_or_fetch_failure",
    };
  }

  if (/(403|forbidden|access denied|request blocked|blocked)/i.test(joined)) {
    return {
      code: "http_403",
      status: 403,
      message: s(err?.message || err?.error || "http_403"),
      barrierType: "blocked",
    };
  }

  if (/(429|too many requests|rate limit)/i.test(joined)) {
    return {
      code: "http_429",
      status: 429,
      message: s(err?.message || err?.error || "http_429"),
      barrierType: "rate_limited",
    };
  }

  if (/(404|not found)/i.test(joined)) {
    return {
      code: "http_404",
      status: 404,
      message: s(err?.message || err?.error || "http_404"),
      barrierType: "not_found",
    };
  }

  if (/(500|502|503|504|520|521|522|523|524|525|526|bad gateway|unavailable|server error|gateway timeout)/i.test(joined)) {
    return {
      code: "http_503",
      status: 503,
      message: s(err?.message || err?.error || "http_503"),
      barrierType: "remote_unavailable",
    };
  }

  if (/^fetch_failed$/i.test(s(err?.message || err?.error || err))) {
    return {
      code: "fetch_failed",
      status: 0,
      message: s(err?.message || err?.error || "fetch_failed"),
      barrierType: "network_or_fetch_failure",
    };
  }

  return null;
}

export function classifyWebsitePartialBarrier({
  err,
  stage = "",
  extracted = null,
  createdObservations = [],
}) {
  const directBarrier = classifyWebsiteExtractBarrier(err);
  if (directBarrier) return directBarrier;

  const currentStage = s(stage).toLowerCase();
  const earlyStage = WEBSITE_PARTIAL_STAGE_SET.has(currentStage);
  const pageCount = safeWebsitePageCount(extracted);
  const noReviewableObservations = !arr(createdObservations).length;

  if (earlyStage && noReviewableObservations) {
    return {
      code: "website_processing_failed_before_review",
      status: Number(err?.status || err?.statusCode || 0),
      message:
        s(err?.message || err) ||
        `website processing failed at stage '${currentStage || "unknown"}'`,
      barrierType:
        pageCount > 0
          ? "processing_failure_after_extract"
          : "processing_failure_before_extract",
    };
  }

  return null;
}

function buildWebsiteBarrierWarnings(barrier = null) {
  const code = s(barrier?.code);
  const status = Number(barrier?.status || 0);
  const type = s(barrier?.barrierType);

  const out = [code || "website_fetch_barrier_detected"];

  if (type === "blocked") out.push("backend_access_blocked_by_remote_site");
  if (type === "rate_limited") out.push("remote_site_rate_limited_backend_access");
  if (type === "remote_unavailable") out.push("remote_site_temporarily_unavailable");
  if (type === "network_or_fetch_failure") out.push("backend_could_not_reach_site");
  if (type === "non_html_response") out.push("non_html_website_response");
  if (type === "not_found") out.push("website_entry_not_found");
  if (type === "unprocessable") out.push("remote_site_rejected_backend_request");
  if (type === "processing_failure_before_extract") {
    out.push("backend_could_not_prepare_reviewable_website_data");
  }
  if (type === "processing_failure_after_extract") {
    out.push("website_review_data_partially_available_but_sync_could_not_complete");
  }

  if (!status && !code && !type) {
    out.push("website_fetch_barrier_detected");
  }

  return dedupeWarnings(out);
}

function pickFirstText(...values) {
  for (const value of values) {
    const text = s(value);
    if (text) return text;
  }

  return "";
}

function mergeTextLists(...lists) {
  return dedupeWarnings(
    lists.flatMap((list) => arr(list).map((item) => s(item)).filter(Boolean))
  );
}

function buildWebsiteBarrierSeedProfile({
  sourceUrl = "",
  extracted = null,
  rawSignals = null,
  sourceProfile = null,
}) {
  const seeded = obj(sourceProfile);
  const derivedSignals =
    Object.keys(obj(rawSignals)).length > 0 ? obj(rawSignals) : buildWebsiteSignals(extracted);
  const derived = synthesizeBusinessProfile(derivedSignals);

  return {
    companyName: pickFirstText(
      seeded.companyName,
      seeded.displayName,
      seeded.companyTitle,
      derived.companyName,
      derived.displayName,
      derived.companyTitle
    ),
    displayName: pickFirstText(
      seeded.displayName,
      seeded.companyName,
      seeded.companyTitle,
      derived.displayName,
      derived.companyName,
      derived.companyTitle
    ),
    companyTitle: pickFirstText(
      seeded.companyTitle,
      seeded.companyName,
      seeded.displayName,
      derived.companyTitle,
      derived.companyName,
      derived.displayName
    ),
    websiteUrl: pickFirstText(
      seeded.websiteUrl,
      seeded.website,
      derived.websiteUrl,
      sourceUrl
    ),
    sourceUrl: pickFirstText(seeded.sourceUrl, derived.sourceUrl, sourceUrl),
    sourceType: "website",
    companySummaryShort: pickFirstText(
      seeded.companySummaryShort,
      seeded.summaryShort,
      derived.companySummaryShort,
      derived.summaryShort
    ),
    companySummaryLong: pickFirstText(
      seeded.companySummaryLong,
      seeded.summaryLong,
      derived.companySummaryLong,
      derived.summaryLong
    ),
    aboutSection: pickFirstText(seeded.aboutSection, derived.aboutSection),
    primaryPhone: pickFirstText(
      seeded.primaryPhone,
      seeded.phone,
      ...arr(seeded.phones),
      derived.primaryPhone,
      ...arr(derived.phones)
    ),
    primaryEmail: pickFirstText(
      seeded.primaryEmail,
      seeded.email,
      ...arr(seeded.emails),
      derived.primaryEmail,
      ...arr(derived.emails)
    ),
    primaryAddress: pickFirstText(
      seeded.primaryAddress,
      seeded.address,
      ...arr(seeded.addresses),
      derived.primaryAddress,
      ...arr(derived.addresses)
    ),
    services: mergeTextLists(seeded.services, derived.services, seeded.products),
    products: mergeTextLists(seeded.products, derived.products),
    pricingHints: mergeTextLists(seeded.pricingHints, derived.pricingHints),
    pricingPolicy: pickFirstText(seeded.pricingPolicy, derived.pricingPolicy),
    supportMode: pickFirstText(seeded.supportMode, derived.supportMode),
    hours: mergeTextLists(seeded.hours, derived.hours),
    emails: mergeTextLists(seeded.emails, [seeded.primaryEmail], derived.emails),
    phones: mergeTextLists(seeded.phones, [seeded.primaryPhone], derived.phones),
    addresses: mergeTextLists(
      seeded.addresses,
      [seeded.primaryAddress],
      derived.addresses
    ),
    socialLinks:
      arr(seeded.socialLinks).length > 0 ? arr(seeded.socialLinks) : arr(derived.socialLinks),
    whatsappLinks: mergeTextLists(seeded.whatsappLinks, derived.whatsappLinks),
    bookingLinks: mergeTextLists(seeded.bookingLinks, derived.bookingLinks),
    faqItems: arr(seeded.faqItems).length > 0 ? arr(seeded.faqItems) : arr(derived.faqItems),
    policyHighlights: mergeTextLists(
      seeded.policyHighlights,
      derived.policyHighlights
    ),
    sourceLanguage: pickFirstText(seeded.sourceLanguage, derived.sourceLanguage),
    mainLanguage: pickFirstText(seeded.mainLanguage, derived.mainLanguage),
    supportedLanguages:
      mergeTextLists(seeded.supportedLanguages, derived.supportedLanguages),
    reviewRequired: true,
  };
}

function buildWebsiteBarrierProfile(sourceUrl = "", seedProfile = null) {
  const seeded = obj(seedProfile);

  if (Object.keys(seeded).length > 0) {
    return {
      ...seeded,
      website: s(seeded.website || sourceUrl),
      sourceUrl: s(seeded.sourceUrl || sourceUrl),
      sourceType: "website",
      websiteUrl: s(seeded.websiteUrl || seeded.website || sourceUrl),
      reviewRequired: true,
      supportedLanguages: arr(seeded.supportedLanguages),
    };
  }

  return {
    website: sourceUrl,
    sourceUrl,
    sourceType: "website",
    websiteUrl: sourceUrl,
    reviewRequired: true,
    supportedLanguages: [],
  };
}

function buildWebsiteBarrierExtracted({
  sourceUrl = "",
  barrier = null,
  extracted = null,
}) {
  const warningCodes = buildWebsiteBarrierWarnings(barrier);
  const status = Number(barrier?.status || 0);
  const code = s(barrier?.code || "website_fetch_barrier_detected");
  const existing = obj(extracted);

  if (Object.keys(existing).length > 0) {
    return {
      ...existing,
      kind: s(existing.kind || "website_raw_v7_1_partial_barrier"),
      sourceUrl: s(existing.sourceUrl || sourceUrl),
      finalUrl: s(existing.finalUrl || sourceUrl),
      crawl: {
        ...obj(existing.crawl),
        failures:
          arr(existing.crawl?.failures).length > 0
            ? arr(existing.crawl?.failures)
            : [
                {
                  url: sourceUrl,
                  error: code,
                  status,
                  source: "entry",
                },
              ],
        warnings: dedupeWarnings([
          ...arr(existing.crawl?.warnings),
          ...warningCodes,
        ]),
      },
      site: {
        ...obj(existing.site),
        sourceUrl: s(existing.site?.sourceUrl || sourceUrl),
        finalUrl: s(existing.site?.finalUrl || sourceUrl),
        quality: {
          score: Number(existing.site?.quality?.score || 0),
          band: s(existing.site?.quality?.band || "weak") || "weak",
          warnings: dedupeWarnings([
            ...arr(existing.site?.quality?.warnings),
            ...warningCodes,
          ]),
        },
      },
    };
  }

  return {
    kind: "website_raw_v7_1_partial_barrier",
    sourceUrl,
    finalUrl: sourceUrl,
    crawl: {
      fetchedAt: new Date().toISOString(),
      entryAttempts: [],
      pagesRequested: 1,
      pagesSucceeded: 0,
      pagesKept: 0,
      pagesRejected: 0,
      pagesFailed: 1,
      pagesSkipped: 0,
      maxPagesAllowed: 0,
      maxCandidatesQueued: 0,
      maxFetchPages: 0,
      mainHtmlBytes: 0,
      failures: [
        {
          url: sourceUrl,
          error: code,
          status,
          source: "entry",
        },
      ],
      skipped: [],
      rejected: [],
      warnings: warningCodes,
    },
    discovery: {
      robots: {
        found: false,
        url: "",
        disallowAll: false,
        allowCount: 0,
        disallowCount: 0,
        sitemapsDeclared: [],
      },
      sitemap: {
        found: false,
        files: [],
        candidateCount: 0,
      },
    },
    site: {
      sourceUrl,
      finalUrl: sourceUrl,
      pagesScanned: 0,
      linksScanned: 0,
      socialLinks: [],
      whatsappLinks: [],
      bookingLinks: [],
      primaryCtas: [],
      internalHints: {
        about_pages: [],
        services_pages: [],
        pricing_pages: [],
        faq_pages: [],
        contact_pages: [],
        policy_pages: [],
        booking_pages: [],
        location_pages: [],
        team_pages: [],
      },
      pageTypeCounts: {},
      identitySignals: {
        nameCandidates: [],
        descriptionCandidates: [],
        contactEmails: [],
        contactPhones: [],
        addresses: [],
        hours: [],
        serviceHints: [],
        pricingHints: [],
        faqPreview: [],
      },
      quality: {
        score: 0,
        band: "weak",
        warnings: warningCodes,
      },
      scannedPages: [],
    },
    pages: [],
    pageAdmissions: [],
    siteText: "",
  };
}

function buildWebsiteBarrierSignals({
  sourceUrl = "",
  barrier = null,
  rawSignals = null,
}) {
  const access = {
    blocked: true,
    status: Number(barrier?.status || 0),
    reasonCode: s(barrier?.code || "website_fetch_barrier_detected"),
    barrierType: s(barrier?.barrierType || "unknown"),
    message: s(barrier?.message || barrier?.code || "website fetch barrier detected"),
  };

  const existing = obj(rawSignals);

  return {
    ...existing,
    access: {
      ...obj(existing.access),
      ...access,
    },
    sourceUrl: s(existing.sourceUrl || sourceUrl),
  };
}

export async function finishWebsiteBarrierAsPartial({
  source,
  run,
  requestedBy = "",
  sources,
  sourceUrl = "",
  stage = "extract",
  barrier = null,
  extracted = null,
  rawSignals = null,
  sourceProfile = null,
  warnings = [],
}) {
  const mergedWarnings = dedupeWarnings([
    ...arr(warnings),
    ...buildWebsiteBarrierWarnings(barrier),
  ]);

  const finalExtracted = buildWebsiteBarrierExtracted({
    sourceUrl,
    barrier,
    extracted,
  });

  const finalRawSignals = buildWebsiteBarrierSignals({
    sourceUrl,
    barrier,
    rawSignals,
  });

  const fallbackProfile = buildWebsiteBarrierProfile(
    sourceUrl,
    buildWebsiteBarrierSeedProfile({
      sourceUrl,
      extracted: finalExtracted,
      rawSignals: finalRawSignals,
      sourceProfile,
    })
  );

  const synthesis = normalizeSynthesisResult(
    {},
    {
      fallbackProfile,
      sourceType: "website",
      sourceUrl,
      allowFallbackIdentity: false,
    }
  );

  const candidateAdmission = buildCandidateAdmission({
    sourceType: "website",
    weakWebsiteExtraction: true,
    websiteTrust: null,
  });

  const pageCount = safeWebsitePageCount(finalExtracted);
  const contactCount =
    arr(finalExtracted?.site?.identitySignals?.contactEmails).length +
    arr(finalExtracted?.site?.identitySignals?.contactPhones).length +
    arr(finalExtracted?.site?.identitySignals?.addresses).length +
    arr(finalExtracted?.site?.identitySignals?.hours).length;

  const serviceCount =
    arr(finalExtracted?.site?.identitySignals?.serviceHints).length +
    arr(fallbackProfile?.services).length;

  const pricingCount = arr(finalExtracted?.site?.identitySignals?.pricingHints).length;
  const faqCount = arr(finalExtracted?.site?.identitySignals?.faqPreview).length;
  const socialCount = arr(finalExtracted?.site?.socialLinks).length;
  const nameCount = s(fallbackProfile?.companyTitle || fallbackProfile?.companyName) ? 1 : 0;
  const descriptionCount =
    s(
      fallbackProfile?.companySummaryShort ||
        fallbackProfile?.summaryShort ||
        fallbackProfile?.companySummaryLong ||
        fallbackProfile?.summaryLong
    )
      ? 1
      : 0;

  const trustScore = Number(finalExtracted?.site?.quality?.score || 0);
  const totalSignalScore =
    nameCount * 4 +
    descriptionCount * 2 +
    Math.min(contactCount, 6) * 3 +
    Math.min(serviceCount, 8) * 2 +
    Math.min(pricingCount, 4) +
    Math.min(faqCount, 4) +
    Math.min(socialCount, 5) +
    Math.min(pageCount, 6) +
    (trustScore >= 60 ? 6 : trustScore >= 35 ? 3 : 0);

  const quality = {
    sourceFusionVersion: SOURCE_FUSION_VERSION,
    sourceSyncVersion: SOURCE_SYNC_VERSION,
    observationCount: 0,
    candidateCount: 0,
    conflictCount: 0,
    scopedObservationCount: 0,
    scopedObservationScope: "",
    droppedDraftObservationCount: 0,
    synthesisInputObservationCount: 0,
    synthesisMetrics: obj(synthesis?.metrics),
    canonicalProjection: "deferred_to_review",
    candidateAdmission,
    websiteTrust: null,
    surfacedWarnings: mergedWarnings,
    debugWarnings: [],
    warningDiagnostics: {
      signalStrength: {
        nameCount,
        descriptionCount,
        contactCount,
        serviceCount,
        pricingCount,
        faqCount,
        pageCount,
        observationCount: 0,
        socialCount,
        trustScore,
        totalSignalScore,
        hasUsableIdentity: nameCount > 0,
        hasUsableBusinessSignals:
          nameCount > 0 && (descriptionCount > 0 || contactCount > 0 || serviceCount > 0),
        isClearlyUsable:
          totalSignalScore >= 12 &&
          nameCount > 0 &&
          (descriptionCount > 0 || contactCount > 0 || serviceCount > 0),
      },
      hardWebsiteWarnings: mergedWarnings,
    },
    accessBarrier: {
      code: s(barrier?.code || "website_fetch_barrier_detected"),
      status: Number(barrier?.status || 0),
      barrierType: s(barrier?.barrierType || "unknown"),
      message: s(barrier?.message || barrier?.code || "website fetch barrier detected"),
    },
  };

  const finished = await sources.finishSourceSync({
    sourceId: source.id,
    runId: run.id,
    syncStatus: "partial",
    runStatus: "partial",
    requestedBy,
    inputSummaryJson: {
      sourceType: "website",
      sourceUrl,
      stage,
    },
    extractionSummaryJson: {
      finalUrl: finalExtracted?.finalUrl || sourceUrl,
      crawl: finalExtracted?.crawl || {},
      discovery: finalExtracted?.discovery || {},
      quality,
      sourceFusion: {
        version: SOURCE_FUSION_VERSION,
        observationsCreated: 0,
        scopedObservationCount: 0,
        scopedObservationScope: "",
        conflictCount: 0,
        currentSnapshotId: "",
        canonicalProjection: "deferred_to_review",
      },
    },
    resultSummaryJson: {
      sourceFusionVersion: SOURCE_FUSION_VERSION,
      sourceSyncVersion: SOURCE_SYNC_VERSION,
      summary:
        synthesis?.profile?.summaryShort ||
        synthesis?.profile?.companySummaryShort ||
        "",
      companySummaryLong:
        synthesis?.profile?.summaryLong ||
        synthesis?.profile?.companySummaryLong ||
        "",
      supportMode: synthesis?.profile?.supportMode || "",
      pricingPolicy: synthesis?.profile?.pricingPolicy || "",
      candidateCount: 0,
      weakGoogleMapsExtraction: false,
      weakWebsiteExtraction: true,
      websiteTrust: null,
      candidateAdmission,
      stage,
      warnings: mergedWarnings,
      rawWarnings: mergedWarnings,
      debugWarnings: [],
      synthesisMetrics: obj(synthesis?.metrics),
      canonicalProjection: "deferred_to_review",
      accessBarrier: {
        code: s(barrier?.code || "website_fetch_barrier_detected"),
        status: Number(barrier?.status || 0),
        barrierType: s(barrier?.barrierType || "unknown"),
        message: s(barrier?.message || barrier?.code || "website fetch barrier detected"),
      },
    },
    pagesScanned: pageCount,
    recordsScanned: 0,
    candidatesCreated: 0,
    warningsCount: mergedWarnings.length,
    logsJson: [
      {
        level: "warn",
        message:
          Number(barrier?.status || 0) > 0
            ? `website sync degraded to partial because remote site returned ${s(barrier?.code)}`
            : `website sync degraded to partial because backend could not complete website processing`,
        stage,
        sourceFusionVersion: SOURCE_FUSION_VERSION,
        sourceSyncVersion: SOURCE_SYNC_VERSION,
        finalUrl: finalExtracted?.finalUrl || sourceUrl,
        candidateAdmission,
        accessBarrier: {
          code: s(barrier?.code || "website_fetch_barrier_detected"),
          status: Number(barrier?.status || 0),
          barrierType: s(barrier?.barrierType || "unknown"),
          message: s(barrier?.message || barrier?.code || "website fetch barrier detected"),
        },
        canonicalProjection: "deferred_to_review",
      },
      ...mergedWarnings.map((message) => ({
        level: "warn",
        message,
        stage,
        surfaced: true,
      })),
    ],
  });

  return {
    ok: true,
    mode: "partial",
    stage,
    warnings: mergedWarnings,
    rawWarnings: mergedWarnings,
    debugWarnings: [],
    source: finished?.source || source,
    run: finished?.run || run,
    candidates: [],
    candidateCount: 0,
    extracted: finalExtracted,
    signals: {
      website: buildSourceSignalPayload({
        sourceType: "website",
        rawSignals: finalRawSignals,
        websiteTrust: null,
      }),
      sourceFusion: synthesis,
    },
    profile: synthesis.profile,
    snapshot: null,
    trust: null,
    admission: candidateAdmission,
  };
}

export const __test__ = {
  buildWebsiteBarrierSeedProfile,
};
