import { getDefaultTenantKey, resolveTenantKey } from "../../tenancy/index.js";
import {
  arr,
  flattenStringList,
  lower,
  normalizeLang,
  obj,
  pickFirstBoolean,
  pickFirstString,
  s,
  uniqStrings,
} from "./shared.js";

export function getResolvedTenantKey(tenantKey) {
  return resolveTenantKey(tenantKey, getDefaultTenantKey());
}

export function normalizeServiceCatalogEntry(item) {
  const x = obj(item);

  const enabled =
    typeof x.enabled === "boolean"
      ? x.enabled
      : typeof x.active === "boolean"
        ? x.active
        : typeof x.is_active === "boolean"
          ? x.is_active
          : true;

  const visibleInAi =
    typeof x.visible_in_ai === "boolean"
      ? x.visible_in_ai
      : typeof x.visibleInAi === "boolean"
        ? x.visibleInAi
        : true;

  const name =
    s(x.title) ||
    s(x.name) ||
    s(x.service_name) ||
    s(x.label);

  const keywords = uniqStrings([
    name,
    ...flattenStringList(
      x.keywords,
      x.synonyms,
      x.aliases,
      x.example_requests
    ),
  ]);

  return {
    id: s(x.id),
    key: lower(x.service_key || x.key || name),
    name,
    enabled: Boolean(enabled),
    visibleInAi: Boolean(visibleInAi),
    keywords,
    disabledReplyText: s(x.disabled_reply_text || x.disabledReplyText),
    raw: x,
  };
}

function getTenantBrandNameFallback(tenant, tenantKey) {
  const brandName =
    tenant?.brand?.displayName ||
    tenant?.brand?.name ||
    tenant?.profile?.displayName ||
    tenant?.profile?.companyName ||
    tenant?.profile?.brand_name ||
    tenant?.company_name ||
    tenant?.name ||
    getResolvedTenantKey(tenantKey);

  return s(brandName || "Brand");
}

export function buildLocalRuntimeFallback({
  tenantKey,
  tenant = null,
  runtime = null,
}) {
  const resolvedTenantKey = getResolvedTenantKey(tenantKey);
  const profile = obj(tenant?.profile);
  const aiPolicy = obj(tenant?.ai_policy);
  const runtimeLike = obj(runtime?.runtime || runtime?.businessRuntime || runtime);

  const runtimeCatalog = arr(runtimeLike.serviceCatalog).length
    ? arr(runtimeLike.serviceCatalog)
    : arr(runtimeLike.servicesDetailed).length
      ? arr(runtimeLike.servicesDetailed)
      : [];

  const serviceCatalog = runtimeCatalog
    .map(normalizeServiceCatalogEntry)
    .filter((x) => x.name);

  const enabledServices = serviceCatalog
    .filter((x) => x.enabled && x.visibleInAi)
    .map((x) => x.name);

  const disabledServices = serviceCatalog
    .filter((x) => (!x.enabled || !x.visibleInAi) && x.name)
    .map((x) => x.name);

  return {
    tenantKey: resolvedTenantKey,
    brandName: getTenantBrandNameFallback(tenant, resolvedTenantKey),
    businessContext: pickFirstString(
      runtimeLike.businessContext,
      runtimeLike.companySummaryLong,
      runtimeLike.companySummaryShort,
      profile.businessContext,
      profile.brand_summary,
      profile.value_proposition,
      profile.services_summary
    ),
    tone: pickFirstString(
      runtimeLike.tone,
      runtimeLike.toneText,
      runtimeLike.replyStyle,
      profile.tone_of_voice,
      "professional"
    ),
    preferredCta: pickFirstString(
      runtimeLike.preferredCta,
      runtimeLike.cta,
      profile.preferred_cta
    ),
    bannedPhrases: uniqStrings(
      flattenStringList(
        runtimeLike.bannedPhrases,
        runtimeLike.forbiddenClaims,
        profile.banned_phrases
      )
    ),
    commentPolicy: {
      ...obj(aiPolicy.comment_policy),
      ...obj(tenant?.comment_policy),
      ...obj(runtimeLike.commentPolicy),
      ...obj(runtimeLike.comment_policy),
    },
    autoReplyEnabled:
      pickFirstBoolean(
        runtimeLike.autoReplyEnabled,
        runtimeLike.aiPolicy?.autoReplyEnabled,
        runtimeLike.aiPolicy?.auto_reply_enabled,
        aiPolicy.auto_reply_enabled
      ) ?? true,
    createLeadEnabled:
      pickFirstBoolean(
        runtimeLike.createLeadEnabled,
        runtimeLike.aiPolicy?.createLeadEnabled,
        runtimeLike.aiPolicy?.create_lead_enabled,
        aiPolicy.create_lead_enabled
      ) ?? true,
    language: normalizeLang(
      pickFirstString(
        runtimeLike.outputLanguage,
        runtimeLike.language,
        tenant?.default_language,
        "az"
      ),
      "az"
    ),
    serviceCatalog,
    services: uniqStrings([
      ...enabledServices,
      ...flattenStringList(
        runtimeLike.services,
        runtimeLike.serviceNames,
        profile.services,
        profile.services_summary
      ),
    ]),
    disabledServices: uniqStrings([
      ...disabledServices,
      ...flattenStringList(runtimeLike.disabledServices),
    ]),
  };
}

