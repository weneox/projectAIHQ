import { Button as AntButton, Input } from "antd";
import { ArrowRight, Command as CommandIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Badge from "../../components/ui/Badge.jsx";
import {
  EmptyState,
  PageCanvas,
  PageHeader,
  SectionHeader,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";
import {
  getWorkspaceIntentExamples,
  parseWorkspaceIntent,
} from "../../view-models/workspaceIntents.js";
import useWorkspaceNarration from "../../view-models/useWorkspaceNarration.js";
import WorkspaceLoadingSurface from "./WorkspaceLoadingSurface.jsx";

function toneForPriority(priority = "") {
  switch (String(priority || "").toLowerCase()) {
    case "critical":
      return "danger";
    case "high":
      return "warn";
    case "medium":
      return "info";
    default:
      return "neutral";
  }
}

function titleize(value = "") {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (item) => item.toUpperCase());
}

function SectionShell({
  id,
  eyebrow,
  title,
  description,
  items = [],
  emptyMessage,
  children,
}) {
  return (
    <Surface id={id} className="scroll-mt-28">
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        className="pb-5"
      />
      {items.length ? children : <EmptyState title={emptyMessage} />}
    </Surface>
  );
}

function BriefMetric({ label, text }) {
  return (
    <div className="rounded-[18px] border border-line-soft bg-surface-muted p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-subtle">
        {label}
      </div>
      <div className="mt-3 text-sm leading-6 text-text-muted">{text}</div>
    </div>
  );
}

function DetailToggle({ expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-sm font-semibold text-brand transition hover:text-brand-strong"
    >
      {expanded ? "Hide detail" : "Why this matters"}
    </button>
  );
}

function NextActionLink({ nextAction }) {
  if (!nextAction?.label) return null;

  const text = nextAction.path ? (
    <Link to={nextAction.path} className="font-semibold text-brand hover:text-brand-strong">
      {nextAction.label}
    </Link>
  ) : (
    <span className="font-semibold text-text">{nextAction.label}</span>
  );

  return (
    <div className="text-sm text-text-muted">
      {text}
      {nextAction.destinationSurface ? (
        <span> in {titleize(nextAction.destinationSurface)}</span>
      ) : null}
    </div>
  );
}

function NarrationRow({ item, expanded = false, onToggle }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5 shadow-panel">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={toneForPriority(item.priority)} variant="subtle" dot>
          {titleize(item.priority || "medium")}
        </Badge>
        <Badge tone="neutral" variant="subtle">
          {titleize(item.relatedCapability || "workspace")}
        </Badge>
        {item.requiresHuman ? (
          <Badge tone="warn" variant="subtle">
            Human needed
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 font-display text-[1.3rem] font-semibold tracking-[-0.04em] text-text">
        {item.title}
      </div>
      <div className="mt-2 text-sm leading-6 text-text-muted">{item.whatHappened}</div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {item.why || item.impact || item.nextAction ? (
          <DetailToggle expanded={expanded} onToggle={onToggle} />
        ) : null}
        {!expanded && item.nextAction ? <NextActionLink nextAction={item.nextAction} /> : null}
      </div>

      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-line-soft pt-4 text-sm leading-6 text-text-muted">
          {item.why ? <div>Why: {item.why}</div> : null}
          {item.impact ? <div>Impact: {item.impact}</div> : null}
          {item.nextAction ? <NextActionLink nextAction={item.nextAction} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function CapabilityRow({ item, expanded = false, onToggle }) {
  return (
    <div className="rounded-[20px] border border-line bg-surface p-5 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-text">{item.label}</div>
            <Badge tone={toneForPriority(item.priority)} variant="subtle">
              {item.statusLabel}
            </Badge>
            {item.requiresHuman ? (
              <Badge tone="warn" variant="subtle">
                Human needed
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 text-sm leading-6 text-text-muted">{item.sentence}</div>
        </div>

        {item.nextAction?.path ? (
          <Link
            to={item.nextAction.path}
            className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-strong"
          >
            {item.nextAction.label}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>

      {item.why || item.impact ? (
        <div className="mt-4">
          <DetailToggle expanded={expanded} onToggle={onToggle} />
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-line-soft pt-4 text-sm leading-6 text-text-muted">
          {item.why ? <div>Why: {item.why}</div> : null}
          {item.impact ? <div>Impact: {item.impact}</div> : null}
          {item.nextAction ? <NextActionLink nextAction={item.nextAction} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ActionChip({ action, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      className="rounded-pill border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-text transition hover:border-line-strong hover:bg-surface-muted"
    >
      {action.label}
    </button>
  );
}

function CommandBar({
  value,
  onChange,
  onSubmit,
  onSuggestedAction,
  suggestedActions,
  statusMessage,
}) {
  const examples = useMemo(() => getWorkspaceIntentExamples(), []);

  return (
    <Surface>
      <SectionHeader
        eyebrow="Command Workspace"
        title="Go where the work is"
        description="Use deterministic routing to jump into the right surface, continue setup, or focus the current brief."
        className="pb-5"
      />

      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          size="large"
          prefix={<CommandIcon className="h-4 w-4 text-text-subtle" />}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder='Try "continue setup" or "open inbox"'
          className="!h-12 !rounded-[16px]"
        />

        <div className="flex flex-wrap gap-2">
          {suggestedActions.map((action) => (
            <ActionChip
              key={action.id}
              action={action}
              onClick={onSuggestedAction}
            />
          ))}
        </div>

        <div className="text-xs leading-5 text-text-subtle">
          Supported examples: {examples.join(" | ")}
        </div>

        {statusMessage ? (
          <div className="rounded-[16px] border border-brand/15 bg-brand-soft/50 px-4 py-3 text-sm text-text-muted">
            {statusMessage}
          </div>
        ) : null}
      </form>
    </Surface>
  );
}

function GuidedMoment({ moment }) {
  return (
    <div className="rounded-[18px] border border-line-soft bg-surface-muted p-4">
      <div className="text-sm font-semibold text-text">{moment.label}</div>
      <div className="mt-2 text-sm leading-6 text-text-muted">{moment.summary}</div>
      {moment.detail ? (
        <div className="mt-2 text-sm leading-6 text-text-subtle">{moment.detail}</div>
      ) : null}
    </div>
  );
}

function SetupGuidanceBlock({ guidance }) {
  if (!guidance?.visible) return null;

  return (
    <Surface>
      <SectionHeader
        eyebrow="Guided Setup"
        title={guidance.headline}
        description={guidance.description}
        className="pb-5"
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {guidance.moments.map((moment) => (
          <GuidedMoment key={moment.id} moment={moment} />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {guidance.primaryAction?.path ? (
          <Link
            to={guidance.primaryAction.path}
            className="inline-flex h-11 items-center rounded-[16px] bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            {guidance.primaryAction.label}
          </Link>
        ) : null}

        {guidance.secondaryAction?.path ? (
          <Link
            to={guidance.secondaryAction.path}
            className="inline-flex h-11 items-center rounded-[16px] border border-line bg-surface px-5 text-sm font-semibold text-text transition hover:border-line-strong hover:bg-surface-muted"
          >
            {guidance.secondaryAction.label}
          </Link>
        ) : null}
      </div>
    </Surface>
  );
}

function BusinessMemoryLine({ label, text }) {
  return (
    <div className="rounded-[18px] border border-line-soft bg-surface-muted p-4">
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-text-subtle">
        {label}
      </div>
      <div className="mt-3 text-sm leading-6 text-text-muted">{text}</div>
    </div>
  );
}

function BusinessMemoryBlock({ memory }) {
  if (!memory?.visible) return null;

  return (
    <Surface>
      <SectionHeader
        eyebrow="Business Memory"
        title={memory.headline}
        description={memory.description}
        className="pb-5"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BusinessMemoryLine label="What we currently know" text={memory.currentKnown} />
        <BusinessMemoryLine label="What may have changed" text={memory.mayHaveChanged} />
        <BusinessMemoryLine label="What needs confirmation" text={memory.needsConfirmation} />
        <BusinessMemoryLine label="What is blocked" text={memory.blocked} />
        <BusinessMemoryLine
          label="What recently became reliable"
          text={memory.recentlyReliable}
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {memory.primaryAction?.path ? (
          <Link
            to={memory.primaryAction.path}
            className="inline-flex h-11 items-center rounded-[16px] bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-strong"
          >
            {memory.primaryAction.label}
          </Link>
        ) : null}

        {memory.secondaryAction?.path ? (
          <Link
            to={memory.secondaryAction.path}
            className="inline-flex h-11 items-center rounded-[16px] border border-line bg-surface px-5 text-sm font-semibold text-text transition hover:border-line-strong hover:bg-surface-muted"
          >
            {memory.secondaryAction.label}
          </Link>
        ) : null}
      </div>
    </Surface>
  );
}

function focusToSection(value = "") {
  switch (String(value || "").toLowerCase()) {
    case "decisions":
      return "workspace-decisions";
    case "capabilities":
      return "workspace-capabilities";
    case "outcomes":
      return "workspace-outcomes";
    default:
      return "";
  }
}

export default function WorkspacePage() {
  const workspace = useWorkspaceNarration();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [command, setCommand] = useState("");
  const [commandStatus, setCommandStatus] = useState("");
  const [expandedRows, setExpandedRows] = useState({});

  const focusSection = searchParams.get("focus") || "";
  const focusedSectionId = focusToSection(focusSection);

  useEffect(() => {
    if (!focusedSectionId) return;
    const element = document.getElementById(focusedSectionId);
    if (element) {
      element.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [focusedSectionId]);

  function toggleExpanded(id) {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function applyWorkspaceFocus(nextFocus = "") {
    const next = new URLSearchParams(searchParams);
    if (nextFocus) next.set("focus", nextFocus);
    else next.delete("focus");
    setSearchParams(next, { replace: false });
  }

  function handleIntent(intent) {
    if (!intent) {
      setCommandStatus(
        'Supported commands are limited in this pass. Try "continue setup", "review business changes", or "open inbox".'
      );
      return;
    }

    setCommandStatus(`Routing to ${intent.label.toLowerCase()}.`);

    if (intent.focusSection && intent.route.startsWith("/workspace")) {
      applyWorkspaceFocus(intent.focusSection);
      return;
    }

    navigate(intent.route);
  }

  function handleSubmit(event) {
    event.preventDefault();
    handleIntent(parseWorkspaceIntent(command));
  }

  if (workspace.loading) {
    return <WorkspaceLoadingSurface />;
  }

  return (
    <PageCanvas className="space-y-6 px-4 py-6 md:px-6 md:py-8 xl:px-0">
      <PageHeader
        eyebrow="Workspace"
        title="Command workspace"
        description="A cleaner operator brief across setup, business state, conversations, and publishing so the next action is obvious."
        actions={
          workspace.error ? (
            <div className="rounded-[16px] border border-warning/20 bg-warning/10 px-4 py-3 text-sm text-text-muted">
              {workspace.error}
            </div>
          ) : (
            <AntButton size="large" type="default" href="/settings">
              Review settings
            </AntButton>
          )
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <div className="space-y-6">
          <CommandBar
            value={command}
            onChange={setCommand}
            onSubmit={handleSubmit}
            onSuggestedAction={handleIntent}
            suggestedActions={workspace.suggestedActions || []}
            statusMessage={commandStatus}
          />

          <SectionShell
            id="workspace-brief"
            eyebrow="System Brief"
            title="What matters right now"
            description="The most important changes, what demands attention, and what can safely wait."
            items={[workspace.systemBrief].filter(Boolean)}
            emptyMessage="The workspace will summarize the current operating state here."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <BriefMetric label="What changed" text={workspace.systemBrief.changed} />
              <BriefMetric label="What matters most" text={workspace.systemBrief.mattersMost} />
              <BriefMetric label="Safe to ignore" text={workspace.systemBrief.safeToIgnore} />
            </div>
          </SectionShell>

          <SectionShell
            id="workspace-decisions"
            eyebrow="Active Decisions"
            title="Human decisions"
            description="Items that still need operator judgement before the system should move."
            items={workspace.decisions}
            emptyMessage="No explicit human decision is waiting right now."
          >
            <div className="space-y-4">
              {workspace.decisions.map((item) => (
                <NarrationRow
                  key={item.id}
                  item={item}
                  expanded={expandedRows[item.id] === true}
                  onToggle={() => toggleExpanded(item.id)}
                />
              ))}
            </div>
          </SectionShell>

          <SectionShell
            id="workspace-capabilities"
            eyebrow="Capability Summary"
            title="Current capability posture"
            description="A practical read on what is working, degraded, or waiting on review."
            items={workspace.capabilities}
            emptyMessage="Capability posture is not available yet."
          >
            <div className="space-y-4">
              {workspace.capabilities.map((item) => (
                <CapabilityRow
                  key={item.id}
                  item={item}
                  expanded={expandedRows[item.id] === true}
                  onToggle={() => toggleExpanded(item.id)}
                />
              ))}
            </div>
          </SectionShell>

          <SectionShell
            id="workspace-outcomes"
            eyebrow="Recent Outcomes"
            title="Recent system outcomes"
            description="The latest completed actions and the operator context behind them."
            items={workspace.recentOutcomes}
            emptyMessage="Recent outcomes will appear here as the system completes work."
          >
            <div className="space-y-4">
              {workspace.recentOutcomes.map((item) => (
                <NarrationRow
                  key={item.id}
                  item={item}
                  expanded={expandedRows[item.id] === true}
                  onToggle={() => toggleExpanded(item.id)}
                />
              ))}
            </div>
          </SectionShell>
        </div>

        <div className="space-y-6">
          <SetupGuidanceBlock guidance={workspace.setupGuidance} />
          <BusinessMemoryBlock memory={workspace.businessMemory} />
        </div>
      </div>
    </PageCanvas>
  );
}
