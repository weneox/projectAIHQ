const DESIGN_TENANT_KEY = "local-dev";
const DESIGN_TENANT_ID = "tenant_local_dev";
const DESIGN_USER_ID = "user_local_operator";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function stripBase(path = "") {
  const raw = s(path);
  if (!raw) return "/";

  try {
    const url = new URL(raw, "http://local.design");
    return `${url.pathname}${url.search || ""}`;
  } catch {
    return raw;
  }
}

function cleanPath(path = "") {
  return stripBase(path).split("?")[0].replace(/\/+$/, "") || "/";
}

function delay(ms = 80) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function isAppDesignModeEnabled() {
  const env = import.meta.env || {};
  const flag = lower(env.VITE_APP_DESIGN_MODE || env.VITE_DESIGN_MODE || "");

  return Boolean(env.DEV) && ["1", "true", "yes", "on"].includes(flag);
}

export function getDesignTenantKey() {
  const env = import.meta.env || {};

  return lower(
    env.VITE_DESIGN_TENANT_KEY ||
      env.VITE_DEV_TENANT_KEY ||
      env.VITE_TENANT_KEY ||
      DESIGN_TENANT_KEY
  );
}

export function getDesignWorkspaceName() {
  const env = import.meta.env || {};

  return s(
    env.VITE_DESIGN_WORKSPACE_NAME ||
      env.VITE_WORKSPACE_NAME ||
      "NEOX Design Workspace"
  );
}

function buildDesignUser() {
  return {
    id: DESIGN_USER_ID,
    userId: DESIGN_USER_ID,
    email: "operator@local.design",
    user_email: "operator@local.design",
    fullName: "operator",
    full_name: "operator",
    displayName: "operator",
    display_name: "operator",
    name: "operator",
    role: "operator",
    tenantId: DESIGN_TENANT_ID,
    tenant_id: DESIGN_TENANT_ID,
    tenantKey: getDesignTenantKey(),
    tenant_key: getDesignTenantKey(),
  };
}

function buildDesignTenant() {
  return {
    id: DESIGN_TENANT_ID,
    tenantId: DESIGN_TENANT_ID,
    tenant_id: DESIGN_TENANT_ID,
    key: getDesignTenantKey(),
    tenantKey: getDesignTenantKey(),
    tenant_key: getDesignTenantKey(),
    name: getDesignWorkspaceName(),
    companyName: getDesignWorkspaceName(),
    company_name: getDesignWorkspaceName(),
    displayName: getDesignWorkspaceName(),
    display_name: getDesignWorkspaceName(),
  };
}

function buildDesignWorkspace() {
  return {
    id: DESIGN_TENANT_ID,
    tenantId: DESIGN_TENANT_ID,
    tenant_id: DESIGN_TENANT_ID,
    tenantKey: getDesignTenantKey(),
    tenant_key: getDesignTenantKey(),
    workspaceKey: getDesignTenantKey(),
    workspace_key: getDesignTenantKey(),
    companyName: getDesignWorkspaceName(),
    company_name: getDesignWorkspaceName(),
    workspaceName: getDesignWorkspaceName(),
    workspace_name: getDesignWorkspaceName(),
    displayName: getDesignWorkspaceName(),
    display_name: getDesignWorkspaceName(),
    role: "operator",
    workspaceReady: true,
    setupCompleted: true,
    setupRequired: false,
    active: true,
    readinessScore: 100,
    readinessLabel: "Design ready",
    nextRoute: "/home",
    nextSetupRoute: "/home?assistant=setup",
  };
}

function buildAuthMe() {
  const user = buildDesignUser();
  const tenant = buildDesignTenant();
  const workspace = buildDesignWorkspace();

  return {
    ok: true,
    authenticated: true,
    resolved: true,
    unavailable: false,
    transientFailure: false,
    reason: "",
    error: "",
    user,
    tenant,
    identity: user,
    membership: {
      id: "membership_local_operator",
      role: "operator",
      tenantId: DESIGN_TENANT_ID,
      tenantKey: getDesignTenantKey(),
      workspaceName: getDesignWorkspaceName(),
      active: true,
    },
    workspace,
    workspaces: [workspace],
    destination: {
      path: "/home",
    },
    runtime: {
      designMode: true,
    },
  };
}


