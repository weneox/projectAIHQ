// src/services/sourceSync/googlePlacesClient.js

import { cfg } from "../../config.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function uniq(list = []) {
  return [...new Set(arr(list).map((x) => s(x)).filter(Boolean))];
}

function compactWhitespace(v = "") {
  return s(v).replace(/\s+/g, " ").trim();
}

function safeUrl(v = "") {
  try {
    const x = new URL(String(v || "").trim());
    return x.toString();
  } catch {
    return "";
  }
}

function stripGoogleNoise(v = "") {
  return compactWhitespace(
    String(v || "")
      .replace(/\bgoogle maps\b/gi, "")
      .replace(/\bmaps\b/gi, "")
      .replace(/\bplace\b/gi, "")
      .replace(/[|•·]/g, " ")
  );
}

function decodeSlug(slug = "") {
  return compactWhitespace(
    decodeURIComponent(String(slug || ""))
      .replace(/\+/g, " ")
      .replace(/-/g, " ")
  );
}

function normalizeLanguageCode(v = "") {
  const x = s(v, cfg.google?.placesDefaultLanguage || "en");
  return x || "en";
}

function normalizeRegionCode(v = "") {
  const x = s(v, cfg.google?.placesDefaultRegion || "AZ").toUpperCase();
  return x || "AZ";
}

function getGooglePlacesTimeoutMs() {
  const fromSourceSync = n(cfg?.sourceSync?.websiteFetchTimeoutMs, 0);
  if (fromSourceSync >= 1000) return fromSourceSync;
  return 12000;
}

function hasGooglePlaces() {
  return Boolean(s(cfg?.google?.placesApiKey));
}

function getGooglePlacesBase() {
  return s(cfg?.google?.placesApiBase, "https://places.googleapis.com").replace(
    /\/+$/,
    ""
  );
}

