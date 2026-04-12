import {
  buildRuntimeAuthorityFailurePayload,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildExecutionPolicySurfaceSummary } from "../../../../services/executionPolicy.js";
import { s } from "../shared.js";

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function resolveRuntimeChannelType(runtimePack = {}, explicitChannelType = "") {
  return (
    s(explicitChannelType) ||
    s(runtimePack?.channelType) ||
    s(runtimePack?.threadState?.channelType) ||
    s(runtimePack?.threadState?.channel) ||
    s(runtimePack?.thread_state?.channelType) ||
    s(runtimePack?.thread_state?.channel) ||
    "inbox"
  )
    .toLowerCase()
    .trim();
}

export function buildRuntimePayload(runtimePack, options = {}) {
  const channelType = resolveRuntimeChannelType(
    runtimePack,
    options?.channelType
  );

  const serviceCatalog = arr(runtimePack?.serviceCatalog).length
    ? runtimePack.serviceCatalog
    : arr(runtimePack?.servicesDetailed);

  const services = arr(runtimePack?.services).length
    ? runtimePack.services
    : serviceCatalog
        .map((item) => s(item?.title || item?.name || item?.service_key || item))
        .filter(Boolean);

  const disabledServices = arr(runtimePack?.disabledServices).length
    ? runtimePack.disabledServices
    : serviceCatalog
        .filter(
          (item) =>
            item &&
            (item.enabled === false ||
              item.active === false ||
              item.visible_in_ai === false ||
              item.visibleInAi === false)
        )
        .map((item) => s(item?.title || item?.name || item?.service_key || ""))
        .filter(Boolean);

  return {
    executionPolicy: {
      inbox: buildExecutionPolicySurfaceSummary({
        runtime: runtimePack,
        surface: "inbox",
        channelType,
        currentState:
          runtimePack?.threadState || runtimePack?.thread_state || null,
      }),
      comments: buildExecutionPolicySurfaceSummary({
        runtime: runtimePack,
        surface: "comments",
        channelType: "comments",
      }),
      voice: buildExecutionPolicySurfaceSummary({
        runtime: runtimePack,
        surface: "voice",
        channelType: "voice",
      }),
    },
    ...runtimePack,
    channelType,
    tenant: runtimePack?.tenant || null,
    serviceCatalog,
    services,
    disabledServices,
    knowledgeEntries: arr(runtimePack?.knowledgeEntries),
    responsePlaybooks: arr(runtimePack?.responsePlaybooks),
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
    bannedPhrases: arr(runtimePack?.bannedPhrases).length
      ? runtimePack.bannedPhrases
      : arr(runtimePack?.forbiddenClaims),
    language:
      s(runtimePack?.language) ||
      s(runtimePack?.defaultLanguage) ||
      s(runtimePack?.outputLanguage) ||
      s(runtimePack?.tenant?.default_language) ||
      "az",
    threadState: runtimePack?.threadState || runtimePack?.thread_state || null,
    raw: runtimePack?.raw || {},
  };
}

export async function loadStrictInboxRuntime({
  client,
  getRuntime,
  tenantKey,
  threadState,
  service,
  channelType = "",
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
      runtime: buildRuntimePayload(
        {
          ...runtimePack,
          tenant,
          threadState: threadState || runtimePack?.threadState || null,
          channelType:
            s(channelType) ||
            s(runtimePack?.channelType) ||
            s(runtimePack?.threadState?.channelType) ||
            s(runtimePack?.threadState?.channel) ||
            "",
        },
        { channelType }
      ),
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