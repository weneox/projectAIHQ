import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  Command as CommandIcon,
  RefreshCw,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Badge from "../../components/ui/Badge.jsx";
import Button from "../../components/ui/Button.jsx";
import Input from "../../components/ui/Input.jsx";
import {
  CompactState,
  PageCanvas,
  PageHeader,
  Section,
  StatusBanner,
  Surface,
} from "../../components/ui/AppShellPrimitives.jsx";
import {
  getWorkspaceIntentExamples,
  parseWorkspaceIntent,
} from "../../view-models/workspaceIntents.js";
import useWorkspaceNarration from "../../view-models/useWorkspaceNarration.js";
import WorkspaceLoadingSurface from "./WorkspaceLoadingSurface.jsx";

function focusToSection(value = "") {
  switch (String(value || "").toLowerCase()) {
    case "decisions":
      return "workspace-actions";
    case "capabilities":
      return "workspace-posture";
    case "outcomes":
      return "workspace-outcomes";
    default:
      return "";
  }
}

function toneForLabel(value = "") {
  switch (String(value || "").toLowerCase()) {
    case "danger":
      return "danger";
    case "warn":
      return "warn";
    case "success":
      return "success";
    case "info":
      return "info";
    default:
      return "neutral";
  }
}

function OperatorConsole({
  value,
  onChange,
  onSubmit,
  onSuggestedAction,
  suggestedActions,
  statusMessage,
  nextBestAction,
  systemBrief,
  onPrimaryAction,
}) {
  const examples = useMemo(() => getWorkspaceIntentExamples(), []);
  const visibleSuggestions = suggestedActions.filter(
    (item) => item.id !== nextBestAction?.id
  );

  return (
    <Surface className="space-y-3">
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-[760px] space-y-1.5">
          <div className="text-sm font-medium text-text-muted">Next best action</div>
          <div className="text-xl font-semibold tracking-[-0.02em] text-text">
            {nextBestAction?.title || "Workspace is clear enough to monitor, not intervene."}
          </div>
          <div className="text-sm leading-5 text-text-muted">
            {nextBestAction?.impact || systemBrief?.mattersMost}
          </div>
        </div>
        {nextBestAction?.action?.path ? (
          <Button type="button" onClick={() => onPrimaryAction(nextBestAction.action)}>
            {nextBestAction.action.label}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 border-y border-line-soft py-3 md:grid-cols-3">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            Latest change
          </div>
          <div className="text-sm leading-5 text-text">{systemBrief?.changed}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            Needs attention
          </div>
          <div className="text-sm leading-5 text-text">{systemBrief?.mattersMost}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-[0.08em] text-text-muted">
            Can wait
          </div>
          <div className="text-sm leading-5 text-text">{systemBrief?.safeToIgnore}</div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-2">
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder='Try "continue setup" or "open inbox"'
          leftIcon={<CommandIcon className="h-4 w-4" />}
        />

        {visibleSuggestions.length ? (
          <div className="flex flex-wrap gap-2">
            {visibleSuggestions.slice(0, 4).map((action) => (
              <Button
                key={action.id}
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onSuggestedAction(action)}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {action.label}
              </Button>
            ))}
          </div>
        ) : null}

        <div className="text-sm text-text-muted">Examples: {examples.join(" | ")}</div>

        {statusMessage ? (
          <div className="rounded-md border border-line bg-surface-muted px-4 py-3 text-sm text-text-muted">
            {statusMessage}
          </div>
        ) : null}
      </form>
    </Surface>
  );
}

function ActionQueue({ items, onAction }) {
  if (!items.length) {
    return (
      <CompactState
        title="No immediate operator action"
        description="Workspace signals are not asking for a manual step right now."
      />
    );
  }

  return (
    <div className="grid gap-2.5">
      {items.map((item) => (
        <Surface key={item.id} padded="sm" className="space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <Badge tone={toneForLabel(item.tone)} variant="subtle">
                {item.status}
              </Badge>
              <div className="text-base font-semibold text-text">{item.title}</div>
              <div className="max-w-[720px] text-sm leading-5 text-text-muted">
                {item.impact}
              </div>
            </div>
            {item.action?.path ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onAction(item.action)}
              >
                {item.action.label}
              </Button>
            ) : null}
          </div>
        </Surface>
      ))}
    </div>
  );
}

