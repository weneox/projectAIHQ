import {
  buildRuntimeAuthorityFailurePayload,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import { s } from "../shared.js";

export function buildRuntimePayload(runtimePack) {
  const serviceCatalog = Array.isArray(runtimePack?.serviceCatalog)
    ? runtimePack.serviceCatalog
    : Array.isArray(runtimePack?.servicesDetailed)
      ? runtimePack.servicesDetailed
      : [];

  const services = Array.isArray(runtimePack?.services)
    ? runtimePack.services
    : serviceCatalog
        .map((item) => s(item?.title || item?.name || item?.service_key || item))
        .filter(Boolean);

  const disabledServices = Array.isArray(runtimePack?.disabledServices)
    ? runtimePack.disabledServices
    : serviceCatalog
        .filter(
          (item) =>
            item &&
            (
              item.enabled === false ||
              item.active === false ||
              item.visible_in_ai === false ||
              item.visibleInAi === false
            )
        )
        .map((item) => s(item?.title || item?.name || item?.service_key || ""))
        .filter(Boolean);

  return {
    ...runtimePack,
    tenant: runtimePack?.tenant || null,
    serviceCatalog,
    services,
    disabledServices,
    knowledgeEntries: Array.isArray(runtimePack?.knowledgeEntries)
      ? runtimePack.knowledgeEntries
      : [],
    responsePlaybooks: Array.isArray(runtimePack?.responsePlaybooks)
      ? runtimePack.responsePlaybooks
      : [],
    aiPolicy:
      runtimePack?.aiPolicy ||
      runtimePack?.ai_policy ||
      runtimePack?.tenant?.ai_policy ||
      {},
    inboxPolicy:
      runtimePack?.inboxPolicy ||
      runtimePack?.inbox_policy ||
      runtimePack?.tenant?.inbox_policy ||
      {},
    commentPolicy:
      runtimePack?.commentPolicy ||
      runtimePack?.comment_policy ||
      runtimePack?.tenant?.comment_policy ||
      {},
    businessContext:
      s(runtimePack?.businessContext) ||
      s(runtimePack?.businessSummary) ||
      s(runtimePack?.companySummaryLong) ||
      s(runtimePack?.companySummaryShort) ||
      "",
    tone:
      s(runtimePack?.tone) ||
      s(runtimePack?.toneText) ||
      s(runtimePack?.tenant?.profile?.tone_of_voice) ||
      "professional, warm, concise",
    preferredCta:
      s(runtimePack?.preferredCta) ||
      s(runtimePack?.tenant?.profile?.preferred_cta) ||
      "",
    bannedPhrases: Array.isArray(runtimePack?.bannedPhrases)
      ? runtimePack.bannedPhrases
      : Array.isArray(runtimePack?.forbiddenClaims)
        ? runtimePack.forbiddenClaims
        : [],
    language:
      s(runtimePack?.language) ||
      s(runtimePack?.defaultLanguage) ||
      s(runtimePack?.outputLanguage) ||
      s(runtimePack?.tenant?.default_language) ||
      "az",
    threadState:
      runtimePack?.threadState ||
      runtimePack?.thread_state ||
      null,
    raw: runtimePack?.raw || {},
  };
}

export async function loadStrictInboxRuntime({
  client,
  getRuntime,
  tenantKey,
  threadState,
  service,
}) {
  try {
    const runtimePack = await getRuntime({
      db: client,
      tenantKey,
      threadState: threadState || null,
      authorityMode: "strict",
    });

    const tenant = runtimePack?.tenant || null;
    if (!tenant?.id && !tenant?.tenant_key) {
      return {
        ok: false,
        response: {
          ok: false,
          error: "runtime_authority_unavailable",
          details: {
            service,
            message:
              "Approved runtime authority did not provide an authoritative tenant payload.",
            authority: runtimePack?.authority || null,
          },
        },
      };
    }

    return {
      ok: true,
      tenant,
      runtimePack,
      runtime: buildRuntimePayload({
        ...runtimePack,
        tenant,
        threadState: threadState || runtimePack?.threadState || null,
      }),
    };
  } catch (error) {
    if (isRuntimeAuthorityError(error)) {
      return {
        ok: false,
        response: buildRuntimeAuthorityFailurePayload(error, {
          service,
          tenantKey,
        }),
      };
    }
    throw error;
  }
}
