import { splitTextList, lowerSlug, s, arr } from "./runtimeShared.js";
import {
  dedupeKnowledgeEntries,
  dedupePlaybooks,
  dedupeServices,
  normalizeKnowledgeEntry,
  normalizePlaybook,
  normalizeServiceEntry,
} from "./runtimeCatalogNormalization.js";
import { firstFact, listFactsByCategory } from "./runtimeCatalogFacts.js";
import { lower } from "./runtimeShared.js";

function mapFactService(text, idx = 0, tenant = null, source = "business_fact") {
  return normalizeServiceEntry(
    {
      id: `${source}-service-${idx + 1}`,
      tenant_id: s(tenant?.id),
      service_key: lowerSlug(text) || `service-${idx + 1}`,
      title: s(text),
      enabled: true,
      sellable: true,
      visible_in_ai: true,
      category: "general",
      description_short: s(text),
      description_full: s(text),
      keywords: [s(text)],
      synonyms: [],
      example_requests: [],
      pricing_mode: "quote_required",
      contact_capture_mode: "optional",
      handoff_mode: "optional",
      response_mode: "template",
      faq_answer: "",
      disabled_reply_text: "",
      sort_order: idx,
      meta: { source },
    },
    idx
  );
}

function buildServices({
  incomingServices = [],
  tenantServices = [],
  facts = [],
  activeKnowledge = [],
  tenant = null,
  legacy = null,
}) {
  const normalizedIncoming = arr(incomingServices).map((item, idx) =>
    normalizeServiceEntry(item, idx)
  );
  const normalizedTenantServices = arr(tenantServices).map((item, idx) =>
    normalizeServiceEntry(item, normalizedIncoming.length + idx)
  );
  const knowledgeServices = arr(activeKnowledge)
    .filter((x) => ["service", "product"].includes(lower(x.category || x.entry_type)))
    .map((x, idx) =>
      mapFactService(
        s(x.value_text || x.valueText || x.title || x.item_key || x.itemKey),
        normalizedIncoming.length + normalizedTenantServices.length + idx,
        tenant,
        "canonical_knowledge"
      )
    );
  const summaryServices = splitTextList(s(legacy?.profile?.services_summary)).map(
    (item, idx) =>
      mapFactService(
        item,
        normalizedIncoming.length +
          normalizedTenantServices.length +
          knowledgeServices.length +
          idx,
        tenant,
        "legacy_profile_summary"
      )
  );
  const factServices = listFactsByCategory(facts, ["service"]);
  const factProducts = listFactsByCategory(facts, ["product"]);
  const fallbackFactServices =
    normalizedTenantServices.length || knowledgeServices.length
      ? []
      : [
          ...factServices.map((item, idx) =>
            mapFactService(
              item,
              normalizedIncoming.length +
                normalizedTenantServices.length +
                knowledgeServices.length +
                summaryServices.length +
                idx,
              tenant,
              "business_fact"
            )
          ),
          ...factProducts.map((item, idx) =>
            mapFactService(
              item,
              normalizedIncoming.length +
                normalizedTenantServices.length +
                knowledgeServices.length +
                summaryServices.length +
                factServices.length +
                idx,
              tenant,
              "business_fact"
            )
          ),
        ];

  return dedupeServices([
    ...normalizedIncoming,
    ...normalizedTenantServices,
    ...knowledgeServices,
    ...summaryServices,
    ...fallbackFactServices,
  ]);
}

function buildKnowledgeEntries({
  incomingKnowledgeEntries = [],
  facts = [],
  activeKnowledge = [],
  tenant = null,
}) {
  const allowed = [
    "faq",
    "pricing",
    "pricing_policy",
    "support",
    "company",
    "summary",
    "service",
    "product",
    "location",
    "hours",
    "contact",
    "booking",
    "social_link",
  ];
  const fromKnowledge = arr(activeKnowledge)
    .filter((x) => allowed.includes(lower(x.category || x.entry_type)))
    .map((x, idx) => normalizeKnowledgeEntry(x, idx, tenant));
  const fromIncoming = arr(incomingKnowledgeEntries).map((item, idx) =>
    normalizeKnowledgeEntry(item, fromKnowledge.length + idx, tenant)
  );
  const fromFacts = arr(facts)
    .filter((x) => allowed.includes(lower(x.category || x.entry_type || x.fact_group || x.factGroup)))
    .map((x, idx) =>
      normalizeKnowledgeEntry(x, fromKnowledge.length + fromIncoming.length + idx, tenant)
    );
  return dedupeKnowledgeEntries([...fromKnowledge, ...fromIncoming, ...fromFacts], tenant);
}

