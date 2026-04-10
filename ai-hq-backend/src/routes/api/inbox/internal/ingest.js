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

function resolveExecutionProviderForChannel(channel = "") {
  return String(channel || "").trim().toLowerCase() === "telegram"
    ? "telegram"
    : "meta";
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

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: false,
          error: "db disabled",
          dbDisabled: true,
          actions: [],
        });
      }

      client = await db.connect();
      await client.query("BEGIN");

      const tenantRow = await resolveTenantRow(client, input.tenantKey);
      const tenantId = String(tenantRow?.id || "").trim();

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

      const { thread, threadWasCreated } = await findOrCreateThreadForIngest({
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

      if (input.externalMessageId && thread?.id) {
        const existingMessage = await findExistingInboundMessage({
          db: client,
          tenantKey: input.tenantKey,
          threadId: thread.id,
          externalMessageId: input.externalMessageId,
        });

        if (existingMessage) {
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

      const message = await insertInboundMessage({
        client,
        threadId: thread.id,
        tenantKey: input.tenantKey,
        externalMessageId: input.externalMessageId,
        text: input.text,
        meta: input.meta,
        timestamp: input.timestamp,
      });

      if (message?.duplicate) {
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

      const recentMessages = await loadRecentMessages(client, thread.id);
      const priorThreadState = await getInboxThreadState(client, thread.id);

      const runtimeState = await loadStrictInboxRuntime({
        client,
        getRuntime,
        tenantKey: input.tenantKey,
        threadState: priorThreadState,
        service: "inbox.ingest",
        channelType: input.channel,
      });

      if (!runtimeState.ok) {
        await rollbackAndRelease(client);
        client = null;
        return okJson(res, runtimeState.response);
      }

      const { tenant, runtime } = runtimeState;

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

      await safeAppendDecisionEvent(client, {
        ...decisionAudit,
        decisionContext: {
          ...decisionAudit.decisionContext,
          threadId: String(thread?.id || ""),
          messageId: String(message?.id || ""),
          proposedActionCount: proposedActions.length,
          allowedActionCount: executionPolicy.summary.allowedActionCount,
          filteredActionCount: executionPolicy.summary.filteredActionCount,
          proposedActionTypes: proposedActions.map((item) => item?.type).filter(Boolean),
          allowedActionTypes: executionPolicy.actions.map((item) => item?.type).filter(Boolean),
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

      const leadResults = await persistLead({
        db,
        client,
        wsHub,
        tenantKey: input.tenantKey,
        actions,
      });

      const handoffResults = await applyHandoff({
        db,
        client,
        wsHub,
        threadId: thread?.id,
        actions,
      });

      const executionResults = await queueExecutionActions({
        client,
        thread,
        tenantId: String(tenant?.id || tenantId),
        tenantKey: input.tenantKey,
        channel: input.channel,
        provider: resolveExecutionProviderForChannel(input.channel),
        actions,
      });

      const normalizedThread = await refreshThread(client, thread?.id, thread);

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

      await client.query("COMMIT");
      client.release();
      client = null;

      emitIngestRealtime({
        wsHub,
        threadWasCreated,
        thread: normalizedThread,
        message,
        executionResults,
        tenantKey: input.tenantKey,
        tenantId: String(tenant?.id || tenantId),
      });

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

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(error?.message || error) },
        actions: [],
      });
    }
  };
}
