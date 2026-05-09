import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Globe2,
  KeyRound,
  MessageSquare,
  RefreshCw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppIcon from "../components/ui/AppIcon.jsx";
import AppStatCard from "../components/ui/AppStatCard.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import {
  AppTableCard,
  AppTableCell,
  AppTableHeaderCell,
  AppTableHeaderRow,
  AppTableRow,
  AppTableText,
  AppTableToolbar,
} from "../components/ui/AppTable.jsx";
import {
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const TABLE_MIN_WIDTH = "min-w-[1040px] w-full";

const TABLE_GRID_STYLE = {
  gridTemplateColumns: "minmax(320px,1fr) 150px 140px 160px 128px",
};

const CHECKS = [
  {
    id: "workspace-profile",
    title: "Workspace profile",
    description: "Workspace name, public identity, and support contact are configured.",
    area: "Foundation",
    owner: "System",
    status: "ready",
    icon: Globe2,
    action: "Review",
  },
  {
    id: "email-verification",
    title: "Email verification",
    description: "Primary operator email is verified before sensitive actions are enabled.",
    area: "Security",
    owner: "Operator",
    status: "ready",
    icon: KeyRound,
    action: "View",
  },
  {
    id: "channel-routing",
    title: "Channel routing",
    description: "Connected channels are able to create inbox threads and route replies.",
    area: "Customer Ops",
    owner: "Operator",
    status: "review",
    icon: MessageSquare,
    action: "Fix",
  },
  {
    id: "lead-capture",
    title: "Lead capture",
    description: "Qualified conversations can create lead and customer records.",
    area: "Customer Ops",
    owner: "System",
    status: "ready",
    icon: CircleDot,
    action: "Review",
  },
  {
    id: "knowledge-sources",
    title: "Knowledge sources",
    description: "Trusted answer sources are indexed and excluded sources are disabled.",
    area: "Assistant",
    owner: "Operator",
    status: "review",
    icon: ShieldCheck,
    action: "Review",
  },
  {
    id: "team-access",
    title: "Team access",
    description: "Owner, admin, and operator roles are assigned correctly.",
    area: "Governance",
    owner: "Owner",
    status: "ready",
    icon: Users,
    action: "Review",
  },
  {
    id: "sensitive-actions",
    title: "Sensitive action guard",
    description: "Destructive or customer-impacting actions require protected confirmation.",
    area: "Security",
    owner: "System",
    status: "ready",
    icon: ShieldCheck,
    action: "View",
  },
  {
    id: "production-smoke",
    title: "Production smoke check",
    description: "Health, release identity, and workspace lane checks must pass before launch.",
    area: "Release",
    owner: "System",
    status: "blocked",
    icon: Rocket,
    action: "Run",
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

function LaunchProgress({ ready, total }) {
  const percent = total ? Math.round((ready / total) * 100) : 0;

  return (
    <Card padded={false} clip>
      <div className="grid gap-5 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div className="min-w-0">
          <div className="text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            Launch readiness
          </div>

          <div className="mt-1 text-[13px] font-medium leading-5 text-text-muted">
            Complete blocked and review items before opening the workspace to real customers.
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-md bg-surface-subtle">
            <div
              className="h-full rounded-md bg-brand transition-[width] duration-300 ease-premium"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="lg:text-right">
          <div className="text-[32px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
            {percent}%
          </div>
          <div className="mt-1 text-[12.5px] font-semibold text-text-muted">
            {ready} of {total} checks ready
          </div>
        </div>
      </div>
    </Card>
  );
}

function CheckIdentity({ check }) {
  const Icon = check.icon || CheckCircle2;

  return (
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
          {check.title}
        </div>

        <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
          {check.description}
        </div>
      </div>
    </div>
  );
}

function LaunchRow({ check }) {
  return (
    <AppTableRow
      minWidthClass={TABLE_MIN_WIDTH}
      gridStyle={TABLE_GRID_STYLE}
      className="min-h-[64px]"
    >
      <AppTableCell>
        <CheckIdentity check={check} />
      </AppTableCell>

      <AppTableCell>
        <AppTag>{check.area}</AppTag>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={statusTone(check.status)}>
          {statusLabel(check.status)}
        </AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{check.owner}</AppTableText>
      </AppTableCell>

      <AppTableCell align="right">
        <Button
          type="button"
          size="sm"
          variant={lower(check.status) === "blocked" ? "primary" : "secondary"}
          rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.15} />}
        >
          {check.action}
        </Button>
      </AppTableCell>
    </AppTableRow>
  );
}

function LaunchTable({ checks }) {
  return (
    <AppTableCard>
      <AppTableToolbar
        title="Readiness checks"
        description="Operational requirements required before launch."
      />

      <div className="overflow-x-auto">
        <div className={TABLE_MIN_WIDTH}>
          <AppTableHeaderRow minWidthClass="w-full" gridStyle={TABLE_GRID_STYLE}>
            <AppTableHeaderCell>Check</AppTableHeaderCell>
            <AppTableHeaderCell>Area</AppTableHeaderCell>
            <AppTableHeaderCell>Status</AppTableHeaderCell>
            <AppTableHeaderCell>Owner</AppTableHeaderCell>
            <AppTableHeaderCell align="right">Action</AppTableHeaderCell>
          </AppTableHeaderRow>

          {checks.map((check) => (
            <LaunchRow key={check.id} check={check} />
          ))}
        </div>
      </div>
    </AppTableCard>
  );
}

export default function LaunchChecklist() {
  const [filter, setFilter] = useState("All");

  const filteredChecks = useMemo(() => {
    if (filter === "All") return CHECKS;
    return CHECKS.filter((check) => lower(check.status) === lower(filter));
  }, [filter]);

  const metrics = useMemo(() => {
    const total = CHECKS.length;
    const ready = CHECKS.filter((check) => lower(check.status) === "ready").length;
    const review = CHECKS.filter((check) => lower(check.status) === "review").length;
    const blocked = CHECKS.filter((check) => lower(check.status) === "blocked").length;

    return { total, ready, review, blocked };
  }, []);

  return (
    <PageCanvas>
      <PageHeader
        title="Launch checklist"
        description="Track production readiness, governance, routing, and operational launch blockers."
        actions={
          <Button
            type="button"
            variant="secondary"
            size="md"
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard icon={Rocket} label="Total checks" value={metrics.total} />
        <AppStatCard icon={CheckCircle2} label="Ready" value={metrics.ready} />
        <AppStatCard icon={ShieldAlert} label="Needs review" value={metrics.review} />
        <AppStatCard icon={ShieldAlert} label="Blocked" value={metrics.blocked} />
      </div>

      <LaunchProgress ready={metrics.ready} total={metrics.total} />

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

      <LaunchTable checks={filteredChecks} />
    </PageCanvas>
  );
}