function buildHeaders(fieldMask = "") {
  return {
    "Content-Type": "application/json",
    "X-Goog-Api-Key": s(cfg.google?.placesApiKey),
    "X-Goog-FieldMask": s(fieldMask),
  };
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function createError(message, extra = {}) {
  const err = new Error(message);
  Object.assign(err, extra);
  return err;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeoutMs = n(options.timeoutMs, getGooglePlacesTimeoutMs());
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      body: options.body,
      signal: controller.signal,
    });

    const data = await parseJsonSafe(res);

    if (!res.ok) {
      throw createError(
        data?.error?.message ||
          data?.message ||
          `Google Places request failed with ${res.status}`,
        {
          status: res.status,
          payload: data,
        }
      );
    }

    return data;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw createError("Google Places request timed out.", {
        code: "GOOGLE_PLACES_TIMEOUT",
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

const TEXT_SEARCH_FIELD_MASK = uniq([
  "places.id",
  "places.name",
  "places.displayName",
  "places.formattedAddress",
  "places.types",
  "places.location",
  "places.primaryType",
  "places.primaryTypeDisplayName",
  "places.googleMapsUri",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
]).join(",");

const PLACE_DETAILS_FIELD_MASK = uniq([
  "id",
  "name",
  "displayName",
  "formattedAddress",
  "shortFormattedAddress",
  "adrFormatAddress",
  "location",
  "viewport",
  "types",
  "primaryType",
  "primaryTypeDisplayName",
  "googleMapsUri",
  "websiteUri",
  "nationalPhoneNumber",
  "internationalPhoneNumber",
  "rating",
  "userRatingCount",
  "businessStatus",
  "regularOpeningHours",
  "currentOpeningHours",
  "utcOffsetMinutes",
  "addressComponents",
]).join(",");

function extractPlaceIdFromResourceName(name = "") {
  const x = s(name);
  if (!x) return "";
  if (x.startsWith("places/")) return x.slice("places/".length);
  return x;
}

function normalizePlace(place = {}) {
  const p = obj(place);

  const displayName = s(p?.displayName?.text);
  const primaryTypeLabel = s(p?.primaryTypeDisplayName?.text);
  const typeList = uniq(arr(p?.types).map((x) => s(x)).filter(Boolean));

  return {
    provider: "google_places",
    providerVersion: "places_v1",
    placeId: s(p.id) || extractPlaceIdFromResourceName(p.name),
    resourceName: s(p.name),
    name: displayName,
    formattedAddress: s(p.formattedAddress),
    shortFormattedAddress: s(p.shortFormattedAddress),
    adrFormatAddress: s(p.adrFormatAddress),
    latitude: Number.isFinite(Number(p?.location?.latitude))
      ? Number(p.location.latitude)
      : null,
    longitude: Number.isFinite(Number(p?.location?.longitude))
      ? Number(p.location.longitude)
      : null,
    types: typeList,
    primaryType: s(p.primaryType),
    primaryTypeLabel,
    googleMapsUri: safeUrl(p.googleMapsUri),
    websiteUrl: safeUrl(p.websiteUri),
    nationalPhoneNumber: s(p.nationalPhoneNumber),
    internationalPhoneNumber: s(p.internationalPhoneNumber),
    rating: Number.isFinite(Number(p.rating)) ? Number(p.rating) : null,
    userRatingCount: Number.isFinite(Number(p.userRatingCount))
      ? Number(p.userRatingCount)
      : null,
    businessStatus: s(p.businessStatus),
    regularOpeningHours: obj(p.regularOpeningHours, null),
    currentOpeningHours: obj(p.currentOpeningHours, null),
    utcOffsetMinutes: Number.isFinite(Number(p.utcOffsetMinutes))
      ? Number(p.utcOffsetMinutes)
      : null,
    addressComponents: arr(p.addressComponents),
    raw: p,
  };
}

function buildTextSearchBody(query, opts = {}) {
  const body = {
    textQuery: compactWhitespace(query),
    languageCode: normalizeLanguageCode(opts.languageCode),
    regionCode: normalizeRegionCode(opts.regionCode),
    maxResultCount: n(opts.maxResultCount, 5),
  };

  if (
    Number.isFinite(Number(opts?.locationBias?.latitude)) &&
    Number.isFinite(Number(opts?.locationBias?.longitude))
  ) {
    body.locationBias = {
      circle: {
        center: {
          latitude: Number(opts.locationBias.latitude),
          longitude: Number(opts.locationBias.longitude),
        },
        radius: Number.isFinite(Number(opts?.locationBias?.radiusMeters))
          ? Number(opts.locationBias.radiusMeters)
          : 5000,
      },
    };
  }

  if (Array.isArray(opts.includedType) && opts.includedType.length) {
    body.includedType = s(opts.includedType[0]);
  } else if (s(opts.includedType)) {
    body.includedType = s(opts.includedType);
  }

  if (s(opts.openNow).toLowerCase() === "true" || opts.openNow === true) {
    body.openNow = true;
  }

  if (s(opts.minRating)) {
    const minRating = Number(opts.minRating);
    if (Number.isFinite(minRating)) body.minRating = minRating;
  }

  return body;
}

export async function searchGooglePlacesText(query, opts = {}) {
  if (!hasGooglePlaces()) {
    throw createError("Google Places API is not configured.", {
      code: "GOOGLE_PLACES_NOT_CONFIGURED",
    });
  }

  const textQuery = compactWhitespace(query);
  if (!textQuery) {
    throw createError("Google Places text search query is required.", {
      code: "GOOGLE_PLACES_QUERY_REQUIRED",
    });
  }

  const url = `${getGooglePlacesBase()}/v1/places:searchText`;
  const body = buildTextSearchBody(textQuery, opts);

  const data = await fetchJson(url, {
    method: "POST",
    headers: buildHeaders(TEXT_SEARCH_FIELD_MASK),
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
  });

  const places = arr(data?.places).map(normalizePlace);

  return {
    ok: true,
    provider: "google_places",
    mode: "text_search",
    query: textQuery,
    count: places.length,
    places,
    raw: data,
  };
}

export async function getGooglePlaceDetails(placeId, opts = {}) {
  if (!hasGooglePlaces()) {
    throw createError("Google Places API is not configured.", {
      code: "GOOGLE_PLACES_NOT_CONFIGURED",
    });
  }

  const id = extractPlaceIdFromResourceName(placeId);
  if (!id) {
    throw createError("Google Places placeId is required.", {
      code: "GOOGLE_PLACE_ID_REQUIRED",
    });
  }

  const params = new URLSearchParams();
  params.set("languageCode", normalizeLanguageCode(opts.languageCode));
  params.set("regionCode", normalizeRegionCode(opts.regionCode));

  const url = `${getGooglePlacesBase()}/v1/places/${encodeURIComponent(
    id
  )}?${params.toString()}`;

  const data = await fetchJson(url, {
    method: "GET",
    headers: buildHeaders(PLACE_DETAILS_FIELD_MASK),
    timeoutMs: opts.timeoutMs,
  });

  return {
    ok: true,
    provider: "google_places",
    mode: "place_details",
    place: normalizePlace(data),
    raw: data,
  };
}

function extractQueryFromGoogleMapsUrl(input = "") {
  const raw = s(input);
  if (!raw) return "";

  let url;
  try {
    url = new URL(raw);
  } catch {
    return "";
  }

  const host = s(url.hostname).toLowerCase();
  if (!host.includes("google.") && !host.includes("maps.app.goo.gl")) {
    return "";
  }

  const q = compactWhitespace(url.searchParams.get("q"));
  if (q) return q;

  const query = compactWhitespace(url.searchParams.get("query"));
  if (query) return query;

  const destination = compactWhitespace(url.searchParams.get("destination"));
  if (destination) return destination;

  const pathname = s(url.pathname);

  const placeMatch = pathname.match(/\/maps\/place\/([^/]+)/i);
  if (placeMatch?.[1]) {
    return stripGoogleNoise(decodeSlug(placeMatch[1]));
  }

  const atMatch = pathname.match(/\/place\/([^/]+)/i);
  if (atMatch?.[1]) {
    return stripGoogleNoise(decodeSlug(atMatch[1]));
  }

  return "";
}

function normalizeSeedText(seed = "") {
  const raw = compactWhitespace(seed);
  if (!raw) return "";

  const fromUrl = extractQueryFromGoogleMapsUrl(raw);
  if (fromUrl) return fromUrl;

  return stripGoogleNoise(raw);
}

function computeConfidence({ searchInput = "", place = null, rank = 0 }) {
  const name = s(place?.name).toLowerCase();
  const addr = s(place?.formattedAddress).toLowerCase();
  const query = s(searchInput).toLowerCase();

  let score = 0.45;

  if (name && query && query.includes(name)) score += 0.25;
  if (addr && query && query.includes(addr)) score += 0.15;
  if (rank === 0) score += 0.1;
  if (place?.websiteUrl) score += 0.05;
  if (place?.nationalPhoneNumber || place?.internationalPhoneNumber) score += 0.05;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

function buildObservationFromPlace(place, meta = {}) {
  const p = obj(place);

  return {
    provider: "google_places",
    sourceType: "google_places",
    sourceUrl: s(p.googleMapsUri),
    confidence: Number.isFinite(Number(meta.confidence))
      ? Number(meta.confidence)
      : 0.5,

    entity: {
      externalId: s(p.placeId),
      externalResourceName: s(p.resourceName),
      name: s(p.name),
      category: s(p.primaryType) || s(p.primaryTypeLabel),
      address: s(p.formattedAddress),
      websiteUrl: s(p.websiteUrl),
      phone: s(p.internationalPhoneNumber || p.nationalPhoneNumber),
      latitude: p.latitude,
      longitude: p.longitude,
      rating: p.rating,
      ratingCount: p.userRatingCount,
      status: s(p.businessStatus),
      types: arr(p.types),
    },

    evidence: {
      query: s(meta.query),
      googleMapsUri: s(p.googleMapsUri),
      displayName: s(p.name),
      formattedAddress: s(p.formattedAddress),
      shortFormattedAddress: s(p.shortFormattedAddress),
      websiteUrl: s(p.websiteUrl),
      nationalPhoneNumber: s(p.nationalPhoneNumber),
      internationalPhoneNumber: s(p.internationalPhoneNumber),
      primaryType: s(p.primaryType),
      primaryTypeLabel: s(p.primaryTypeLabel),
      types: arr(p.types),
      openingHours: obj(p.regularOpeningHours, null),
      rating: p.rating,
      userRatingCount: p.userRatingCount,
    },

    raw: p.raw || {},
  };
}

export async function resolveGooglePlaceFromSeed(seed, opts = {}) {
  const query = normalizeSeedText(seed);
  if (!query) {
    return {
      ok: false,
      provider: "google_places",
      mode: "resolve_seed",
      query: "",
      place: null,
      observation: null,
      warnings: ["empty_or_unusable_seed"],
    };
  }

  const search = await searchGooglePlacesText(query, {
    ...opts,
    maxResultCount: n(opts.maxResultCount, 5),
  });

  const first = arr(search.places)[0] || null;

  if (!first?.placeId) {
    return {
      ok: false,
      provider: "google_places",
      mode: "resolve_seed",
      query,
      place: null,
      observation: null,
      warnings: ["no_google_places_match"],
      candidates: search.places,
    };
  }

  const details = await getGooglePlaceDetails(first.placeId, opts);
  const confidence = computeConfidence({
    searchInput: query,
    place: details.place,
    rank: 0,
  });

  const observation = buildObservationFromPlace(details.place, {
    query,
    confidence,
  });

  return {
    ok: true,
    provider: "google_places",
    mode: "resolve_seed",
    query,
    confidence,
    place: details.place,
    observation,
    candidates: search.places,
    warnings: [],
  };
}

export function googlePlacesProviderState() {
  return {
    configured: hasGooglePlaces(),
    baseUrl: getGooglePlacesBase(),
    defaultLanguage: normalizeLanguageCode(),
    defaultRegion: normalizeRegionCode(),
    timeoutMs: getGooglePlacesTimeoutMs(),
  };
}