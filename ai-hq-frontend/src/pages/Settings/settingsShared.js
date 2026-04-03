function pad2(n) {
  return String(Number(n || 0)).padStart(2, "0");
}

function clampHour(v, fallback = 10) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(23, n));
}

function clampMinute(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(59, n));
}

export function normalizeTimeString(v, fallback = "10:00") {
  const raw = String(v || "").trim();
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(raw);
  if (!m) return fallback;
  return `${pad2(clampHour(m[1]))}:${pad2(clampMinute(m[2]))}`;
}

export function normalizeAutomationMode(v, fallback = "manual") {
  const x = String(v || fallback).trim().toLowerCase();
  return x === "full_auto" ? "full_auto" : "manual";
}

export function normalizeWorkspace(raw) {
  const tenant = raw?.tenant || {};
  const profile = raw?.profile || {};
  const ai = raw?.aiPolicy || {};
  const entitlements =
    raw?.entitlements && typeof raw.entitlements === "object" && !Array.isArray(raw.entitlements)
      ? raw.entitlements
      : {};
  const publishPolicy =
    ai && typeof ai.publish_policy === "object" && !Array.isArray(ai.publish_policy)
      ? ai.publish_policy
      : {};
  const oldDraftSchedule =
    publishPolicy &&
    typeof publishPolicy.draftSchedule === "object" &&
    !Array.isArray(publishPolicy.draftSchedule)
      ? publishPolicy.draftSchedule
      : {};
  const schedule =
    publishPolicy &&
    typeof publishPolicy.schedule === "object" &&
    !Array.isArray(publishPolicy.schedule)
      ? publishPolicy.schedule
      : {};
  const automation =
    publishPolicy &&
    typeof publishPolicy.automation === "object" &&
    !Array.isArray(publishPolicy.automation)
      ? publishPolicy.automation
      : {};
  const scheduleTime =
    typeof schedule.time === "string" && schedule.time.trim()
      ? normalizeTimeString(schedule.time, "10:00")
      : `${pad2(clampHour(oldDraftSchedule?.hour, 10))}:${pad2(
          clampMinute(oldDraftSchedule?.minute, 0)
        )}`;
  const scheduleTimezone =
    schedule.timezone || oldDraftSchedule?.timezone || tenant?.timezone || "Asia/Baku";
  const automationEnabled =
    typeof automation.enabled === "boolean"
      ? automation.enabled
      : normalizeAutomationMode(automation.mode, "manual") === "full_auto";
  const automationMode = normalizeAutomationMode(
    automation.mode,
    automationEnabled ? "full_auto" : "manual"
  );

  return {
    tenantKey: tenant?.tenant_key || raw?.tenantKey || "neox",
    viewerRole: String(raw?.viewerRole || raw?.role || "owner").trim().toLowerCase(),
    tenant: {
      company_name: tenant?.company_name || "",
      legal_name: tenant?.legal_name || "",
      industry_key: tenant?.industry_key || "generic_business",
      country_code: tenant?.country_code || "AZ",
      timezone: tenant?.timezone || "Asia/Baku",
      default_language: tenant?.default_language || "az",
      enabled_languages: Array.isArray(tenant?.enabled_languages)
        ? tenant.enabled_languages
        : ["az"],
      market_region: tenant?.market_region || "",
      plan_key: tenant?.plan_key || "starter",
      status: tenant?.status || "active",
      active: typeof tenant?.active === "boolean" ? tenant.active : true,
    },
    entitlements: {
      source: entitlements?.source || "managed_plan_key",
      billing:
        entitlements?.billing &&
        typeof entitlements.billing === "object" &&
        !Array.isArray(entitlements.billing)
          ? {
              selfServeAvailable:
                typeof entitlements.billing.selfServeAvailable === "boolean"
                  ? entitlements.billing.selfServeAvailable
                  : false,
              message:
                entitlements.billing.message ||
                "Plan assignment is managed internally. Self-serve billing is not enabled.",
            }
          : {
              selfServeAvailable: false,
              message:
                "Plan assignment is managed internally. Self-serve billing is not enabled.",
            },
      plan:
        entitlements?.plan &&
        typeof entitlements.plan === "object" &&
        !Array.isArray(entitlements.plan)
          ? {
              key: entitlements.plan.key || tenant?.plan_key || "starter",
              normalizedKey:
                entitlements.plan.normalizedKey || tenant?.plan_key || "starter",
              label: entitlements.plan.label || tenant?.plan_key || "starter",
              managed:
                typeof entitlements.plan.managed === "boolean"
                  ? entitlements.plan.managed
                  : true,
            }
          : {
              key: tenant?.plan_key || "starter",
              normalizedKey: tenant?.plan_key || "starter",
              label: tenant?.plan_key || "starter",
              managed: true,
            },
      capabilities:
        entitlements?.capabilities &&
        typeof entitlements.capabilities === "object" &&
        !Array.isArray(entitlements.capabilities)
          ? entitlements.capabilities
          : {},
      summary:
        entitlements?.summary &&
        typeof entitlements.summary === "object" &&
        !Array.isArray(entitlements.summary)
          ? entitlements.summary
          : { included: [], restricted: [], restrictedCount: 0 },
    },
    profile: {
      brand_name: profile?.brand_name || "",
      website_url: profile?.website_url || "",
      public_email: profile?.public_email || "",
      public_phone: profile?.public_phone || "",
      audience_summary: profile?.audience_summary || "",
      services_summary: profile?.services_summary || "",
      value_proposition: profile?.value_proposition || "",
      brand_summary: profile?.brand_summary || "",
      tone_of_voice: profile?.tone_of_voice || "professional",
      preferred_cta: profile?.preferred_cta || "",
      banned_phrases: Array.isArray(profile?.banned_phrases) ? profile.banned_phrases : [],
      communication_rules:
        profile &&
        typeof profile.communication_rules === "object" &&
        !Array.isArray(profile.communication_rules)
          ? profile.communication_rules
          : {},
      visual_style:
        profile &&
        typeof profile.visual_style === "object" &&
        !Array.isArray(profile.visual_style)
          ? profile.visual_style
          : {},
      extra_context:
        profile &&
        typeof profile.extra_context === "object" &&
        !Array.isArray(profile.extra_context)
          ? profile.extra_context
          : {},
    },
    aiPolicy: {
      auto_reply_enabled:
        typeof ai?.auto_reply_enabled === "boolean" ? ai.auto_reply_enabled : true,
      suppress_ai_during_handoff:
        typeof ai?.suppress_ai_during_handoff === "boolean"
          ? ai.suppress_ai_during_handoff
          : true,
      mark_seen_enabled:
        typeof ai?.mark_seen_enabled === "boolean" ? ai.mark_seen_enabled : true,
      typing_indicator_enabled:
        typeof ai?.typing_indicator_enabled === "boolean"
          ? ai.typing_indicator_enabled
          : true,
      create_lead_enabled:
        typeof ai?.create_lead_enabled === "boolean" ? ai.create_lead_enabled : true,
      approval_required_content:
        typeof ai?.approval_required_content === "boolean"
          ? ai.approval_required_content
          : true,
      approval_required_publish:
        typeof ai?.approval_required_publish === "boolean"
          ? ai.approval_required_publish
          : true,
      quiet_hours_enabled:
        typeof ai?.quiet_hours_enabled === "boolean" ? ai.quiet_hours_enabled : false,
      quiet_hours:
        ai && typeof ai.quiet_hours === "object" && !Array.isArray(ai.quiet_hours)
          ? ai.quiet_hours
          : { startHour: 0, endHour: 0 },
      inbox_policy:
        ai && typeof ai.inbox_policy === "object" && !Array.isArray(ai.inbox_policy)
          ? ai.inbox_policy
          : {},
      comment_policy:
        ai && typeof ai.comment_policy === "object" && !Array.isArray(ai.comment_policy)
          ? ai.comment_policy
          : {},
      content_policy:
        ai && typeof ai.content_policy === "object" && !Array.isArray(ai.content_policy)
          ? ai.content_policy
          : {},
      escalation_rules:
        ai && typeof ai.escalation_rules === "object" && !Array.isArray(ai.escalation_rules)
          ? ai.escalation_rules
          : {},
      risk_rules:
        ai && typeof ai.risk_rules === "object" && !Array.isArray(ai.risk_rules)
          ? ai.risk_rules
          : {},
      lead_scoring_rules:
        ai && typeof ai.lead_scoring_rules === "object" && !Array.isArray(ai.lead_scoring_rules)
          ? ai.lead_scoring_rules
          : {},
      publish_policy: {
        ...(publishPolicy || {}),
        schedule: {
          enabled:
            typeof schedule?.enabled === "boolean"
              ? schedule.enabled
              : typeof oldDraftSchedule?.enabled === "boolean"
              ? oldDraftSchedule.enabled
              : false,
          time: scheduleTime,
          timezone: scheduleTimezone,
        },
        automation: {
          enabled: automationEnabled,
          mode: automationMode,
        },
        draftSchedule: {
          enabled:
            typeof schedule?.enabled === "boolean"
              ? schedule.enabled
              : typeof oldDraftSchedule?.enabled === "boolean"
              ? oldDraftSchedule.enabled
              : false,
          hour: clampHour(oldDraftSchedule?.hour, Number(scheduleTime.split(":")[0])),
          minute: clampMinute(oldDraftSchedule?.minute, Number(scheduleTime.split(":")[1])),
          timezone: scheduleTimezone,
          format: oldDraftSchedule?.format || "image",
        },
      },
    },
    governance:
      raw?.governance &&
      typeof raw.governance === "object" &&
      !Array.isArray(raw.governance)
        ? raw.governance
        : {
            directWorkspaceWritesBlocked: true,
            governedSections: ["tenant", "profile"],
            directlyEditableSections: ["aiPolicy"],
            governedFields: {
              tenant: [
                "company_name",
                "legal_name",
                "industry_key",
                "country_code",
                "timezone",
                "default_language",
                "enabled_languages",
                "market_region",
              ],
              profile: [
                "brand_name",
                "website_url",
                "public_email",
                "public_phone",
                "audience_summary",
                "services_summary",
                "value_proposition",
                "brand_summary",
                "tone_of_voice",
                "preferred_cta",
                "banned_phrases",
                "communication_rules",
                "visual_style",
                "extra_context",
              ],
            },
            setupRoute: "/setup",
            truthRoute: "/truth",
          },
    agents: Array.isArray(raw?.agents) ? raw.agents : [],
    businessFacts: Array.isArray(raw?.businessFacts) ? raw.businessFacts : [],
    channelPolicies: Array.isArray(raw?.channelPolicies) ? raw.channelPolicies : [],
    locations: Array.isArray(raw?.locations) ? raw.locations : [],
    contacts: Array.isArray(raw?.contacts) ? raw.contacts : [],
    sources: Array.isArray(raw?.sources) ? raw.sources : [],
    knowledgeReview: Array.isArray(raw?.knowledgeReview) ? raw.knowledgeReview : [],
  };
}