let runtimeResolverPromise = null;

export async function loadRuntimeResolver() {
  if (!runtimeResolverPromise) {
    runtimeResolverPromise = import("../businessBrain/getTenantBrainRuntime.js")
      .then((mod) => {
        const defaultExport = mod?.default;

        const resolve =
          mod?.getTenantBrainRuntime ||
          mod?.getTenantBusinessRuntime ||
          mod?.resolveTenantBusinessRuntime ||
          mod?.buildTenantBusinessRuntime ||
          mod?.getBusinessRuntime ||
          mod?.resolveBusinessRuntime ||
          mod?.buildBusinessRuntime ||
          (typeof defaultExport === "function" ? defaultExport : null) ||
          defaultExport?.getTenantBrainRuntime ||
          defaultExport?.getTenantBusinessRuntime ||
          defaultExport?.resolveTenantBusinessRuntime ||
          defaultExport?.buildTenantBusinessRuntime ||
          defaultExport?.getBusinessRuntime ||
          defaultExport?.resolveBusinessRuntime ||
          defaultExport?.buildBusinessRuntime ||
          null;

        return { mod, resolve };
      })
      .catch(() => ({ mod: null, resolve: null }));
  }

  return runtimeResolverPromise;
}

function pickRuntimeObject(runtime) {
  const candidates = [
    runtime?.runtime,
    runtime?.businessRuntime,
    runtime?.data,
    runtime,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      if (Object.keys(candidate).length) return candidate;
    }
  }

  return {};
}

function normalizeResolvedRuntime(runtime, { tenantKey, tenant = null } = {}) {
  const raw = pickRuntimeObject(runtime);
  const fallback = buildLocalRuntimeFallback({ tenantKey, tenant, runtime });

  const rawServiceCatalog =
    arr(raw.serviceCatalog).length
      ? raw.serviceCatalog
      : arr(raw.catalog).length
        ? raw.catalog
        : arr(raw.servicesDetailed).length
          ? raw.servicesDetailed
          : arr(fallback.serviceCatalog);

  const serviceCatalog = rawServiceCatalog
    .map(normalizeServiceCatalogEntry)
    .filter((x) => x.name);

  const enabledServicesFromCatalog = serviceCatalog
    .filter((x) => x.enabled && x.visibleInAi)
    .map((x) => x.name);

  const disabledServicesFromCatalog = serviceCatalog
    .filter((x) => (!x.enabled || !x.visibleInAi) && x.name)
    .map((x) => x.name);

  const rawCommentPolicy =
    obj(raw.commentPolicy) ||
    obj(raw.comment_policy) ||
    obj(raw.aiPolicy?.commentPolicy) ||
    obj(raw.aiPolicy?.comment_policy) ||
    obj(raw.ai_policy?.comment_policy) ||
    obj(raw.tenant?.comment_policy);

  return {
    tenantKey: getResolvedTenantKey(
      pickFirstString(
        raw.tenantKey,
        raw.tenant_key,
        raw.tenant?.tenant_key,
        fallback.tenantKey
      )
    ),
    brandName: pickFirstString(
      raw.brandName,
      raw.displayName,
      raw.companyName,
      raw.company_name,
      raw.profile?.brandName,
      raw.profile?.displayName,
      raw.profile?.brand_name,
      raw.tenant?.profile?.brand_name,
      raw.tenant?.brand?.displayName,
      fallback.brandName
    ),
    businessContext: pickFirstString(
      raw.businessContext,
      raw.businessSummary,
      raw.companySummaryLong,
      raw.companySummaryShort,
      raw.summaryLong,
      raw.summaryShort,
      raw.aboutSection,
      raw.valueProposition,
      raw.profile?.businessContext,
      raw.profile?.brand_summary,
      raw.tenant?.profile?.brand_summary,
      fallback.businessContext
    ),
    tone: pickFirstString(
      raw.tone,
      raw.toneText,
      raw.replyStyle,
      raw.capabilities?.replyStyle,
      raw.profile?.tone,
      raw.profile?.tone_of_voice,
      raw.tenant?.profile?.tone_of_voice,
      fallback.tone
    ),
    preferredCta: pickFirstString(
      raw.preferredCta,
      raw.cta,
      raw.capabilities?.ctaStyle,
      raw.profile?.preferredCta,
      raw.profile?.preferred_cta,
      raw.tenant?.profile?.preferred_cta,
      fallback.preferredCta
    ),
    bannedPhrases: uniqStrings(
      flattenStringList(
        raw.bannedPhrases,
        raw.forbiddenClaims,
        raw.profile?.bannedPhrases,
        raw.profile?.banned_phrases,
        raw.tenant?.profile?.banned_phrases,
        fallback.bannedPhrases
      )
    ),
    commentPolicy: {
      ...obj(fallback.commentPolicy),
      ...obj(rawCommentPolicy),
    },
    autoReplyEnabled:
      pickFirstBoolean(
        raw.autoReplyEnabled,
        raw.aiPolicy?.autoReplyEnabled,
        raw.aiPolicy?.auto_reply_enabled,
        raw.ai_policy?.auto_reply_enabled,
        raw.tenant?.ai_policy?.auto_reply_enabled,
        raw.capabilities?.autoReplyEnabled,
        fallback.autoReplyEnabled
      ) ?? true,
    createLeadEnabled:
      pickFirstBoolean(
        raw.createLeadEnabled,
        raw.aiPolicy?.createLeadEnabled,
        raw.aiPolicy?.create_lead_enabled,
        raw.ai_policy?.create_lead_enabled,
        raw.tenant?.ai_policy?.create_lead_enabled,
        raw.capabilities?.createLeadEnabled,
        fallback.createLeadEnabled
      ) ?? true,
    language: normalizeLang(
      pickFirstString(
        raw.outputLanguage,
        raw.language,
        raw.primaryLanguage,
        raw.defaultLanguage,
        raw.capabilities?.primaryLanguage,
        raw.tenant?.default_language,
        fallback.language
      ),
      fallback.language || "az"
    ),
    serviceCatalog,
    services: uniqStrings([
      ...enabledServicesFromCatalog,
      ...flattenStringList(
        raw.services,
        raw.enabledServices,
        raw.serviceNames,
        fallback.services
      ),
    ]),
    disabledServices: uniqStrings([
      ...disabledServicesFromCatalog,
      ...flattenStringList(raw.disabledServices, fallback.disabledServices),
    ]),
  };
}

