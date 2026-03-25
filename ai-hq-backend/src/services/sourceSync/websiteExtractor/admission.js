import { arr, n, s, uniq } from "./shared.js";
import { canonicalPageKey } from "./url.js";
import { hasMeaningfulPageContent, isBusinessCriticalPageType } from "./pageModel.js";

function chooseFallbackIdentityPage(records = []) {
  const ranked = arr(records)
    .map((record) => {
      const page = record.page;
      const identityScore =
        (s(page.title) ? 5 : 0) +
        (s(page.metaDescription) ? 4 : 0) +
        (arr(page.structured?.names).length ? 4 : 0) +
        (arr(page.structured?.descriptions).length ? 3 : 0) +
        (page.pageType === "generic" ? 1 : 0) +
        (record.source === "entry" ? 3 : 0) +
        n(page?.quality?.score, 0);

      return {
        ...record,
        identityScore,
      };
    })
    .sort((a, b) => b.identityScore - a.identityScore || a.page.url.localeCompare(b.page.url));

  return ranked[0] || null;
}

function decidePageAdmission({
  page = {},
  source = "",
  duplicateShell = false,
  sameAsEntryShell = false,
}) {
  if (!page || !page.url) {
    return {
      admitted: false,
      admissionReason: "invalid_page",
    };
  }

  const warnings = arr(page.qualityWarnings);
  const placeholderLike = warnings.some((x) =>
    [
      "bot_or_access_protection_detected",
      "parked_or_placeholder_site_detected",
      "error_or_placeholder_content_detected",
    ].includes(x)
  );

  if (placeholderLike) {
    return {
      admitted: false,
      admissionReason: "placeholder_or_soft_block_page",
    };
  }

  if (sameAsEntryShell || duplicateShell) {
    return {
      admitted: false,
      admissionReason: "duplicate_shell_page",
    };
  }

  const textLength = n(page?.metrics?.textLength, 0);
  const evidenceCount = n(page?.analysis?.evidenceCount, 0);
  const signalCount = n(page?.analysis?.signalCount, 0);
  const meaningfulContent = hasMeaningfulPageContent(page);
  const businessCritical = isBusinessCriticalPageType(page.pageType);

  if (businessCritical && meaningfulContent) {
    return {
      admitted: true,
      admissionReason: "business_critical_page_with_content",
    };
  }

  if (businessCritical && !meaningfulContent && textLength <= 120) {
    return {
      admitted: false,
      admissionReason:
        source === "path_seed" ? "route_only_shell_page" : "thin_business_critical_page",
    };
  }

  if (page.quality?.score >= 40) {
    return {
      admitted: true,
      admissionReason: "quality_threshold_met",
    };
  }

  if (textLength >= 1200 && signalCount >= 2) {
    return {
      admitted: true,
      admissionReason: "useful_signal_density",
    };
  }

  if (source === "path_seed" && textLength < 350 && evidenceCount === 0) {
    return {
      admitted: false,
      admissionReason: "weak_seed_page",
    };
  }

  if (page.pageType === "blog") {
    return {
      admitted: false,
      admissionReason: "blog_like_page_rejected",
    };
  }

  return {
    admitted: false,
    admissionReason: "weak_generic_page",
  };
}

export function finalizePageAdmissions({ fetchedPageRecords = [], maxPagesAllowed = 8 }) {
  const records = arr(fetchedPageRecords).map((record) => ({
    source: s(record.source || "unknown"),
    depth: n(record.depth, 0),
    page: record.page,
    pageKey: canonicalPageKey(record.page?.canonicalUrl || record.page?.url),
  }));

  const entryRecord = records.find((x) => x.source === "entry") || records[0] || null;
  const entrySignature = s(entryRecord?.page?.analysis?.shellSignature);

  const shellSignatureCounts = new Map();
  for (const record of records) {
    const signature = s(record.page?.analysis?.shellSignature);
    if (!signature) continue;
    if (!record.page?.analysis?.minimalShell) continue;
    shellSignatureCounts.set(signature, (shellSignatureCounts.get(signature) || 0) + 1);
  }

  const evaluated = records.map((record) => {
    const page = record.page;
    const signature = s(page?.analysis?.shellSignature);

    const duplicateShell =
      !!signature &&
      page?.analysis?.minimalShell &&
      (shellSignatureCounts.get(signature) || 0) >= 2;

    const sameAsEntryShell =
      !!entrySignature &&
      signature === entrySignature &&
      record.pageKey !== canonicalPageKey(entryRecord?.page?.canonicalUrl || entryRecord?.page?.url) &&
      page?.analysis?.minimalShell;

    const admission = decidePageAdmission({
      page,
      source: record.source,
      duplicateShell,
      sameAsEntryShell,
    });

    return {
      ...record,
      duplicateShell,
      sameAsEntryShell,
      admitted: !!admission.admitted,
      admissionReason: s(admission.admissionReason),
    };
  });

  let keptRecords = evaluated.filter((x) => x.admitted);
  let usedFallback = false;

  if (!keptRecords.length) {
    const fallback = chooseFallbackIdentityPage(evaluated);
    if (fallback?.page) {
      keptRecords = [
        {
          ...fallback,
          admitted: true,
          admissionReason: "fallback_identity_only_page",
        },
      ];
      usedFallback = true;
    }
  }

  keptRecords = keptRecords
    .sort((a, b) => {
      const aCritical = isBusinessCriticalPageType(a.page?.pageType) ? 1 : 0;
      const bCritical = isBusinessCriticalPageType(b.page?.pageType) ? 1 : 0;
      const aScore = n(a.page?.quality?.score, 0);
      const bScore = n(b.page?.quality?.score, 0);
      return bCritical - aCritical || bScore - aScore || a.page.url.localeCompare(b.page.url);
    })
    .slice(0, maxPagesAllowed);

  const keptPageKeys = new Set(keptRecords.map((x) => x.pageKey));

  const pageAdmissions = evaluated.map((record) => {
    const kept = keptPageKeys.has(record.pageKey);

    return {
      url: record.page.url,
      source: record.source,
      admitted: kept,
      admissionReason: kept && usedFallback ? "fallback_identity_only_page" : record.admissionReason,
    };
  });

  const rejectedPages = pageAdmissions
    .filter((x) => !x.admitted)
    .map((x) => ({
      url: x.url,
      source: x.source,
      reason: x.admissionReason,
    }));

  const admissionWarnings = uniq([
    ...(usedFallback ? ["fallback_identity_only_extraction"] : []),
    ...(evaluated.some((x) => x.duplicateShell || x.sameAsEntryShell)
      ? ["duplicate_shell_routes_detected"]
      : []),
    ...(evaluated.some((x) => x.admissionReason === "route_only_shell_page")
      ? ["route_only_shell_pages_detected"]
      : []),
    ...(keptRecords.length <= 1 && evaluated.length >= 3 ? ["shell_like_website_detected"] : []),
  ]);

  return {
    keptPages: keptRecords.map((x) => x.page),
    pageAdmissions,
    rejectedPages,
    admissionWarnings,
  };
}