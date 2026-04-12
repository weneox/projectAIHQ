import {
  buildRuntimeAuthorityFailurePayload,
  isRuntimeAuthorityError,
} from "../../../../services/businessBrain/getTenantBrainRuntime.js";
import { buildExecutionPolicySurfaceSummary } from "../../../../services/executionPolicy.js";
import { refreshTenantRuntimeProjectionStrict } from "../../../../db/helpers/tenantRuntimeProjection.js";
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

function extractRuntimeAuthorityReasonCode(error = null) {
  return s(
    error?.runtimeAuthority?.reasonCode ||
      error?.runtimeAuthority?.reason ||
      error?.authority?.reasonCode ||
      error?.authority?.reason ||
      error?.reasonCode ||
      error?.reason
  ).toLowerCase();
}

function shouldAttemptRuntimeProjectionRepair(error = null) {
  const reasonCode = extractRuntimeAuthorityReasonCode(error);
  const errorCode = s(error?.code).toUpperCase();

  return (
    reasonCode === "runtime_projection_stale" ||
    reasonCode === "runtime_projection_missing" ||
    reasonCode === "missing_runtime_projection" ||
    reasonCode === "runtime_status_not_ready" ||
    errorCode === "TENANT_RUNTIME_PROJECTION_STALE"
  );
}

async function tryRepairRuntimeProjection({
  tenantKey,
  service,
  channelType,
  reasonCode,
}) {
  return refreshTenantRuntimeProjectionStrict({
    tenantKey,
    triggerType: "runtime_authority_auto_repair",
    requestedBy: "system",
    runnerKey: "inbox.internal.runtime.autoRepair",
    generatedBy: "system",
    metadata: {
      source: "inbox.internal.runtime",
      service: s(service),
      channelType: s(channelType),
      previousReasonCode: s(reasonCode),
      automaticRepair: true,
    },
  });
}

function buildResolvedRuntimeState(runtimePack, { threadState, service, channelType }) {
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
  const runtimeArgs = {
    db: client,
    tenantKey,
    threadState: threadState || null,
    authorityMode: "strict",
  };

  try {
    const runtimePack = await getRuntime(runtimeArgs);
    return buildResolvedRuntimeState(runtimePack, {
      threadState,
      service,
      channelType,
    });
  } catch (error) {
    if (!isRuntimeAuthorityError(error)) {
      throw error;
    }

    const reasonCode = extractRuntimeAuthorityReasonCode(error);

    if (shouldAttemptRuntimeProjectionRepair(error)) {
      try {
        console.warn("[ai-hq] inbox runtime auto-repair attempting", {
          tenantKey: s(tenantKey),
          service: s(service),
          channelType: s(channelType),
          reasonCode: s(reasonCode),
        });
      } catch {}

      try {
        await tryRepairRuntimeProjection({
          tenantKey,
          service,
          channelType,
          reasonCode,
        });

        try {
          console.warn("[ai-hq] inbox runtime auto-repair completed", {
            tenantKey: s(tenantKey),
            service: s(service),
            channelType: s(channelType),
            reasonCode: s(reasonCode),
          });
        } catch {}

        const runtimePack = await getRuntime(runtimeArgs);
        return buildResolvedRuntimeState(runtimePack, {
          threadState,
          service,
          channelType,
        });
      } catch (repairError) {
        if (isRuntimeAuthorityError(repairError)) {
          return {
            ok: false,
            response: buildRuntimeAuthorityFailurePayload(repairError, {
              service,
              tenantKey,
            }),
          };
        }
        throw repairError;
      }
    }

    return {
      ok: false,
      response: buildRuntimeAuthorityFailurePayload(error, {
        service,
        tenantKey,
      }),
    };
  }
}