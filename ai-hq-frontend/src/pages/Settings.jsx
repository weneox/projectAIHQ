import { useMemo, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  Code2,
  Globe2,
  KeyRound,
  LockKeyhole,
  Mail,
  Plug,
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
import AppTag from "../components/ui/AppTag.jsx";
import {
  AppSelectControl as SelectControl,
  AppTextArea as TextArea,
  AppTextInput as TextInput,
  AppToggleControl as ToggleControl,
} from "../components/ui/AppFormControls.jsx";
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    icon: Settings2,
    description: "Identity, region, domain, and support details.",
  },
  {
    id: "assistant",
    label: "Assistant",
    icon: Bot,
    description: "Tone, automation behavior, and handoff rules.",
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    description: "Verification, sessions, and protected actions.",
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: Bell,
    description: "Inbox, lead, and weekly operational alerts.",
  },
  {
    id: "developer",
    label: "Developer",
    icon: Code2,
    description: "API mode, webhook URL, and integration settings.",
  },
];

const INITIAL_SETTINGS = {
  workspaceName: "AI HQ",
  workspaceRegion: "Azerbaijan",
  publicDomain: "aihq.local",
  supportEmail: "support@weneox.com",

  assistantName: "AI Operator",
  responseTone: "Professional",
  fallbackBehavior: "Collect context and hand off to operator",
  autoRouteLeads: true,
  safeHandoff: true,

  requireEmailVerification: true,
  sensitiveActionLock: true,
  adminApproval: true,
  sessionTimeout: "24 hours",

  inboxAlerts: true,
  leadAlerts: true,
  weeklySummary: true,
  notificationEmail: "support@weneox.com",

  apiMode: "Test mode",
  webhookUrl: "https://aihq.local/api/webhooks/inbound",
  developerAccess: false,
  environment: "Local workspace",
};

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function SettingRow({ icon: Icon, title, description, children, last = false }) {
  return (
    <div
      className={cx(
        "grid gap-4 px-5 py-5 lg:grid-cols-[minmax(220px,0.72fr)_minmax(0,1fr)] lg:items-start",
        last ? "" : "border-b border-line-soft"
      )}
    >
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text-muted">
          <Icon className="h-4.5 w-4.5" strokeWidth={2.05} />
        </div>

        <div className="min-w-0">
          <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {title}
          </div>
          <div className="mt-1 max-w-[420px] text-[12.5px] font-medium leading-5 text-text-muted">
            {description}
          </div>
        </div>
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SectionNav({ activeSection, onChange }) {
  return (
    <aside className="border-b border-line-soft bg-surface-subtle/60 p-3 xl:border-b-0 xl:border-r">
      <div className="px-2 pb-3 pt-1">
        <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          Settings
        </div>
      </div>

      <div className="grid gap-1">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = activeSection === section.id;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onChange(section.id)}
              className={cx(
                "group flex w-full items-start gap-3 rounded-md px-3 py-3 text-left transition-[background-color,color,box-shadow] duration-base ease-premium",
                active
                  ? "bg-white text-text shadow-[inset_3px_0_0_rgb(var(--color-brand)),0_8px_20px_-18px_rgba(15,23,42,0.35)]"
                  : "text-text-muted hover:bg-white hover:text-text"
              )}
            >
              <Icon
                className={cx(
                  "mt-0.5 h-4.5 w-4.5 shrink-0",
                  active ? "text-brand" : "text-text-subtle group-hover:text-text-muted"
                )}
                strokeWidth={2.05}
              />

              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold">
                  {section.label}
                </span>
                <span
                  className={cx(
                    "mt-0.5 block text-[12px] font-medium leading-5",
                    active ? "text-text-muted" : "text-text-subtle"
                  )}
                >
                  {section.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function WorkspaceContent({ settings, onPatch }) {
  return (
    <>
      <SettingRow
        icon={Globe2}
        title="Workspace name"
        description="Shown inside the app shell and used as the default workspace identity."
      >
        <TextInput
          value={settings.workspaceName}
          onChange={(workspaceName) => onPatch({ workspaceName })}
          placeholder="Workspace name"
        />
      </SettingRow>

      <SettingRow
        icon={Globe2}
        title="Workspace region"
        description="Used for workspace defaults, operational language, and support context."
      >
        <SelectControl
          value={settings.workspaceRegion}
          onChange={(workspaceRegion) => onPatch({ workspaceRegion })}
          options={["Azerbaijan", "United States", "United Kingdom", "United Arab Emirates", "Turkey", "European Union"]}
        />
      </SettingRow>

      <SettingRow
        icon={Plug}
        title="Public domain"
        description="Used for hosted pages, widgets, and workspace public links."
      >
        <TextInput
          value={settings.publicDomain}
          onChange={(publicDomain) => onPatch({ publicDomain })}
          placeholder="workspace.domain.com"
        />
      </SettingRow>

      <SettingRow
        icon={Mail}
        title="Support email"
        description="Fallback email for customer support, escalations, and handoff."
        last
      >
        <TextInput
          type="email"
          value={settings.supportEmail}
          onChange={(supportEmail) => onPatch({ supportEmail })}
          placeholder="support@example.com"
        />
      </SettingRow>
    </>
  );
}

function AssistantContent({ settings, onPatch }) {
  return (
    <>
      <SettingRow
        icon={Bot}
        title="Assistant name"
        description="Internal assistant identity used in previews and handoff surfaces."
      >
        <TextInput
          value={settings.assistantName}
          onChange={(assistantName) => onPatch({ assistantName })}
          placeholder="Assistant name"
        />
      </SettingRow>

      <SettingRow
        icon={SlidersHorizontal}
        title="Response tone"
        description="Default style for generated replies and qualification messages."
      >
        <SelectControl
          value={settings.responseTone}
          onChange={(responseTone) => onPatch({ responseTone })}
          options={["Professional", "Direct", "Warm", "Premium", "Technical"]}
        />
      </SettingRow>

      <SettingRow
        icon={Sparkles}
        title="Auto-route qualified leads"
        description="Move qualified conversations into the lead pipeline automatically."
      >
        <ToggleControl
          checked={settings.autoRouteLeads}
          onChange={(autoRouteLeads) => onPatch({ autoRouteLeads })}
          enabledLabel="Auto-routing is on"
          disabledLabel="Auto-routing is off"
          label="Auto-route qualified leads"
        />
      </SettingRow>

      <SettingRow
        icon={UserCog}
        title="Fallback behavior"
        description="What the assistant should do when the request needs a human."
        last
      >
        <TextArea
          value={settings.fallbackBehavior}
          onChange={(fallbackBehavior) => onPatch({ fallbackBehavior })}
          placeholder="Describe fallback behavior"
        />
      </SettingRow>
    </>
  );
}

function SecurityContent({ settings, onPatch }) {
  return (
    <>
      <SettingRow
        icon={KeyRound}
        title="Email verification"
        description="Require verified email access before sensitive workspace actions."
      >
        <ToggleControl
          checked={settings.requireEmailVerification}
          onChange={(requireEmailVerification) => onPatch({ requireEmailVerification })}
          enabledLabel="Verification required"
          disabledLabel="Verification optional"
          label="Email verification required"
        />
      </SettingRow>

      <SettingRow
        icon={LockKeyhole}
        title="Sensitive action lock"
        description="Protect destructive or customer-impacting actions with confirmation."
      >
        <ToggleControl
          checked={settings.sensitiveActionLock}
          onChange={(sensitiveActionLock) => onPatch({ sensitiveActionLock })}
          enabledLabel="Protected"
          disabledLabel="Not protected"
          label="Sensitive action lock"
        />
      </SettingRow>

      <SettingRow
        icon={ShieldCheck}
        title="Admin approval"
        description="Require owner/admin approval for restricted workspace changes."
      >
        <ToggleControl
          checked={settings.adminApproval}
          onChange={(adminApproval) => onPatch({ adminApproval })}
          enabledLabel="Approval required"
          disabledLabel="Approval not required"
          label="Admin approval"
        />
      </SettingRow>

      <SettingRow
        icon={KeyRound}
        title="Session timeout"
        description="How long an operator session can remain active."
        last
      >
        <SelectControl
          value={settings.sessionTimeout}
          onChange={(sessionTimeout) => onPatch({ sessionTimeout })}
          options={["1 hour", "8 hours", "24 hours", "7 days", "30 days"]}
        />
      </SettingRow>
    </>
  );
}

function NotificationsContent({ settings, onPatch }) {
  return (
    <>
      <SettingRow
        icon={Bell}
        title="Inbox alerts"
        description="Notify when new conversations arrive or need attention."
      >
        <ToggleControl
          checked={settings.inboxAlerts}
          onChange={(inboxAlerts) => onPatch({ inboxAlerts })}
          enabledLabel="Inbox alerts on"
          disabledLabel="Inbox alerts off"
          label="Inbox alerts"
        />
      </SettingRow>

      <SettingRow
        icon={Sparkles}
        title="Lead alerts"
        description="Notify when a conversation becomes a qualified lead."
      >
        <ToggleControl
          checked={settings.leadAlerts}
          onChange={(leadAlerts) => onPatch({ leadAlerts })}
          enabledLabel="Lead alerts on"
          disabledLabel="Lead alerts off"
          label="Lead alerts"
        />
      </SettingRow>

      <SettingRow
        icon={CheckCircle2}
        title="Weekly summary"
        description="Send a weekly operational summary for inbox, leads, and workspace health."
      >
        <ToggleControl
          checked={settings.weeklySummary}
          onChange={(weeklySummary) => onPatch({ weeklySummary })}
          enabledLabel="Weekly summary on"
          disabledLabel="Weekly summary off"
          label="Weekly summary"
        />
      </SettingRow>

      <SettingRow
        icon={Mail}
        title="Notification email"
        description="Where operational alerts and weekly summaries should be sent."
        last
      >
        <TextInput
          type="email"
          value={settings.notificationEmail}
          onChange={(notificationEmail) => onPatch({ notificationEmail })}
          placeholder="alerts@example.com"
        />
      </SettingRow>
    </>
  );
}

function DeveloperContent({ settings, onPatch }) {
  return (
    <>
      <SettingRow
        icon={Code2}
        title="Environment"
        description="Current workspace environment used for integrations and previews."
      >
        <SelectControl
          value={settings.environment}
          onChange={(environment) => onPatch({ environment })}
          options={["Local workspace", "Staging", "Production"]}
        />
      </SettingRow>

      <SettingRow
        icon={Plug}
        title="API mode"
        description="Choose whether API-related actions run in test or live mode."
      >
        <SelectControl
          value={settings.apiMode}
          onChange={(apiMode) => onPatch({ apiMode })}
          options={["Test mode", "Live mode", "Disabled"]}
        />
      </SettingRow>

      <SettingRow
        icon={Plug}
        title="Webhook URL"
        description="Inbound webhook endpoint used by connected channels and integrations."
      >
        <TextInput
          value={settings.webhookUrl}
          onChange={(webhookUrl) => onPatch({ webhookUrl })}
          placeholder="https://example.com/webhook"
        />
      </SettingRow>

      <SettingRow
        icon={KeyRound}
        title="Developer access"
        description="Allow developer tools and integration controls inside this workspace."
        last
      >
        <ToggleControl
          checked={settings.developerAccess}
          onChange={(developerAccess) => onPatch({ developerAccess })}
          enabledLabel="Developer access enabled"
          disabledLabel="Developer access disabled"
          label="Developer access"
        />
      </SettingRow>
    </>
  );
}

function ActiveContent({ activeSection, settings, onPatch }) {
  if (activeSection === "assistant") {
    return <AssistantContent settings={settings} onPatch={onPatch} />;
  }

  if (activeSection === "security") {
    return <SecurityContent settings={settings} onPatch={onPatch} />;
  }

  if (activeSection === "notifications") {
    return <NotificationsContent settings={settings} onPatch={onPatch} />;
  }

  if (activeSection === "developer") {
    return <DeveloperContent settings={settings} onPatch={onPatch} />;
  }

  return <WorkspaceContent settings={settings} onPatch={onPatch} />;
}

export default function Settings() {
  const [activeSection, setActiveSection] = useState("workspace");
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [saved, setSaved] = useState(true);

  const activeMeta = useMemo(() => {
    return SECTIONS.find((section) => section.id === activeSection) || SECTIONS[0];
  }, [activeSection]);

  const ActiveIcon = activeMeta.icon;

  function patchSettings(next = {}) {
    setSettings((current) => ({ ...current, ...next }));
    setSaved(false);
  }

  function resetSettings() {
    setSettings(INITIAL_SETTINGS);
    setSaved(true);
  }

  function saveSettings() {
    setSaved(true);
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Settings"
        description="Configure the workspace from one clean settings surface."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={resetSettings}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              Reset
            </Button>

            <Button
              type="button"
              size="md"
              onClick={saveSettings}
              leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
            >
              Save changes
            </Button>
          </div>
        }
      />

      <Card padded={false} clip className="overflow-visible">
        <div className="grid min-h-[690px] xl:grid-cols-[310px_minmax(0,1fr)]">
          <SectionNav activeSection={activeSection} onChange={setActiveSection} />

          <section className="flex min-w-0 flex-col bg-white">
            <div className="flex flex-col gap-4 border-b border-line-soft px-5 py-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text">
                  <ActiveIcon className="h-6 w-6" strokeWidth={2.05} />
                </div>

                <div className="min-w-0">
                  <div className="text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                    {activeMeta.label}
                  </div>
                  <div className="mt-1 max-w-[640px] text-[13.5px] font-medium leading-6 text-text-muted">
                    {activeMeta.description}
                  </div>
                </div>
              </div>

              <AppTag tone={saved ? "success" : "warning"} dot>
                {saved ? "Saved" : "Unsaved changes"}
              </AppTag>
            </div>

            <div className="min-h-0 flex-1">
              <ActiveContent
                activeSection={activeSection}
                settings={settings}
                onPatch={patchSettings}
              />
            </div>
          </section>
        </div>
      </Card>
    </PageCanvas>
  );
}