export function buildSafeWorkspaceSavePayload(workspace) {
  const publishPolicy =
    workspace?.aiPolicy &&
    typeof workspace.aiPolicy.publish_policy === "object" &&
    !Array.isArray(workspace.aiPolicy.publish_policy)
      ? workspace.aiPolicy.publish_policy
      : {};
  const schedule =
    publishPolicy &&
    typeof publishPolicy.schedule === "object" &&
    !Array.isArray(publishPolicy.schedule)
      ? publishPolicy.schedule
      : {};
  const automation =
    publishPolicy &&
    typeof publishPolicy.automation === "object" &&
    !Array.isArray(publishPolicy.automation)
      ? publishPolicy.automation
      : {};
  const safeTime = normalizeTimeString(schedule.time, "10:00");
  const safeMode = normalizeAutomationMode(
    automation.mode,
    automation.enabled ? "full_auto" : "manual"
  );
  const safeAutomationEnabled =
    typeof automation.enabled === "boolean" ? automation.enabled : safeMode === "full_auto";

  return {
    aiPolicy: {
      auto_reply_enabled: !!workspace?.aiPolicy?.auto_reply_enabled,
      suppress_ai_during_handoff: !!workspace?.aiPolicy?.suppress_ai_during_handoff,
      mark_seen_enabled: !!workspace?.aiPolicy?.mark_seen_enabled,
      typing_indicator_enabled: !!workspace?.aiPolicy?.typing_indicator_enabled,
      create_lead_enabled: !!workspace?.aiPolicy?.create_lead_enabled,
      approval_required_content: !!workspace?.aiPolicy?.approval_required_content,
      approval_required_publish: !!workspace?.aiPolicy?.approval_required_publish,
      quiet_hours_enabled: !!workspace?.aiPolicy?.quiet_hours_enabled,
      quiet_hours:
        workspace?.aiPolicy &&
        typeof workspace.aiPolicy.quiet_hours === "object" &&
        !Array.isArray(workspace.aiPolicy.quiet_hours)
          ? workspace.aiPolicy.quiet_hours
          : { startHour: 0, endHour: 0 },
      inbox_policy:
        workspace?.aiPolicy &&
        typeof workspace.aiPolicy.inbox_policy === "object" &&
        !Array.isArray(workspace.aiPolicy.inbox_policy)
          ? workspace.aiPolicy.inbox_policy
          : {},
      comment_policy:
        workspace?.aiPolicy &&
        typeof workspace.aiPolicy.comment_policy === "object" &&
        !Array.isArray(workspace.aiPolicy.comment_policy)
          ? workspace.aiPolicy.comment_policy
          : {},
      content_policy:
        workspace?.aiPolicy &&
        typeof workspace.aiPolicy.content_policy === "object" &&
        !Array.isArray(workspace.aiPolicy.content_policy)
          ? workspace.aiPolicy.content_policy
          : {},
      escalation_rules:
        workspace?.aiPolicy &&
        typeof workspace.aiPolicy.escalation_rules === "object" &&
        !Array.isArray(workspace.aiPolicy.escalation_rules)
          ? workspace.aiPolicy.escalation_rules
          : {},
      risk_rules:
        workspace?.aiPolicy &&
        typeof workspace.aiPolicy.risk_rules === "object" &&
        !Array.isArray(workspace.aiPolicy.risk_rules)
          ? workspace.aiPolicy.risk_rules
          : {},
      lead_scoring_rules:
        workspace?.aiPolicy &&
        typeof workspace.aiPolicy.lead_scoring_rules === "object" &&
        !Array.isArray(workspace.aiPolicy.lead_scoring_rules)
          ? workspace.aiPolicy.lead_scoring_rules
          : {},
      publish_policy: {
        ...publishPolicy,
        schedule: {
          enabled: !!schedule.enabled,
          time: safeTime,
          timezone:
            String(schedule.timezone || workspace?.tenant?.timezone || "Asia/Baku").trim() ||
            "Asia/Baku",
        },
        automation: {
          enabled: !!safeAutomationEnabled,
          mode: safeMode,
        },
        draftSchedule: {
          enabled: !!schedule.enabled,
          hour: Number(safeTime.split(":")[0]),
          minute: Number(safeTime.split(":")[1]),
          timezone:
            String(schedule.timezone || workspace?.tenant?.timezone || "Asia/Baku").trim() ||
            "Asia/Baku",
          format:
            publishPolicy &&
            typeof publishPolicy.draftSchedule === "object" &&
            !Array.isArray(publishPolicy.draftSchedule)
              ? publishPolicy.draftSchedule.format || "image"
              : "image",
        },
      },
    },
  };
}