export async function resolveCommentRuntime({
  tenantKey,
  tenant = null,
  runtime = null,
}) {
  if (runtime && typeof runtime === "object") {
    return normalizeResolvedRuntime(runtime, { tenantKey, tenant });
  }

  const loaded = await loadRuntimeResolver();

  if (loaded?.resolve) {
    const attempts = [
      () => loaded.resolve({ tenantKey, tenant, channel: "comments" }),
      () => loaded.resolve({ tenantKey, tenant }),
      () => loaded.resolve(tenantKey, tenant, "comments"),
      () => loaded.resolve(tenantKey, tenant),
      () => loaded.resolve(tenant),
    ];

    for (const tryResolve of attempts) {
      try {
        const resolved = await tryResolve();
        if (resolved && typeof resolved === "object") {
          return normalizeResolvedRuntime(resolved, { tenantKey, tenant });
        }
      } catch {}
    }
  }

  return buildLocalRuntimeFallback({ tenantKey, tenant, runtime });
}

export function getCommentPolicy(runtime) {
  return obj(runtime?.commentPolicy);
}

export function getTenantBrandName(runtime, tenantKey) {
  return pickFirstString(runtime?.brandName, getResolvedTenantKey(tenantKey), "Brand");
}

export function getTenantBusinessContext(runtime) {
  return s(runtime?.businessContext).slice(0, 1400);
}

export function getTenantTone(runtime) {
  return s(runtime?.tone || "professional");
}

export function getTenantPreferredCta(runtime) {
  return s(runtime?.preferredCta || "");
}

export function getTenantBannedPhrases(runtime) {
  return uniqStrings(arr(runtime?.bannedPhrases).map((x) => lower(x)).filter(Boolean));
}

export function getRuntimeServiceKeywords(runtime) {
  const catalogKeywords = arr(runtime?.serviceCatalog)
    .filter((item) => item?.enabled && item?.visibleInAi)
    .flatMap((item) => [item?.name, ...arr(item?.keywords)]);

  return uniqStrings([
    ...catalogKeywords,
    ...flattenStringList(runtime?.services),
  ]);
}

export function findDisabledServiceMatch(text, runtime) {
  const incoming = lower(text);

  const disabledCatalog = arr(runtime?.serviceCatalog).filter(
    (item) => !item?.enabled || !item?.visibleInAi
  );

  for (const item of disabledCatalog) {
    const probes = uniqStrings([item?.name, ...arr(item?.keywords)]);
    for (const probe of probes) {
      if (probe && incoming.includes(lower(probe))) {
        return item;
      }
    }
  }

  const disabledNames = flattenStringList(runtime?.disabledServices);
  for (const name of disabledNames) {
    if (name && incoming.includes(lower(name))) {
      return {
        name,
        keywords: [name],
        disabledReplyText: "",
      };
    }
  }

  return null;
}