function PostureGrid({ items, onAction }) {
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {items.map((item) => (
        <Surface key={item.id} padded="sm" className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-medium text-text">{item.label}</div>
            <Badge tone={toneForLabel(item.tone)} variant="subtle">
              {item.statusLabel}
            </Badge>
          </div>
          <div className="text-sm leading-5 text-text-muted">{item.summary}</div>
          {item.action?.path ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => onAction(item.action)}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              {item.action.label}
            </Button>
          ) : null}
        </Surface>
      ))}
    </div>
  );
}

function OutcomesList({ items, onAction, hasPartialSignal }) {
  if (!items.length) {
    return (
      <CompactState
        title={hasPartialSignal ? "Recent outcomes are limited" : "No recent outcomes yet"}
        description={
          hasPartialSignal
            ? "No trustworthy recent outcome is available from the live workspace signal."
            : "No recent completed work is worth showing yet."
        }
      />
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <Surface key={item.id} padded="sm" className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={toneForLabel(item.tone)} variant="subtle">
              {item.label}
            </Badge>
            <div className="text-base font-semibold text-text">{item.title}</div>
          </div>
          <div className="text-sm leading-5 text-text-muted">{item.summary}</div>
          {item.nextAction?.path ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => onAction(item.nextAction)}
              rightIcon={<ChevronRight className="h-4 w-4" />}
            >
              {item.nextAction.label}
            </Button>
          ) : null}
        </Surface>
      ))}
    </div>
  );
}

export default function WorkspacePage() {
  const workspace = useWorkspaceNarration();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [command, setCommand] = useState("");
  const [commandStatus, setCommandStatus] = useState("");

  const focusSection = searchParams.get("focus") || "";
  const focusedSectionId = focusToSection(focusSection);

  useEffect(() => {
    if (!focusedSectionId) return;
    const element = document.getElementById(focusedSectionId);
    if (element) {
      element.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [focusedSectionId]);

  function applyWorkspaceFocus(nextFocus = "") {
    const next = new URLSearchParams(searchParams);
    if (nextFocus) next.set("focus", nextFocus);
    else next.delete("focus");
    setSearchParams(next, { replace: false });
  }

  function navigateFromAction(action = null) {
    if (!action?.path) return;
    navigate(action.path);
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
    <PageCanvas className="space-y-4 px-4 py-5 md:px-6 md:py-7 xl:px-0">
      <PageHeader
        eyebrow="Support surface"
        title="Operator workspace"
        description="Cross-surface brief and control view behind the primary inbox, comments, and voice operating path."
        className="gap-4 pb-4"
      />

      {workspace.availabilityNotice?.title ? (
        <StatusBanner
          tone={workspace.availabilityNotice.partial ? "warning" : "danger"}
          label={workspace.availabilityNotice.partial ? "Limited signal" : "Unavailable"}
          title={workspace.availabilityNotice.title}
          description={workspace.availabilityNotice.description}
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => workspace.refetch?.()}
              leftIcon={
                <RefreshCw
                  className={workspace.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                />
              }
            >
              Retry
            </Button>
          }
        />
      ) : null}

      <OperatorConsole
        value={command}
        onChange={setCommand}
        onSubmit={handleSubmit}
        onSuggestedAction={handleIntent}
        suggestedActions={workspace.suggestedActions || []}
        statusMessage={commandStatus}
        nextBestAction={workspace.nextBestAction}
        systemBrief={workspace.systemBrief}
        onPrimaryAction={navigateFromAction}
      />

      <div id="workspace-actions">
        <Section
          eyebrow="Needs action now"
          title="What needs action now"
          description="Only the shortest list of items that still need an operator step."
          className="space-y-3"
        >
          <ActionQueue
            items={workspace.actionItems || []}
            onAction={navigateFromAction}
          />
        </Section>
      </div>

      <div id="workspace-posture">
        <Section
          eyebrow="System posture"
          title="System posture"
          description="Where the workspace is stable, constrained, or temporarily unavailable."
          className="space-y-3"
        >
          <PostureGrid
            items={workspace.postureItems || []}
            onAction={navigateFromAction}
          />
        </Section>
      </div>

      <div id="workspace-outcomes">
        <Section
          eyebrow="Recent outcomes"
          title="Recent outcomes"
          description="Recent work worth knowing about."
          className="space-y-3"
        >
          <OutcomesList
            items={workspace.outcomeItems || []}
            onAction={navigateFromAction}
            hasPartialSignal={workspace.availabilityNotice?.partial}
          />
        </Section>
      </div>
    </PageCanvas>
  );
}
