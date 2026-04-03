import React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  BellRing,
  PhoneCall,
  RefreshCw,
  ShieldCheck,
  Users,
  Waypoints,
} from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";

import SettingsShell from "../../components/settings/SettingsShell.jsx";
import ChannelsPanel from "../../components/settings/ChannelsPanel.jsx";
import TeamPanel from "../../components/settings/TeamPanel.jsx";
import SettingsSaveBar from "../../components/settings/SettingsSaveBar.jsx";

import {
  askPermission,
  getNotificationPermission,
  subscribePush,
} from "../../lib/pushClient.js";

import { useSettingsWorkspace } from "./hooks/useSettingsWorkspace.js";
import { useOperationalSettings } from "./hooks/useOperationalSettings.js";
import AiPolicySection from "./sections/AiPolicySection.jsx";
import NotificationsSection from "./sections/NotificationsSection.jsx";
import OperationalSection from "./sections/OperationalSection.jsx";
import { getControlPlanePermissions } from "../../lib/controlPlanePermissions.js";

const SETTINGS_SECTION_ALIASES = Object.freeze({
  "ai-policy": "ai_policy",
  ai_policy: "ai_policy",
  "channel-policies": "ai_policy",
  channel_policies: "ai_policy",

  channels: "channels",
  channel: "channels",
  integrations: "channels",
  integration: "channels",

  operational: "operational",
  "runtime-operations": "operational",
  runtime_operations: "operational",

  team: "team",
  notifications: "notifications",

  general: "general",
  brand: "brand",

  sources: "sources",
  source: "sources",
  truth: "sources",
  "truth-governance": "sources",
  truth_governance: "sources",

  knowledge: "knowledge_review",
  "knowledge-review": "knowledge_review",
  knowledge_review: "knowledge_review",
  review: "knowledge_review",
  "review-queue": "knowledge_review",
  review_queue: "knowledge_review",

  "change-history": "change_history",
  change_history: "change_history",

  "business-facts": "business_facts",
  business_facts: "business_facts",

  locations: "locations",
  contacts: "contacts",
  agents: "agents",
});

const SETTINGS_SECTION_REDIRECTS = Object.freeze({
  general: "/setup",
  brand: "/setup",
  sources: "/truth",
  knowledge_review: "/truth",
  change_history: "/truth",
  business_facts: "/setup",
  locations: "/setup",
  contacts: "/setup",
  agents: "/workspace",
});

