import { okJson, isDbReady } from "../../../../utils/http.js";
import { buildInboxActions } from "../../../../services/inboxBrain.js";
import { emitRuntimeProjectionBlockedConsumer } from "../../../../services/runtimeProjectionObservability.js";
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
  applyInboxExecutionPolicyGate,
  buildExecutionPolicyFilteredDecisionEvent,
  buildTenantManualModeBrain,
  buildTenantManualModeDecisionEvent,
  isAutonomousTenantMode,
  resolveTenantAutonomyMode,
} from "./autonomyGates.js";
import {
  buildDuplicateIngestResponse,
  buildIngestSuccessResponse,
  emitInboundAcceptedRealtime,
  emitIngestRealtime,
  emitTypingRealtime,
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

function summarizeBrainDecision(brain = {}) {
  const reply = obj(brain?.reply);
  const control = obj(brain?.control);
  const diagnostics = obj(brain?.diagnostics);

  return {
    intent: s(brain?.intent || control?.intent || "general"),
    leadScore: Number(brain?.leadScore || control?.leadScore || 0),
    reply: {
      shouldReply: Boolean(reply?.shouldReply),
      mode: s(reply?.mode),
      reasonCode: s(reply?.reasonCode),
      language: s(reply?.language),
      confidence:
        typeof reply?.confidence === "number" ? reply.confidence : null,
      usedRecovery: Boolean(reply?.usedRecovery),
      textPreview: s(reply?.text).slice(0, 220),
    },
    control: {
      explicitHumanRequest: Boolean(control?.explicitHumanRequest),
      shouldCreateLead: Boolean(control?.shouldCreateLead),
      shouldStartHandoff: Boolean(control?.shouldStartHandoff),
      shouldMarkSeen: Boolean(control?.shouldMarkSeen),
      shouldTyping: Boolean(control?.shouldTyping),
      shouldSendMessage: Boolean(control?.shouldSendMessage),
      shouldNoReply: Boolean(control?.shouldNoReply),
      handoffReason: s(control?.handoffReason),
      handoffPriority: s(control?.handoffPriority),
      askCategory: s(control?.askCategory),
      stage: s(control?.stage),
    },
    diagnostics: {
      explicitNeed: Boolean(diagnostics?.explicitNeed),
      inferredNeedCategory: s(diagnostics?.inferredNeedCategory),
      genericClarifierDetected: Boolean(
        diagnostics?.genericClarifierDetected
      ),
      usedRecovery: Boolean(diagnostics?.usedRecovery),
      quietHoursApplied: Boolean(diagnostics?.quietHoursApplied),
      noReplyReason: s(diagnostics?.noReplyReason),
      operatorRecentlyReplied: Boolean(
        diagnostics?.operatorRecentlyReplied
      ),
    },
  };
}

function mapBrainOutcomeToDecisionEventType(brain = {}) {
  const reply = obj(brain?.reply);
  const control = obj(brain?.control);
  const diagnostics = obj(brain?.diagnostics);
  const noReplyReason = lower(
    diagnostics?.noReplyReason || reply?.reasonCode || ""
  );

  if (control?.shouldStartHandoff) {
    return "handoff_required_action_outcome";
  }

  if (
    [
      "channel_not_allowed",
      "quiet_hours",
      "auto_reply_disabled",
      "human_request_waiting_for_operator",
      "handoff_active_operator_recently_replied",
    ].includes(noReplyReason)
  ) {
    return "blocked_action_outcome";
  }

  return "execution_policy_decision";
}

function buildDecisionEventFromBrain({
  brain = {},
  tenantId = "",
  tenantKey = "",
  channel = "",
  thread = null,
  message = null,
} = {}) {
  const runtime = obj(brain?.runtime);
  const reply = obj(brain?.reply);
  const control = obj(brain?.control);
  const diagnostics = obj(brain?.diagnostics);
  const authority = summarizeRuntimeAuthority(runtime);

  const reasonCodes = uniq([
    reply?.reasonCode,
    diagnostics?.noReplyReason,
    control?.handoffReason,
    authority?.reasonCode,
    diagnostics?.inferredNeedCategory,
  ].filter(Boolean));

  const policyOutcome = control?.shouldStartHandoff
    ? "handoff_required"
    : control?.shouldSendMessage
      ? "reply_generated"
      : "no_reply";

  const recommendedNextAction = control?.shouldStartHandoff
    ? {
        type: "operator_handoff",
        reason: s(control?.handoffReason || "manual_review"),
        priority: s(control?.handoffPriority || "normal"),
      }
    : !control?.shouldSendMessage && control?.shouldNoReply
      ? {
          type: "no_reply",
          reason: s(diagnostics?.noReplyReason || reply?.reasonCode),
        }
      : control?.shouldCreateLead
        ? {
            type: "create_lead",
          }
        : {};

  return {
    tenantId: s(tenantId),
    tenantKey: s(tenantKey),
    eventType: mapBrainOutcomeToDecisionEventType(brain),
    actor: "system",
    source: "inbox.ingest",
    surface: "inbox",
    channelType: s(channel),
    policyOutcome,
    reasonCodes,
    healthState: {
      runtimeAuthority: authority,
    },
    approvalPosture: {
      runtimeSource: s(authority.source),
      runtimeAvailable: authority.available === true,
      runtimeStale: authority.stale === true,
      runtimeReasonCode: s(authority.reasonCode),
    },
    executionPosture: {
      reply: {
        shouldReply: Boolean(reply?.shouldReply),
        mode: s(reply?.mode),
        reasonCode: s(reply?.reasonCode),
        usedRecovery: Boolean(reply?.usedRecovery),
      },
      actions: {
        shouldCreateLead: Boolean(control?.shouldCreateLead),
        shouldStartHandoff: Boolean(control?.shouldStartHandoff),
        shouldMarkSeen: Boolean(control?.shouldMarkSeen),
        shouldTyping: Boolean(control?.shouldTyping),
        shouldSendMessage: Boolean(control?.shouldSendMessage),
        shouldNoReply: Boolean(control?.shouldNoReply),
      },
    },
    controlState: {
      explicitHumanRequest: Boolean(control?.explicitHumanRequest),
      handoffReason: s(control?.handoffReason),
      handoffPriority: s(control?.handoffPriority),
      askCategory: s(control?.askCategory),
      stage: s(control?.stage),
      diagnostics: {
        explicitNeed: Boolean(diagnostics?.explicitNeed),
        genericClarifierDetected: Boolean(
          diagnostics?.genericClarifierDetected
        ),
        inferredNeedCategory: s(diagnostics?.inferredNeedCategory),
        quietHoursApplied: Boolean(diagnostics?.quietHoursApplied),
        noReplyReason: s(diagnostics?.noReplyReason),
      },
    },
    runtimeProjectionId: s(authority.runtimeProjectionId),
    affectedSurfaces: ["inbox"],
    recommendedNextAction,
    decisionContext: {
      threadId: s(thread?.id),
      messageId: s(message?.id),
      intent: s(brain?.intent || control?.intent || "general"),
      leadScore: Number(brain?.leadScore || control?.leadScore || 0),
      actionTypes: arr(brain?.actions)
        .map((item) => s(item?.type))
        .filter(Boolean),
      textPreview: s(reply?.text).slice(0, 220),
    },
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

      stage = "commit_inbound_message";
      await client.query("COMMIT");
      client.release();
      client = null;

      stage = "refresh_committed_inbound_thread";
      thread = await refreshThread(db, thread.id, thread);

      stage = "emit_inbound_accepted_realtime";
      emitInboundAcceptedRealtime({
        wsHub,
        threadWasCreated,
        thread,
        message,
        tenantKey: input.tenantKey,
        tenantId,
      });

      emitTypingRealtime({
        wsHub,
        tenantKey: input.tenantKey,
        tenantId,
        threadId: thread?.id,
        actor: "business",
        active: true,
        reason: "ai_reply_preparing",
        ttlMs: 12000,
      });

      stage = "begin_decision_transaction";
      client = await db.connect();
      await client.query("BEGIN");

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
        emitRuntimeProjectionBlockedConsumer({
          consumer: "inbox",
          tenantKey: s(input.tenantKey),
          authority: obj(runtimeState?.response?.details?.authority),
          requestId: s(req?.requestId),
          correlationId: s(req?.correlationId),
          externalThreadId: s(input.externalThreadId),
          externalMessageId: s(input.externalMessageId),
        });

        logInfo("inbox runtime unavailable", {
          tenantKey: input.tenantKey,
          channel: input.channel,
          externalThreadId: input.externalThreadId,
          externalUserId: input.externalUserId,
          runtimeResponse: runtimeState.response,
        });

        emitTypingRealtime({
          wsHub,
          tenantKey: input.tenantKey,
          tenantId,
          threadId: thread?.id,
          actor: "business",
          active: false,
          reason: "runtime_unavailable",
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

      stage = "resolve_tenant_autonomy_mode";
      const autonomyMode = await resolveTenantAutonomyMode({
        db: client,
        tenantKey: input.tenantKey,
      });

      if (!isAutonomousTenantMode(autonomyMode.mode)) {
        const manualReasonCode = autonomyMode.defaulted
          ? autonomyMode.reasonCode
          : "tenant_mode_manual";

        const manualBrain = buildTenantManualModeBrain({
          runtime,
          tenantKey: input.tenantKey,
          tenantMode: autonomyMode.mode,
          reasonCode: manualReasonCode,
        });
        const manualActions = Array.isArray(manualBrain?.actions)
          ? manualBrain.actions
          : [];
        const manualExecutionPolicy = manualBrain.executionPolicy || null;

        stage = "append_manual_mode_decision_event";
        await safeAppendDecisionEvent(
          client,
          buildTenantManualModeDecisionEvent({
            tenantId: String(tenant?.id || tenantId),
            tenantKey: input.tenantKey,
            channel: input.channel,
            thread,
            message,
            runtime,
            tenantMode: autonomyMode.mode,
            reasonCode: manualReasonCode,
          })
        );

        stage = "refresh_manual_mode_thread";
        const manualThread = await refreshThread(client, thread?.id, thread);

        stage = "upsert_manual_mode_thread_state";
        const manualThreadState = await upsertInboxThreadState(
          client,
          buildThreadStateForDecision({
            thread: manualThread,
            tenant,
            tenantKey: input.tenantKey,
            priorState: priorThreadState,
            brain: manualBrain,
            actions: manualActions,
            leadResults: [],
            handoffResults: [],
            executionResults: [],
          })
        );

        stage = "commit_manual_mode_transaction";
        await client.query("COMMIT");
        client.release();
        client = null;

        stage = "emit_manual_mode_realtime";
        emitIngestRealtime({
          wsHub,
          threadWasCreated,
          thread: manualThread,
          message,
          executionResults: [],
          tenantKey: input.tenantKey,
          tenantId: String(tenant?.id || tenantId),
        });

        emitTypingRealtime({
          wsHub,
          tenantKey: input.tenantKey,
          tenantId: String(tenant?.id || tenantId),
          threadId: manualThread?.id || thread?.id,
          actor: "business",
          active: false,
          reason: manualReasonCode,
        });

        stage = "build_manual_mode_success_response";
        return okJson(
          res,
          buildIngestSuccessResponse({
            thread: manualThread,
            threadState: manualThreadState,
            message,
            tenant,
            brain: manualBrain,
            executionPolicy: manualExecutionPolicy,
            actions: manualActions,
            leadResults: [],
            handoffResults: [],
            executionResults: [],
          })
        );
      }

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

      const rawActions = Array.isArray(brain?.actions) ? brain.actions : [];

      stage = "apply_inbox_execution_policy";
      const executionPolicy = applyInboxExecutionPolicyGate({
        runtime,
        actions: rawActions,
        thread,
        channel: input.channel,
      });
      const actions = Array.isArray(executionPolicy?.actions)
        ? executionPolicy.actions
        : [];

      brain.actions = actions;
      brain.executionPolicy = executionPolicy;

      logInfo("inbox realtime/control decision", {
        tenantKey: input.tenantKey,
        channel: input.channel,
        externalThreadId: input.externalThreadId,
        externalUserId: input.externalUserId,
        brain: summarizeBrainDecision(brain),
        actionTypes: actions.map((item) => s(item?.type)).filter(Boolean),
      });

      stage = "append_decision_event";
      await safeAppendDecisionEvent(
        client,
        buildDecisionEventFromBrain({
          brain,
          tenantId: String(tenant?.id || tenantId),
          tenantKey: input.tenantKey,
          channel: input.channel,
          thread,
          message,
        })
      );

      if (Number(executionPolicy?.summary?.filteredActionCount || 0) > 0) {
        stage = "append_execution_policy_filtered_decision_event";
        await safeAppendDecisionEvent(
          client,
          buildExecutionPolicyFilteredDecisionEvent({
            tenantId: String(tenant?.id || tenantId),
            tenantKey: input.tenantKey,
            channel: input.channel,
            thread,
            message,
            runtime,
            executionPolicy,
          })
        );
      }

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
          brain,
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

      emitTypingRealtime({
        wsHub,
        tenantKey: input.tenantKey,
        tenantId: String(tenant?.id || tenantId),
        threadId: normalizedThread?.id || thread?.id,
        actor: "business",
        active: false,
        reason: "ai_reply_complete",
      });

      stage = "build_success_response";
      return okJson(
        res,
        buildIngestSuccessResponse({
          thread: normalizedThread,
          threadState: nextThreadState,
          message,
          tenant,
          brain,
          executionPolicy,
          actions,
          leadResults,
          handoffResults,
          executionResults,
        })
      );
    } catch (error) {
      try {
        emitTypingRealtime({
          wsHub,
          tenantKey: input?.tenantKey,
          tenantId,
          threadId: thread?.id,
          actor: "business",
          active: false,
          reason: `ingest_failed:${stage}`,
        });
      } catch {}

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

export const __test__ = {
  summarizeRuntimeAuthority,
  summarizeBrainDecision,
  mapBrainOutcomeToDecisionEventType,
  buildDecisionEventFromBrain,
};


