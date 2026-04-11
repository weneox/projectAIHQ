import { okJson, isDbReady } from "../../../../utils/http.js";
import { buildInboxActions } from "../../../../services/inboxBrain.js";
import {
  applyExecutionPolicyToActions,
  buildExecutionPolicyDecisionAuditShape,
  mapExecutionOutcomeToDecisionEventType,
} from "../../../../services/executionPolicy.js";
import { safeAppendDecisionEvent } from "../../../../db/helpers/decisionEvents.js";
import { applyHandoffActions, persistLeadActions } from "../mutations.js";
import {
  findExistingInboundMessage,
  getInboxThreadState,
  refreshThread,
  upsertInboxThreadState,
} from "../repository.js";
import { logInfo, resolveTenantRow, rollbackAndRelease } from "./shared.js";
import { parseIngestRequest, validateIngestRequest } from "./request.js";
import {
  findOrCreateThreadForIngest,
  insertInboundMessage,
  loadRecentMessages,
} from "./persistence.js";
import { loadStrictInboxRuntime } from "./runtime.js";
import { queueExecutionActions } from "./execution.js";
import { buildThreadStateForDecision } from "./threadState.js";
import {
  buildDuplicateIngestResponse,
  buildIngestSuccessResponse,
  emitIngestRealtime,
} from "./responses.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

