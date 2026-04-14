import { arr, compactDraftObject, obj, s } from "./draftShared.js";

const WEEK_DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const AZ_CHAR_MAP = {
  ə: "e",
  Ə: "e",
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

const DAY_ALIASES = {
  monday: ["mon", "monday", "bazar ertesi", "b e", "be"],
  tuesday: ["tue", "tues", "tuesday", "cersenbe axsami"],
  wednesday: ["wed", "wednesday", "cersenbe"],
  thursday: ["thu", "thur", "thurs", "thursday", "cume axsami"],
  friday: ["fri", "friday", "cume"],
  saturday: ["sat", "saturday", "senbe"],
  sunday: ["sun", "sunday", "bazar"],
};

const CURRENCY_ALIASES = {
  $: "USD",
  usd: "USD",
  dollar: "USD",
  dollars: "USD",
  "€": "EUR",
  eur: "EUR",
  euro: "EUR",
  "₼": "AZN",
  azn: "AZN",
  manat: "AZN",
  "£": "GBP",
  gbp: "GBP",
  pound: "GBP",
};

function slugify(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function compactSentence(value = "", limit = 220) {
  const text = s(value);
  if (!text) return "";
  return text.length > limit ? `${text.slice(0, limit - 3).trim()}...` : text;
}

function uniqueStrings(value = [], limit = 16) {
  return Array.from(
    new Set(
      arr(value)
        .map((item) => s(item))
        .filter(Boolean)
        .slice(0, limit)
    )
  );
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLocaleText(value = "") {
  const mapped = String(value || "")
    .split("")
    .map((char) => AZ_CHAR_MAP[char] ?? char)
    .join("");

  return mapped
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/[.,]/g, (match) => (match === "." ? " " : match))
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED_DAY_ALIASES = Object.fromEntries(
  Object.entries(DAY_ALIASES).map(([day, aliases]) => [
    day,
    aliases.map((alias) => normalizeLocaleText(alias)),
  ])
);

const DAY_ALIAS_TO_DAY = Object.entries(NORMALIZED_DAY_ALIASES).reduce(
  (acc, [day, aliases]) => {
    for (const alias of aliases) {
      acc[alias] = day;
    }
    return acc;
  },
  {}
);

const DAY_PATTERN = Object.keys(DAY_ALIAS_TO_DAY)
  .sort((a, b) => b.length - a.length)
  .map((alias) => escapeRegex(alias))
  .join("|");

function findCurrency(text = "") {
  const raw = s(text).toLowerCase();
  for (const [needle, currency] of Object.entries(CURRENCY_ALIASES)) {
    if (raw.includes(needle)) return currency;
  }
  return "";
}

function parseAmount(value = "") {
  const normalized = s(value)
    .replace(/,/g, ".")
    .replace(/[^\d.]/g, "");
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseTimeToken(value = "", meridiemHint = "") {
  const text = s(value).toLowerCase();
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!match) {
    return {
      formatted: "",
      hour: null,
      minute: null,
      explicitMeridiem: s(meridiemHint).toLowerCase(),
    };
  }

  let hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2] || "0", 10);
  const meridiem = s(meridiemHint).toLowerCase();

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
    return {
      formatted: "",
      hour: null,
      minute: null,
      explicitMeridiem: meridiem,
    };
  }

  if (!Number.isFinite(minute) || minute < 0 || minute > 59) {
    return {
      formatted: "",
      hour: null,
      minute: null,
      explicitMeridiem: meridiem,
    };
  }

  return {
    formatted: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hour,
    minute,
    explicitMeridiem: meridiem,
  };
}

