import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Database,
  Globe2,
  MessageSquare,
  RefreshCw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppIcon from "../components/ui/AppIcon.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const SETUP_STEPS = [
  {
    id: "workspace",
    title: "Workspace profile",
    description: "Confirm workspace identity, support email, and public routing details.",
    area: "Foundation",
    status: "ready",
    icon: Globe2,
    action: "Review",
  },
  {
    id: "channels",
    title: "Connect channels",
    description: "Choose customer entry points and route conversations into Inbox.",
    area: "Channels",
    status: "review",
    icon: MessageSquare,
    action: "Configure",
  },
  {
    id: "knowledge",
    title: "Prepare knowledge",
    description: "Add trusted sources used by assistants and customer-facing answers.",
    area: "Assistant",
    status: "ready",
    icon: Database,
    action: "Open",
  },
  {
    id: "team",
    title: "Invite operators",
    description: "Assign owner, admin, and operator access before launch.",
    area: "Governance",
    status: "ready",
    icon: Users,
    action: "Manage",
  },
  {
    id: "security",
    title: "Security controls",
    description: "Email verification and sensitive action guards are active.",
    area: "Security",
    status: "ready",
    icon: ShieldCheck,
    action: "View",
  },
  {
    id: "launch",
    title: "Launch readiness",
    description: "Run final release checks before using the workspace with real customers.",
    area: "Release",
    status: "blocked",
    icon: Rocket,
    action: "Run checks",
  },
];

const ACTIVITY = [
  {
    id: "activity-1",
    label: "Inbox routing",
    value: "Ready",
    tone: "success",
  },
  {
    id: "activity-2",
    label: "Lead capture",
    value: "Review",
    tone: "warning",
  },
  {
    id: "activity-3",
    label: "Knowledge index",
    value: "Ready",
    tone: "success",
  },
  {
    id: "activity-4",
    label: "Production smoke",
    value: "Blocked",
    tone: "danger",
  },
];

const FILTERS = ["All", "Ready", "Review", "Blocked"];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "ready") return "success";
  if (safe === "review") return "warning";
  if (safe === "blocked") return "danger";

  return "neutral";
}

function statusLabel(status = "") {
  const safe = lower(status);

  if (safe === "review") return "Needs review";
  return titleize(safe);
}

function actionVariant(status = "") {
  const safe = lower(status);

  if (safe === "blocked") return "primary";
  if (safe === "review") return "primary";

  return "secondary";
}

function SetupProgress({ ready, total, blocked }) {
  const percent = total ? Math.round((ready / total) * 100) : 0;

  return (
    <Card padded={false} clip>
      <div className="grid gap-5 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <AppIcon icon={Rocket} size="lg" tone="text" strokeWidth={2.05} />

            <div className="min-w-0">
              <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                Workspace setup
              </div>
              <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
                Finish the remaining operational checks before launch.
              </div>
            </div>
          </div>

          <div className="mt-5 h-2 overflow-hidden rounded-md bg-surface-subtle">
            <div
              className="h-full rounded-md bg-brand transition-[width] duration-300 ease-premium"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-6 xl:justify-end">
          <div>
            <div className="text-[30px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {percent}%
            </div>
            <div className="mt-1 text-[12.5px] font-semibold text-text-muted">
              {ready} of {total} ready
            </div>
          </div>

          <div className="h-12 w-px bg-line-soft" />

          <div>
            <div className="text-[30px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {blocked}
            </div>
            <div className="mt-1 text-[12.5px] font-semibold text-text-muted">
              blocked
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function SetupStepRow({ step }) {
  const Icon = step.icon || CircleDot;

  return (
    <div className="grid min-h-[72px] gap-4 border-b border-line-soft px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(320px,1fr)_140px_150px_132px] lg:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <AppIcon
          icon={Icon}
          size="lg"
          tone="text"
          strokeWidth={2.05}
          className="shrink-0"
        />

        <div className="min-w-0">
          <div className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
            {step.title}
          </div>
          <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
            {step.description}
          </div>
        </div>
      </div>

      <div>
        <AppTag>{step.area}</AppTag>
      </div>

      <div>
        <AppStatusText tone={statusTone(step.status)}>
          {statusLabel(step.status)}
        </AppStatusText>
      </div>

      <div className="lg:justify-self-end">
        <Button
          type="button"
          size="sm"
          variant={actionVariant(step.status)}
          rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.15} />}
        >
          {step.action}
        </Button>
      </div>
    </div>
  );
}

function SetupList({ steps }) {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Setup path
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Work through the remaining items in order.
        </div>
      </div>

      {steps.map((step) => (
        <SetupStepRow key={step.id} step={step} />
      ))}
    </Card>
  );
}

function WorkspaceSnapshot() {
  return (
    <Card padded={false} clip>
      <div className="border-b border-line-soft px-5 py-4">
        <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
          Workspace snapshot
        </div>
        <div className="mt-1 text-[12.5px] font-medium text-text-muted">
          Current launch posture.
        </div>
      </div>

      <div className="space-y-3 px-5 py-5">
        {ACTIVITY.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 border-b border-line-soft pb-3 last:border-b-0 last:pb-0"
          >
            <span className="text-[12px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
              {item.label}
            </span>

            <AppStatusText tone={item.tone}>{item.value}</AppStatusText>
          </div>
        ))}
      </div>
    </Card>
  );
}

function NextActionCard() {
  return (
    <Card padded={false} clip>
      <div className="px-5 py-5">
        <div className="flex items-start gap-4">
          <AppIcon
            icon={ShieldAlert}
            size="lg"
            tone="danger"
            strokeWidth={2.05}
            className="shrink-0"
          />

          <div className="min-w-0">
            <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Production smoke is blocking launch
            </div>

            <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
              Run the final release check after channel routing and knowledge review are confirmed.
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                size="md"
                rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.15} />}
              >
                Open checklist
              </Button>

              <Button type="button" variant="secondary" size="md">
                Review notes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function Welcome() {
  const [filter, setFilter] = useState("All");

  const metrics = useMemo(() => {
    const total = SETUP_STEPS.length;
    const ready = SETUP_STEPS.filter((step) => lower(step.status) === "ready").length;
    const review = SETUP_STEPS.filter((step) => lower(step.status) === "review").length;
    const blocked = SETUP_STEPS.filter((step) => lower(step.status) === "blocked").length;

    return { total, ready, review, blocked };
  }, []);

  const filteredSteps = useMemo(() => {
    if (filter === "All") return SETUP_STEPS;
    return SETUP_STEPS.filter((step) => lower(step.status) === lower(filter));
  }, [filter]);

  return (
    <PageCanvas>
      <PageHeader
        title="Welcome"
        description="Start from the operational setup path and move the workspace toward launch."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              Refresh
            </Button>

            <Button
              type="button"
              size="md"
              leftIcon={<Upload className="h-4 w-4" strokeWidth={2.1} />}
            >
              Import data
            </Button>
          </div>
        }
      />

      <SetupProgress
        ready={metrics.ready}
        total={metrics.total}
        blocked={metrics.blocked}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 border-b border-line-soft pb-5">
            {FILTERS.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={filter === item ? "primary" : "secondary"}
                onClick={() => setFilter(item)}
                className={cx(filter === item ? "" : "bg-white")}
              >
                {item}
              </Button>
            ))}
          </div>

          <SetupList steps={filteredSteps} />
        </div>

        <div className="space-y-4">
          <WorkspaceSnapshot />
          <NextActionCard />
        </div>
      </div>
    </PageCanvas>
  );
}