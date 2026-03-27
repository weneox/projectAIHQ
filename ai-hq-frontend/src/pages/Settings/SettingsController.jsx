// src/pages/Settings.jsx
// PREMIUM v5.4 — final settings assembly + tenant business brain + source intelligence + stable dirty sync

import React from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Bot,
  Building2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  Waypoints,
  BrainCircuit,
  Contact2,
  ListTree,
  Database,
  SearchCheck,
  PhoneCall,
  ScrollText,
} from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import Badge from "../../components/ui/Badge.jsx";

import SettingsShell from "../../components/settings/SettingsShell.jsx";
import ChannelsPanel from "../../components/settings/ChannelsPanel.jsx";
import AgentsPanel from "../../components/settings/AgentsPanel.jsx";
import TeamPanel from "../../components/settings/TeamPanel.jsx";
import SettingsSaveBar from "../../components/settings/SettingsSaveBar.jsx";

import {
  askPermission,
  getNotificationPermission,
  subscribePush,
} from "../../lib/pushClient.js";

import { useSettingsWorkspace } from "./hooks/useSettingsWorkspace.js";
import { useBusinessBrain } from "./hooks/useBusinessBrain.js";
import { useOperationalSettings } from "./hooks/useOperationalSettings.js";
import { useSourceIntelligence } from "./hooks/useSourceIntelligence.js";
import { useTrustSurface } from "./hooks/useTrustSurface.js";
import { useAuditHistory } from "./hooks/useAuditHistory.js";
import GeneralSection from "./sections/GeneralSection.jsx";
import BrandSection from "./sections/BrandSection.jsx";
import AiPolicySection from "./sections/AiPolicySection.jsx";
import SourcesSection from "./sections/SourcesSection.jsx";
import KnowledgeReviewSection from "./sections/KnowledgeReviewSection.jsx";
import TrustMaintenanceSection from "./sections/TrustMaintenanceSection.jsx";
import TrustKnowledgeReviewSection from "./sections/TrustKnowledgeReviewSection.jsx";
import SyncRunsModal from "./sections/SyncRunsModal.jsx";
import AutoContentSection from "./sections/AutoContentSection.jsx";
import NotificationsSection from "./sections/NotificationsSection.jsx";
import BusinessFactsSection from "./sections/BusinessFactsSection.jsx";
import ChannelPoliciesSection from "./sections/ChannelPoliciesSection.jsx";
import LocationsSection from "./sections/LocationsSection.jsx";
import ContactsSection from "./sections/ContactsSection.jsx";
import OperationalSection from "./sections/OperationalSection.jsx";
import ChangeHistorySection from "./sections/ChangeHistorySection.jsx";
import {
  createNewBusinessFact,
  createNewChannelPolicy,
  createNewContact,
  createNewLocation,
} from "./settingsShared.js";
import { createNewSource } from "./sections/trustSurfaceShared.jsx";
import { getControlPlanePermissions } from "../../lib/controlPlanePermissions.js";