function daysAgo(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days || 0));
  return date.toISOString();
}

function buildDesignTeam() {
  const users = [
    {
      id: "user_local_owner",
      user_id: "user_local_owner",
      user_email: "emil@weneox.com",
      email: "emil@weneox.com",
      full_name: "Emil Bagirov",
      fullName: "Emil Bagirov",
      name: "Emil Bagirov",
      display_name: "Emil Bagirov",
      displayName: "Emil Bagirov",
      role: "owner",
      status: "active",
      created_at: daysAgo(42),
      createdAt: daysAgo(42),
      updated_at: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "user_local_admin",
      user_id: "user_local_admin",
      user_email: "ops@weneox.com",
      email: "ops@weneox.com",
      full_name: "Nigar Aliyeva",
      fullName: "Nigar Aliyeva",
      name: "Nigar Aliyeva",
      display_name: "Nigar Aliyeva",
      displayName: "Nigar Aliyeva",
      role: "admin",
      status: "active",
      created_at: daysAgo(31),
      createdAt: daysAgo(31),
      updated_at: daysAgo(1),
      updatedAt: daysAgo(1),
    },
    {
      id: "user_local_operator",
      user_id: "user_local_operator",
      user_email: "operator@local.design",
      email: "operator@local.design",
      full_name: "AI Operator",
      fullName: "AI Operator",
      name: "AI Operator",
      display_name: "AI Operator",
      displayName: "AI Operator",
      role: "operator",
      status: "active",
      created_at: daysAgo(18),
      createdAt: daysAgo(18),
      updated_at: nowIso(),
      updatedAt: nowIso(),
    },
    {
      id: "user_local_support",
      user_id: "user_local_support",
      user_email: "support@weneox.com",
      email: "support@weneox.com",
      full_name: "Support Agent",
      fullName: "Support Agent",
      name: "Support Agent",
      display_name: "Support Agent",
      displayName: "Support Agent",
      role: "operator",
      status: "invited",
      created_at: daysAgo(5),
      createdAt: daysAgo(5),
      updated_at: daysAgo(5),
      updatedAt: daysAgo(5),
    },
    {
      id: "user_local_automation",
      user_id: "user_local_automation",
      user_email: "automation@weneox.com",
      email: "automation@weneox.com",
      full_name: "Automation Lead",
      fullName: "Automation Lead",
      name: "Automation Lead",
      display_name: "Automation Lead",
      displayName: "Automation Lead",
      role: "admin",
      status: "disabled",
      created_at: daysAgo(12),
      createdAt: daysAgo(12),
      updated_at: daysAgo(2),
      updatedAt: daysAgo(2),
    },
  ];

  return {
    ok: true,
    designMode: true,
    tenantId: DESIGN_TENANT_ID,
    tenant_id: DESIGN_TENANT_ID,
    tenantKey: getDesignTenantKey(),
    tenant_key: getDesignTenantKey(),
    viewerRole: "owner",
    viewer_role: "owner",
    count: users.length,
    users,
  };
}

function buildDesignTeamCreate(body = {}) {
  const email = s(body?.user_email || body?.email || "new.member@local.design").toLowerCase();
  const fullName = s(body?.full_name || body?.fullName || body?.name || email.split("@")[0] || "New member");
  const role = lower(body?.role || "operator");
  const status = lower(body?.status || "active");

  return {
    ok: true,
    designMode: true,
    created: true,
    user: {
      id: `user_local_${Date.now()}`,
      user_id: `user_local_${Date.now()}`,
      user_email: email,
      email,
      full_name: fullName,
      fullName,
      name: fullName,
      display_name: fullName,
      displayName: fullName,
      role,
      status,
      created_at: nowIso(),
      createdAt: nowIso(),
      updated_at: nowIso(),
      updatedAt: nowIso(),
    },
  };
}

