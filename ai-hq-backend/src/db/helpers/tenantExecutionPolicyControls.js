function s(v, d = "") {
  return String(v ?? d).trim();
}

function lower(v, d = "") {
  return s(v, d).toLowerCase();
}

function bool(v, d = false) {
  return typeof v === "boolean" ? v : d;
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function normalizeSurface(surface = "") {
  const value = lower(surface || "tenant");
  return ["tenant", "inbox", "comments", "voice", "meta"].includes(value)
    ? value
    : "tenant";
}

function normalizeScopeType(scopeType = "", surface = "") {
  const normalized = lower(scopeType);
  if (normalized === "channel") return "channel";
  return normalizeSurface(surface) === "tenant" ? "tenant_default" : "channel";
}

function deriveStoredMode(control = {}) {
  const source = obj(control);
  if (source.emergency_stop === true) return "emergency_stop";
  if (source.blocked_until_repair === true) return "blocked_until_repair";
  if (source.handoff_required === true) return "handoff_required";
  if (source.operator_only_mode === true) return "operator_only_mode";
  if (source.human_review_required === true) return "human_review_required";
  if (source.handoff_preferred === true) return "handoff_preferred";
  if (source.autonomy_enabled === false) return "operator_only_mode";
  return "autonomy_enabled";
}

export function mapTenantExecutionPolicyControl(row = {}) {
  const meta = obj(row.metadata_json);
  return {
    id: s(row.id),
    tenantId: s(row.tenant_id),
    tenantKey: lower(row.tenant_key),
    scopeType: normalizeScopeType(row.scope_type, row.surface_key),
    surface: normalizeSurface(row.surface_key),
    autonomyEnabled: bool(row.autonomy_enabled, true),
    operatorOnlyMode: bool(row.operator_only_mode),
    humanReviewRequired: bool(row.human_review_required),
    handoffPreferred: bool(row.handoff_preferred),
    handoffRequired: bool(row.handoff_required),
    blockedUntilRepair: bool(row.blocked_until_repair),
    emergencyStop: bool(row.emergency_stop),
    policyReason: s(row.policy_reason),
    operatorNote: s(row.operator_note),
    changedBy: s(row.changed_by),
    changedAt: s(row.changed_at || row.updated_at || row.created_at),
    createdAt: s(row.created_at),
    updatedAt: s(row.updated_at),
    metadata: meta,
    controlMode: deriveStoredMode({
      autonomy_enabled: row.autonomy_enabled,
      operator_only_mode: row.operator_only_mode,
      human_review_required: row.human_review_required,
      handoff_preferred: row.handoff_preferred,
      handoff_required: row.handoff_required,
      blocked_until_repair: row.blocked_until_repair,
      emergency_stop: row.emergency_stop,
    }),
  };
}

export function buildTenantExecutionPolicyControlRecord(input = {}) {
  const surface = normalizeSurface(input.surface);
  const scopeType = normalizeScopeType(input.scopeType, surface);
  return {
    tenantId: s(input.tenantId || input.tenant_id),
    tenantKey: lower(input.tenantKey || input.tenant_key),
    scopeType,
    surface,
    autonomyEnabled:
      typeof input.autonomyEnabled === "boolean"
        ? input.autonomyEnabled
        : typeof input.autonomy_enabled === "boolean"
        ? input.autonomy_enabled
        : true,
    operatorOnlyMode: bool(input.operatorOnlyMode ?? input.operator_only_mode),
    humanReviewRequired: bool(
      input.humanReviewRequired ?? input.human_review_required
    ),
    handoffPreferred: bool(input.handoffPreferred ?? input.handoff_preferred),
    handoffRequired: bool(input.handoffRequired ?? input.handoff_required),
    blockedUntilRepair: bool(
      input.blockedUntilRepair ?? input.blocked_until_repair
    ),
    emergencyStop: bool(input.emergencyStop ?? input.emergency_stop),
    policyReason: s(input.policyReason || input.policy_reason),
    operatorNote: s(input.operatorNote || input.operator_note),
    changedBy: s(input.changedBy || input.changed_by),
    metadata: obj(input.metadata),
  };
}

export function createTenantExecutionPolicyControlHelpers({ db }) {
  if (!db?.query || typeof db.query !== "function") {
    throw new Error(
      "createTenantExecutionPolicyControlHelpers: valid db.query(...) adapter required"
    );
  }

  async function listControls({ tenantId = "", tenantKey = "" } = {}) {
    const result = await db.query(
      `
      select *
      from tenant_execution_policy_controls
      where ($1::text = '' or tenant_id = $1::uuid)
        and ($2::text = '' or lower(tenant_key) = lower($2::text))
      order by
        case when lower(surface_key) = 'tenant' then 0 else 1 end,
        lower(surface_key) asc,
        updated_at desc
      `,
      [s(tenantId), s(tenantKey)]
    );

    return arr(result?.rows).map(mapTenantExecutionPolicyControl);
  }

  async function upsertControl(input = {}) {
    const next = buildTenantExecutionPolicyControlRecord(input);
    const result = await db.query(
      `
      insert into tenant_execution_policy_controls (
        tenant_id,
        tenant_key,
        scope_type,
        surface_key,
        autonomy_enabled,
        operator_only_mode,
        human_review_required,
        handoff_preferred,
        handoff_required,
        blocked_until_repair,
        emergency_stop,
        policy_reason,
        operator_note,
        changed_by,
        changed_at,
        metadata_json
      )
      values (
        $1::uuid,
        $2::text,
        $3::text,
        $4::text,
        $5::boolean,
        $6::boolean,
        $7::boolean,
        $8::boolean,
        $9::boolean,
        $10::boolean,
        $11::boolean,
        $12::text,
        $13::text,
        $14::text,
        now(),
        $15::jsonb
      )
      on conflict (tenant_id, scope_type, surface_key)
      do update set
        tenant_key = excluded.tenant_key,
        autonomy_enabled = excluded.autonomy_enabled,
        operator_only_mode = excluded.operator_only_mode,
        human_review_required = excluded.human_review_required,
        handoff_preferred = excluded.handoff_preferred,
        handoff_required = excluded.handoff_required,
        blocked_until_repair = excluded.blocked_until_repair,
        emergency_stop = excluded.emergency_stop,
        policy_reason = excluded.policy_reason,
        operator_note = excluded.operator_note,
        changed_by = excluded.changed_by,
        changed_at = now(),
        metadata_json = coalesce(tenant_execution_policy_controls.metadata_json, '{}'::jsonb) || excluded.metadata_json,
        updated_at = now()
      returning *
      `,
      [
        next.tenantId,
        next.tenantKey,
        next.scopeType,
        next.surface,
        next.autonomyEnabled,
        next.operatorOnlyMode,
        next.humanReviewRequired,
        next.handoffPreferred,
        next.handoffRequired,
        next.blockedUntilRepair,
        next.emergencyStop,
        next.policyReason,
        next.operatorNote,
        next.changedBy,
        JSON.stringify(next.metadata),
      ]
    );

    return mapTenantExecutionPolicyControl(result?.rows?.[0] || {});
  }

  return {
    listControls,
    upsertControl,
  };
}

export const __test__ = {
  deriveStoredMode,
  normalizeScopeType,
  normalizeSurface,
};

export default createTenantExecutionPolicyControlHelpers;