function parseTimeRange(text = "") {
  const normalized = normalizeLocaleText(text);

  const match = normalized.match(
    /(?:\bsaat\s*)?(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*(?:-|to|through|thru|dan|den|dek|kimi|qeder|qederki|a|ya)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i
  );

  if (!match) {
    return { openTime: "", closeTime: "" };
  }

  const start = parseTimeToken(match[1], match[2]);
  const end = parseTimeToken(match[3], match[4]);

  if (!start.formatted || !end.formatted) {
    return { openTime: "", closeTime: "" };
  }

  let endHour = end.hour;
  const bothImplicit = !start.explicitMeridiem && !end.explicitMeridiem;

  if (
    bothImplicit &&
    Number.isFinite(start.hour) &&
    Number.isFinite(end.hour) &&
    endHour <= start.hour &&
    endHour < 12
  ) {
    endHour += 12;
  }

  const closeTime = `${String(endHour).padStart(2, "0")}:${String(
    end.minute
  ).padStart(2, "0")}`;

  return {
    openTime: start.formatted,
    closeTime,
  };
}

function parseBreakRange(text = "") {
  const normalized = normalizeLocaleText(text);
  const match = normalized.match(
    /(?:break|lunch|fasil[eə])\s*(?:from)?\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s*(?:-|to|dan|den|dek|kimi|qeder)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)?/i
  );
  if (!match) return { breakStart: "", breakEnd: "" };

  const start = parseTimeToken(match[1], match[2]);
  const end = parseTimeToken(match[3], match[4]);

  return {
    breakStart: start.formatted,
    breakEnd: end.formatted,
  };
}

function expandDayRange(start = "", end = "") {
  const startIndex = WEEK_DAYS.indexOf(start);
  const endIndex = WEEK_DAYS.indexOf(end);
  if (startIndex < 0 || endIndex < 0) return [];
  if (startIndex <= endIndex) return WEEK_DAYS.slice(startIndex, endIndex + 1);
  return [...WEEK_DAYS.slice(startIndex), ...WEEK_DAYS.slice(0, endIndex + 1)];
}

function parseDaysFromText(text = "") {
  const lower = normalizeLocaleText(text);
  if (!lower) return [];

  if (
    /\b(every day|daily|7 days|all week|each day|her gun|hergun)\b/i.test(lower) ||
    /\b(24\/7|7\/24)\b/i.test(lower)
  ) {
    return [...WEEK_DAYS];
  }

  if (
    /\b(weekdays|is gunleri|heftede 5 gun|5 gun)\b/i.test(lower)
  ) {
    return WEEK_DAYS.slice(0, 5);
  }

  if (/\b(weekend|heftesonu|hefte sonu)\b/i.test(lower)) {
    return ["saturday", "sunday"];
  }

  const rangeMatch = lower.match(
    new RegExp(
      `\\b(${DAY_PATTERN})\\b\\s*(?:-|to|through|thru|dan|den|dek|qeder)\\s*\\b(${DAY_PATTERN})\\b`,
      "i"
    )
  );

  if (rangeMatch) {
    const start = DAY_ALIAS_TO_DAY[s(rangeMatch[1]).toLowerCase()];
    const end = DAY_ALIAS_TO_DAY[s(rangeMatch[2]).toLowerCase()];
    if (start && end) {
      return expandDayRange(start, end);
    }
  }

  const directMatches = [];
  for (const [day, aliases] of Object.entries(NORMALIZED_DAY_ALIASES)) {
    if (aliases.some((alias) => new RegExp(`\\b${escapeRegex(alias)}\\b`, "i").test(lower))) {
      directMatches.push(day);
    }
  }

  return Array.from(new Set(directMatches));
}

function createDefaultHour(day) {
  return {
    day,
    enabled: false,
    closed: true,
    openTime: "",
    closeTime: "",
    breakStart: "",
    breakEnd: "",
    allDay: false,
    appointmentOnly: false,
    notes: "",
  };
}

function normalizeHoursRow(item = {}) {
  const source = obj(item);
  const day = s(source.day).toLowerCase();
  if (!WEEK_DAYS.includes(day)) return null;

  const enabled =
    source.enabled === true ||
    source.closed === false ||
    Boolean(s(source.openTime || source.open || source.opensAt));
  const closed = source.closed === true || (!enabled && source.allDay !== true);

  return compactDraftObject({
    day,
    enabled,
    closed,
    openTime: s(source.openTime || source.open || source.opensAt),
    closeTime: s(source.closeTime || source.close || source.closesAt),
    breakStart: s(source.breakStart || source.break_start),
    breakEnd: s(source.breakEnd || source.break_end),
    allDay: source.allDay === true || source.all_day === true,
    appointmentOnly:
      source.appointmentOnly === true || source.appointment_only === true,
    notes: s(source.notes),
  });
}