function buildDesignTeamStatus(path = "", body = {}) {
  const match = cleanPath(path).match(/\/api\/team\/([^/]+)\/status$/);
  const id = match ? decodeURIComponent(match[1]) : "user_local_operator";
  const status = lower(body?.status || "active");

  return {
    ok: true,
    designMode: true,
    updated: true,
    user: {
      id,
      user_id: id,
      status,
      updated_at: nowIso(),
      updatedAt: nowIso(),
    },
  };
}

function buildBootstrap() {
  const user = buildDesignUser();
  const tenant = buildDesignTenant();
  const workspace = buildDesignWorkspace();

  return {
    ok: true,
    designMode: true,
    tenant,
    tenantKey: getDesignTenantKey(),
    tenantId: DESIGN_TENANT_ID,
    workspace,
    viewer: user,
    viewerRole: "operator",
    user,
    membership: {
      id: "membership_local_operator",
      role: "operator",
      tenantId: DESIGN_TENANT_ID,
      tenantKey: getDesignTenantKey(),
      workspaceName: getDesignWorkspaceName(),
      active: true,
    },
    destination: {
      path: "/home",
    },
  };
}

const designThreads = [
  {
    id: "thread_design_1",
    external_thread_id: "dm_design_1",
    customer_name: "Aylin Məmmədova",
    external_username: "aylin.design",
    external_user_id: "u_design_1",
    channel_type: "instagram",
    channel_label: "Instagram",
    provider: "meta",
    source_type: "instagram",
    status: "open",
    unread_count: 2,
    assigned_to: "",
    handoff_active: true,
    priority: "high",
    last_message_text: "Salam, xidmətlər və qiymətlər barədə məlumat ala bilərəm?",
    last_message_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "thread_design_2",
    external_thread_id: "web_design_1",
    customer_name: "Website visitor",
    external_username: "",
    external_user_id: "u_design_2",
    channel_type: "website",
    channel_label: "Website chat",
    provider: "website",
    source_type: "webchat",
    status: "open",
    unread_count: 0,
    assigned_to: "operator",
    handoff_active: false,
    priority: "normal",
    last_message_text: "I want to book a demo for business automation.",
    last_message_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
  {
    id: "thread_design_3",
    external_thread_id: "tg_design_1",
    customer_name: "Telegram lead",
    external_username: "local_lead",
    external_user_id: "u_design_3",
    channel_type: "telegram",
    channel_label: "Telegram",
    provider: "telegram",
    source_type: "telegram",
    status: "resolved",
    unread_count: 0,
    assigned_to: "",
    handoff_active: false,
    priority: "normal",
    last_message_text: "Thanks, I will check the proposal.",
    last_message_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

const designMessagesByThread = {
  thread_design_1: [
    {
      id: "msg_design_1",
      thread_id: "thread_design_1",
      direction: "inbound",
      sender_type: "customer",
      message_type: "text",
      text: "Salam, xidmətlər və qiymətlər barədə məlumat ala bilərəm?",
      body: "Salam, xidmətlər və qiymətlər barədə məlumat ala bilərəm?",
      created_at: nowIso(),
      status: "received",
    },
    {
      id: "msg_design_2",
      thread_id: "thread_design_1",
      direction: "outbound",
      sender_type: "agent",
      message_type: "text",
      text: "Salam! Əlbəttə. Biz biznes axınlarını, inbox automation, AI assistant və omnichannel prosesləri qururuq.",
      body: "Salam! Əlbəttə. Biz biznes axınlarını, inbox automation, AI assistant və omnichannel prosesləri qururuq.",
      created_at: nowIso(),
      status: "sent",
    },
    {
      id: "msg_design_3",
      thread_id: "thread_design_1",
      direction: "inbound",
      sender_type: "customer",
      message_type: "text",
      text: "Demo görə bilərəm?",
      body: "Demo görə bilərəm?",
      created_at: nowIso(),
      status: "received",
    },
  ],
  thread_design_2: [
    {
      id: "msg_design_4",
      thread_id: "thread_design_2",
      direction: "inbound",
      sender_type: "customer",
      message_type: "text",
      text: "I want to book a demo for business automation.",
      body: "I want to book a demo for business automation.",
      created_at: nowIso(),
      status: "received",
    },
    {
      id: "msg_design_5",
      thread_id: "thread_design_2",
      direction: "outbound",
      sender_type: "agent",
      message_type: "text",
      text: "Perfect — I can help with that. Which channel do you want to automate first?",
      body: "Perfect — I can help with that. Which channel do you want to automate first?",
      created_at: nowIso(),
      status: "sent",
    },
  ],
  thread_design_3: [
    {
      id: "msg_design_6",
      thread_id: "thread_design_3",
      direction: "inbound",
      sender_type: "customer",
      message_type: "text",
      text: "Thanks, I will check the proposal.",
      body: "Thanks, I will check the proposal.",
      created_at: nowIso(),
      status: "received",
    },
  ],
};

function findThreadId(path = "") {
  const match = cleanPath(path).match(/\/api\/inbox\/threads\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function findLeadId(path = "") {
  const match = cleanPath(path).match(/\/api\/leads\/([^/]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function buildLead(threadId = "thread_design_1") {
  const thread = designThreads.find((item) => item.id === threadId) || designThreads[0];

  return {
    id: `lead_${thread.id}`,
    inbox_thread_id: thread.id,
    name: thread.customer_name || "Design lead",
    customer_name: thread.customer_name || "Design lead",
    email: "lead@local.design",
    phone: "+994 50 000 00 00",
    source: thread.channel_label || "Design mode",
    stage: "qualified",
    status: "open",
    priority: thread.priority || "normal",
    owner: thread.assigned_to || "operator",
    next_action: "Send demo",
    notes: "Local design-mode lead. Safe to edit UI against this object.",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
}

function buildChannelStatus(provider = "website") {
  if (provider === "meta") {
    return {
      ok: true,
      state: "not_connected",
      connected: false,
      account: {},
      readiness: {
        status: "blocked",
        message: "Instagram is available for design preview.",
      },
      runtime: {
        deliveryReady: false,
      },
    };
  }

  if (provider === "telegram") {
    return {
      ok: true,
      state: "connected",
      connected: true,
      account: {
        displayName: "NEOX Telegram Bot",
        botUsername: "neox_design_bot",
        botUserId: "tg_design_bot",
      },
      readiness: {
        status: "ready",
        message: "Telegram is connected in design mode.",
      },
      runtime: {
        deliveryReady: true,
      },
    };
  }

  return {
    ok: true,
    state: "connected",
    connected: true,
    widget: {
      enabled: true,
      title: "NEOX Website Chat",
      websiteUrl: "https://weneox.com",
      publicWidgetId: "widget_design",
    },
    launchReadiness: {
      widgetEnabled: true,
      channelConfigured: true,
      productionReady: true,
      productionLaunchAllowed: true,
      publicWidgetId: "widget_design",
      message: "Website chat is configured in design mode.",
      blockers: [],
    },
    readiness: {
      status: "ready",
      message: "Website chat is ready in design mode.",
      blockers: [],
    },
    runtime: {
      deliveryReady: true,
    },
  };
}

function buildTrustView() {
  return {
    ok: true,
    summary: {
      truth: {
        latestVersionId: "truth_design_v1",
        readiness: {
          status: "ready",
          message: "Approved design truth is available.",
          blockers: [],
        },
      },
      runtimeProjection: {
        readiness: {
          status: "ready",
          message: "Runtime projection is healthy in design mode.",
          blockers: [],
        },
        health: {
          usable: true,
          autonomousAllowed: true,
          reasonCode: "",
          reasons: [],
        },
        authority: {
          available: true,
        },
      },
      policyControls: {
        tenantDefault: {
          surface: "tenant",
          controlMode: "autonomy_enabled",
          availableModes: [
            { mode: "autonomy_enabled", allowed: true },
            { mode: "operator_only_mode", allowed: true },
          ],
          changedAt: nowIso(),
          changedBy: "operator",
          policyReason: "Design mode default",
          operatorNote: "Editable local state",
        },
        items: [
          {
            surface: "inbox",
            controlMode: "autonomy_enabled",
            availableModes: [
              { mode: "autonomy_enabled", allowed: true },
              { mode: "operator_only_mode", allowed: true },
            ],
            changedAt: nowIso(),
            changedBy: "operator",
            policyReason: "Design mode default",
            operatorNote: "Inbox automatic replies enabled for preview.",
          },
        ],
      },
    },
  };
}

function buildTruthSnapshot() {
  return {
    ok: true,
    fields: [
      {
        key: "companyName",
        label: "Business name",
        value: getDesignWorkspaceName(),
        provenance: "Design mode approved truth",
      },
      {
        key: "description",
        label: "Summary",
        value:
          "NEOX builds AI-powered business automation, omnichannel messaging, operator inbox workflows, and governed assistant systems.",
        provenance: "Design mode approved truth",
      },
      {
        key: "mainLanguage",
        label: "Language",
        value: "Azerbaijani, English",
        provenance: "Design mode approved truth",
      },
      {
        key: "primaryPhone",
        label: "Phone",
        value: "+994 50 000 00 00",
        provenance: "Design mode approved truth",
      },
      {
        key: "primaryEmail",
        label: "Email",
        value: "hello@weneox.com",
        provenance: "Design mode approved truth",
      },
      {
        key: "websiteUrl",
        label: "Website",
        value: "https://weneox.com",
        provenance: "Design mode approved truth",
      },
      {
        key: "services",
        label: "Services",
        value:
          "AI assistant setup, omnichannel inbox, workflow automation, website chat, Telegram automation, Instagram DM automation",
        provenance: "Design mode approved truth",
      },
      {
        key: "tone",
        label: "Tone",
        value: "Clear, premium, helpful, operator-aware",
        provenance: "Design mode approved truth",
      },
    ],
    approval: {
      approvedAt: nowIso(),
      approvedBy: "operator",
      version: "truth_design_v1",
    },
    history: [
      {
        id: "truth_design_v1",
        version: "truth_design_v1",
        versionLabel: "Truth design v1",
        profileStatus: "approved",
        approvedAt: nowIso(),
        approvedBy: "operator",
        diffSummary: "Initial design truth",
        previousVersionId: "",
      },
    ],
    notices: [],
    hasProvenance: true,
    approvedTruthUnavailable: false,
    readiness: {
      status: "ready",
      message: "Design truth is ready.",
    },
    sourceSummary: {
      primaryLabel: "Design mode",
      primarySourceType: "manual",
      primaryUrl: "local://design-mode",
      latestImport: {
        sourceLabel: "Design mode",
        sourceType: "manual",
        sourceUrl: "local://design-mode",
      },
    },
    metadata: {
      designMode: true,
    },
    governance: {},
    finalizeImpact: {},
  };
}

function buildTruthWorkbench() {
  return {
    ok: true,
    tenantId: DESIGN_TENANT_ID,
    tenantKey: getDesignTenantKey(),
    viewerRole: "operator",
    count: 1,
    summary: {
      total: 1,
      pending: 1,
      quarantined: 0,
      conflicting: 0,
      autoApprovable: 0,
      blockedHighRisk: 0,
      highRisk: 0,
    },
    items: [
      {
        id: "candidate_design_1",
        candidateId: "candidate_design_1",
        queueBucket: "pending",
        category: "business_profile",
        itemKey: "short_description",
        title: "Short business summary",
        valueText:
          "NEOX helps businesses turn messages, leads, tasks, and replies into one controlled operating flow.",
        status: "pending",
        source: {
          displayName: "Design mode",
          sourceType: "manual",
          trustTier: "operator",
          trustLabel: "Operator preview",
        },
        confidence: {
          score: 0.92,
          label: "high",
        },
        governance: {
          trust: {},
          freshness: {},
          support: {},
          conflict: {},
          quarantine: false,
          quarantineReasons: [],
          reviewExplanation: ["Design candidate for UI preview."],
        },
        approvalPolicy: {
          outcome: "manual_review",
          requiredRole: "operator",
          reasonCodes: ["design_mode"],
          autoApprovalAllowed: false,
          autoApprovalForbidden: false,
          blocked: false,
          highRiskOperationalTruth: false,
          riskLevel: "low",
          riskLabel: "low",
        },
        impactPreview: {
          canonicalAreas: ["business_profile"],
          runtimeAreas: ["assistant_runtime"],
          canonicalPaths: ["business_profile.description"],
          runtimePaths: ["runtime.summary"],
          affectedSurfaces: ["inbox", "channels", "truth"],
          currentTruth: {},
        },
        finalizeImpactPreview: {},
        publishPreview: {},
        currentTruth: {},
        sourceEvidence: [],
        review: {
          reviewReason: "Design preview candidate",
          firstSeenAt: nowIso(),
          updatedAt: nowIso(),
        },
        auditContext: {},
        actions: [
          {
            actionType: "approve",
            label: "Approve",
            allowed: true,
            requiredRole: "operator",
          },
          {
            actionType: "reject",
            label: "Reject",
            allowed: true,
            requiredRole: "operator",
          },
        ],
      },
    ],
  };
}

function buildSetupAssistant() {
  return {
    ok: true,
    created: false,
    session: {
      id: "setup_design_session",
      status: "active",
      mode: "design",
      currentStep: "business_truth",
      startedAt: nowIso(),
      updatedAt: nowIso(),
      draftVersion: 1,
      reviewSessionId: "review_design_session",
      draftOnly: true,
      storageModel: "design_mode",
      sourceType: "manual",
      namespace: "design",
    },
    assistant: {
      phase: "business_truth",
      message: "Design mode is active. You can edit UI without waiting for backend data.",
      assistantMessage:
        "Design mode is active. You can edit UI without waiting for backend data.",
      readyForApproval: true,
      finalizeAvailable: true,
      reviewSessionId: "review_design_session",
      draftVersion: 1,
      draft: {
        businessProfile: {
          companyName: getDesignWorkspaceName(),
          description:
            "AI-powered automation studio for inbox, channels, and business workflows.",
          websiteUrl: "https://weneox.com",
        },
        services: [
          { name: "AI assistant setup", description: "Governed assistant setup." },
          { name: "Omnichannel inbox", description: "Unified operator inbox." },
          { name: "Workflow automation", description: "Business process automation." },
        ],
      },
      reviewDraft: {},
      timeline: [
        {
          id: "timeline_design_1",
          role: "assistant",
          text: "Design mode session is ready.",
          phase: "business_truth",
          createdAt: nowIso(),
        },
      ],
    },
    review: {
      status: "ready",
      draftOnly: true,
      sourceType: "manual",
      namespace: "design",
      readyForReview: true,
      readyForApproval: true,
      finalizeAvailable: true,
      finalized: false,
      message: "Design review is ready.",
    },
    setup: {
      status: "ready",
      draftOnly: true,
      sourceType: "manual",
      namespace: "design",
      review: {
        status: "ready",
        readyForReview: true,
        readyForApproval: true,
        finalizeAvailable: true,
      },
      draft: {
        businessProfile: {
          companyName: getDesignWorkspaceName(),
          description:
            "AI-powered automation studio for inbox, channels, and business workflows.",
          websiteUrl: "https://weneox.com",
        },
        services: [
          { name: "AI assistant setup" },
          { name: "Omnichannel inbox" },
          { name: "Workflow automation" },
        ],
        version: 1,
        updatedAt: nowIso(),
      },
      assistant: {},
      timeline: [],
    },
    timeline: [],
  };
}

function buildSetupReview() {
  return {
    ok: true,
    review: {
      session: {
        id: "review_design_session",
        status: "ready",
        draftVersion: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      draft: {
        businessProfile: {
          companyName: getDesignWorkspaceName(),
          description:
            "AI-powered automation studio for inbox, channels, and business workflows.",
          websiteUrl: "https://weneox.com",
          primaryEmail: "hello@weneox.com",
          primaryPhone: "+994 50 000 00 00",
        },
        services: [
          { name: "AI assistant setup" },
          { name: "Omnichannel inbox" },
          { name: "Workflow automation" },
        ],
        version: 1,
      },
      sources: [
        {
          id: "source_design_1",
          sourceType: "manual",
          sourceUrl: "local://design-mode",
          status: "ready",
        },
      ],
      events: [],
    },
    assistant: buildSetupAssistant().assistant,
    timeline: [],
    bundleSources: [],
    contributionSummary: {},
    fieldProvenance: {},
    reviewDraftSummary: {},
  };
}

function buildGenericOk(path = "", method = "GET", body = undefined) {
  return {
    ok: true,
    designMode: true,
    path: stripBase(path),
    method,
    received: body ?? null,
  };
}

function buildMessages(path = "") {
  const threadId = findThreadId(path);
  return {
    ok: true,
    messages: designMessagesByThread[threadId] || [],
  };
}

function buildThread(path = "") {
  const threadId = findThreadId(path);
  const thread = designThreads.find((item) => item.id === threadId) || designThreads[0];

  return {
    ok: true,
    thread,
  };
}

function buildOutboundAttempts(path = "") {
  const threadId = findThreadId(path);

  return {
    ok: true,
    attempts: [
      {
        id: `attempt_${threadId || "design"}`,
        message_id: `msg_${threadId || "design"}`,
        thread_id: threadId,
        provider: "design",
        status: "accepted",
        delivery_status: "accepted",
        created_at: nowIso(),
        updated_at: nowIso(),
        last_error: "",
      },
    ],
  };
}

function buildLeads() {
  return {
    ok: true,
    leads: [
      buildLead("thread_design_1"),
      {
        ...buildLead("thread_design_2"),
        id: "lead_thread_design_2",
        name: "Website visitor",
        stage: "demo_requested",
        source: "Website chat",
      },
    ],
    dbDisabled: false,
  };
}

function buildLeadResponse(path = "") {
  const byThreadMatch = cleanPath(path).match(/\/api\/leads\/by-thread\/([^/]+)/);
  if (byThreadMatch) {
    const threadId = decodeURIComponent(byThreadMatch[1]);
    return {
      ok: true,
      lead: buildLead(threadId),
    };
  }

  const leadId = findLeadId(path);
  return {
    ok: true,
    lead: {
      ...buildLead("thread_design_1"),
      id: leadId || "lead_thread_design_1",
    },
  };
}

function buildTruthVersionDetail(path = "") {
  const versionId =
    decodeURIComponent(cleanPath(path).split("/").filter(Boolean).at(-1) || "") ||
    "truth_design_v1";

  return {
    ok: true,
    version: {
      id: versionId,
      version: versionId,
      versionLabel: `Truth ${versionId}`,
      approvedAt: nowIso(),
      approvedBy: "operator",
      profileStatus: "approved",
    },
    detail: {
      selectedVersion: {
        id: versionId,
        version: versionId,
        versionLabel: `Truth ${versionId}`,
        approvedAt: nowIso(),
        approvedBy: "operator",
      },
      previousVersion: null,
      diff: {
        summaryExplanation: "Design mode version comparison.",
        canonicalAreasChanged: ["business_profile"],
        runtimeAreasLikelyAffected: ["assistant_runtime"],
        affectedSurfaces: ["inbox", "channels"],
        valueSummary: {
          added: 1,
          removed: 0,
          changed: 1,
          changedFields: ["description"],
        },
      },
      rollbackPreview: {
        action: {
          actionType: "rollback",
          label: "Rollback",
          allowed: true,
        },
        rollbackDisposition: "safe",
        summaryExplanation: "Rollback is mocked in design mode.",
      },
    },
  };
}

export function shouldMockApiRequest(path = "") {
  if (!isAppDesignModeEnabled()) return false;
  const next = cleanPath(path);
  return next.startsWith("/api/");
}

export async function getDesignModeApiResponse(path = "", options = {}) {
  const method = s(options.method || "GET").toUpperCase();
  const body = options.body;
  const fullPath = stripBase(path);
  const pathOnly = cleanPath(path);

  await delay();

  if (pathOnly === "/api/auth/me") return buildAuthMe();

  if (
    pathOnly === "/api/auth/login" ||
    pathOnly === "/api/auth/signup" ||
    pathOnly === "/api/auth/select-workspace"
  ) {
    return {
      ...buildAuthMe(),
      ok: true,
      created: pathOnly === "/api/auth/signup",
    };
  }

  if (pathOnly === "/api/auth/logout") {
    return { ok: true, loggedOut: true, designMode: true };
  }

  if (pathOnly === "/api/app/bootstrap") return buildBootstrap();

  if (pathOnly === "/api/team") {
    if (method === "POST") return buildDesignTeamCreate(body);
    return buildDesignTeam();
  }

  if (/^\/api\/team\/[^/]+\/status$/.test(pathOnly)) {
    return buildDesignTeamStatus(fullPath, body);
  }

  if (pathOnly === "/api/channels/meta/status") return buildChannelStatus("meta");
  if (pathOnly === "/api/channels/telegram/status") return buildChannelStatus("telegram");
  if (pathOnly === "/api/channels/webchat/status") return buildChannelStatus("website");

  if (pathOnly.includes("/api/channels/")) {
    return buildGenericOk(fullPath, method, body);
  }

  if (pathOnly === "/api/settings/trust" || pathOnly.includes("/api/settings/trust")) {
    return buildTrustView();
  }

  if (pathOnly === "/api/inbox/threads") {
    return {
      ok: true,
      threads: designThreads,
      dbDisabled: false,
    };
  }

  if (pathOnly === "/api/inbox/outbound/summary") {
    return {
      ok: true,
      pendingCount: 0,
      pending: 0,
      retryingCount: 0,
      failedCount: 0,
      acceptedCount: 2,
    };
  }

  if (pathOnly === "/api/inbox/outbound/failed") {
    return {
      ok: true,
      attempts: [],
      failed: [],
    };
  }

  if (pathOnly.includes("/outbound-attempts")) return buildOutboundAttempts(fullPath);
  if (pathOnly.includes("/messages")) {
    if (method === "POST") {
      return {
        ok: true,
        accepted: true,
        message: {
          id: `msg_design_${Date.now()}`,
          thread_id: findThreadId(fullPath),
          direction: "outbound",
          sender_type: "agent",
          message_type: "text",
          text: s(body?.text || body?.body || ""),
          body: s(body?.text || body?.body || ""),
          created_at: nowIso(),
          status: "accepted",
        },
      };
    }

    return buildMessages(fullPath);
  }

  if (pathOnly.startsWith("/api/inbox/threads/")) return buildThread(fullPath);

  if (pathOnly === "/api/leads") return buildLeads();
  if (pathOnly.startsWith("/api/leads/")) return buildLeadResponse(fullPath);

  if (pathOnly === "/api/setup/status") {
    return {
      ok: true,
      status: "ready",
      workspaceReady: true,
      setupCompleted: true,
      setupRequired: false,
      designMode: true,
    };
  }

  if (pathOnly === "/api/setup/truth/current") return buildTruthSnapshot();

  if (pathOnly.includes("/api/setup/assistant/session")) {
    return buildSetupAssistant();
  }

  if (pathOnly === "/api/setup/review/current") return buildSetupReview();

  if (
    pathOnly === "/api/setup/review/current/analyze" ||
    pathOnly === "/api/setup/review/current/finalize" ||
    pathOnly === "/api/setup/review/current/discard" ||
    pathOnly.startsWith("/api/setup/import/") ||
    pathOnly === "/api/setup/business-profile" ||
    pathOnly === "/api/setup/runtime-preferences"
  ) {
    return {
      ...buildSetupReview(),
      ok: true,
      mode: "design",
      status: "ready",
      message: "Design mode response.",
    };
  }

  if (
    pathOnly === "/api/setup/truth/history" ||
    pathOnly.includes("/api/setup/truth/history")
  ) {
    return buildTruthVersionDetail(fullPath);
  }

  if (
    pathOnly === "/api/setup/truth/review/workbench" ||
    pathOnly.includes("/api/setup/truth/review/workbench") ||
    pathOnly.includes("/api/truth/review/workbench")
  ) {
    return buildTruthWorkbench();
  }

  if (
    pathOnly === "/api/setup/truth/current" ||
    pathOnly === "/api/truth/current" ||
    pathOnly.includes("/api/truth/current")
  ) {
    return buildTruthSnapshot();
  }

  if (pathOnly.includes("/api/truth/history/")) return buildTruthVersionDetail(fullPath);

  if (pathOnly.includes("/api/notifications")) {
    return {
      ok: true,
      notifications: [],
      unreadCount: 0,
      items: [],
    };
  }

  return buildGenericOk(fullPath, method, body);
}