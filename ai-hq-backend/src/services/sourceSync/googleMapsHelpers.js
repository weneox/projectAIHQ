import {
  arr,
  cleanInlineText,
  compactText,
  dedupeTextList,
  humanizePlaceType,
  lower,
  n,
  obj,
  s,
  safeKeyPart,
  shouldKeepTextCandidate,
  titleCase,
  uniq,
} from "./shared.js";

function formatGooglePlaceHours(place = {}) {
  const current = obj(place.currentOpeningHours);
  const regular = obj(place.regularOpeningHours);

  const weekdayDescriptions = arr(
    current.weekdayDescriptions?.length
      ? current.weekdayDescriptions
      : regular.weekdayDescriptions
  );

  return dedupeTextList(
    weekdayDescriptions.map((x) => cleanInlineText(x)).filter(Boolean),
    { maxItems: 14, maxText: 180 }
  );
}

function buildGoogleMapsResolvedExtraction({ source, resolved }) {
  const place = obj(resolved?.place);
  const candidates = arr(resolved?.candidates);
  const warnings = uniq(arr(resolved?.warnings).map((x) => s(x)).filter(Boolean));
  const confidence = n(resolved?.confidence, place.placeId ? 0.76 : 0);

  const reasons = [];
  if (!s(place.placeId)) reasons.push("no_place_match");
  if (!s(place.name)) reasons.push("missing_business_name");
  if (!s(place.formattedAddress)) reasons.push("missing_address");
  if (!s(place.primaryType) && !s(place.primaryTypeLabel)) reasons.push("missing_category");
  if (!s(place.websiteUrl)) reasons.push("missing_website");
  if (!s(place.internationalPhoneNumber) && !s(place.nationalPhoneNumber)) {
    reasons.push("missing_phone");
  }
  if (confidence > 0 && confidence < 0.6) {
    reasons.push("low_confidence_match");
  }

  const signalCount = [
    !!s(place.name),
    !!s(place.formattedAddress),
    !!s(place.primaryType || place.primaryTypeLabel),
    !!s(place.websiteUrl),
    !!s(place.internationalPhoneNumber || place.nationalPhoneNumber),
    !!arr(formatGooglePlaceHours(place)).length,
    Number.isFinite(Number(place.rating)),
  ].filter(Boolean).length;

  const isWeak =
    !s(place.placeId) ||
    confidence < 0.6 ||
    (!s(place.name) && !s(place.formattedAddress)) ||
    signalCount < 2;

  return {
    provider: "google_places",
    providerVersion: "places_v1",
    sourceType: "google_maps",
    sourceUrl: s(source?.source_url || source?.url),
    finalUrl: s(place.googleMapsUri || source?.source_url || source?.url),
    query: s(resolved?.query),
    confidence,
    place,
    candidates,
    observation: obj(resolved?.observation),
    quality: {
      isWeak,
      reasons: uniq(reasons),
      signalCount,
      confidence,
      candidateCount: candidates.length,
    },
    warnings,
  };
}

