import crypto from "crypto";
import { okJson, isDbReady, serviceUnavailableJson } from "../../../utils/http.js";
import { deepFix, fixText } from "../../../utils/textFix.js";
import { kernelHandle } from "../../../kernel/agentKernel.js";
import { buildAgentReplayTrace } from "../../../services/agentReplayTrace.js";
import {
  buildRuntimeAuthorityFailurePayload,
  getTenantBrainRuntime,
  isRuntimeAuthorityError,
} from "../../../services/businessBrain/getTenantBrainRuntime.js";
import { resolveTenantKeyFromReq } from "../../../tenancy/index.js";
import { normalizeChatBody } from "./utils.js";

function s(v) {
  return String(v ?? "").trim();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function buildChatRuntimeBehavior(runtimePack = {}) {
  const rawBehavior = obj(runtimePack.behavior || runtimePack.behavior_json);
  const rawChannelBehavior = obj(
    runtimePack.channelBehavior ||
      runtimePack.channel_behavior ||
      rawBehavior.channelBehavior ||
      rawBehavior.channel_behavior
  );

  return {
    ...rawBehavior,
    niche: s(runtimePack.niche || rawBehavior.niche || runtimePack.industry),
    conversionGoal: s(
      runtimePack.conversionGoal ||
        runtimePack.conversion_goal ||
        rawBehavior.conversionGoal ||
        rawBehavior.conversion_goal
    ),
    primaryCta: s(
      runtimePack.primaryCta ||
        runtimePack.primary_cta ||
        rawBehavior.primaryCta ||
        rawBehavior.primary_cta
    ),
    toneProfile: s(
      runtimePack.toneProfile ||
        runtimePack.tone_profile ||
        rawBehavior.toneProfile ||
        rawBehavior.tone_profile
    ),
    qualificationQuestions: uniqStrings(
      runtimePack.qualificationQuestions ||
        runtimePack.qualification_questions ||
        rawBehavior.qualificationQuestions ||
        rawBehavior.qualification_questions
    ),
    handoffTriggers: uniqStrings(
      runtimePack.handoffTriggers ||
        runtimePack.handoff_triggers ||
        rawBehavior.handoffTriggers ||
        rawBehavior.handoff_triggers
    ),
    disallowedClaims: uniqStrings(
      runtimePack.disallowedClaims ||
        runtimePack.disallowed_claims ||
        rawBehavior.disallowedClaims ||
        rawBehavior.disallowed_claims
    ),
    channelBehavior: rawChannelBehavior,
  };
}

function buildAuthoritativeChatTenant(runtimePack = {}, tenantKey = "") {
  const runtimeTenant = obj(runtimePack.tenant);
  const profile = obj(runtimePack.profile || runtimeTenant.profile);
  const brand = obj(runtimeTenant.brand);
  const behavior = buildChatRuntimeBehavior(runtimePack);
  const displayName =
    s(runtimePack.displayName) ||
    s(runtimeTenant.company_name) ||
    s(profile.brand_name) ||
    s(brand.displayName) ||
    s(tenantKey) ||
    "Brand";
  const outputLanguage =
    s(runtimePack.language) ||
    s(runtimePack.outputLanguage) ||
    s(runtimePack.defaultLanguage) ||
    s(runtimeTenant.default_language) ||
    s(arr(runtimePack.languages)[0]) ||
    "az";

  return {
    ...runtimeTenant,
    tenantKey: s(runtimePack.tenantKey || runtimeTenant.tenant_key || tenantKey),
    tenantId: s(runtimeTenant.id || runtimeTenant.tenant_id || runtimePack.tenantId || tenantKey),
    tenant_key: s(runtimeTenant.tenant_key || runtimePack.tenantKey || tenantKey),
    companyName: displayName,
    brandName: displayName,
    industryKey: s(runtimePack.industry || runtimeTenant.industry_key || "generic_business"),
    outputLanguage,
    defaultLanguage: outputLanguage,
    language: outputLanguage,
    businessContext:
      s(runtimePack.businessContext) ||
      s(runtimePack.businessSummary) ||
      s(profile.brand_summary),
    toneText: s(runtimePack.tone || runtimePack.toneText || profile.tone_of_voice),
    services: uniqStrings(runtimePack.services),
    behavior,
    profile: {
      ...profile,
      brand_name: s(profile.brand_name || displayName),
      tone_of_voice: s(profile.tone_of_voice || runtimePack.tone || runtimePack.toneText),
    },
    ai_policy: {
      ...obj(runtimeTenant.ai_policy),
      ...obj(runtimePack.aiPolicy || runtimePack.ai_policy),
    },
  };
}

function sendInternalError(res, payload) {
  const target = typeof res?.status === "function" ? res.status(500) : res;
  if (typeof target?.json === "function") {
    return target.json(payload);
  }
  return payload;
}

export function createChatHandlers({
  db,
  wsHub,
  getRuntime = getTenantBrainRuntime,
  runKernel = kernelHandle,
} = {}) {
  async function postChat(req, res) {
    const input = normalizeChatBody(req.body);

    let {
      agentId,
      message,
      usecase,
      tenant,
      today,
      format,
      extra,
      threadId,
    } = input;

    if (!message) {
      return okJson(res, { ok: false, error: "message required" });
    }

    try {
      if (!threadId) threadId = crypto.randomUUID?.() || String(Date.now());

      if (!isDbReady(db)) {
        return serviceUnavailableJson(
          res,
          "database unavailable; chat runtime requires persistent storage"
        );
      }

      const tenantKey = resolveTenantKeyFromReq(
        req,
        s(tenant?.tenantKey || tenant?.tenant_key)
      );
      const runtimePack = await getRuntime({
        db,
        tenantKey,
        authorityMode: "strict",
        channel: "chat",
      });
      const authoritativeTenant = runtimePack?.tenant || null;

      if (!authoritativeTenant?.id && !authoritativeTenant?.tenant_key) {
        return okJson(res, {
          ok: false,
          error: "runtime_authority_unavailable",
          details: {
            service: "chat.post",
            message:
              "Approved runtime authority did not provide an authoritative tenant payload.",
            authority: runtimePack?.authority || null,
          },
        });
      }

      const runtimeBehavior = buildChatRuntimeBehavior(runtimePack);
      const runtimeTenant = buildAuthoritativeChatTenant(runtimePack, tenantKey);

      await db.query(
        `insert into threads (id, title) values ($1::uuid, $2::text)
         on conflict (id) do nothing`,
        [threadId, "Chat"]
      );

      await db.query(
        `insert into messages (thread_id, role, agent_key, content, meta)
         values ($1::uuid, 'user', null, $2::text, '{}'::jsonb)`,
        [threadId, message]
      );

      const out = await runKernel({
        message,
        agentHint: agentId,
        usecase: usecase || "general.chat",
        tenant: runtimeTenant,
        today,
        format,
        extra: {
          ...obj(extra),
          channel: "chat",
          runtimeBehavior,
        },
      });

      const answer = fixText(String(out?.replyText || "").trim());
      const meta = deepFix({
        ...(obj(out?.meta)),
        replayTrace: buildAgentReplayTrace({
          runtime: runtimePack,
          behavior: runtimeBehavior,
          promptBundle: out?.promptBundle,
          channel: "chat",
          usecase: usecase || "general.chat",
          decisions: {
            cta: {
              selected: s(runtimeBehavior.primaryCta),
              reason: "approved_runtime_behavior",
            },
            qualification: {
              mode: s(obj(runtimeBehavior.channelBehavior).chat?.qualificationDepth),
              questionCount: arr(runtimeBehavior.qualificationQuestions).length,
              reason:
                arr(runtimeBehavior.qualificationQuestions).length > 0
                  ? "approved_runtime_behavior"
                  : "",
            },
          },
          evaluation: {
            outcome: answer ? "reply_generated" : "empty_reply",
            ctaDirection: s(runtimeBehavior.primaryCta) ? "guided_reply" : "informational_reply",
            qualification: {
              status:
                arr(runtimeBehavior.qualificationQuestions).length > 0
                  ? "guided"
                  : "none",
              questionCount: arr(runtimeBehavior.qualificationQuestions).length,
            },
          },
        }),
      });

      const q = await db.query(
        `insert into messages (thread_id, role, agent_key, content, meta)
         values ($1::uuid, 'assistant', $2::text, $3::text, $4::jsonb)
         returning id, thread_id, role, agent_key, content, meta, created_at`,
        [threadId, agentId, answer, meta]
      );

      const row = q.rows?.[0] || null;
      if (row) {
        row.content = fixText(row.content);
        row.meta = deepFix(row.meta);

        wsHub?.broadcast?.({
          type: "thread.message",
          threadId,
          message: row,
        });
      }

      return okJson(res, {
        ok: Boolean(out?.ok),
        threadId,
        agentId,
        answer,
        meta,
      });
    } catch (e) {
      if (isRuntimeAuthorityError(e)) {
        return okJson(
          res,
          buildRuntimeAuthorityFailurePayload(e, {
            service: "chat.post",
            tenantKey: resolveTenantKeyFromReq(
              req,
              s(input?.tenant?.tenantKey || input?.tenant?.tenant_key)
            ),
          })
        );
      }

      return sendInternalError(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

  return { postChat };
}