export function sanitizeStructuredHours(value = []) {
  const existing = new Map();

  for (const day of WEEK_DAYS) {
    existing.set(day, createDefaultHour(day));
  }

  for (const item of arr(value)) {
    const normalized = normalizeHoursRow(item);
    if (!normalized) continue;
    existing.set(normalized.day, {
      ...createDefaultHour(normalized.day),
      ...normalized,
    });
  }

  return WEEK_DAYS.map((day) => compactDraftObject(existing.get(day)));
}

function applyHoursLine(baseRows, line = "") {
  const lower = normalizeLocaleText(line);
  if (!lower) return;

  const allDays =
    /\b(24\/7|7\/24|24h|24 hours|all day|gece gunduz)\b/i.test(lower);
  let days = allDays ? [...WEEK_DAYS] : parseDaysFromText(lower);

  const isClosed = /\b(closed|off|bagli|baqli)\b/i.test(lower);
  const appointmentOnly =
    /\b(appointment only|yalniz rezervasiya ile|yalniz qebul ile)\b/i.test(lower);
  const isAllDay = /\b(24\/7|7\/24|24h|24 hours|all day)\b/i.test(lower);
  const { openTime, closeTime } = parseTimeRange(lower);
  const { breakStart, breakEnd } = parseBreakRange(lower);

  if (!days.length && (isAllDay || appointmentOnly || openTime || closeTime)) {
    days = WEEK_DAYS.slice(0, 5);
  }

  if (!days.length) return;

  for (const day of days) {
    const current = obj(baseRows.get(day), createDefaultHour(day));
    baseRows.set(
      day,
      compactDraftObject({
        ...current,
        day,
        enabled: !isClosed && (isAllDay || Boolean(openTime) || appointmentOnly),
        closed: isClosed,
        openTime: isClosed || isAllDay || appointmentOnly ? "" : openTime,
        closeTime: isClosed || isAllDay || appointmentOnly ? "" : closeTime,
        breakStart: breakStart || current.breakStart,
        breakEnd: breakEnd || current.breakEnd,
        allDay: isAllDay,
        appointmentOnly,
        notes:
          appointmentOnly || (!openTime && !closeTime && !isClosed && !isAllDay)
            ? compactSentence(line, 120)
            : s(current.notes),
      })
    );
  }
}

export function parseHoursNote(note = "", currentHours = []) {
  const text = s(note);
  if (!text) return sanitizeStructuredHours(currentHours);

  const baseRows = new Map();
  for (const row of sanitizeStructuredHours(currentHours)) {
    baseRows.set(row.day, { ...createDefaultHour(row.day), ...row });
  }

  const segments = text
    .split(/\n|;+/)
    .map((item) => s(item))
    .filter(Boolean);

  if (!segments.length) return sanitizeStructuredHours(currentHours);

  if (segments.length === 1 && /\b(24\/7|7\/24)\b/i.test(normalizeLocaleText(segments[0]))) {
    return WEEK_DAYS.map((day) =>
      compactDraftObject({
        day,
        enabled: true,
        closed: false,
        allDay: true,
      })
    );
  }

  for (const line of segments) {
    applyHoursLine(baseRows, line);
  }

  return WEEK_DAYS.map((day) => compactDraftObject(baseRows.get(day)));
}