function buildGoogleMapsProfile(extracted = {}) {
  const place = obj(extracted.place);
  const quality = obj(extracted.quality);

  const companyTitle = s(place.name);
  const category = s(place.primaryTypeLabel || titleCase(humanizePlaceType(place.primaryType)));
  const secondaryTypes = dedupeTextList(
    arr(place.types)
      .map((x) => humanizePlaceType(x))
      .map((x) => titleCase(x))
      .filter(Boolean)
      .filter(
        (x) =>
          lower(x) !== lower(category) &&
          !["Establishment", "Point Of Interest"].includes(x)
      ),
    { maxItems: 4, maxText: 80 }
  );

  const address = s(place.formattedAddress || place.shortFormattedAddress);
  const websiteUrl = s(place.websiteUrl);
  const phone = s(place.internationalPhoneNumber || place.nationalPhoneNumber);
  const phones = phone ? [phone] : [];
  const emails = [];
  const hours = formatGooglePlaceHours(place);

  const summaryShort = compactText(
    [
      companyTitle,
      category ? `${category}.` : "",
      address ? `Address: ${address}.` : "",
      Number.isFinite(Number(place.rating))
        ? Number.isFinite(Number(place.userRatingCount))
          ? `Rating: ${place.rating} from ${place.userRatingCount} reviews.`
          : `Rating: ${place.rating}.`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    420
  );

  const summaryLong = compactText(
    [
      summaryShort,
      secondaryTypes.length ? `Other types: ${secondaryTypes.join(", ")}.` : "",
      websiteUrl ? `Website: ${websiteUrl}.` : "",
      hours.length ? `Hours: ${hours.join(" | ")}.` : "",
      s(place.businessStatus) ? `Business status: ${place.businessStatus}.` : "",
    ]
      .filter(Boolean)
      .join(" "),
    1600
  );

  return {
    companyTitle,
    companySummaryShort: quality.isWeak ? "" : summaryShort,
    companySummaryLong: quality.isWeak || summaryLong === summaryShort ? "" : summaryLong,
    aboutSection: "",
    headings: dedupeTextList([category, ...secondaryTypes], {
      maxItems: 6,
      maxText: 120,
    }),
    services: dedupeTextList([category, ...secondaryTypes], {
      maxItems: 8,
      maxText: 120,
    }),
    products: [],
    pricingHints: [],
    pricingPolicy: "",
    faqItems: [],
    emails,
    phones,
    addresses: address ? [address] : [],
    hours,
    socialLinks: [],
    whatsappLinks: [],
    bookingLinks: websiteUrl ? [websiteUrl] : [],
    supportMode:
      phones.length || emails.length
        ? "Direct phone or email contact available"
        : websiteUrl
          ? "Website available"
          : "",
    websiteUrl,
    category,
    rating: Number.isFinite(Number(place.rating)) ? String(place.rating) : "",
    reviewCount: Number.isFinite(Number(place.userRatingCount))
      ? String(place.userRatingCount)
      : "",
    geo: {
      latitude: Number.isFinite(Number(place.latitude)) ? Number(place.latitude) : null,
      longitude: Number.isFinite(Number(place.longitude))
        ? Number(place.longitude)
        : null,
    },
    weakExtraction: !!quality.isWeak,
    weakReasons: arr(quality.reasons),
    signalCount: Number(quality.signalCount || 0),
  };
}

function isWeakGoogleMapsExtraction(extracted = {}, profile = {}) {
  const quality = obj(extracted.quality);
  if (typeof quality.isWeak === "boolean") {
    return quality.isWeak;
  }

  const signalCount = [
    !!s(profile.companyTitle),
    !!arr(profile.addresses).length,
    !!arr(profile.phones).length,
    !!arr(profile.emails).length,
    !!s(profile.websiteUrl),
    !!s(profile.category),
    !!arr(profile.hours).length,
  ].filter(Boolean).length;

  return signalCount < 3;
}

function buildGoogleMapsExtractionWarnings(extracted = {}, profile = {}) {
  const quality = obj(extracted.quality);
  const reasons = arr(quality.reasons);
  const out = [];

  for (const reason of reasons) {
    if (reason === "no_place_match") {
      out.push("google_maps seed could not be resolved to a Google Places result");
    } else if (reason === "missing_business_name") {
      out.push("google_places result is missing a business name");
    } else if (reason === "missing_address") {
      out.push("google_places result is missing an address");
    } else if (reason === "missing_category") {
      out.push("google_places result is missing a category");
    } else if (reason === "missing_phone") {
      out.push("google_places result is missing a phone number");
    } else if (reason === "missing_website") {
      out.push("google_places result is missing a website");
    } else if (reason === "low_confidence_match") {
      out.push("google_places returned a low-confidence match for the provided seed");
    }
  }

  for (const warning of arr(extracted.warnings)) {
    if (warning === "no_google_places_match") {
      out.push("google_places returned no matching business for this google_maps seed");
    } else if (warning === "empty_or_unusable_seed") {
      out.push("google_maps source URL could not be converted into a usable search seed");
    } else {
      out.push(warning);
    }
  }

  if (!out.length && isWeakGoogleMapsExtraction(extracted, profile)) {
    out.push("google_maps resolution quality is too weak for automatic knowledge promotion");
  }

  return uniq(out);
}

function buildGoogleMapsObservations({ source, run, extracted, profile }) {
  const out = [];
  const sourceType = s(source?.source_type || source?.type || "google_maps");
  const sourceId = s(source?.id);
  const sourceRunId = s(run?.id);
  const place = obj(extracted?.place);
  const quality = obj(extracted?.quality);
  const pageUrl = s(place.googleMapsUri || extracted?.finalUrl || source?.source_url || source?.url);
  const pageTitle = s(profile?.companyTitle || "");

  function pushObservation({
    observationGroup = "general",
    claimType,
    claimKey,
    rawValueText = "",
    rawValueJson = {},
    normalizedValueText = "",
    normalizedValueJson = {},
    evidenceText = "",
    confidence = 0.7,
    metadataJson = {},
  }) {
    const text = s(rawValueText);
    const jsonValue = obj(rawValueJson);
    if (!text && !Object.keys(jsonValue).length) return;

    out.push({
      sourceId,
      sourceRunId,
      sourceType,
      observationGroup,
      claimType,
      claimKey,
      rawValueText: text,
      rawValueJson: jsonValue,
      normalizedValueText: s(normalizedValueText),
      normalizedValueJson: obj(normalizedValueJson),
      evidenceText: s(evidenceText),
      pageUrl,
      pageTitle,
      confidence,
      confidenceLabel:
        confidence >= 0.92
          ? "very_high"
          : confidence >= 0.8
            ? "high"
            : confidence >= 0.6
              ? "medium"
              : "low",
      resolutionStatus: "pending",
      extractionMethod: "provider_api",
      extractionModel: "google_places_v1",
      metadataJson: {
        source_label: "Google Places",
        source_seed_type: "google_maps",
        source_url: s(source?.source_url || source?.url),
        final_url: s(extracted?.finalUrl),
        weak_extraction: !!quality.isWeak,
        weak_reasons: arr(quality.reasons),
        signal_count: Number(quality.signalCount || 0),
        provider: "google_places",
        place_id: s(place.placeId),
        resource_name: s(place.resourceName),
        ...obj(metadataJson),
      },
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    });
  }

  if (s(profile?.companyTitle)) {
    pushObservation({
      observationGroup: "identity",
      claimType: "company_name",
      claimKey: "company_name",
      rawValueText: profile.companyTitle,
      rawValueJson: { company_name: profile.companyTitle },
      normalizedValueText: lower(profile.companyTitle),
      normalizedValueJson: { company_name: profile.companyTitle },
      evidenceText: "Business name returned by Google Places",
      confidence: 0.98,
    });
  }

  if (s(profile?.websiteUrl)) {
    pushObservation({
      observationGroup: "identity",
      claimType: "website_url",
      claimKey: "website_url",
      rawValueText: profile.websiteUrl,
      rawValueJson: { url: profile.websiteUrl },
      normalizedValueText: s(profile.websiteUrl),
      normalizedValueJson: { url: profile.websiteUrl },
      evidenceText: "Website URL returned by Google Places",
      confidence: 0.96,
    });
  }

  if (s(profile?.companySummaryShort)) {
    pushObservation({
      observationGroup: "summary",
      claimType: "summary_short",
      claimKey: "summary_short",
      rawValueText: profile.companySummaryShort,
      rawValueJson: { summary: profile.companySummaryShort },
      normalizedValueText: lower(profile.companySummaryShort),
      normalizedValueJson: { summary: profile.companySummaryShort },
      evidenceText: "Short business summary synthesized from Google Places data",
      confidence: quality.isWeak ? 0.5 : 0.82,
    });
  }

  if (s(profile?.companySummaryLong)) {
    pushObservation({
      observationGroup: "summary",
      claimType: "summary_long",
      claimKey: "summary_long",
      rawValueText: profile.companySummaryLong,
      rawValueJson: { summary: profile.companySummaryLong },
      normalizedValueText: lower(profile.companySummaryLong),
      normalizedValueJson: { summary: profile.companySummaryLong },
      evidenceText: "Long business summary synthesized from Google Places data",
      confidence: quality.isWeak ? 0.48 : 0.76,
    });
  }

  for (const phone of arr(profile?.phones)) {
    pushObservation({
      observationGroup: "contact",
      claimType: "primary_phone",
      claimKey: `phone_${safeKeyPart(phone, "phone")}`,
      rawValueText: phone,
      rawValueJson: { phone },
      normalizedValueText: phone,
      normalizedValueJson: { phone },
      evidenceText: "Phone returned by Google Places",
      confidence: 0.98,
    });
  }

  for (const address of arr(profile?.addresses)) {
    pushObservation({
      observationGroup: "location",
      claimType: "primary_address",
      claimKey: `address_${safeKeyPart(address, "address")}`,
      rawValueText: address,
      rawValueJson: { address },
      normalizedValueText: lower(address),
      normalizedValueJson: { address },
      evidenceText: "Address returned by Google Places",
      confidence: 0.99,
    });
  }

  for (const hour of arr(profile?.hours)) {
    pushObservation({
      observationGroup: "hours",
      claimType: "working_hours",
      claimKey: `hours_${safeKeyPart(hour, "hours")}`,
      rawValueText: hour,
      rawValueJson: { hours: hour },
      normalizedValueText: lower(hour),
      normalizedValueJson: { hours: hour },
      evidenceText: "Opening hours returned by Google Places",
      confidence: 0.96,
    });
  }

  for (const service of arr(profile?.services)) {
    if (!shouldKeepTextCandidate(service, 3)) continue;

    pushObservation({
      observationGroup: "offerings",
      claimType: "service",
      claimKey: `service_${safeKeyPart(service, "service")}`,
      rawValueText: service,
      rawValueJson: { service },
      normalizedValueText: lower(service),
      normalizedValueJson: { service },
      evidenceText: "Service/category inferred from Google Places type data",
      confidence: quality.isWeak ? 0.56 : 0.78,
    });
  }

  if (Number.isFinite(Number(place.rating)) || Number.isFinite(Number(place.userRatingCount))) {
    const ratingText = compactText(
      [
        Number.isFinite(Number(place.rating)) ? `Rating ${place.rating}` : "",
        Number.isFinite(Number(place.userRatingCount))
          ? `${place.userRatingCount} reviews`
          : "",
      ]
        .filter(Boolean)
        .join(" — "),
      160
    );

    if (ratingText) {
      pushObservation({
        observationGroup: "reputation",
        claimType: "support_mode",
        claimKey: "google_places_reputation",
        rawValueText: ratingText,
        rawValueJson: {
          rating: Number.isFinite(Number(place.rating)) ? Number(place.rating) : null,
          review_count: Number.isFinite(Number(place.userRatingCount))
            ? Number(place.userRatingCount)
            : null,
        },
        normalizedValueText: lower(ratingText),
        normalizedValueJson: {
          rating: Number.isFinite(Number(place.rating)) ? Number(place.rating) : null,
          review_count: Number.isFinite(Number(place.userRatingCount))
            ? Number(place.userRatingCount)
            : null,
        },
        evidenceText: "Rating metadata returned by Google Places",
        confidence: 0.7,
      });
    }
  }

  if (
    Number.isFinite(Number(profile?.geo?.latitude)) &&
    Number.isFinite(Number(profile?.geo?.longitude))
  ) {
    pushObservation({
      observationGroup: "location",
      claimType: "geo_coordinates",
      claimKey: "geo_coordinates",
      rawValueText: `${profile.geo.latitude},${profile.geo.longitude}`,
      rawValueJson: {
        latitude: Number(profile.geo.latitude),
        longitude: Number(profile.geo.longitude),
      },
      normalizedValueText: `${profile.geo.latitude},${profile.geo.longitude}`,
      normalizedValueJson: {
        latitude: Number(profile.geo.latitude),
        longitude: Number(profile.geo.longitude),
      },
      evidenceText: "Coordinates returned by Google Places",
      confidence: 0.94,
    });
  }

  const seen = new Set();
  return out.filter((item) => {
    const key = [
      lower(item.claimType),
      lower(item.claimKey),
      lower(item.normalizedValueText || item.rawValueText),
    ].join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildGoogleMapsSyncQualitySummary({
  extracted = {},
  profile = {},
  candidateCount = 0,
  observationCount = 0,
}) {
  const place = obj(extracted.place);
  const quality = obj(extracted.quality);

  return {
    crawlVersion: "google_places_v1",
    pipelineVersion: "source_sync_v7_0",
    sourceType: "google_maps",
    provider: "google_places",
    pagesScanned: 1,
    linksScanned: 0,

    emailsFound: arr(profile.emails).length,
    phonesFound: arr(profile.phones).length,
    socialLinksFound: 0,
    whatsappLinksFound: 0,
    bookingLinksFound: arr(profile.bookingLinks).length,

    servicesFound: arr(profile.services).length,
    productsFound: arr(profile.products).length,
    faqFound: 0,
    locationsFound: arr(profile.addresses).length,
    hoursFound: arr(profile.hours).length,
    pricingHintsFound: 0,

    hasAboutSection: !!profile.aboutSection,
    hasSummaryShort: !!profile.companySummaryShort,
    hasSummaryLong: !!profile.companySummaryLong,

    observationCount: Number(observationCount || 0),
    candidateCount: Number(candidateCount || 0),

    companyTitle: profile.companyTitle || "",
    category: s(profile.category),
    rating: s(profile.rating),
    reviewCount: s(profile.reviewCount),
    supportMode: profile.supportMode || "",

    weakExtraction: !!quality.isWeak,
    weakReasons: arr(quality.reasons),
    signalCount: Number(quality.signalCount || 0),
    confidence: n(quality.confidence, 0),
    query: s(extracted.query),
    placeId: s(place.placeId),
    googleMapsUri: s(place.googleMapsUri),

    signalBuckets: {
      hours: arr(profile.hours).length,
      emails: arr(profile.emails).length,
      phones: arr(profile.phones).length,
      services: arr(profile.services).length,
      address: arr(profile.addresses).length,
      website: arr(profile.bookingLinks).length,
    },
  };
}

export {
  buildGoogleMapsExtractionWarnings,
  buildGoogleMapsObservations,
  buildGoogleMapsProfile,
  buildGoogleMapsResolvedExtraction,
  buildGoogleMapsSyncQualitySummary,
  formatGooglePlaceHours,
  isWeakGoogleMapsExtraction,
};