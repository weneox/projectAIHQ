import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Database,
  ExternalLink,
  Globe2,
  LockKeyhole,
  Plug,
  RadioTower,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";

import {
  getOperationalSettings,
  getWorkspaceSettings,
  saveWorkspaceAiPolicy,
} from "../api/settings.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import {
  AppToggleControl as ToggleControl,
} from "../components/ui/AppFormControls.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const DEFAULT_AI_POLICY = {
  auto_reply_enabled: true,
  suppress_ai_during_handoff: true,
  mark_seen_enabled: true,
  typing_indicator_enabled: true,
  create_lead_enabled: true,
  approval_required_content: true,
  approval_required_publish: true,
  quiet_hours_enabled: false,
  quiet_hours: { startHour: 0, endHour: 0 },
  inbox_policy: {},
  comment_policy: {},
  content_policy: {},
  escalation_rules: {},
  risk_rules: {},
  lead_scoring_rules: {},
  publish_policy: {},
};

const SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    icon: Settings2,
    description: "Real tenant identity, governed profile, and workspace ownership.",
  },
  {
    id: "assistant",
    label: "AI policy",
    icon: Bot,
    description: "Live automation rules that are saved to backend policy.",
  },
  {
    id: "operational",
    label: "Operational",
    icon: RadioTower,
    description: "Readiness, voice, Meta, provider secrets, and blockers.",
  },
  {
    id: "channels",
    label: "Channels",
    icon: Plug,
    description: "Connected channel records and launch-lane direction.",
  },
  {
    id: "security",
    label: "Security",
    icon: ShieldCheck,
    description: "Sensitive-action rules enforced by the backend.",
  },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function bool(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toneForStatus(status = "") {
  const safe = lower(status);

  if (["ready", "active", "connected", "bounded", "ok"].includes(safe)) {
    return "success";
  }

  if (["blocked", "unavailable", "danger", "failed"].includes(safe)) {
    return "danger";
  }

  if (["attention", "review", "warning", "degraded"].includes(safe)) {
    return "warning";
  }

  return "neutral";
}

function normalizeAiPolicy(policy = {}) {
  const source = obj(policy);

  return {
    ...DEFAULT_AI_POLICY,
    ...source,
    auto_reply_enabled: bool(source.auto_reply_enabled, true),
    suppress_ai_during_handoff: bool(source.suppress_ai_during_handoff, true),
    mark_seen_enabled: bool(source.mark_seen_enabled, true),
    typing_indicator_enabled: bool(source.typing_indicator_enabled, true),
    create_lead_enabled: bool(source.create_lead_enabled, true),
    approval_required_content: bool(source.approval_required_content, true),
    approval_required_publish: bool(source.approval_required_publish, true),
    quiet_hours_enabled: bool(source.quiet_hours_enabled, false),
    quiet_hours: obj(source.quiet_hours, { startHour: 0, endHour: 0 }),
    inbox_policy: obj(source.inbox_policy),
    comment_policy: obj(source.comment_policy),
    content_policy: obj(source.content_policy),
    escalation_rules: obj(source.escalation_rules),
    risk_rules: obj(source.risk_rules),
    lead_scoring_rules: obj(source.lead_scoring_rules),
    publish_policy: obj(source.publish_policy),
  };
}

function fieldValue(value, fallback = "Not configured") {
  const text = s(value);
  return text || fallback;
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
                  "mt-0.5 h-4 w-4 shrink-0",
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

function ReadOnlyField({ label, value }) {
  return (
    <div className="rounded-md border border-line-soft bg-white px-4 py-3 shadow-[var(--shadow-inset-top)]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>
      <div className="mt-1 truncate text-[13.5px] font-semibold text-text">
        {fieldValue(value)}
      </div>
    </div>
  );
}

function SurfaceCard({ icon: Icon, title, description, tag, tone = "neutral", children }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-line-soft bg-surface-subtle text-text">
              <Icon className="h-5 w-5" strokeWidth={2.05} />
            </div>

            <div className="min-w-0">
              <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {title}
              </div>
              <div className="mt-1 max-w-[680px] text-[12.5px] font-medium leading-5 text-text-muted">
                {description}
              </div>
            </div>
          </div>

          {tag ? (
            <AppTag tone={tone} dot>
              {tag}
            </AppTag>
          ) : null}
        </div>
      </div>

      <div className="p-5">{children}</div>
    </Card>
  );
}

function WorkspaceContent({ payload, navigate }) {
  const tenant = obj(payload?.tenant);
  const profile = obj(payload?.profile);
  const governance = obj(payload?.governance);

  return (
    <div className="grid gap-4">
      <SurfaceCard
        icon={Globe2}
        title="Workspace identity"
        description="This is real tenant/profile data from the backend. Identity fields are governed through setup and Business Info review."
        tag={governance.directWorkspaceWritesBlocked ? "Governed" : "Editable"}
        tone={governance.directWorkspaceWritesBlocked ? "warning" : "success"}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="Company name" value={tenant.company_name} />
          <ReadOnlyField label="Legal name" value={tenant.legal_name} />
          <ReadOnlyField label="Tenant key" value={tenant.tenant_key} />
          <ReadOnlyField label="Plan" value={tenant.plan_key} />
          <ReadOnlyField label="Region" value={tenant.market_region || tenant.country_code} />
          <ReadOnlyField label="Timezone" value={tenant.timezone} />
          <ReadOnlyField label="Brand name" value={profile.brand_name} />
          <ReadOnlyField label="Website" value={profile.website_url} />
          <ReadOnlyField label="Public email" value={profile.public_email} />
          <ReadOnlyField label="Tone of voice" value={profile.tone_of_voice} />
        </div>

        <div className="mt-4 rounded-md border border-warning/20 bg-warning-soft px-4 py-3">
          <div className="text-[13px] font-semibold text-text">
            Business identity is protected.
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            Company profile, public claims, tone, and service facts should move through Setup and Business Info approval instead of direct Settings edits.
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => navigate("/truth")}>
              Open Business Info
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate("/home?assistant=setup")}
            >
              Open setup review
            </Button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

function PolicyToggle({ title, description, checked, onChange }) {
  return (
    <div className="grid gap-3 rounded-md border border-line-soft bg-white px-4 py-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-center">
      <div>
        <div className="text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {title}
        </div>
        <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
          {description}
        </div>
      </div>

      <ToggleControl
        checked={checked}
        onChange={onChange}
        enabledLabel="Enabled"
        disabledLabel="Disabled"
        label={title}
      />
    </div>
  );
}

function AssistantPolicyContent({ aiPolicy, onPatch }) {
  function patch(key, value) {
    onPatch({ [key]: value });
  }

  return (
    <div className="grid gap-4">
      <SurfaceCard
        icon={Bot}
        title="Live AI policy"
        description="These controls are backed by tenant_ai_policies and save through /settings/workspace."
        tag="Real save"
        tone="success"
      >
        <div className="grid gap-3">
          <PolicyToggle
            title="AI auto replies"
            description="Allow the assistant to generate live replies when runtime and channel readiness allow it."
            checked={aiPolicy.auto_reply_enabled}
            onChange={(value) => patch("auto_reply_enabled", value)}
          />

          <PolicyToggle
            title="Suppress AI during handoff"
            description="Stop autonomous replies while a human operator owns the conversation."
            checked={aiPolicy.suppress_ai_during_handoff}
            onChange={(value) => patch("suppress_ai_during_handoff", value)}
          />

          <PolicyToggle
            title="Mark messages as seen"
            description="Allow the system to mark inbound messages as seen when processing is active."
            checked={aiPolicy.mark_seen_enabled}
            onChange={(value) => patch("mark_seen_enabled", value)}
          />

          <PolicyToggle
            title="Typing indicator"
            description="Show typing activity while AI is preparing a response on supported channels."
            checked={aiPolicy.typing_indicator_enabled}
            onChange={(value) => patch("typing_indicator_enabled", value)}
          />

          <PolicyToggle
            title="Create leads automatically"
            description="Allow qualified conversations to create lead records in the pipeline."
            checked={aiPolicy.create_lead_enabled}
            onChange={(value) => patch("create_lead_enabled", value)}
          />

          <PolicyToggle
            title="Content approval required"
            description="Require operator approval before generated content is treated as publishable."
            checked={aiPolicy.approval_required_content}
            onChange={(value) => patch("approval_required_content", value)}
          />

          <PolicyToggle
            title="Publishing approval required"
            description="Keep publishing actions guarded unless an owner/admin explicitly approves them."
            checked={aiPolicy.approval_required_publish}
            onChange={(value) => patch("approval_required_publish", value)}
          />

          <PolicyToggle
            title="Quiet hours"
            description="Reserve room for future quiet-hour rules without inventing fake schedules in the UI."
            checked={aiPolicy.quiet_hours_enabled}
            onChange={(value) => patch("quiet_hours_enabled", value)}
          />
        </div>
      </SurfaceCard>
    </div>
  );
}

function OperationalContent({ payload, error }) {
  const readiness = obj(payload?.readiness);
  const voice = obj(payload?.voice);
  const channels = obj(payload?.channels);
  const meta = obj(channels.meta);
  const dataGovernance = obj(payload?.dataGovernance);
  const retention = obj(dataGovernance.retention);
  const blockers = arr(readiness.blockers);

  if (error) {
    return (
      <InlineNotice
        tone="warning"
        title="Operational settings unavailable"
        description={error}
      />
    );
  }

  return (
    <div className="grid gap-4">
      <SurfaceCard
        icon={RadioTower}
        title="Operational readiness"
        description="Real backend posture for production dependencies, blockers, voice, Meta, and provider secrets."
        tag={titleize(readiness.status || "unknown")}
        tone={toneForStatus(readiness.status)}
      >
        <div className="grid gap-3 md:grid-cols-3">
          <ReadOnlyField label="Status" value={readiness.status} />
          <ReadOnlyField label="Viewer role" value={payload?.viewerRole} />
          <ReadOnlyField
            label="Can manage"
            value={payload?.capabilities?.canManageOperationalSettings ? "Yes" : "No"}
          />
        </div>

        <div className="mt-4 rounded-md border border-line-soft bg-surface-subtle px-4 py-3 text-[13px] font-medium leading-6 text-text-muted">
          {readiness.message || "Operational readiness is loaded from backend."}
        </div>

        {blockers.length ? (
          <div className="mt-4 grid gap-2">
            {blockers.map((blocker, index) => (
              <div
                key={blocker.reasonCode || index}
                className="rounded-md border border-danger/20 bg-danger-soft px-4 py-3"
              >
                <div className="text-[13px] font-semibold text-text">
                  {blocker.title || "Operational blocker"}
                </div>
                <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                  {blocker.subtitle || blocker.message || blocker.reasonCode}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard
          icon={Sparkles}
          title="Voice surface"
          description="Voice readiness from persisted tenant voice settings."
          tag={titleize(voice?.operational?.status || voice?.operational?.reasonCode || "unknown")}
          tone={voice?.operational?.ready ? "success" : "warning"}
        >
          <div className="grid gap-3">
            <ReadOnlyField label="Provider" value={voice?.operational?.provider} />
            <ReadOnlyField label="Reason" value={voice?.operational?.reasonCode} />
            <ReadOnlyField
              label="Missing fields"
              value={arr(voice?.missingFields).join(", ")}
            />
          </div>
        </SurfaceCard>

        <SurfaceCard
          icon={Plug}
          title="Meta surface"
          description="Meta channel and required provider-secret coverage."
          tag={meta?.operational?.ready ? "Ready" : "Review"}
          tone={meta?.operational?.ready ? "success" : "warning"}
        >
          <div className="grid gap-3">
            <ReadOnlyField label="Provider" value={meta?.providerSecrets?.provider} />
            <ReadOnlyField
              label="Required secrets"
              value={arr(meta?.providerSecrets?.requiredSecretKeys).join(", ")}
            />
            <ReadOnlyField
              label="Missing secrets"
              value={arr(meta?.providerSecrets?.missingSecretKeys).join(", ")}
            />
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard
        icon={Database}
        title="Data governance"
        description="Retention posture returned by backend, not a local design placeholder."
        tag={retention.version || "Policy"}
        tone="success"
      >
        <div className="grid gap-2">
          {arr(retention.items).slice(0, 6).map((item) => (
            <div
              key={item.key}
              className="grid gap-2 rounded-md border border-line-soft bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_140px]"
            >
              <div>
                <div className="text-[13px] font-semibold text-text">
                  {item.label || titleize(item.key)}
                </div>
                <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                  {item.message}
                </div>
              </div>

              <div className="flex items-start md:justify-end">
                <AppTag tone={toneForStatus(item.status)} dot>
                  {titleize(item.status)}
                </AppTag>
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

function ChannelsContent({ workspacePayload, operationalPayload, navigate }) {
  const channels = arr(workspacePayload?.channels);
  const operationalChannels = obj(operationalPayload?.channels);

  return (
    <div className="grid gap-4">
      <SurfaceCard
        icon={Plug}
        title="Channel records"
        description="Settings should not duplicate the connector flow. It should show real channel posture and route operators to Channels for connection work."
        tag={channels.length ? `${channels.length} records` : "No records"}
        tone={channels.length ? "success" : "warning"}
      >
        {channels.length ? (
          <div className="grid gap-2">
            {channels.map((channel) => (
              <div
                key={channel.id || channel.channel_type}
                className="grid gap-3 rounded-md border border-line-soft bg-white px-4 py-3 md:grid-cols-[minmax(0,1fr)_120px_120px]"
              >
                <div>
                  <div className="text-[13.5px] font-semibold text-text">
                    {titleize(channel.channel_type || channel.provider)}
                  </div>
                  <div className="mt-1 text-[12.5px] font-medium text-text-muted">
                    {fieldValue(channel.display_name || channel.external_username || channel.external_page_id)}
                  </div>
                </div>

                <AppTag tone={toneForStatus(channel.status)} dot>
                  {titleize(channel.status)}
                </AppTag>

                <div className="text-[12.5px] font-semibold text-text-muted">
                  {channel.is_primary ? "Primary" : "Secondary"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-warning/20 bg-warning-soft px-4 py-3 text-[13px] font-medium leading-6 text-text-muted">
            No persisted channel record is visible yet. Use Channels to connect Website, Instagram, or Telegram.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => navigate("/channels")}>
            Open Channels
          </Button>
          <Button
            type="button"
            variant="secondary"
            rightIcon={<ExternalLink className="h-4 w-4" strokeWidth={2.05} />}
            onClick={() => navigate("/channels?channel=website")}
          >
            Website lane
          </Button>
        </div>

        <div className="mt-4 rounded-md border border-line-soft bg-surface-subtle px-4 py-3">
          <div className="text-[13px] font-semibold text-text">
            Meta operational summary
          </div>
          <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
            Missing fields: {arr(operationalChannels?.meta?.missingFields).join(", ") || "None reported"}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

function SecurityContent({ payload }) {
  const viewerRole = payload?.viewerRole || "member";
  const governance = obj(payload?.governance);

  return (
    <div className="grid gap-4">
      <SurfaceCard
        icon={LockKeyhole}
        title="Backend-enforced security"
        description="This surface is intentionally read-only until each security setting has a real mutation endpoint."
        tag="No fake save"
        tone="success"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyField label="Viewer role" value={viewerRole} />
          <ReadOnlyField
            label="Direct workspace writes"
            value={governance.directWorkspaceWritesBlocked ? "Blocked" : "Allowed"}
          />
          <ReadOnlyField
            label="Governed sections"
            value={arr(governance.governedSections).join(", ")}
          />
          <ReadOnlyField
            label="Editable sections"
            value={arr(governance.directlyEditableSections).join(", ")}
          />
        </div>

        <div className="mt-4 grid gap-2">
          {[
            "Sensitive channel, team, provider-secret, and operational mutations require authenticated owner/admin access.",
            "Business identity fields are routed through setup and Business Info review instead of direct form writes.",
            "Provider secrets should stay outside casual UI until a dedicated secret-management screen is designed.",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-[13px] font-medium leading-6 text-text-muted">
              <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" strokeWidth={2.05} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </SurfaceCard>
    </div>
  );
}

function ActiveContent({
  activeSection,
  workspacePayload,
  operationalPayload,
  operationalError,
  aiPolicy,
  onPatchAiPolicy,
  navigate,
}) {
  if (activeSection === "assistant") {
    return <AssistantPolicyContent aiPolicy={aiPolicy} onPatch={onPatchAiPolicy} />;
  }

  if (activeSection === "operational") {
    return <OperationalContent payload={operationalPayload} error={operationalError} />;
  }

  if (activeSection === "channels") {
    return (
      <ChannelsContent
        workspacePayload={workspacePayload}
        operationalPayload={operationalPayload}
        navigate={navigate}
      />
    );
  }

  if (activeSection === "security") {
    return <SecurityContent payload={workspacePayload} />;
  }

  return <WorkspaceContent payload={workspacePayload} navigate={navigate} />;
}

export default function Settings() {
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("workspace");
  const [workspacePayload, setWorkspacePayload] = useState(null);
  const [operationalPayload, setOperationalPayload] = useState(null);
  const [operationalError, setOperationalError] = useState("");
  const [aiPolicy, setAiPolicy] = useState(DEFAULT_AI_POLICY);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeMeta = useMemo(() => {
    return SECTIONS.find((section) => section.id === activeSection) || SECTIONS[0];
  }, [activeSection]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");
    setNotice("");
    setOperationalError("");

    try {
      const [workspaceResult, operationalResult] = await Promise.allSettled([
        getWorkspaceSettings(),
        getOperationalSettings(),
      ]);

      if (workspaceResult.status !== "fulfilled") {
        throw workspaceResult.reason;
      }

      const workspace = workspaceResult.value || {};
      setWorkspacePayload(workspace);
      setAiPolicy(normalizeAiPolicy(workspace.aiPolicy));
      setDirty(false);

      if (operationalResult.status === "fulfilled") {
        setOperationalPayload(operationalResult.value || null);
      } else {
        setOperationalPayload(null);
        setOperationalError(
          s(
            operationalResult.reason?.payload?.error ||
              operationalResult.reason?.payload?.message ||
              operationalResult.reason?.message
          ) || "Operational settings could not be loaded."
        );
      }
    } catch (err) {
      setError(
        s(err?.payload?.error || err?.payload?.message || err?.message) ||
          "Settings could not be loaded."
      );
      setWorkspacePayload(null);
      setOperationalPayload(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patchAiPolicy(next = {}) {
    setAiPolicy((current) => ({ ...current, ...next }));
    setDirty(true);
    setNotice("");
  }

  async function saveAiPolicy() {
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await saveWorkspaceAiPolicy(aiPolicy);
      setWorkspacePayload(response);
      setAiPolicy(normalizeAiPolicy(response.aiPolicy));
      setDirty(false);
      setNotice("AI policy saved to backend.");
    } catch (err) {
      setError(
        s(err?.payload?.message || err?.payload?.error || err?.message) ||
          "AI policy could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading settings"
          description="Reading real workspace policy, governance, and operational posture."
          rows={5}
        />
      </PageCanvas>
    );
  }

  const ActiveIcon = activeMeta.icon;
  const canSaveAiPolicy = activeSection === "assistant" && dirty;

  return (
    <PageCanvas>
      <PageHeader
        title="Settings"
        description="Real workspace settings, governed identity, AI policy, and operational posture."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={refreshing}
              onClick={() => load({ silent: true })}
              leftIcon={!refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Refresh
            </Button>

            <Button
              type="button"
              size="md"
              disabled={!canSaveAiPolicy}
              loading={saving}
              onClick={saveAiPolicy}
              leftIcon={!saving ? <Save className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Save AI policy
            </Button>
          </div>
        }
      />

      {error ? (
        <InlineNotice tone="danger" title="Settings unavailable" description={error} />
      ) : null}

      {notice ? (
        <InlineNotice tone="success" title="Saved" description={notice} compact />
      ) : null}

      {dirty && activeSection !== "assistant" ? (
        <InlineNotice
          tone="warning"
          title="Unsaved AI policy changes"
          description="Return to AI policy and save before leaving this control surface."
          compact
        />
      ) : null}

      <Card padded={false} clip className="overflow-visible">
        <div className="grid min-h-[690px] xl:grid-cols-[320px_minmax(0,1fr)]">
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
                  <div className="mt-1 max-w-[700px] text-[13.5px] font-medium leading-6 text-text-muted">
                    {activeMeta.description}
                  </div>
                </div>
              </div>

              <AppTag tone={dirty ? "warning" : "success"} dot>
                {dirty ? "Unsaved AI policy" : "Synced"}
              </AppTag>
            </div>

            <div className="min-h-0 flex-1 bg-surface-subtle/35 p-5">
              <ActiveContent
                activeSection={activeSection}
                workspacePayload={workspacePayload}
                operationalPayload={operationalPayload}
                operationalError={operationalError}
                aiPolicy={aiPolicy}
                onPatchAiPolicy={patchAiPolicy}
                navigate={navigate}
              />
            </div>
          </section>
        </div>
      </Card>

      <div className="sr-only">
        {workspacePayload?.governance?.directWorkspaceWritesBlocked
          ? "Workspace identity fields are governed through setup and Business Info."
          : "Workspace identity fields are editable."}
      </div>
    </PageCanvas>
  );
}
