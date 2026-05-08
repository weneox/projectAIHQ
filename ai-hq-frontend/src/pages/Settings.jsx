import { useMemo, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  Globe2,
  KeyRound,
  LockKeyhole,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserCog,
} from "lucide-react";

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import AppIcon from "../components/ui/AppIcon.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    icon: Settings2,
    description: "Identity, domain, and public workspace details.",
  },
  {
    id: "assistant",
    label: "Assistant",
    icon: Bot,
    description: "Default behavior, routing tone, and automation limits.",
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    description: "Verification, access control, and sensitive actions.",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Inbox, leads, and operational alerts.",
  },
];

const INITIAL_SETTINGS = {
  workspaceName: "AI HQ",
  publicDomain: "aihq.local",
  supportEmail: "support@weneox.com",
  assistantName: "AI Operator",
  responseTone: "Professional",
  autoRouteLeads: true,
  requireEmailVerification: true,
  sensitiveActionLock: true,
  weeklySummary: true,
  leadAlerts: true,
  inboxAlerts: true,
};

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-[background-color,border-color,box-shadow] duration-150 ease-premium",
        checked
          ? "border-brand bg-brand shadow-[0_8px_20px_-14px_rgba(var(--color-brand),0.85)]"
          : "border-line bg-surface-subtle"
      )}
    >
      <span
        className={cx(
          "block h-4.5 w-4.5 rounded-full bg-white shadow-[0_2px_8px_-4px_rgba(15,23,42,0.55)] transition-transform duration-150 ease-premium",
          checked ? "translate-x-5" : "translate-x-1"
        )}
      />
    </button>
  );
}