function inferServiceCategory(text = "") {
  const lower = s(text).toLowerCase();
  if (/\b(tax|payroll|bookkeeping|accounting|cfo|finance)\b/i.test(lower)) {
    return "finance";
  }
  if (/\b(doctor|clinic|dental|treatment|wellness|medical)\b/i.test(lower)) {
    return "clinic";
  }
  if (/\b(salon|hair|beauty|spa|nail|cosmetic)\b/i.test(lower)) {
    return "beauty";
  }
  if (/\b(legal|law|contract|court|attorney)\b/i.test(lower)) {
    return "legal";
  }
  if (/\b(marketing|brand|seo|ads|campaign|website)\b/i.test(lower)) {
    return "marketing";
  }
  if (/\b(course|academy|lesson|training|education|coach)\b/i.test(lower)) {
    return "education";
  }
  if (/\b(repair|installation|maintenance|technician)\b/i.test(lower)) {
    return "home_service";
  }
  if (/\b(event|reservation|restaurant|booking)\b/i.test(lower)) {
    return "hospitality";
  }
  return "general";
}

function parseServiceLine(line = "") {
  const text = s(line);
  if (!text) return null;

  const pairMatch = text.match(/^([^:-]+?)\s*(?:[:\-]\s*)(.+)$/);
  const title = s(pairMatch?.[1] || text);
  const remainder = s(pairMatch?.[2]);
  const priceMatch = remainder.match(
    /((?:[$]\s*)?\d+(?:[.,]\d{1,2})?(?:\s*(?:azn|usd|eur|gbp))?)/i
  );

  return compactDraftObject({
    key: slugify(title),
    title,
    summary: priceMatch ? s(remainder.replace(priceMatch[0], "")) : remainder,
    category: inferServiceCategory(`${title} ${remainder}`),
    priceLabel: s(priceMatch?.[0]),
    availabilityStatus: "available",
  });
}

