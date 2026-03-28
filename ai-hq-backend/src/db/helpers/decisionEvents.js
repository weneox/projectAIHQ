function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function uniq(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function iso(v) {
  if (!v) return "";
  try {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  } catch {
    return "";
  }
}

function shouldRedactKey(key = "") {
  return /(token|secret|password|authorization|cookie|session|credential)/i.test(
    s(key)
  );
}

function sanitizeValue(value, depth = 0) {
  if (depth > 5 || value == null) return value ?? null;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, next] of Object.entries(value)) {
      if (shouldRedactKey(key)) continue;
      out[key] = sanitizeValue(next, depth + 1);
    }
    return out;
  }
  if (typeof value === "string") {
    return value.length > 2000 ? `${value.slice(0, 1997)}...` : value;
  }
  return value;
}

export const DECISION_EVENT_TYPES = [
  "truth_publication_decision",
  "approval_policy_decision",
  "execution_policy_decision",
  "runtime_health_transition",
  "repair_state_change",
  "policy_control_change",
  "autonomy_posture_change",
  "blocked_action_outcome",
  "handoff_required_action_outcome",
  "review_required_action_outcome",
];

export function mapDecisionEvent(row = {}) {
  return {
    id: s(row.id),
    tenantId: s(row.tenant_id),
    tenantKey: lower(row.tenant_key),
    eventType: lower(row.event_type),
    actor: s(row.actor),
    source: s(row.source),
    surface: lower(row.surface),
    channelType: lower(row.channel_type),
    policyOutcome: lower(row.policy_outcome),
    reasonCodes: uniq(row.reason_codes),
    healthState: obj(row.health_state_json),
    approvalPosture: obj(row.approval_posture_json),
    executionPosture: obj(row.execution_posture_json),
    controlState: obj(row.control_state_json),
    truthVersionId: s(row.truth_version_id),
    runtimeProjectionId: s(row.runtime_projection_id),
    affectedSurfaces: uniq(row.affected_surfaces).map((item) => lower(item)),
    recommendedNextAction: obj(row.recommended_next_action_json),
    decisionContext: obj(row.decision_context_json),
    timestamp: iso(row.event_at || row.created_at),
    createdAt: iso(row.created_at),
  };
}

export function normalizeDecisionEvent(input = {}) {
  const value = obj(input);
  const timestamp = iso(value.timestamp || value.eventAt || value.event_at) || new Date().toISOString();

  return {
    tenantId: s(value.tenantId || value.tenant_id),
    tenantKey: lower(value.tenantKey || value.tenant_key),
    eventType: DECISION_EVENT_TYPES.includes(lower(value.eventType || value.event_type))
      ? lower(value.eventType || value.event_type)
      : "execution_policy_decision",
    actor: s(value.actor || "system"),
    source: s(value.source),
    surface: lower(value.surface),
    channelType: lower(value.channelType || value.channel_type),
    policyOutcome: lower(value.policyOutcome || value.policy_outcome),
    reasonCodes: uniq(value.reasonCodes || value.reason_codes).map((item) => lower(item)),
    healthState: sanitizeValue(obj(value.healthState || value.health_state)),
    approvalPosture: sanitizeValue(
      obj(value.approvalPosture || value.approval_posture)
    ),
    executionPosture: sanitizeValue(
      obj(value.executionPosture || value.execution_posture)
    ),
    controlState: sanitizeValue(obj(value.controlState || value.control_state)),
    truthVersionId: s(value.truthVersionId || value.truth_version_id),
    runtimeProjectionId: s(value.runtimeProjectionId || value.runtime_projection_id),
    affectedSurfaces: uniq(value.affectedSurfaces || value.affected_surfaces).map(
      (item) => lower(item)
    ),
    recommendedNextAction: sanitizeValue(
      obj(value.recommendedNextAction || value.recommended_next_action)
    ),
    decisionContext: sanitizeValue(
      obj(value.decisionContext || value.decision_context)
    ),
    timestamp,
  };
}

export async function appendDecisionEvent(db, input = {}) {
  if (!db?.query || typeof db.query !== "function") {
    throw new Error("appendDecisionEvent: valid db.query adapter required");
  }

  const event = normalizeDecisionEvent(input);
  const result = await db.query(
    `
    insert into tenant_decision_events (
      tenant_id,
      tenant_key,
      event_type,
      actor,
      source,
      surface,
      channel_type,
      policy_outcome,
      reason_codes,
      health_state_json,
      approval_posture_json,
      execution_posture_json,
      control_state_json,
      truth_version_id,
      runtime_projection_id,
      affected_surfaces,
      recommended_next_action_json,
      decision_context_json,
      event_at
    )
    values (
      nullif($1::text, '')::uuid,
      $2::text,
      $3::text,
      $4::text,
      $5::text,
      $6::text,
      $7::text,
      $8::text,
      $9::jsonb,
      $10::jsonb,
      $11::jsonb,
      $12::jsonb,
      $13::jsonb,
      $14::text,
      $15::text,
      $16::jsonb,
      $17::jsonb,
      $18::jsonb,
      $19::timestamptz
    )
    returning *
    `,
    [
      event.tenantId,
      event.tenantKey,
      event.eventType,
      event.actor,
      event.source,
      event.surface,
      event.channelType,
      event.policyOutcome,
      JSON.stringify(event.reasonCodes),
      JSON.stringify(event.healthState),
      JSON.stringify(event.approvalPosture),
      JSON.stringify(event.executionPosture),
      JSON.stringify(event.controlState),
      event.truthVersionId,
      event.runtimeProjectionId,
      JSON.stringify(event.affectedSurfaces),
      JSON.stringify(event.recommendedNextAction),
      JSON.stringify(event.decisionContext),
      event.timestamp,
    ]
  );

  return mapDecisionEvent(result?.rows?.[0] || {});
}

export async function safeAppendDecisionEvent(db, input = {}) {
  try {
    return await appendDecisionEvent(db, input);
  } catch {
    return null;
  }
}

export async function listDecisionEvents(
  db,
  { tenantId = "", tenantKey = "", eventTypes = [], surfaces = [], limit = 25 } = {}
) {
  if (!db?.query || typeof db.query !== "function") {
    throw new Error("listDecisionEvents: valid db.query adapter required");
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 25, 100));
  const result = await db.query(
    `
    select *
    from tenant_decision_events
    where ($1::text = '' or tenant_id = nullif($1::text, '')::uuid)
      and ($2::text = '' or lower(tenant_key) = lower($2::text))
      and (
        cardinality($3::text[]) = 0
        or lower(event_type) = any($3::text[])
      )
      and (
        cardinality($4::text[]) = 0
        or lower(surface) = any($4::text[])
      )
    order by event_at desc, created_at desc
    limit $5::int
    `,
    [
      s(tenantId),
      s(tenantKey),
      uniq(eventTypes).map((item) => lower(item)),
      uniq(surfaces).map((item) => lower(item)),
      safeLimit,
    ]
  );

  return arr(result?.rows).map(mapDecisionEvent);
}

export const __test__ = {
  sanitizeValue,
  shouldRedactKey,
};
