import { isDbReady, isUuid } from "../../../../utils/http.js";
import { s } from "../shared.js";
import { normalizeInboxThreadState, normalizeJsonObject } from "./shared.js";

export async function getInboxThreadState(db, threadId) {
  if (!isDbReady(db)) return null;
  if (!threadId || !isUuid(threadId)) return null;

  try {
    const result = await db.query(
      `
      select
        thread_id, tenant_id, tenant_key, last_customer_intent, last_customer_service_key,
        last_ai_intent, last_ai_service_key, last_ai_reply_hash, last_ai_reply_text,
        last_ai_cta_type, last_response_mode, contact_requested_at, contact_shared_at,
        pricing_explained_at, lead_created_at, handoff_announced_at, handoff_message_id,
        suppressed_until_operator_reply, repeat_intent_count, repeat_service_count,
        awaiting_customer_answer_to, last_decision_meta, created_at, updated_at
      from inbox_thread_state
      where thread_id = $1::uuid
      limit 1
      `,
      [threadId]
    );

    return normalizeInboxThreadState(result.rows?.[0] || null);
  } catch {
    return null;
  }
}

export async function upsertInboxThreadState(db, input = {}) {
  if (!isDbReady(db)) return null;

  const threadId = s(input.thread_id || input.threadId);
  if (!threadId || !isUuid(threadId)) return null;

  const tenantId = s(input.tenant_id || input.tenantId);
  const tenantKey = s(input.tenant_key || input.tenantKey);
  const handoffMessageId = s(input.handoff_message_id || input.handoffMessageId);
  const repeatIntentCount = Number.isFinite(Number(input.repeat_intent_count))
    ? Number(input.repeat_intent_count)
    : Number.isFinite(Number(input.repeatIntentCount))
      ? Number(input.repeatIntentCount)
      : 0;
  const repeatServiceCount = Number.isFinite(Number(input.repeat_service_count))
    ? Number(input.repeat_service_count)
    : Number.isFinite(Number(input.repeatServiceCount))
      ? Number(input.repeatServiceCount)
      : 0;
  const lastDecisionMeta = normalizeJsonObject(
    input.last_decision_meta || input.lastDecisionMeta
  );

  try {
    const result = await db.query(
      `
      insert into inbox_thread_state (
        thread_id, tenant_id, tenant_key, last_customer_intent, last_customer_service_key,
        last_ai_intent, last_ai_service_key, last_ai_reply_hash, last_ai_reply_text,
        last_ai_cta_type, last_response_mode, contact_requested_at, contact_shared_at,
        pricing_explained_at, lead_created_at, handoff_announced_at, handoff_message_id,
        suppressed_until_operator_reply, repeat_intent_count, repeat_service_count,
        awaiting_customer_answer_to, last_decision_meta
      )
      values (
        $1::uuid, nullif($2::text, '')::uuid, $3::text, nullif($4::text, ''), nullif($5::text, ''),
        nullif($6::text, ''), nullif($7::text, ''), nullif($8::text, ''), nullif($9::text, ''),
        nullif($10::text, ''), nullif($11::text, ''), $12::timestamptz, $13::timestamptz, $14::timestamptz,
        $15::timestamptz, $16::timestamptz, nullif($17::text, '')::uuid, $18::boolean, $19::int, $20::int,
        nullif($21::text, ''), $22::jsonb
      )
      on conflict (thread_id) do update
      set
        tenant_id = coalesce(excluded.tenant_id, inbox_thread_state.tenant_id),
        tenant_key = coalesce(nullif(excluded.tenant_key, ''), inbox_thread_state.tenant_key),
        last_customer_intent = coalesce(excluded.last_customer_intent, inbox_thread_state.last_customer_intent),
        last_customer_service_key = coalesce(excluded.last_customer_service_key, inbox_thread_state.last_customer_service_key),
        last_ai_intent = coalesce(excluded.last_ai_intent, inbox_thread_state.last_ai_intent),
        last_ai_service_key = coalesce(excluded.last_ai_service_key, inbox_thread_state.last_ai_service_key),
        last_ai_reply_hash = coalesce(excluded.last_ai_reply_hash, inbox_thread_state.last_ai_reply_hash),
        last_ai_reply_text = coalesce(excluded.last_ai_reply_text, inbox_thread_state.last_ai_reply_text),
        last_ai_cta_type = coalesce(excluded.last_ai_cta_type, inbox_thread_state.last_ai_cta_type),
        last_response_mode = coalesce(excluded.last_response_mode, inbox_thread_state.last_response_mode),
        contact_requested_at = coalesce(excluded.contact_requested_at, inbox_thread_state.contact_requested_at),
        contact_shared_at = coalesce(excluded.contact_shared_at, inbox_thread_state.contact_shared_at),
        pricing_explained_at = coalesce(excluded.pricing_explained_at, inbox_thread_state.pricing_explained_at),
        lead_created_at = coalesce(excluded.lead_created_at, inbox_thread_state.lead_created_at),
        handoff_announced_at = coalesce(excluded.handoff_announced_at, inbox_thread_state.handoff_announced_at),
        handoff_message_id = coalesce(excluded.handoff_message_id, inbox_thread_state.handoff_message_id),
        suppressed_until_operator_reply = excluded.suppressed_until_operator_reply,
        repeat_intent_count = excluded.repeat_intent_count,
        repeat_service_count = excluded.repeat_service_count,
        awaiting_customer_answer_to = coalesce(excluded.awaiting_customer_answer_to, inbox_thread_state.awaiting_customer_answer_to),
        last_decision_meta = coalesce(inbox_thread_state.last_decision_meta, '{}'::jsonb) || coalesce(excluded.last_decision_meta, '{}'::jsonb),
        updated_at = now()
      returning
        thread_id, tenant_id, tenant_key, last_customer_intent, last_customer_service_key,
        last_ai_intent, last_ai_service_key, last_ai_reply_hash, last_ai_reply_text,
        last_ai_cta_type, last_response_mode, contact_requested_at, contact_shared_at,
        pricing_explained_at, lead_created_at, handoff_announced_at, handoff_message_id,
        suppressed_until_operator_reply, repeat_intent_count, repeat_service_count,
        awaiting_customer_answer_to, last_decision_meta, created_at, updated_at
      `,
      [
        threadId,
        tenantId || null,
        tenantKey || "",
        s(input.last_customer_intent || input.lastCustomerIntent),
        s(input.last_customer_service_key || input.lastCustomerServiceKey),
        s(input.last_ai_intent || input.lastAiIntent),
        s(input.last_ai_service_key || input.lastAiServiceKey),
        s(input.last_ai_reply_hash || input.lastAiReplyHash),
        s(input.last_ai_reply_text || input.lastAiReplyText),
        s(input.last_ai_cta_type || input.lastAiCtaType),
        s(input.last_response_mode || input.lastResponseMode),
        input.contact_requested_at || input.contactRequestedAt || null,
        input.contact_shared_at || input.contactSharedAt || null,
        input.pricing_explained_at || input.pricingExplainedAt || null,
        input.lead_created_at || input.leadCreatedAt || null,
        input.handoff_announced_at || input.handoffAnnouncedAt || null,
        handoffMessageId || null,
        Boolean(
          input.suppressed_until_operator_reply || input.suppressedUntilOperatorReply
        ),
        repeatIntentCount,
        repeatServiceCount,
        s(input.awaiting_customer_answer_to || input.awaitingCustomerAnswerTo),
        JSON.stringify(lastDecisionMeta),
      ]
    );

    return normalizeInboxThreadState(result.rows?.[0] || null);
  } catch {
    return null;
  }
}