export default function SettingsController() {
  const [activeSection, setActiveSection] = useState("general");
  const [perm, setPerm] = useState("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");

  const env = useMemo(() => {
    const VAPID = String(import.meta.env?.VITE_VAPID_PUBLIC_KEY || "").trim();
    return { VAPID };
  }, []);

  const workspaceState = useSettingsWorkspace();
  const {
    surface: workspaceSurface,
    workspace,
    setWorkspace,
    agents,
    dirty,
    dirtyMap,
    canManageSettings,
    tenantKey,
    patchTenant,
    patchProfile,
    patchAi,
    refreshWorkspace,
    onSaveWorkspace,
    onResetWorkspace,
    saveAgent,
    setInitialWorkspace,
  } = workspaceState;
  const viewerRole = String(workspace?.viewerRole || "member").toLowerCase();

  const businessBrain = useBusinessBrain({
    canManageSettings,
    setWorkspace,
    setInitialWorkspace,
  });

  const {
    surface: businessBrainSurface,
    businessFacts,
    setBusinessFacts,
    channelPolicies,
    setChannelPolicies,
    locations,
    setLocations,
    contacts,
    setContacts,
    refreshBusinessBrain,
    handleSaveBusinessFact,
    handleDeleteBusinessFact,
    handleSaveChannelPolicy,
    handleDeleteChannelPolicy,
    handleSaveLocation,
    handleDeleteLocation,
    handleSaveContact,
    handleDeleteContact,
  } = businessBrain;

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
  const canManageOperational = controlPlanePermissions.operationalSettingsWrite.allowed;

  const { trust, refreshTrust } = useTrustSurface({ tenantKey });
  const { auditHistory, surface: auditHistorySurface, refreshAuditHistory } = useAuditHistory();

  const sourceIntelligence = useSourceIntelligence({
    tenantKey,
    canManageSettings,
    setWorkspace,
    setInitialWorkspace,
    onRefreshBusinessBrain: refreshBusinessBrain,
    onRefreshTrust: refreshTrust,
  });

  const {
    sources,
    setSources,
    knowledgeReview,
    setKnowledgeReview,
    syncRunsOpen,
    setSyncRunsOpen,
    syncRunsSource,
    syncRunsItems,
    surface: sourceSurface,
    refreshSourceIntelligence,
    handleSaveSource,
    handleStartSourceSync,
    handleViewSourceSyncRuns,
    handleApproveKnowledge,
    handleRejectKnowledge,
  } = sourceIntelligence;

  const navItems = useMemo(
    () => [
      { key: "general", label: "General", description: "Workspace identity, region, language", dirty: !!dirtyMap.general, icon: Building2 },
      { key: "brand", label: "Brand", description: "Voice, audience, services, CTA", dirty: !!dirtyMap.brand, icon: Sparkles },
      { key: "ai_policy", label: "AI Policy", description: "Auto reply, approvals, quiet hours", dirty: !!dirtyMap.ai_policy, icon: ShieldCheck },
      { key: "business_facts", label: "Business Facts", description: "Structured company facts for AI", dirty: !!dirtyMap.business_facts, icon: BrainCircuit },
      { key: "channel_policies", label: "Channel Policies", description: "Per-channel reply behavior rules", dirty: !!dirtyMap.channel_policies, icon: ListTree },
      { key: "operational", label: "Operational", description: "Voice runtime, channel readiness, provider state", dirty: false, icon: PhoneCall },
      { key: "locations", label: "Locations", description: "Branches, address, working hours", dirty: !!dirtyMap.locations, icon: MapPin },
      { key: "contacts", label: "Contacts", description: "Phone, email, WhatsApp, public lines", dirty: !!dirtyMap.contacts, icon: Contact2 },
      { key: "sources", label: "Sources", description: "Connected data sources and sync intelligence", dirty: !!dirtyMap.sources, icon: Database },
      { key: "knowledge_review", label: "Knowledge Review", description: "Approve AI-discovered business knowledge", dirty: !!dirtyMap.knowledge_review, icon: SearchCheck },
      ...(controlPlanePermissions.auditHistoryRead.allowed
        ? [
            {
              key: "change_history",
              label: "Change History",
              description: "Sensitive control-plane mutation timeline",
              dirty: false,
              icon: ScrollText,
            },
          ]
        : []),
      { key: "channels", label: "Channels", description: "Instagram, WhatsApp, Messenger", dirty: !!dirtyMap.channels, icon: Waypoints },
      { key: "agents", label: "Agents", description: "Agent status, model, enable/disable", dirty: !!dirtyMap.agents, icon: Bot },
      { key: "team", label: "Team", description: "Workspace users, roles, access", dirty: !!dirtyMap.team, icon: Users },
      { key: "notifications", label: "Notifications", description: "Push subscription and browser status", dirty: !!dirtyMap.notifications, icon: BellRing },
    ],
    [controlPlanePermissions.auditHistoryRead.allowed, dirtyMap]
  );

  useEffect(() => {
    getNotificationPermission().then(setPerm).catch(() => setPerm("default"));
  }, [env.VAPID]);

  useEffect(() => {
    let mounted = true;

    async function loadAll() {
      try {
        const base = await refreshWorkspace();
        if (!mounted) return;
        await Promise.all([
          refreshBusinessBrain(),
          refreshOperationalSettings(base.tenantKey),
          refreshSourceIntelligence(base.tenantKey),
          refreshTrust(base.tenantKey),
          refreshAuditHistory(),
        ]);
      } catch {}
    }

    loadAll();
    return () => {
      mounted = false;
    };
  }, [refreshWorkspace, refreshBusinessBrain, refreshOperationalSettings, refreshSourceIntelligence, refreshTrust, refreshAuditHistory]);

  function handleResetWorkspace() {
    const reset = onResetWorkspace();
    setBusinessFacts(Array.isArray(reset?.businessFacts) ? reset.businessFacts : []);
    setChannelPolicies(Array.isArray(reset?.channelPolicies) ? reset.channelPolicies : []);
    setLocations(Array.isArray(reset?.locations) ? reset.locations : []);
    setContacts(Array.isArray(reset?.contacts) ? reset.contacts : []);
    setSources(Array.isArray(reset?.sources) ? reset.sources : []);
    setKnowledgeReview(Array.isArray(reset?.knowledgeReview) ? reset.knowledgeReview : []);
  }

  async function enableNotifications() {
    setPushBusy(true);
    setPushMessage("");

    try {
      const p = await askPermission();
      setPerm(p);

      if (p !== "granted") {
        setPushMessage("Notification icaz?si verilm?di. Browser settings-d?n icaz? ver.");
        return;
      }

      if (!env.VAPID) {
        setPushMessage("VITE_VAPID_PUBLIC_KEY yoxdur. .env.local yoxla v? Vite restart et.");
        return;
      }

      const res = await subscribePush({ vapidPublicKey: env.VAPID, recipient: "ceo" });

      if (!res?.ok) {
        const err = res?.json?.error || res?.error || res?.status || "unknown";
        setPushMessage(`Subscription u?ursuz oldu: ${err}`);
        return;
      }

      setPushMessage("? Push notifications aktiv edildi.");
    } catch (e) {
      setPushMessage(String(e?.message || e));
    } finally {
      setPushBusy(false);
    }
  }

  function renderSection() {
    switch (activeSection) {
      case "general":
        return (
          <GeneralSection
            tenantKey={workspace.tenantKey}
            tenant={workspace.tenant}
            patchTenant={patchTenant}
            canManage={canManageSettings}
            surface={workspaceSurface}
          />
        );
      case "brand":
        return (
          <BrandSection
            profile={workspace.profile}
            patchProfile={patchProfile}
            canManage={canManageSettings}
            surface={workspaceSurface}
          />
        );
      case "ai_policy":
        return (
          <AiPolicySection
            aiPolicy={workspace.aiPolicy}
            patchAi={patchAi}
            canManage={canManageSettings}
            surface={workspaceSurface}
            autoContent={
              <AutoContentSection
                aiPolicy={workspace.aiPolicy}
                patchAi={patchAi}
                canManage={canManageSettings}
              />
            }
          />
        );
      case "business_facts":
        return (
          <BusinessFactsSection
            items={businessFacts}
            canManage={canManageSettings}
            surface={businessBrainSurface}
            onCreate={() => {
              const next = [createNewBusinessFact(), ...businessFacts];
              setBusinessFacts(next);
              setWorkspace((prev) => ({ ...prev, businessFacts: next }));
            }}
            onSave={handleSaveBusinessFact}
            onDelete={handleDeleteBusinessFact}
          />
        );
      case "channel_policies":
        return (
          <ChannelPoliciesSection
            items={channelPolicies}
            canManage={canManageSettings}
            surface={businessBrainSurface}
            onCreate={() => {
              const next = [createNewChannelPolicy(), ...channelPolicies];
              setChannelPolicies(next);
              setWorkspace((prev) => ({ ...prev, channelPolicies: next }));
            }}
            onSave={handleSaveChannelPolicy}
            onDelete={handleDeleteChannelPolicy}
          />
        );
      case "operational":
        return (
          <OperationalSection
            data={operationalData}
            surface={operationalSurface}
            savingVoice={savingVoice}
            savingChannel={savingChannel}
            canManage={canManageOperational}
            permissionState={controlPlanePermissions}
            onSaveVoice={saveVoiceSettings}
            onSaveChannel={saveChannelSettings}
          />
        );
      case "locations":
        return (
          <LocationsSection
            items={locations}
            canManage={canManageSettings}
            surface={businessBrainSurface}
            onCreate={() => {
              const next = [createNewLocation(), ...locations];
              setLocations(next);
              setWorkspace((prev) => ({ ...prev, locations: next }));
            }}
            onSave={handleSaveLocation}
            onDelete={handleDeleteLocation}
          />
        );
      case "contacts":
        return (
          <ContactsSection
            items={contacts}
            canManage={canManageSettings}
            surface={businessBrainSurface}
            onCreate={() => {
              const next = [createNewContact(), ...contacts];
              setContacts(next);
              setWorkspace((prev) => ({ ...prev, contacts: next }));
            }}
            onSave={handleSaveContact}
            onDelete={handleDeleteContact}
          />
        );
      case "sources":
        return (
          <SourcesSection>
            <TrustMaintenanceSection
              items={sources}
              canManage={canManageSettings}
              onCreate={(draft = createNewSource()) => {
                const next = [draft, ...sources];
                setSources(next);
                setWorkspace((prev) => ({ ...prev, sources: next }));
              }}
              onSave={handleSaveSource}
              onStartSync={handleStartSourceSync}
              onViewSyncRuns={handleViewSourceSyncRuns}
              trust={trust}
              sourceSurface={sourceSurface}
            />
          </SourcesSection>
        );
      case "knowledge_review":
        return (
          <KnowledgeReviewSection>
            <TrustKnowledgeReviewSection
              items={knowledgeReview}
              canManage={canManageSettings}
              onApprove={handleApproveKnowledge}
              onReject={handleRejectKnowledge}
              trust={trust}
              sourceSurface={sourceSurface}
            />
          </KnowledgeReviewSection>
        );
      case "change_history":
        return (
          <ChangeHistorySection
            history={auditHistory}
            surface={auditHistorySurface}
            viewerRole={viewerRole}
          />
        );
      case "channels":
        return <ChannelsPanel canManage={canManageSettings} />;
      case "agents":
        return (
          <AgentsPanel
            agents={agents}
            surface={workspaceSurface}
            canManage={canManageSettings}
            onSaveAgent={saveAgent}
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

  const saveWorkspaceWithSlices = () =>
    onSaveWorkspace({
      businessFacts,
      channelPolicies,
      locations,
      contacts,
      sources,
      knowledgeReview,
    });

  return (
    <>
      <SettingsShell
        title="Settings"
        subtitle="Workspace, brand, AI policy, business brain, team v? integrations idar?si."
        items={navItems}
        activeKey={activeSection}
        onChange={setActiveSection}
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                tone={canManageSettings || canManageOperational ? "success" : "warn"}
                variant="subtle"
                dot={canManageSettings || canManageOperational}
              >
                {canManageSettings
                  ? "Owner / Admin Access"
                  : canManageOperational
                  ? "Operational Write Access"
                  : "Read Only Access"}
              </Badge>
              <Badge tone={dirty ? "info" : "neutral"} variant="subtle" dot={dirty}>
                {dirty ? "Unsaved Workspace Edits" : "Workspace Synced"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => window.location.reload()} leftIcon={<RefreshCw className="h-4 w-4" />}>
                Refresh
              </Button>
              <Button
                onClick={saveWorkspaceWithSlices}
                disabled={workspaceSurface.loading || workspaceSurface.saving || !canManageSettings}
              >
                {workspaceSurface.saving ? "Saving..." : "Save Workspace"}
              </Button>
            </div>
          </div>

          {!canManageSettings ? (
            <div className="rounded-[24px] border border-amber-200/80 bg-amber-50/90 px-4 py-4 text-sm text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200">
              {canManageOperational
                ? "This account can manage operational records, but broader workspace settings remain read-only."
                : "This workspace is read-only here. Sensitive control-plane changes remain limited to owner/admin."}
            </div>
          ) : null}

          {renderSection()}

          <SettingsSaveBar
            dirty={dirty && canManageSettings}
            surface={workspaceSurface}
            onReset={handleResetWorkspace}
            onSave={saveWorkspaceWithSlices}
          />
        </div>
      </SettingsShell>

      <SyncRunsModal
        open={syncRunsOpen}
        source={syncRunsSource}
        items={syncRunsItems}
        onClose={() => {
          setSyncRunsOpen(false);
        }}
      />
    </>
  );
}