function arr(v, d = []) {
  return Array.isArray(v) ? v : d;
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function resolveExecutionProviderForChannel(channel = "") {
  return String(channel || "").trim().toLowerCase() === "telegram"
    ? "telegram"
    : "meta";
}

function buildIngestFailureReasonCode(stage = "", error = null) {
  const explicit =
    s(error?.reasonCode) ||
    s(error?.code) ||
    s(error?.details?.reasonCode) ||
    s(error?.details?.code);

  if (explicit) return explicit;
  if (stage) return `inbox_ingest_${stage}_failed`;
  return "inbox_ingest_failed";
}

function buildIngestFailurePayload({
  stage = "",
  error = null,
  input = null,
  tenantId = "",
  thread = null,
  message = null,
} = {}) {
  const reasonCode = buildIngestFailureReasonCode(stage, error);

  return {
    ok: false,
    error: "Error",
    reasonCode,
    stage: s(stage),
    details: {
      name: s(error?.name || "Error"),
      message: s(error?.message || error || "Unknown inbox ingest error"),
      code: s(error?.code),
      reasonCode,
      stage: s(stage),
      tenantKey: s(input?.tenantKey),
      channel: s(input?.channel),
      externalThreadId: s(input?.externalThreadId),
      externalUserId: s(input?.externalUserId),
      threadId: s(thread?.id),
      messageId: s(message?.id),
      tenantId: s(tenantId),
      stack: s(error?.stack),
    },
    actions: [],
  };
}

function logIngestFailure({
  stage = "",
  error = null,
  input = null,
  tenantId = "",
  thread = null,
  message = null,
} = {}) {
  const payload = buildIngestFailurePayload({
    stage,
    error,
    input,
    tenantId,
    thread,
    message,
  });

  try {
    console.error("[ai-hq] inbox ingest failed", payload.details);
  } catch {}

  return payload;
}

function summarizeRuntimeAuthority(runtime = {}) {
  const authority = obj(runtime?.authority);

  return {
    mode: s(authority.mode),
    required:
      typeof authority.required === "boolean" ? authority.required : null,
    available:
      typeof authority.available === "boolean" ? authority.available : null,
    source: s(authority.source),
    runtimeProjectionId: s(
      authority.runtimeProjectionId || authority.runtime_projection_id
    ),
    runtimeProjectionStatus: s(
      authority.runtimeProjectionStatus || authority.runtime_projection_status
    ),
    projectionHash: s(authority.projectionHash || authority.projection_hash),
    stale: typeof authority.stale === "boolean" ? authority.stale : null,
    readinessLabel: s(authority.readinessLabel || authority.readiness_label),
    readinessScore:
      authority.readinessScore ?? authority.readiness_score ?? null,
    confidenceLabel: s(authority.confidenceLabel || authority.confidence_label),
    confidence: authority.confidence ?? null,
    reasonCode: s(authority.reasonCode || authority.reason_code),
    reason: s(authority.reason),
    healthStatus: s(obj(authority.health).status),
    healthPrimaryReasonCode: s(
      obj(authority.health).primaryReasonCode ||
        obj(authority.health).primary_reason_code ||
        obj(authority.health).reasonCode ||
        obj(authority.health).reason_code
    ),
  };
}

function summarizeExecutionPolicySurface(runtime = {}, surface = "inbox") {
  const executionPolicy = obj(runtime?.executionPolicy);
  const surfaceSummary = obj(executionPolicy?.[surface]);

  return {
    surface: s(surfaceSummary.surface || surface),
    channelType: s(surfaceSummary.channelType),
    lowRiskOutcome: s(surfaceSummary.lowRiskOutcome),
    mediumRiskOutcome: s(surfaceSummary.mediumRiskOutcome),
    highRiskOutcome: s(surfaceSummary.highRiskOutcome),
    blocked: typeof surfaceSummary.blocked === "boolean"
      ? surfaceSummary.blocked
      : null,
    blockedUntilRepair: typeof surfaceSummary.blockedUntilRepair === "boolean"
      ? surfaceSummary.blockedUntilRepair
      : null,
    humanReviewRequired: typeof surfaceSummary.humanReviewRequired === "boolean"
      ? surfaceSummary.humanReviewRequired
      : null,
    handoffRequired: typeof surfaceSummary.handoffRequired === "boolean"
      ? surfaceSummary.handoffRequired
      : null,
    reasonCodes: uniq(surfaceSummary.reasonCodes),
    signals: {
      authorityAvailable:
        surfaceSummary?.signals?.authorityAvailable ?? null,
      projectionHealthStatus: s(
        surfaceSummary?.signals?.projectionHealthStatus
      ),
      truthApprovalOutcome: s(
        surfaceSummary?.signals?.truthApprovalOutcome
      ),
      truthRiskLevel: s(surfaceSummary?.signals?.truthRiskLevel),
      policyControlMode: s(surfaceSummary?.signals?.policyControlMode),
    },
    policyControl: {
      controlMode: s(surfaceSummary?.policyControl?.controlMode),
      policyReason: s(surfaceSummary?.policyControl?.policyReason),
      operatorNote: s(surfaceSummary?.policyControl?.operatorNote),
      changedBy: s(surfaceSummary?.policyControl?.changedBy),
      changedAt: s(surfaceSummary?.policyControl?.changedAt),
    },
  };
}

function summarizePolicyApplication(executionPolicy = {}, actions = []) {
  const summary = obj(executionPolicy?.summary);
  const decisions = arr(executionPolicy?.decisions);
  const filteredActions = arr(executionPolicy?.filteredActions);

  return {
    strictestOutcome: s(summary.strictestOutcome),
    requiredExecutionLevel: s(summary.requiredExecutionLevel),
    allowedActionCount: Number(summary.allowedActionCount || 0),
    filteredActionCount: Number(summary.filteredActionCount || 0),
    humanReviewRequired:
      typeof summary.humanReviewRequired === "boolean"
        ? summary.humanReviewRequired
        : null,
    handoffRequired:
      typeof summary.handoffRequired === "boolean"
        ? summary.handoffRequired
        : null,
    operatorOnly:
      typeof summary.operatorOnly === "boolean" ? summary.operatorOnly : null,
    blocked: typeof summary.blocked === "boolean" ? summary.blocked : null,
    blockedUntilRepair:
      typeof summary.blockedUntilRepair === "boolean"
        ? summary.blockedUntilRepair
        : null,
    reasonCodes: uniq(summary.reasonCodes),
    outcomes: uniq(summary.outcomes),
    policyControlModes: uniq(summary.policyControlModes),
    proposedActionTypes: uniq(arr(actions).map((item) => s(item?.type))),
    filteredActionTypes: uniq(
      filteredActions.map((item) => s(item?.type))
    ),
    decisions: decisions.map((decision) => ({
      outcome: s(decision?.outcome),
      actionType: s(decision?.risk?.actionType),
      intent: s(decision?.risk?.intent),
      riskLevel: s(decision?.risk?.level),
      reasonCodes: uniq(decision?.reasonCodes),
      runtimeAuthorityAvailable:
        decision?.signals?.runtimeAuthorityAvailable ?? null,
      runtimeAuthoritySource: s(decision?.signals?.runtimeAuthoritySource),
      runtimeAuthorityMode: s(decision?.signals?.runtimeAuthorityMode),
      runtimeProjectionId: s(decision?.signals?.runtimeProjectionId),
      projectionHealthStatus: s(decision?.signals?.projectionHealthStatus),
      projectionHealthReasonCode: s(
        decision?.signals?.projectionHealthReasonCode
      ),
      truthApprovalOutcome: s(decision?.signals?.truthApprovalOutcome),
      truthRiskLevel: s(decision?.signals?.truthRiskLevel),
      policyControlMode: s(decision?.signals?.policyControlMode),
    })),
  };
}

export function createInboxIngestHandler({
  db,
  wsHub,
  getRuntime,
  buildActions = buildInboxActions,
  persistLead = persistLeadActions,
  applyHandoff = applyHandoffActions,
}) {
  return async function inboxIngestHandler(req, res) {
    logInfo("inbox-internal hit", {
      path: req.originalUrl || req.url || req.path,
      hasInternalToken: Boolean(req.headers["x-internal-token"]),
    });

    const input = parseIngestRequest(req);
    const validation = validateIngestRequest(input);
    if (!validation.ok) return okJson(res, validation.response);

    let client = null;
    let stage = "start";
    let tenantId = "";
    let thread = null;
    let message = null;

    try {
      stage = "db_ready_check";
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
          actions: [],
        });
      }

      stage = "db_connect";
      client = await db.connect();

      stage = "begin_transaction";
      await client.query("BEGIN");

      stage = "resolve_tenant";
      const tenantRow = await resolveTenantRow(client, input.tenantKey);
      tenantId = String(tenantRow?.id || "").trim();

      if (!tenantId) {
        await rollbackAndRelease(client);
        client = null;

        return okJson(res, {
          ok: false,
          error: "tenant not found",
          details: { tenantKey: input.tenantKey },
          actions: [],
        });
      }

      stage = "find_or_create_thread";
      const threadResult = await findOrCreateThreadForIngest({
        client,
        tenantId,
        tenantKey: input.tenantKey,
        channel: input.channel,
        externalThreadId: input.externalThreadId,
        externalUserId: input.externalUserId,
        externalUsername: input.externalUsername,
        customerName: input.customerName,
        meta: input.meta,
      });

      thread = threadResult.thread;
      const { threadWasCreated } = threadResult;

      if (input.externalMessageId && thread?.id) {
        stage = "find_existing_inbound_message";
        const existingMessage = await findExistingInboundMessage({
          db: client,
          tenantKey: input.tenantKey,
          threadId: thread.id,
          externalMessageId: input.externalMessageId,
        });

        if (existingMessage) {
          stage = "commit_duplicate_existing_message";
          await client.query("COMMIT");
          client.release();
          client = null;

          return okJson(
            res,
            buildDuplicateIngestResponse({
              thread,
              message: existingMessage,
              threadState: await getInboxThreadState(db, thread.id),
            })
          );
        }
      }

      stage = "insert_inbound_message";
      message = await insertInboundMessage({
        client,
        threadId: thread.id,
        tenantKey: input.tenantKey,
        externalMessageId: input.externalMessageId,
        text: input.text,
        meta: input.meta,
        timestamp: input.timestamp,
      });

      if (message?.duplicate) {
        stage = "duplicate_message_after_insert";
        await rollbackAndRelease(client);
        client = null;

        return okJson(
          res,
          buildDuplicateIngestResponse({
            thread: await refreshThread(db, thread.id, thread),
            message,
            threadState: await getInboxThreadState(db, thread.id),
          })
        );
      }

      stage = "load_recent_messages";
      const recentMessages = await loadRecentMessages(client, thread.id);

      stage = "load_prior_thread_state";
      const priorThreadState = await getInboxThreadState(client, thread.id);

      stage = "load_strict_runtime";
      const runtimeState = await loadStrictInboxRuntime({
        client,
        getRuntime,
        tenantKey: input.tenantKey,
        threadState: priorThreadState,
        service: "inbox.ingest",
        channelType: input.channel,
      });

      if (!runtimeState.ok) {
        logInfo("inbox runtime unavailable", {
          tenantKey: input.tenantKey,
          channel: input.channel,
          externalThreadId: input.externalThreadId,
          externalUserId: input.externalUserId,
          runtimeResponse: runtimeState.response,
        });

        await rollbackAndRelease(client);
        client = null;
        return okJson(res, runtimeState.response);
      }

      const { tenant, runtime } = runtimeState;

      logInfo("inbox runtime authority", {
        tenantKey: input.tenantKey,
        channel: input.channel,
        externalThreadId: input.externalThreadId,
        externalUserId: input.externalUserId,
        authority: summarizeRuntimeAuthority(runtime),
      });

      logInfo("inbox runtime execution policy surface", {
        tenantKey: input.tenantKey,
        channel: input.channel,
        externalThreadId: input.externalThreadId,
        externalUserId: input.externalUserId,
        inbox: summarizeExecutionPolicySurface(runtime, "inbox"),
      });

      stage = "build_inbox_actions";
      const brain = await buildActions({
        text: input.text,
        channel: input.channel,
        externalUserId: input.externalUserId,
        tenantKey: input.tenantKey,
        thread,
        message,
        tenant,
        recentMessages,
        customerContext: input.customerContext,
        formData: input.formData,
        leadContext: input.leadContext,
        conversationContext: input.conversationContext,
        tenantContext: {
          ...input.tenantContext,
          runtime,
        },
        services: runtime.serviceCatalog,
        knowledgeEntries: runtime.knowledgeEntries,
        responsePlaybooks: runtime.responsePlaybooks,
        threadState: runtime.threadState || null,
        runtime,
      });

      const proposedActions = Array.isArray(brain?.actions) ? brain.actions : [];

      stage = "apply_execution_policy";
      const executionPolicy = applyExecutionPolicyToActions({
        runtime,
        actions: proposedActions,
        surface: "inbox",
        channelType: input.channel,
        currentState: {
          handoffActive:
            runtime?.threadState?.handoffActive ??
            runtime?.threadState?.handoff_active ??
            thread?.handoff_active,
        },
      });

      logInfo("inbox execution policy decision", {
        tenantKey: input.tenantKey,
        channel: input.channel,
        externalThreadId: input.externalThreadId,
        externalUserId: input.externalUserId,
        policy: summarizePolicyApplication(executionPolicy, proposedActions),
      });

      const actions = executionPolicy.actions.length
        ? executionPolicy.actions
        : executionPolicy.summary.strictestOutcome === "allowed_with_human_review" ||
          executionPolicy.summary.strictestOutcome === "handoff_required" ||
          executionPolicy.summary.strictestOutcome === "operator_only" ||
          executionPolicy.summary.strictestOutcome === "blocked" ||
          executionPolicy.summary.strictestOutcome === "blocked_until_repair"
        ? [
            {
              type: "no_reply",
              reason: `execution_policy_${executionPolicy.summary.strictestOutcome}`,
              meta: {
                executionPolicy: executionPolicy.summary,
              },
            },
          ]
        : [];

      const brainWithPolicy = {
        ...brain,
        proposedActions,
        executionPolicy: executionPolicy.summary,
      };

      stage = "build_decision_audit";
      const decisionAudit = buildExecutionPolicyDecisionAuditShape({
        tenantId: String(tenant?.id || tenantId),
        tenantKey: input.tenantKey,
        source: "inbox.ingest",
        actor: "system",
        surface: "inbox",
        channelType: input.channel,
        runtime,
        summary: executionPolicy.summary,
        actions: proposedActions,
        currentState: {
          handoffActive:
            runtime?.threadState?.handoffActive ??
            runtime?.threadState?.handoff_active ??
            thread?.handoff_active,
        },
      });

      stage = "append_decision_event";
      await safeAppendDecisionEvent(client, {
        ...decisionAudit,
        decisionContext: {
          ...decisionAudit.decisionContext,
          threadId: String(thread?.id || ""),
          messageId: String(message?.id || ""),
          proposedActionCount: proposedActions.length,
          allowedActionCount: executionPolicy.summary.allowedActionCount,
          filteredActionCount: executionPolicy.summary.filteredActionCount,
          proposedActionTypes: proposedActions
            .map((item) => item?.type)
            .filter(Boolean),
          allowedActionTypes: executionPolicy.actions
            .map((item) => item?.type)
            .filter(Boolean),
          filteredActionTypes: executionPolicy.filteredActions
            .map((item) => item?.type)
            .filter(Boolean),
        },
      });

      if (
        executionPolicy.summary.strictestOutcome &&
        mapExecutionOutcomeToDecisionEventType(
          executionPolicy.summary.strictestOutcome
        ) !== "execution_policy_decision"
      ) {
        stage = "append_blocked_decision_event_prepare";
        const blockedDecisionAudit = buildExecutionPolicyDecisionAuditShape({
          tenantId: String(tenant?.id || tenantId),
          tenantKey: input.tenantKey,
          source: "inbox.ingest",
          actor: "system",
          surface: "inbox",
          channelType: input.channel,
          runtime,
          summary: executionPolicy.summary,
          actions: proposedActions,
          currentState: {
            handoffActive:
              runtime?.threadState?.handoffActive ??
              runtime?.threadState?.handoff_active ??
              thread?.handoff_active,
          },
        });

        stage = "append_blocked_decision_event";
        await safeAppendDecisionEvent(client, {
          ...blockedDecisionAudit,
          eventType: mapExecutionOutcomeToDecisionEventType(
            executionPolicy.summary.strictestOutcome
          ),
          decisionContext: {
            ...blockedDecisionAudit.decisionContext,
            threadId: String(thread?.id || ""),
            messageId: String(message?.id || ""),
            blockedActionTypes: executionPolicy.filteredActions
              .map((item) => item?.type)
              .filter(Boolean),
          },
        });
      }

      logInfo("inbox brain result", {
        tenantKey: input.tenantKey,
        intent: brainWithPolicy?.intent || "",
        leadScore: Number(brainWithPolicy?.leadScore || 0),
        actionsCount: actions.length,
        executionPolicyOutcome: executionPolicy.summary.strictestOutcome,
      });

      stage = "persist_lead_actions";
      const leadResults = await persistLead({
        db,
        client,
        wsHub,
        tenantKey: input.tenantKey,
        actions,
      });

      stage = "apply_handoff_actions";
      const handoffResults = await applyHandoff({
        db,
        client,
        wsHub,
        threadId: thread?.id,
        actions,
      });

      stage = "queue_execution_actions";
      const executionResults = await queueExecutionActions({
        client,
        thread,
        tenantId: String(tenant?.id || tenantId),
        tenantKey: input.tenantKey,
        channel: input.channel,
        provider: resolveExecutionProviderForChannel(input.channel),
        actions,
      });

      stage = "refresh_thread";
      const normalizedThread = await refreshThread(client, thread?.id, thread);

      stage = "upsert_thread_state";
      const nextThreadState = await upsertInboxThreadState(
        client,
        buildThreadStateForDecision({
          thread: normalizedThread,
          tenant,
          tenantKey: input.tenantKey,
          priorState: priorThreadState,
          brain: brainWithPolicy,
          actions,
          leadResults,
          handoffResults,
          executionResults,
        })
      );

      stage = "commit_transaction";
      await client.query("COMMIT");
      client.release();
      client = null;

      stage = "emit_realtime";
      emitIngestRealtime({
        wsHub,
        threadWasCreated,
        thread: normalizedThread,
        message,
        executionResults,
        tenantKey: input.tenantKey,
        tenantId: String(tenant?.id || tenantId),
      });

      stage = "build_success_response";
      return okJson(
        res,
        buildIngestSuccessResponse({
          thread: normalizedThread,
          threadState: nextThreadState,
          message,
          tenant,
          brain: brainWithPolicy,
          actions,
          leadResults,
          handoffResults,
          executionResults,
        })
      );
    } catch (error) {
      if (client) await rollbackAndRelease(client);

      return okJson(
        res,
        logIngestFailure({
          stage,
          error,
          input,
          tenantId,
          thread,
          message,
        })
      );
    }
  };
}