function normalizeSectionToken(value = "") {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

function resolveSectionAlias(value = "") {
  const normalized = normalizeSectionToken(value);
  if (!normalized) return "";
  return SETTINGS_SECTION_ALIASES[normalized] || normalized.replace(/-/g, "_");
}

function resolveRequestedSectionToken({ searchParams, locationState, hash }) {
  const candidates = [
    locationState?.settingsSection,
    locationState?.section,
    locationState?.initialSection,
    locationState?.activeSection,
    locationState?.openSection,
    searchParams.get("settingsSection"),
    searchParams.get("section"),
    String(hash || "").replace(/^#/, ""),
  ];

  for (const candidate of candidates) {
    const resolved = resolveSectionAlias(candidate);
    if (resolved) return resolved;
  }

  return "";
}

function countEnabledAiRules(aiPolicy = {}) {
  const keys = [
    "auto_reply_enabled",
    "mark_seen_enabled",
    "typing_indicator_enabled",
    "create_lead_enabled",
    "suppress_ai_during_handoff",
    "quiet_hours_enabled",
  ];

  return keys.filter((key) => aiPolicy?.[key]).length;
}

export default function SettingsController({
  shellEyebrow = "Settings",
  shellTitle = "Operator settings",
  shellSubtitle = "Policy, runtime, integrations, team access, and alerts for the live operator stack.",
  navTitle = "Control Areas",
  navSubtitle = "Live launch configuration",
} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [perm, setPerm] = useState("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  const env = useMemo(() => {
    const VAPID = String(import.meta.env?.VITE_VAPID_PUBLIC_KEY || "").trim();
    const API_BASE = String(import.meta.env?.VITE_API_BASE || "").trim();
    return { VAPID, API_BASE };
  }, []);

  const workspaceState = useSettingsWorkspace();
  const {
    surface: workspaceSurface,
    workspace,
    dirty,
    dirtyMap,
    canManageSettings,
    tenantKey,
    patchAi,
    refreshWorkspace,
    onSaveWorkspace,
    onResetWorkspace,
  } = workspaceState;

  const viewerRole = String(workspace?.viewerRole || "member").toLowerCase();
  const workspaceEntitlements =
    workspace?.entitlements && typeof workspace.entitlements === "object"
      ? workspace.entitlements
      : {};
  const planCapabilities =
    workspaceEntitlements?.capabilities &&
    typeof workspaceEntitlements.capabilities === "object"
      ? workspaceEntitlements.capabilities
      : {};

  const {
    surface: operationalSurface,
    savingVoice,
    savingChannel,
    operationalData,
    refreshOperationalSettings,
    saveVoiceSettings,
    saveChannelSettings,
  } = useOperationalSettings({
    tenantKey,
  });

  const controlPlanePermissions = getControlPlanePermissions({
    viewerRole,
    capabilities: operationalData?.capabilities,
  });

  const canManageOperational =
    controlPlanePermissions.operationalSettingsWrite.allowed;
  const canManageChannels =
    canManageSettings && planCapabilities?.metaChannelConnect?.allowed !== false;

  const aiRuleCount = countEnabledAiRules(workspace.aiPolicy);
  const voiceReady = operationalData?.voice?.operational?.ready === true;
  const metaReady = operationalData?.channels?.meta?.operational?.ready === true;
  const metaConnected = !!operationalData?.channels?.meta?.channel;

  const navItems = useMemo(
    () => [
      {
        key: "ai_policy",
        label: "AI Policy",
        meta:
          aiRuleCount > 0
            ? `${aiRuleCount} live rule${aiRuleCount === 1 ? "" : "s"}`
            : "No automation rules active",
        status: aiRuleCount > 0 ? "Active" : "Idle",
        dirty: !!dirtyMap.ai_policy,
        icon: ShieldCheck,
      },
      {
        key: "operational",
        label: "Operational",
        meta: voiceReady ? "Voice line ready" : "Voice line needs attention",
        status: voiceReady ? "Ready" : "Check",
        dirty: false,
        icon: PhoneCall,
      },
      {
        key: "channels",
        label: "Integrations",
        meta: metaConnected
          ? metaReady
            ? "Meta connected and aligned"
            : "Meta connected, runtime blocked"
          : "Meta connection required",
        status: metaConnected ? (metaReady ? "Ready" : "Repair") : "Offline",
        dirty: !!dirtyMap.channels,
        icon: Waypoints,
      },
      {
        key: "team",
        label: "Team",
        meta: canManageSettings ? "Access can be managed here" : "Read only",
        status: canManageSettings ? "Write" : "View",
        dirty: !!dirtyMap.team,
        icon: Users,
      },
      {
        key: "notifications",
        label: "Notifications",
        meta:
          perm === "granted"
            ? "Browser delivery enabled"
            : perm === "denied"
              ? "Browser permission blocked"
              : "Browser permission pending",
        status:
          perm === "granted" ? "Ready" : perm === "denied" ? "Blocked" : "Setup",
        dirty: !!dirtyMap.notifications,
        icon: BellRing,
      },
    ],
    [aiRuleCount, canManageSettings, dirtyMap, metaConnected, metaReady, perm, voiceReady]
  );

  const requestedSectionToken = useMemo(
    () =>
      resolveRequestedSectionToken({
        searchParams,
        locationState: location?.state,
        hash: location?.hash,
      }),
    [searchParams, location?.state, location?.hash]
  );

  const requestedRedirect =
    SETTINGS_SECTION_REDIRECTS[requestedSectionToken] || "";
  const requestedSection = navItems.some(
    (item) => item.key === requestedSectionToken
  )
    ? requestedSectionToken
    : "";

  const [activeSection, setActiveSection] = useState(
    () => requestedSection || "ai_policy"
  );

  const appliedDeepLinkRef = useRef("");

  useEffect(() => {
    if (!requestedRedirect) return;
    navigate(requestedRedirect, { replace: true });
  }, [navigate, requestedRedirect]);

  useEffect(() => {
    const available = new Set(navItems.map((item) => item.key));
    if (!available.has(activeSection)) {
      setActiveSection("ai_policy");
    }
  }, [activeSection, navItems]);

  useEffect(() => {
    if (!requestedSection || requestedRedirect) return;

    const marker = [
      searchParams.toString(),
      location?.hash || "",
      location?.state?.section || "",
      location?.state?.settingsSection || "",
      location?.state?.initialSection || "",
      location?.state?.activeSection || "",
      location?.state?.openSection || "",
      requestedSection,
    ].join("|");

    if (appliedDeepLinkRef.current === marker) return;
    appliedDeepLinkRef.current = marker;

    setActiveSection((current) =>
      current === requestedSection ? current : requestedSection
    );
  }, [requestedRedirect, requestedSection, searchParams, location]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const current = String(prev.get("section") || "").trim().toLowerCase();
        const desired = String(activeSection || "").trim().toLowerCase();

        if (current === desired || (!current && desired === "ai_policy")) {
          return prev;
        }

        const next = new URLSearchParams(prev);

        if (desired && desired !== "ai_policy") {
          next.set("section", desired);
        } else {
          next.delete("section");
        }

        return next;
      },
      { replace: true }
    );
  }, [activeSection, setSearchParams]);

  useEffect(() => {
    getNotificationPermission().then(setPerm).catch(() => setPerm("default"));
  }, [env.VAPID]);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      try {
        const base = await refreshWorkspace();
        if (!mounted) return;

        await refreshOperationalSettings(base?.tenantKey);
      } catch {}
    }

    loadAll();

    return () => {
      mounted = false;
    };
  }, [refreshOperationalSettings, refreshWorkspace]);

  async function enableNotifications() {
    setPushBusy(true);
    setPushMessage("");

    try {
      const permission = await askPermission();
      setPerm(permission);

      if (permission !== "granted") {
        setPushMessage(
          "Browser notification permission is still required for operator alerts."
        );
        return;
      }

      if (!env.VAPID) {
        setPushMessage(
          "Push delivery is not configured in this environment."
        );
        return;
      }

      const res = await subscribePush({
        vapidPublicKey: env.VAPID,
        recipient: "ceo",
      });

      if (!res?.ok) {
        const err =
          res?.json?.error || res?.error || res?.status || "unknown";
        setPushMessage(`Subscription failed: ${err}`);
        return;
      }

      setPushMessage("Push notifications enabled.");
    } catch (error) {
      setPushMessage(String(error?.message || error));
    } finally {
      setPushBusy(false);
    }
  }

  function renderSection() {
    switch (activeSection) {
      case "ai_policy":
        return (
          <AiPolicySection
            aiPolicy={workspace.aiPolicy}
            patchAi={patchAi}
            canManage={canManageSettings}
            surface={workspaceSurface}
          />
        );

      case "operational":
        return (
          <OperationalSection
            data={operationalData}
            surface={operationalSurface}
            savingVoice={savingVoice}
            canManage={canManageOperational}
            permissionState={controlPlanePermissions}
            onSaveVoice={saveVoiceSettings}
          />
        );

      case "channels":
        return (
          <ChannelsPanel
            canManage={canManageChannels}
            canManageIdentifiers={canManageOperational}
            metaOperational={operationalData?.channels?.meta}
            voiceStatus={{
              ready: operationalData?.voice?.operational?.ready === true,
              reasonCode: operationalData?.voice?.operational?.reasonCode || "",
              phoneNumber: operationalData?.voice?.settings?.twilioPhoneNumber || "",
              callerId:
                operationalData?.voice?.settings?.twilioConfig?.callerId || "",
            }}
            savingChannel={savingChannel}
            onSaveChannel={saveChannelSettings}
          />
        );

      case "team":
        return <TeamPanel canManage={canManageSettings} />;

      case "notifications":
        return (
          <NotificationsSection
            perm={perm}
            pushBusy={pushBusy}
            pushMessage={pushMessage}
            env={env}
            enableNotifications={enableNotifications}
          />
        );

      default:
        return null;
    }
  }

  return (
    <SettingsShell
      eyebrow={shellEyebrow}
      title={shellTitle}
      subtitle={shellSubtitle}
      navTitle={navTitle}
      navSubtitle={navSubtitle}
      items={navItems}
      activeKey={activeSection}
      onChange={setActiveSection}
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                canManageSettings || canManageOperational ? "success" : "warn"
              }
              variant="subtle"
              dot={canManageSettings || canManageOperational}
            >
              {canManageSettings
                ? "Owner / Admin Access"
                : canManageOperational
                  ? "Operational Write Access"
                  : "Read Only Access"}
            </Badge>

            <Badge
              tone={dirty ? "info" : "neutral"}
              variant="subtle"
              dot={dirty}
            >
              {dirty ? "Unsaved Settings Changes" : "Settings Synced"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => window.location.reload()}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Refresh
            </Button>

            <Button
              onClick={() => onSaveWorkspace()}
              disabled={
                workspaceSurface.loading ||
                workspaceSurface.saving ||
                !canManageSettings
              }
            >
              {workspaceSurface.saving ? "Saving..." : "Save Settings"}
            </Button>
          </div>
        </div>

        {!canManageSettings ? (
          <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
            {canManageOperational
              ? "This account can manage operational records, but broader workspace settings remain read-only."
              : "This workspace is read-only here. Sensitive operational changes remain limited to owner/admin."}
          </div>
        ) : null}

        {renderSection()}

        <SettingsSaveBar
          dirty={dirty && canManageSettings}
          surface={workspaceSurface}
          onReset={onResetWorkspace}
          onSave={onSaveWorkspace}
        />
      </div>
    </SettingsShell>
  );
}
