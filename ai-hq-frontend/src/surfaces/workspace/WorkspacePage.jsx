import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Badge from "../../components/ui/Badge.jsx";
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

function sectionClasses(highlighted = false) {
  return [
    "relative overflow-hidden rounded-[32px] px-6 py-6 sm:px-7 sm:py-7",
    "border bg-[#fffdf9]/90 shadow-[0_18px_44px_rgba(120,102,73,0.08),inset_0_1px_0_rgba(255,255,255,0.78)]",
    highlighted ? "border-[#dbc8aa]" : "border-[#ece2d3]",
  ].join(" ");
}

function softRowClasses() {
  return "rounded-[22px] border border-[#efe6d7] bg-[#fffdfa]/94 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]";
}

function Section({
  id,
  eyebrow,
  title,
  items = [],
  emptyMessage,
  children,
  highlighted = false,
}) {
  return (
    <section id={id} className={sectionClasses(highlighted)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_0%_0%,rgba(229,211,180,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.34),transparent_26%)]" />
      <div className="relative space-y-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            {eyebrow}
          </div>
          <div className="text-[23px] font-semibold tracking-[-0.045em] text-stone-900">
            {title}
          </div>
        </div>

        {children}

        {!items.length ? (
          <div className="text-sm leading-6 text-stone-500">{emptyMessage}</div>
        ) : null}
      </div>
    </section>
  );
}

function BriefLine({ label, text }) {
  return (
    <div className={softRowClasses()}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-stone-600">{text}</div>
    </div>
  );
}

function ExpandToggle({ expanded, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950"
    >
      {expanded ? "Hide detail" : "Why this matters"}
    </button>
  );
}

function NextActionLink({ nextAction }) {
  if (!nextAction?.label) return null;

  if (nextAction?.path) {
    return (
      <div className="text-sm font-medium">
        <Link
          to={nextAction.path}
          className="text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950"
        >
          {nextAction.label}
        </Link>
        <span className="text-stone-500"> in {titleize(nextAction.destinationSurface)}</span>
      </div>
    );
  }

  return (
    <div className="text-sm font-medium text-stone-700">
      Next: {nextAction.label} in {titleize(nextAction.destinationSurface)}
    </div>
  );
}

function NarrationRow({ item, expanded = false, onToggle }) {
  return (
    <div className={softRowClasses()}>
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

      <div className="mt-3 text-[17px] font-semibold text-stone-900">
        {item.title}
      </div>

      <div className="mt-2 text-sm leading-6 text-stone-600">
        {item.whatHappened}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        {item.why || item.impact || item.nextAction ? (
          <ExpandToggle expanded={expanded} onToggle={onToggle} />
        ) : null}

        {!expanded && item.nextAction ? <NextActionLink nextAction={item.nextAction} /> : null}
      </div>

      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-[#eee3d3] pt-4 text-sm leading-6 text-stone-500">
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
    <div className={softRowClasses()}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-stone-900">
              {item.label}
            </div>
            <Badge tone={toneForPriority(item.priority)} variant="subtle">
              {item.statusLabel}
            </Badge>
            {item.requiresHuman ? (
              <Badge tone="warn" variant="subtle">
                Human needed
              </Badge>
            ) : null}
          </div>

          <div className="mt-2 text-sm leading-6 text-stone-600">
            {item.sentence}
          </div>
        </div>

        {item.nextAction?.path ? (
          <Link
            to={item.nextAction.path}
            className="shrink-0 text-sm font-medium text-stone-700 underline decoration-stone-300 underline-offset-4 transition hover:text-stone-950"
          >
            {item.nextAction.label}
          </Link>
        ) : null}
      </div>

      {item.why || item.impact ? (
        <div className="mt-3">
          <ExpandToggle expanded={expanded} onToggle={onToggle} />
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-4 space-y-2 border-t border-[#eee3d3] pt-4 text-sm leading-6 text-stone-500">
          {item.why ? <div>Why: {item.why}</div> : null}
          {item.impact ? <div>Impact: {item.impact}</div> : null}
          {item.nextAction ? <NextActionLink nextAction={item.nextAction} /> : null}
        </div>
      ) : null}
    </div>
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
    <section className={sectionClasses()}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_circle_at_0%_0%,rgba(233,217,188,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.38),transparent_24%)]" />
      <div className="relative space-y-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            Command Bar
          </div>
          <div className="text-[23px] font-semibold tracking-[-0.045em] text-stone-900">
            Go where the work is
          </div>
          <div className="max-w-3xl text-sm leading-6 text-stone-600">
            Type a simple command or choose a suggested action. Commands use deterministic matching only.
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder='Try "continue setup" or "open inbox"'
            className="h-13 w-full rounded-[22px] border border-[#e8decf] bg-[#fffdfa] px-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-[#d9c8ac] focus:bg-white"
          />
          <div className="flex flex-wrap gap-2">
            {suggestedActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onSuggestedAction(action)}
                className="rounded-full border border-[#e7ddcf] bg-[#fffaf4] px-3.5 py-2 text-[12px] font-medium text-stone-700 transition hover:border-[#d9c8ac] hover:bg-white hover:text-stone-950"
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className="text-xs leading-5 text-stone-500">
            Supported examples: {examples.join(" · ")}
          </div>
          {statusMessage ? (
            <div className="rounded-[18px] border border-[#ece2d3] bg-[#fffdfa] px-4 py-3 text-sm text-stone-600">
              {statusMessage}
            </div>
          ) : null}
        </form>
      </div>
    </section>
  );
}