function SettingsRow({
  icon,
  title,
  description,
  children,
  border = true,
}) {
  return (
    <div
      className={cx(
        "grid gap-4 px-5 py-4 lg:grid-cols-[minmax(260px,1fr)_minmax(280px,0.9fr)] lg:items-center",
        border ? "border-b border-line-soft" : ""
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <AppIcon
          icon={icon}
          size="md"
          tone="text"
          strokeWidth={2.05}
          className="mt-0.5 shrink-0"
        />

        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>

          {description ? (
            <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-w-0 lg:justify-self-end">{children}</div>
    </div>
  );
}

function SectionNav({ activeSection, onChange }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Settings
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Configure workspace behavior.
        </div>
      </div>

      <div className="p-2">
        {SECTIONS.map((section) => {
          const active = activeSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              className={cx(
                "flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-colors duration-150 ease-premium",
                active
                  ? "bg-brand-soft text-brand"
                  : "text-text-muted hover:bg-surface-subtle hover:text-text"
              )}
            >
              <AppIcon
                icon={section.icon}
                size="md"
                tone={active ? "brand" : "muted"}
                strokeWidth={2.05}
                className="mt-0.5 shrink-0"
              />

              <span className="min-w-0">
                <span className="block text-[13px] font-semibold text-current">
                  {section.label}
                </span>
                <span
                  className={cx(
                    "mt-0.5 block text-[12px] font-medium leading-5",
                    active ? "text-brand/75" : "text-text-subtle"
                  )}
                >
                  {section.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function WorkspaceSettings({ settings, onPatch }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Workspace configuration
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Core identity and public-facing workspace details.
        </div>
      </div>

      <SettingsRow
        icon={Globe2}
        title="Workspace name"
        description="Shown in the shell, customer-facing surfaces, and internal workspace context."
      >
        <Input
          value={settings.workspaceName}
          onChange={(event) => onPatch({ workspaceName: event.target.value })}
          placeholder="Workspace name"
          appearance="quiet"
        />
      </SettingsRow>

      <SettingsRow
        icon={Globe2}
        title="Public domain"
        description="Used for hosted pages, routing previews, and public workspace links."
      >
        <Input
          value={settings.publicDomain}
          onChange={(event) => onPatch({ publicDomain: event.target.value })}
          placeholder="workspace.domain.com"
          appearance="quiet"
        />
      </SettingsRow>

      <SettingsRow
        icon={UserCog}
        title="Support email"
        description="Fallback contact for customer replies, escalation, and manual handoff."
        border={false}
      >
        <Input
          value={settings.supportEmail}
          onChange={(event) => onPatch({ supportEmail: event.target.value })}
          placeholder="support@example.com"
          appearance="quiet"
        />
      </SettingsRow>
    </Card>
  );
}

function AssistantSettings({ settings, onPatch }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Assistant behavior
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Default behavior for workspace automation and conversation routing.
        </div>
      </div>

      <SettingsRow
        icon={Bot}
        title="Assistant name"
        description="Internal operator name used in previews and handoff surfaces."
      >
        <Input
          value={settings.assistantName}
          onChange={(event) => onPatch({ assistantName: event.target.value })}
          placeholder="Assistant name"
          appearance="quiet"
        />
      </SettingsRow>

      <SettingsRow
        icon={SlidersHorizontal}
        title="Response tone"
        description="Default style for generated replies and lead qualification messages."
      >
        <div className="flex flex-wrap gap-2">
          {["Professional", "Direct", "Warm"].map((tone) => (
            <Button
              key={tone}
              type="button"
              size="sm"
              variant={settings.responseTone === tone ? "primary" : "secondary"}
              onClick={() => onPatch({ responseTone: tone })}
            >
              {tone}
            </Button>
          ))}
        </div>
      </SettingsRow>

      <SettingsRow
        icon={Sparkles}
        title="Auto-route qualified leads"
        description="Automatically move qualified conversations into the lead pipeline."
        border={false}
      >
        <div className="flex items-center justify-end gap-3">
          <AppStatusText tone={settings.autoRouteLeads ? "success" : "neutral"}>
            {settings.autoRouteLeads ? "Enabled" : "Disabled"}
          </AppStatusText>
          <Toggle
            checked={settings.autoRouteLeads}
            onChange={(value) => onPatch({ autoRouteLeads: value })}
            label="Auto-route qualified leads"
          />
        </div>
      </SettingsRow>
    </Card>
  );
}

function SecuritySettings({ settings, onPatch }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Security controls
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Guard sensitive workspace actions and account-level verification.
        </div>
      </div>

      <SettingsRow
        icon={KeyRound}
        title="Email verification required"
        description="Restrict sensitive actions until the workspace user verifies email access."
      >
        <div className="flex items-center justify-end gap-3">
          <AppStatusText tone={settings.requireEmailVerification ? "success" : "warning"}>
            {settings.requireEmailVerification ? "Required" : "Optional"}
          </AppStatusText>
          <Toggle
            checked={settings.requireEmailVerification}
            onChange={(value) => onPatch({ requireEmailVerification: value })}
            label="Email verification required"
          />
        </div>
      </SettingsRow>

      <SettingsRow
        icon={LockKeyhole}
        title="Sensitive action lock"
        description="Require guarded confirmation before destructive or customer-impacting actions."
        border={false}
      >
        <div className="flex items-center justify-end gap-3">
          <AppStatusText tone={settings.sensitiveActionLock ? "success" : "neutral"}>
            {settings.sensitiveActionLock ? "Active" : "Disabled"}
          </AppStatusText>
          <Toggle
            checked={settings.sensitiveActionLock}
            onChange={(value) => onPatch({ sensitiveActionLock: value })}
            label="Sensitive action lock"
          />
        </div>
      </SettingsRow>
    </Card>
  );
}

function NotificationSettings({ settings, onPatch }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Notification rules
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Decide which operational signals should notify the workspace.
        </div>
      </div>

      <SettingsRow
        icon={Bell}
        title="Inbox alerts"
        description="Notify when new conversations arrive or existing threads need response."
      >
        <div className="flex items-center justify-end gap-3">
          <AppStatusText tone={settings.inboxAlerts ? "success" : "neutral"}>
            {settings.inboxAlerts ? "On" : "Off"}
          </AppStatusText>
          <Toggle
            checked={settings.inboxAlerts}
            onChange={(value) => onPatch({ inboxAlerts: value })}
            label="Inbox alerts"
          />
        </div>
      </SettingsRow>

      <SettingsRow
        icon={Sparkles}
        title="Lead alerts"
        description="Notify when a conversation becomes a qualified lead or needs follow-up."
      >
        <div className="flex items-center justify-end gap-3">
          <AppStatusText tone={settings.leadAlerts ? "success" : "neutral"}>
            {settings.leadAlerts ? "On" : "Off"}
          </AppStatusText>
          <Toggle
            checked={settings.leadAlerts}
            onChange={(value) => onPatch({ leadAlerts: value })}
            label="Lead alerts"
          />
        </div>
      </SettingsRow>

      <SettingsRow
        icon={CheckCircle2}
        title="Weekly summary"
        description="Send a weekly summary of inbox load, leads, and workspace health."
        border={false}
      >
        <div className="flex items-center justify-end gap-3">
          <AppStatusText tone={settings.weeklySummary ? "success" : "neutral"}>
            {settings.weeklySummary ? "On" : "Off"}
          </AppStatusText>
          <Toggle
            checked={settings.weeklySummary}
            onChange={(value) => onPatch({ weeklySummary: value })}
            label="Weekly summary"
          />
        </div>
      </SettingsRow>
    </Card>
  );
}

function ActiveSettingsPanel({ activeSection, settings, onPatch }) {
  if (activeSection === "assistant") {
    return <AssistantSettings settings={settings} onPatch={onPatch} />;
  }

  if (activeSection === "security") {
    return <SecuritySettings settings={settings} onPatch={onPatch} />;
  }

  if (activeSection === "notifications") {
    return <NotificationSettings settings={settings} onPatch={onPatch} />;
  }

  return <WorkspaceSettings settings={settings} onPatch={onPatch} />;
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState("workspace");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [saved, setSaved] = useState(true);

  const activeMeta = useMemo(
    () => SECTIONS.find((section) => section.id === activeSection) || SECTIONS[0],
    [activeSection]
  );

  function patchSettings(next = {}) {
    setSettings((current) => ({ ...current, ...next }));
    setSaved(false);
  }

  function handleSave() {
    setSaved(true);
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Workspace settings"
        description="Control identity, assistant behavior, security, and notification rules."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
              onClick={() => {
                setSettings(INITIAL_SETTINGS);
                setSaved(true);
              }}
            >
              Reset
            </Button>

            <Button
              type="button"
              size="md"
              leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
              onClick={handleSave}
            >
              Save changes
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SectionNav activeSection={activeSection} onChange={setActiveSection} />

        <div className="space-y-4">
          <Card padded={false} clip>
            <div className="flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3.5">
                <AppIcon
                  icon={activeMeta.icon}
                  size="lg"
                  tone="text"
                  strokeWidth={2.05}
                  className="mt-0.5 shrink-0"
                />

                <div className="min-w-0">
                  <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                    {activeMeta.label}
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                    {activeMeta.description}
                  </div>
                </div>
              </div>

              <AppTag tone={saved ? "success" : "warning"}>
                {saved ? "Saved" : "Unsaved changes"}
              </AppTag>
            </div>
          </Card>

          <ActiveSettingsPanel
            activeSection={activeSection}
            settings={settings}
            onPatch={patchSettings}
          />
        </div>
      </div>
    </PageCanvas>
  );
}