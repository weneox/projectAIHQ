import { arr, compactDraftObject, obj, s } from "./draftShared.js";

function slugify(value = "") {
  return s(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeAliases(value = [], limit = 12) {
  return Array.from(
    new Set(
      arr(value)
        .map((item) => s(item).toLowerCase())
        .filter(Boolean)
        .slice(0, limit)
    )
  );
}

function normalizeCatalogItem(item = {}) {
  const source = obj(item);
  const title = s(source.title || source.name);
  if (!title) return null;

  return compactDraftObject({
    key: s(source.key || slugify(title)),
    title,
    summary: s(source.summary || source.description),
    category: s(source.category || "general").toLowerCase() || "general",
    aliases: normalizeAliases(source.aliases),
    packKey: s(source.packKey || source.pack_key),
  });
}

const STARTER_SERVICE_CATALOG = [
  {
    key: "consultation",
    title: "Consultation",
    summary: "Initial discovery call or appointment to understand the request.",
    category: "general",
    aliases: ["intro call", "discovery call", "assessment"],
  },
  {
    key: "follow-up-appointment",
    title: "Follow-up Appointment",
    summary: "Short follow-up session for ongoing customers or returning cases.",
    category: "general",
    aliases: ["follow up", "review appointment"],
  },
  {
    key: "diagnostic-check",
    title: "Diagnostic Check",
    summary: "Inspection or assessment before a detailed quote or treatment plan.",
    category: "clinic",
    aliases: ["diagnostics", "assessment visit", "inspection"],
    packKey: "clinic",
  },
  {
    key: "treatment-plan",
    title: "Treatment Plan",
    summary: "Structured plan for treatments, procedures, or staged care.",
    category: "clinic",
    aliases: ["care plan", "procedure plan"],
    packKey: "clinic",
  },
  {
    key: "haircut-styling",
    title: "Haircut & Styling",
    summary: "Hair cutting, styling, and standard salon appointment work.",
    category: "beauty",
    aliases: ["haircut", "styling", "salon"],
    packKey: "beauty",
  },
  {
    key: "color-treatment",
    title: "Color Treatment",
    summary: "Coloring, toning, bleaching, or related beauty treatments.",
    category: "beauty",
    aliases: ["hair color", "toning", "bleach"],
    packKey: "beauty",
  },
  {
    key: "manicure-pedicure",
    title: "Manicure / Pedicure",
    summary: "Nail care and beauty services.",
    category: "beauty",
    aliases: ["manicure", "pedicure", "nails"],
    packKey: "beauty",
  },
  {
    key: "installation",
    title: "Installation",
    summary: "Install or set up equipment, fixtures, or delivered systems.",
    category: "home_service",
    aliases: ["setup", "mounting", "install"],
    packKey: "home_service",
  },
  {
    key: "repair",
    title: "Repair",
    summary: "Fix, restore, or troubleshoot a faulty system or asset.",
    category: "home_service",
    aliases: ["fix", "maintenance repair", "troubleshooting"],
    packKey: "home_service",
  },
  {
    key: "maintenance-service",
    title: "Maintenance Service",
    summary: "Scheduled upkeep or preventive maintenance for an existing system.",
    category: "home_service",
    aliases: ["maintenance", "service visit", "upkeep"],
    packKey: "home_service",
  },
  {
    key: "legal-consultation",
    title: "Legal Consultation",
    summary: "Initial legal consultation or advisory session.",
    category: "legal",
    aliases: ["law consultation", "legal advice"],
    packKey: "legal",
  },
  {
    key: "contract-review",
    title: "Contract Review",
    summary: "Review of contracts, agreements, or legal documents.",
    category: "legal",
    aliases: ["agreement review", "document review"],
    packKey: "legal",
  },
  {
    key: "document-preparation",
    title: "Document Preparation",
    summary: "Drafting or preparing formal business or legal documents.",
    category: "legal",
    aliases: ["drafting", "document drafting"],
    packKey: "legal",
  },
  {
    key: "bookkeeping",
    title: "Bookkeeping",
    summary: "Routine bookkeeping and financial record maintenance.",
    category: "finance",
    aliases: ["accounts", "ledger maintenance"],
    packKey: "finance",
  },
  {
    key: "tax-filing",
    title: "Tax Filing",
    summary: "Tax preparation, filing, and related compliance support.",
    category: "finance",
    aliases: ["tax prep", "tax return", "vat filing"],
    packKey: "finance",
  },
  {
    key: "payroll-support",
    title: "Payroll Support",
    summary: "Payroll setup, recurring payroll, or payroll corrections.",
    category: "finance",
    aliases: ["payroll", "salary processing"],
    packKey: "finance",
  },
  {
    key: "financial-advisory",
    title: "Financial Advisory",
    summary: "Ongoing advisory, CFO-style support, or finance planning.",
    category: "finance",
    aliases: ["advisory", "cfo support", "planning"],
    packKey: "finance",
  },
  {
    key: "social-media-management",
    title: "Social Media Management",
    summary: "Content planning, posting, and channel management.",
    category: "marketing",
    aliases: ["smm", "social media", "content management"],
    packKey: "marketing",
  },
  {
    key: "paid-ads-management",
    title: "Paid Ads Management",
    summary: "Ad strategy, setup, and optimization across paid channels.",
    category: "marketing",
    aliases: ["ads", "ppc", "campaign management"],
    packKey: "marketing",
  },
  {
    key: "brand-strategy",
    title: "Brand Strategy",
    summary: "Brand positioning, messaging, and audience strategy.",
    category: "marketing",
    aliases: ["branding", "brand positioning"],
    packKey: "marketing",
  },
  {
    key: "website-build",
    title: "Website Build",
    summary: "Website design, build, or redesign work.",
    category: "marketing",
    aliases: ["web design", "website design", "web development"],
    packKey: "marketing",
  },
  {
    key: "course-enrollment",
    title: "Course Enrollment",
    summary: "Enrollment support for classes, courses, or programs.",
    category: "education",
    aliases: ["registration", "admission"],
    packKey: "education",
  },
  {
    key: "private-lessons",
    title: "Private Lessons",
    summary: "One-to-one teaching, coaching, or tutoring sessions.",
    category: "education",
    aliases: ["tutoring", "private class", "coaching"],
    packKey: "education",
  },
  {
    key: "exam-preparation",
    title: "Exam Preparation",
    summary: "Focused preparation for tests, certifications, or exams.",
    category: "education",
    aliases: ["exam prep", "test prep"],
    packKey: "education",
  },
  {
    key: "reservation-booking",
    title: "Reservation / Booking",
    summary: "Table, event, or appointment reservation support.",
    category: "hospitality",
    aliases: ["reservation", "booking", "table booking"],
    packKey: "hospitality",
  },
  {
    key: "event-package",
    title: "Event Package",
    summary: "Bundled event, celebration, or venue package offering.",
    category: "hospitality",
    aliases: ["event booking", "venue package"],
    packKey: "hospitality",
  },
];

const STARTER_PACKS = [
  {
    key: "clinic",
    title: "Clinic & wellness",
    summary: "Health, dental, wellness, and care businesses.",
    matchTerms: ["clinic", "dental", "doctor", "medical", "wellness", "treatment"],
  },
  {
    key: "beauty",
    title: "Beauty & salon",
    summary: "Beauty salons, cosmetology, and self-care businesses.",
    matchTerms: ["beauty", "salon", "hair", "spa", "cosmetic", "nail"],
  },
  {
    key: "home_service",
    title: "Repair & installation",
    summary: "Installation, repair, maintenance, and field services.",
    matchTerms: ["repair", "installation", "maintenance", "service visit", "technician"],
  },
  {
    key: "legal",
    title: "Legal practice",
    summary: "Law firms, legal advisors, and case-based practices.",
    matchTerms: ["legal", "law", "contract", "attorney", "advocate"],
  },
  {
    key: "finance",
    title: "Finance & accounting",
    summary: "Accounting, bookkeeping, payroll, and finance support.",
    matchTerms: ["finance", "accounting", "bookkeeping", "tax", "payroll", "cfo"],
  },
  {
    key: "marketing",
    title: "Marketing & digital",
    summary: "Agencies, digital marketing teams, and creative service businesses.",
    matchTerms: ["marketing", "brand", "ads", "website", "smm", "seo", "agency"],
  },
  {
    key: "education",
    title: "Education & coaching",
    summary: "Courses, tutoring, academies, and coaching businesses.",
    matchTerms: ["course", "academy", "lesson", "education", "training", "coach"],
  },
  {
    key: "hospitality",
    title: "Hospitality & events",
    summary: "Restaurants, venues, and event-driven businesses.",
    matchTerms: ["reservation", "restaurant", "event", "venue", "booking"],
  },
];

const NORMALIZED_CATALOG = STARTER_SERVICE_CATALOG.map(normalizeCatalogItem).filter(Boolean);

function buildPackServices(packKey = "") {
  return NORMALIZED_CATALOG.filter((item) => s(item.packKey) === s(packKey));
}

function matchesNeedle(item = {}, needle = "") {
  const normalizedNeedle = s(needle).toLowerCase();
  if (!normalizedNeedle) return true;

  const haystack = [
    s(item.key),
    s(item.title),
    s(item.summary),
    ...arr(item.aliases),
    s(item.category),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedNeedle);
}

function inferPackMatches({ companyName = "", description = "", services = [] } = {}) {
  const haystack = [
    s(companyName),
    s(description),
    ...arr(services).map((item) => s(item?.title || item?.summary || item)),
  ]
    .join(" ")
    .toLowerCase();

  return STARTER_PACKS.filter((pack) =>
    arr(pack.matchTerms).some((term) => haystack.includes(s(term).toLowerCase()))
  );
}

function normalizeServiceDraftItem(item = {}) {
  const source = obj(item);
  const title = s(source.title || source.name || source.label);
  if (!title) return null;

  return compactDraftObject({
    key: s(source.key || slugify(title)),
    title,
    summary: s(source.summary || source.description),
    category: s(source.category || "general").toLowerCase() || "general",
    priceLabel: s(source.priceLabel || source.price_label || source.price),
    aliases: arr(source.aliases)
      .map((value) => s(value))
      .filter(Boolean)
      .slice(0, 12),
    availabilityStatus:
      s(source.availabilityStatus || source.availability_status).toLowerCase() ||
      "available",
    operatorNotes: s(source.operatorNotes || source.operator_notes),
  });
}

function mergeUniqueServices(...groups) {
  const seen = new Set();
  const out = [];

  for (const group of groups) {
    for (const item of arr(group)) {
      const normalized = normalizeServiceDraftItem(item);
      if (!normalized) continue;

      const dedupeKey = `${s(normalized.key).toLowerCase()}|${s(normalized.title).toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      out.push(normalized);
    }
  }

  return out;
}

export function buildSetupAssistantServiceCatalog({
  businessProfile = {},
  currentServices = [],
  sourceServices = [],
} = {}) {
  const profile = obj(businessProfile);
  const packMatches = inferPackMatches({
    companyName: profile.companyName,
    description:
      profile.description || profile.summaryLong || profile.companySummaryLong,
    services: sourceServices,
  });

  const suggestedFromPacks = packMatches.flatMap((pack) => buildPackServices(pack.key));
  const suggestedServices = mergeUniqueServices(
    sourceServices,
    currentServices,
    suggestedFromPacks
  ).slice(0, 12);

  return {
    items: NORMALIZED_CATALOG,
    packs: STARTER_PACKS.map((pack) => ({
      key: pack.key,
      title: pack.title,
      summary: pack.summary,
      services: buildPackServices(pack.key),
    })),
    detectedPacks: packMatches.map((pack) => compactDraftObject(pack)),
    suggestedServices,
  };
}

export function searchSetupAssistantCatalogItems(query = "", catalog = {}) {
  const items = arr(catalog.items || NORMALIZED_CATALOG);
  const needle = s(query);
  if (!needle) return items.slice(0, 18);
  return items.filter((item) => matchesNeedle(item, needle)).slice(0, 18);
}

export const __test__ = {
  inferPackMatches,
  normalizeCatalogItem,
  normalizeServiceDraftItem,
  searchSetupAssistantCatalogItems,
};