function SetupMoment({ moment }) {
  return (
    <div className={softRowClasses()}>
      <div className="text-sm font-semibold text-stone-900">
        {moment.label}
      </div>
      <div className="mt-2 text-sm leading-6 text-stone-600">
        {moment.summary}
      </div>
      {moment.detail ? (
        <div className="mt-2 text-sm leading-6 text-stone-500">
          {moment.detail}
        </div>
      ) : null}
    </div>
  );
}

function SetupGuidanceBlock({ guidance }) {
  if (!guidance?.visible) return null;

  return (
    <section className={sectionClasses()}>
      <div className="relative space-y-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            Guided Setup
          </div>
          <div className="text-[23px] font-semibold tracking-[-0.045em] text-stone-900">
            {guidance.headline}
          </div>
          <div className="max-w-3xl text-sm leading-6 text-stone-600">
            {guidance.description}
          </div>
        </div>

        <div className="space-y-3">
          {guidance.moments.map((moment) => (
            <SetupMoment key={moment.id} moment={moment} />
          ))}
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          {guidance.primaryAction?.path ? (
            <Link
              to={guidance.primaryAction.path}
              className="inline-flex items-center rounded-full border border-[#dfcfb2] bg-[#efe0c0] px-4 py-2 text-sm font-medium text-stone-900 transition hover:border-[#d4bf99] hover:bg-[#ead7b2]"
            >
              {guidance.primaryAction.label}
            </Link>
          ) : null}

          {guidance.secondaryAction?.path ? (
            <Link
              to={guidance.secondaryAction.path}
              className="inline-flex items-center rounded-full border border-[#e8decf] bg-[#fffaf4] px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-[#d9c8ac] hover:bg-white hover:text-stone-950"
            >
              {guidance.secondaryAction.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function BusinessMemoryLine({ label, text }) {
  return (
    <div className={softRowClasses()}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-stone-600">
        {text}
      </div>
    </div>
  );
}

function BusinessMemoryBlock({ memory }) {
  if (!memory?.visible) return null;

  return (
    <section className={sectionClasses()}>
      <div className="relative space-y-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            Business Memory
          </div>
          <div className="text-[23px] font-semibold tracking-[-0.045em] text-stone-900">
            {memory.headline}
          </div>
          <div className="max-w-3xl text-sm leading-6 text-stone-600">
            {memory.description}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <BusinessMemoryLine label="What we currently know" text={memory.currentKnown} />
          <BusinessMemoryLine label="What may have changed" text={memory.mayHaveChanged} />
          <BusinessMemoryLine label="What needs confirmation" text={memory.needsConfirmation} />
          <BusinessMemoryLine label="What is blocked" text={memory.blocked} />
          <BusinessMemoryLine label="What recently became reliable" text={memory.recentlyReliable} />
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          {memory.primaryAction?.path ? (
            <Link
              to={memory.primaryAction.path}
              className="inline-flex items-center rounded-full border border-[#dfcfb2] bg-[#efe0c0] px-4 py-2 text-sm font-medium text-stone-900 transition hover:border-[#d4bf99] hover:bg-[#ead7b2]"
            >
              {memory.primaryAction.label}
            </Link>
          ) : null}

          {memory.secondaryAction?.path ? (
            <Link
              to={memory.secondaryAction.path}
              className="inline-flex items-center rounded-full border border-[#e8decf] bg-[#fffaf4] px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-[#d9c8ac] hover:bg-white hover:text-stone-950"
            >
              {memory.secondaryAction.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
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
        'Supported commands are limited in Phase 3. Try "continue setup", "review business changes", or "open inbox".'
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
    <div className="mx-auto max-w-[1080px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div className="space-y-3 px-1">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            Workspace
          </div>
          <div className="text-[34px] font-semibold tracking-[-0.055em] text-stone-950">
            Command Workspace
          </div>
          <div className="max-w-3xl text-[15px] leading-7 text-stone-600">
            A lightweight operating brief across setup, business memory, inbox, and publishing.
          </div>
          {workspace.error ? (
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {workspace.error}
            </div>
          ) : null}
        </div>

        <CommandBar
          value={command}
          onChange={setCommand}
          onSubmit={handleSubmit}
          onSuggestedAction={handleIntent}
          suggestedActions={workspace.suggestedActions || []}
          statusMessage={commandStatus}
        />

        <Section
          id="workspace-brief"
          eyebrow="System Brief"
          title="What matters right now"
          items={[workspace.systemBrief].filter(Boolean)}
          emptyMessage="The workspace will summarize the current operating state here."
        >
          <div className="grid gap-3 md:grid-cols-3">
            <BriefLine label="What changed" text={workspace.systemBrief.changed} />
            <BriefLine label="What matters most" text={workspace.systemBrief.mattersMost} />
            <BriefLine label="Safe to ignore" text={workspace.systemBrief.safeToIgnore} />
          </div>
        </Section>

        <SetupGuidanceBlock guidance={workspace.setupGuidance} />

        <BusinessMemoryBlock memory={workspace.businessMemory} />

        <Section
          id="workspace-decisions"
          eyebrow="Active Decisions"
          title="Human decisions"
          items={workspace.decisions}
          emptyMessage="No explicit human decision is waiting right now."
          highlighted={focusSection === "decisions"}
        >
          <div className="space-y-3">
            {workspace.decisions.map((item) => (
              <NarrationRow
                key={item.id}
                item={item}
                expanded={expandedRows[item.id] === true}
                onToggle={() => toggleExpanded(item.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          id="workspace-capabilities"
          eyebrow="Capability Summary"
          title="Current capability posture"
          items={workspace.capabilities}
          emptyMessage="Capability posture is not available yet."
          highlighted={focusSection === "capabilities"}
        >
          <div className="space-y-3">
            {workspace.capabilities.map((item) => (
              <CapabilityRow
                key={item.id}
                item={item}
                expanded={expandedRows[item.id] === true}
                onToggle={() => toggleExpanded(item.id)}
              />
            ))}
          </div>
        </Section>

        <Section
          id="workspace-outcomes"
          eyebrow="Recent Outcomes"
          title="Recent system outcomes"
          items={workspace.recentOutcomes}
          emptyMessage="Recent outcomes will appear here as the system completes work."
          highlighted={focusSection === "outcomes"}
        >
          <div className="space-y-3">
            {workspace.recentOutcomes.map((item) => (
              <NarrationRow
                key={item.id}
                item={item}
                expanded={expandedRows[item.id] === true}
                onToggle={() => toggleExpanded(item.id)}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