export function createNewBusinessFact() {
  return {
    fact_key: "",
    fact_group: "general",
    title: "",
    value_text: "",
    language: "az",
    priority: 100,
    enabled: true,
    source_type: "manual",
  };
}

export function createNewChannelPolicy() {
  return {
    channel: "instagram",
    subchannel: "default",
    enabled: true,
    auto_reply_enabled: true,
    ai_reply_enabled: true,
    human_handoff_enabled: true,
    pricing_visibility: "inherit",
    public_reply_mode: "inherit",
    contact_capture_mode: "inherit",
    escalation_mode: "inherit",
    reply_style: "",
    max_reply_sentences: 2,
  };
}

export function createNewLocation() {
  return {
    location_key: "",
    title: "",
    country_code: "AZ",
    city: "",
    address_line: "",
    map_url: "",
    phone: "",
    email: "",
    is_primary: false,
    enabled: true,
    sort_order: 0,
  };
}

export function createNewContact() {
  return {
    contact_key: "",
    channel: "phone",
    label: "",
    value: "",
    is_primary: false,
    enabled: true,
    visible_public: true,
    visible_in_ai: true,
    sort_order: 0,
  };
}

export function createNewSource() {
  return {
    source_type: "website",
    source_key: "",
    display_name: "",
    status: "pending",
    auth_status: "not_required",
    sync_status: "idle",
    connection_mode: "manual",
    access_scope: "public",
    source_url: "",
    external_account_id: "",
    external_page_id: "",
    external_username: "",
    is_enabled: true,
    is_primary: false,
    permissions_json: {
      allowProfileRead: true,
      allowFutureSync: true,
      allowBusinessInference: true,
      requireApprovalForCriticalFacts: true,
    },
    settings_json: {},
    metadata_json: {},
  };
}

export function replaceWorkspaceSlice(prev, patch) {
  return {
    ...prev,
    ...patch,
  };
}

export function syncWorkspaceAndInitial({
  setWorkspace,
  setInitialWorkspace,
  patch,
}) {
  setWorkspace((prev) => replaceWorkspaceSlice(prev, patch));
  setInitialWorkspace((prev) => replaceWorkspaceSlice(prev, patch));
}