function buildResponsePlaybooks({
  incomingResponsePlaybooks = [],
  storedResponsePlaybooks = [],
  facts = [],
  activeKnowledge = [],
  capabilities = {},
  tenant = null,
}) {
  const normalizedIncoming = arr(incomingResponsePlaybooks).map((item, idx) =>
    normalizePlaybook(item, idx, tenant)
  );
  const normalizedStored = arr(storedResponsePlaybooks).map((item, idx) =>
    normalizePlaybook(item, normalizedIncoming.length + idx, tenant)
  );
  const replyStyle = s(capabilities.reply_style || capabilities.replyStyle || "professional");
  const generated = [];
  const bookingText = firstFact(activeKnowledge, ["booking"]) || firstFact(facts, ["booking"]);
  if (bookingText) {
    generated.push(
      normalizePlaybook(
        {
          id: "brain-playbook-booking",
          intent_key: "booking",
          language: s(tenant?.default_language || "az"),
          ideal_reply: bookingText,
          reply_style: replyStyle,
          cta_type: "booking",
          priority: 20,
          enabled: true,
          meta: {
            name: "booking",
            triggerKeywords: ["booking", "book", "appointment", "meeting", "demo", "consultation", "randevu", "rezervasiya"],
            replyTemplate: bookingText,
            actionType: "book",
            createLead: true,
            handoff: false,
            handoffReason: "",
            handoffPriority: "normal",
          },
        },
        normalizedIncoming.length + normalizedStored.length,
        tenant
      )
    );
  }
  const supportText = firstFact(activeKnowledge, ["support"]) || firstFact(facts, ["support"]);
  if (supportText) {
    generated.push(
      normalizePlaybook(
        {
          id: "brain-playbook-support",
          intent_key: "support",
          language: s(tenant?.default_language || "az"),
          ideal_reply: supportText,
          reply_style: replyStyle,
          cta_type: "handoff",
          priority: 30,
          enabled: true,
          meta: {
            name: "support",
            triggerKeywords: ["problem", "issue", "support", "help", "komek", "destek"],
            replyTemplate: supportText,
            actionType: "handoff",
            createLead: false,
            handoff: true,
            handoffReason: "support_request",
            handoffPriority: "high",
          },
        },
        normalizedIncoming.length + normalizedStored.length + generated.length,
        tenant
      )
    );
  }
  const ctaText =
    firstFact(activeKnowledge, ["cta", "booking"]) ||
    firstFact(facts, ["cta", "booking"]);
  if (ctaText) {
    generated.push(
      normalizePlaybook(
        {
          id: "brain-playbook-cta",
          intent_key: "general_cta",
          language: s(tenant?.default_language || "az"),
          ideal_reply: ctaText,
          reply_style: replyStyle,
          cta_type: "contact",
          priority: 40,
          enabled: true,
          meta: {
            name: "general_cta",
            triggerKeywords: ["elaqe", "contact", "write me", "dm", "reach out"],
            replyTemplate: ctaText,
            actionType: "lead",
            createLead: true,
            handoff: false,
            handoffReason: "",
            handoffPriority: "normal",
          },
        },
        normalizedIncoming.length + normalizedStored.length + generated.length,
        tenant
      )
    );
  }

  return dedupePlaybooks([...normalizedIncoming, ...normalizedStored, ...generated], tenant);
}

export {
  buildKnowledgeEntries,
  buildResponsePlaybooks,
  buildServices,
};