export function parseServicesNote(note = "", currentServices = []) {
  const lines = s(note)
    .split(/\n|;|,/)
    .map((item) => s(item))
    .filter(Boolean);

  const out = [];
  const seen = new Set();

  for (const item of [...arr(currentServices), ...lines]) {
    const normalized =
      typeof item === "string" ? parseServiceLine(item) : parseServiceLine(item?.title || "");
    const merged = normalized
      ? {
          ...normalized,
          ...(typeof item === "object" ? compactDraftObject(item) : {}),
          key: s(normalized.key || item?.key || slugify(normalized.title)),
          category: s(item?.category || normalized.category || "general"),
          title: s(item?.title || normalized.title),
        }
      : null;

    if (!merged?.title) continue;
    const dedupeKey = `${s(merged.key).toLowerCase()}|${s(merged.title).toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(
      compactDraftObject({
        ...merged,
        aliases: uniqueStrings(merged.aliases, 8),
      })
    );
  }

  return out.slice(0, 40);
}

function buildPublicSummary({
  mode,
  startingAt,
  minPrice,
  maxPrice,
  currency,
  perServicePricing,
  note,
}) {
  const symbol = currency ? `${currency} ` : "";

  if (mode === "fixed_price" && minPrice != null) {
    return `Public price is ${symbol}${minPrice}.`.trim();
  }
  if (mode === "starting_from" && startingAt != null) {
    return `Public replies can say pricing starts from ${symbol}${startingAt}.`.trim();
  }
  if (mode === "variable_by_service" && arr(perServicePricing).length) {
    return "Public replies can share starting labels per service, but exact pricing may vary by selected service.";
  }
  if (mode === "promotional" && minPrice != null) {
    return `A promotional starting price of ${symbol}${minPrice} is available, subject to terms.`.trim();
  }
  if (mode === "operator_only") {
    return "Exact pricing should stay with an operator.";
  }
  if (mode === "quote_required") {
    return "Public replies can explain that an exact quote requires more details.";
  }
  return compactSentence(note, 160);
}

export function parsePricingNote(note = "", currentPricing = {}, currentServices = []) {
  const text = s(note);
  const existing = obj(currentPricing);
  if (!text) return compactDraftObject(existing);

  const amounts = Array.from(
    text.matchAll(/(?:[$]\s*)?\d+(?:[.,]\d{1,2})?(?:\s*(?:azn|usd|eur|gbp))?/gi)
  )
    .map((match) => ({
      raw: s(match[0]),
      value: parseAmount(match[0]),
    }))
    .filter((item) => item.value != null);

  const currency =
    s(existing.currency).toUpperCase() || findCurrency(text) || "AZN";

  const servicePairs = text
    .split(/\n|;+/)
    .map((item) => s(item))
    .filter(Boolean)
    .map((line) => {
      const pair = line.match(
        /^([^:-]+?)\s*(?:[:\-]\s*)?((?:[$]\s*)?\d+(?:[.,]\d{1,2})?(?:\s*(?:azn|usd|eur|gbp))?)/i
      );
      if (!pair) return null;
      return compactDraftObject({
        serviceKey: slugify(pair[1]),
        title: s(pair[1]),
        mode: "fixed_price",
        minPrice: parseAmount(pair[2]),
        maxPrice: parseAmount(pair[2]),
        priceLabel: s(pair[2]),
      });
    })
    .filter(Boolean);

  const hasFromLanguage = /\b(from|starting at|starts at|starting from)\b/i.test(text);
  const hasPromoLanguage = /\b(promo|promotion|discount|sale|campaign)\b/i.test(text);
  const hasQuoteLanguage = /\b(quote|depends|after inspection|after review|case by case|custom quote)\b/i.test(text);
  const hasOperatorOnlyLanguage = /\b(call|dm|message us|contact us|operator|manager|human)\b/i.test(text);

  let pricingMode = s(existing.pricingMode || existing.mode).toLowerCase();
  if (servicePairs.length > 1) pricingMode = "variable_by_service";
  else if (hasPromoLanguage) pricingMode = "promotional";
  else if (hasOperatorOnlyLanguage && !amounts.length) pricingMode = "operator_only";
  else if (hasQuoteLanguage) pricingMode = "quote_required";
  else if (hasFromLanguage) pricingMode = "starting_from";
  else if (amounts.length === 1) pricingMode = "fixed_price";
  else if (amounts.length > 1) pricingMode = "variable_by_service";
  else pricingMode = pricingMode || "quote_required";

  const minPrice = amounts.length ? Math.min(...amounts.map((item) => item.value)) : null;
  const maxPrice = amounts.length ? Math.max(...amounts.map((item) => item.value)) : null;
  const startingAt =
    pricingMode === "starting_from" || pricingMode === "promotional"
      ? minPrice
      : existing.startingAt ?? null;

  const publicSummary = buildPublicSummary({
    mode: pricingMode,
    startingAt,
    minPrice,
    maxPrice,
    currency,
    perServicePricing: servicePairs,
    note: text,
  });

  return compactDraftObject({
    pricingMode,
    currency,
    publicSummary,
    startingAt,
    minPrice,
    maxPrice,
    perServicePricing:
      servicePairs.length > 0
        ? servicePairs
        : arr(existing.perServicePricing).filter((item) =>
            arr(currentServices).some(
              (service) =>
                s(service?.key).toLowerCase() === s(item?.serviceKey).toLowerCase() ||
                s(service?.title).toLowerCase() === s(item?.title).toLowerCase()
            )
          ),
    allowPublicPriceReplies:
      pricingMode !== "operator_only" && pricingMode !== "quote_required",
    requiresOperatorForExactQuote: [
      "quote_required",
      "operator_only",
      "variable_by_service",
      "promotional",
    ].includes(pricingMode),
    pricingNotes: compactSentence(text, 260),
    pricingConfidence:
      servicePairs.length > 1 || amounts.length > 0
        ? "medium"
        : pricingMode === "operator_only" || pricingMode === "quote_required"
          ? "low"
          : "medium",
    operatorEscalationRules: uniqueStrings(
      [
        pricingMode === "quote_required" ? "Exact quote requested" : "",
        pricingMode === "operator_only" ? "Any pricing request" : "",
        pricingMode === "variable_by_service" ? "Service combination is unclear" : "",
        hasPromoLanguage ? "Promotion applicability is unclear" : "",
      ],
      8
    ),
  });
}

export const __test__ = {
  parseHoursNote,
  parsePricingNote,
  parseServicesNote,
  sanitizeStructuredHours,
  parseDaysFromText,
  parseTimeRange,
};