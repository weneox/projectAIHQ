import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Database,
  ExternalLink,
  FileCheck2,
  Filter,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import AppIcon from "../../components/ui/AppIcon.jsx";
import AppIconButton from "../../components/ui/AppIconButton.jsx";
import AppPaginationFooter from "../../components/ui/AppPaginationFooter.jsx";
import AppStatCard from "../../components/ui/AppStatCard.jsx";
import AppStatusText from "../../components/ui/AppStatusText.jsx";
import AppTag from "../../components/ui/AppTag.jsx";
import {
  AppFilterAction,
  AppFilterMenuShell,
  AppFilterOption,
  AppFilterSearchInput,
  AppMultiSelectMenu,
  AppTableHeaderFilter,
  normalizeAppFilterList,
  toggleAppFilterListValue,
} from "../../components/ui/AppTableFilters.jsx";
import {
  AppTableCard,
  AppTableCell,
  AppTableEmptyState,
  AppTableHeaderCell,
  AppTableHeaderRow,
  AppTableRow,
  AppTableText,
  AppTableToolbar,
} from "../../components/ui/AppTable.jsx";
import {
  PageCanvas,
  PageHeader,
} from "../../components/ui/AppShellPrimitives.jsx";

const PAGE_SIZE = 7;

const TABLE_MIN_WIDTH = "min-w-[1240px] w-full";

const TABLE_GRID_STYLE = {
  gridTemplateColumns:
    "minmax(340px,1fr) 150px 145px 130px minmax(220px,0.8fr) 150px 112px",
};

const AREA_PRIORITY = [
  "identity",
  "auth",
  "routing",
  "inbox",
  "knowledge",
  "release",
];

const STATUS_PRIORITY = ["verified", "review", "stale", "blocked"];
const RISK_PRIORITY = ["high", "medium", "low"];

const TRUTH_RECORDS = [
  {
    id: "truth_identity_001",
    title: "Workspace identity is configured",
    description: "Workspace name, support email, and visible shell identity are present.",
    area: "identity",
    status: "verified",
    risk: "low",
    evidence: "settings.workspaceName + supportEmail",
    source: "Workspace settings",
    updated_at: daysAgo(0),
  },
  {
    id: "truth_auth_001",
    title: "Email verification protects sensitive actions",
    description: "Sensitive workspace actions stay restricted until verification completes.",
    area: "auth",
    status: "verified",
    risk: "medium",
    evidence: "verify-email gate + secure action checks",
    source: "Auth guard",
    updated_at: daysAgo(1),
  },
  {
    id: "truth_routing_001",
    title: "Inbox routing can receive connected channel threads",
    description: "Connected channels should create inbox threads and expose follow-up state.",
    area: "routing",
    status: "review",
    risk: "medium",
    evidence: "channel state + thread creation path",
    source: "Inbox routing",
    updated_at: daysAgo(1),
  },
  {
    id: "truth_leads_001",
    title: "Qualified conversations can become lead records",
    description: "Lead creation flow is visible in the sales pipeline and customer directory.",
    area: "inbox",
    status: "verified",
    risk: "low",
    evidence: "listLeads response + pipeline records",
    source: "Leads API",
    updated_at: daysAgo(0),
  },
  {
    id: "truth_knowledge_001",
    title: "Knowledge sources are trusted answer inputs",
    description: "Assistant answers should only use enabled and reviewed sources.",
    area: "knowledge",
    status: "review",
    risk: "high",
    evidence: "source status + review marker",
    source: "Knowledge base",
    updated_at: daysAgo(2),
  },
  {
    id: "truth_release_001",
    title: "Production smoke is not blocking release",
    description: "Health, release identity, and workspace lane checks must pass together.",
    area: "release",
    status: "blocked",
    risk: "high",
    evidence: "prod smoke result",
    source: "Release gate",
    updated_at: daysAgo(0),
  },
  {
    id: "truth_inbox_001",
    title: "Outbound health summary is available",
    description: "Outbound attempt state can be inspected before customer-impacting sends.",
    area: "inbox",
    status: "stale",
    risk: "medium",
    evidence: "outbound summary snapshot",
    source: "Inbox repository",
    updated_at: daysAgo(6),
  },
  {
    id: "truth_team_001",
    title: "Operator access is separated from owner access",
    description: "Owner, admin, and operator roles are visible and assignable.",
    area: "auth",
    status: "verified",
    risk: "medium",
    evidence: "team role records",
    source: "Team page",
    updated_at: daysAgo(0),
  },
];

function daysAgo(days = 0) {
  const date = new Date();
  date.setDate(date.getDate() - Number(days || 0));
  return date.toISOString();
}

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

function formatDate(value = "") {
  const raw = s(value);
  if (!raw) return "—";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function updatedTimestamp(record = {}) {
  const date = new Date(record.updated_at);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "verified") return "success";
  if (safe === "review") return "warning";
  if (safe === "blocked") return "danger";
  if (safe === "stale") return "neutral";

  return "neutral";
}

function riskTone(risk = "") {
  const safe = lower(risk);

  if (safe === "high") return "danger";
  if (safe === "medium") return "warning";
  return "success";
}

function areaIcon(area = "") {
  const safe = lower(area);

  if (safe === "auth") return ShieldCheck;
  if (safe === "routing") return Filter;
  if (safe === "knowledge") return Database;
  if (safe === "release") return ShieldAlert;
  if (safe === "inbox") return FileCheck2;

  return CheckCircle2;
}

function uniqueOptions(values = [], priority = []) {
  const priorityMap = new Map(priority.map((item, index) => [item, index]));
  const unique = [...new Set(values.map((value) => lower(value)).filter(Boolean))];

  return unique
    .sort((a, b) => {
      const aPriority = priorityMap.has(a) ? priorityMap.get(a) : 100;
      const bPriority = priorityMap.has(b) ? priorityMap.get(b) : 100;

      if (aPriority !== bPriority) return aPriority - bPriority;

      return titleize(a).localeCompare(titleize(b));
    })
    .map((value) => ({ value, label: titleize(value) }));
}

function createDefaultFilters() {
  return {
    record: "",
    areas: [],
    statuses: [],
    risks: [],
    updatedSort: "newest",
  };
}

function countActiveFilters(filters = {}) {
  return [
    s(filters.record),
    normalizeAppFilterList(filters.areas).length ? "areas" : "",
    normalizeAppFilterList(filters.statuses).length ? "statuses" : "",
    normalizeAppFilterList(filters.risks).length ? "risks" : "",
    filters.updatedSort && filters.updatedSort !== "newest" ? "updatedSort" : "",
  ].filter(Boolean).length;
}

function recordComparator(sortValue = "newest") {
  return (a, b) => {
    const aTime = updatedTimestamp(a);
    const bTime = updatedTimestamp(b);

    if (sortValue === "oldest") return aTime - bTime;
    return bTime - aTime;
  };
}

function matchesRecord(record = {}, query = "") {
  const q = lower(query);
  if (!q) return true;

  return lower(
    [
      record.title,
      record.description,
      record.area,
      record.status,
      record.risk,
      record.evidence,
      record.source,
    ].join(" ")
  ).includes(q);
}

function RecordIdentity({ record }) {
  const Icon = areaIcon(record.area);

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
          {record.title}
        </div>

        <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
          {record.description}
        </div>
      </div>
    </div>
  );
}

function TruthRow({ record }) {
  return (
    <AppTableRow
      minWidthClass={TABLE_MIN_WIDTH}
      gridStyle={TABLE_GRID_STYLE}
      className="min-h-[64px]"
    >
      <AppTableCell>
        <RecordIdentity record={record} />
      </AppTableCell>

      <AppTableCell>
        <AppTag>{titleize(record.area)}</AppTag>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={statusTone(record.status)}>
          {titleize(record.status)}
        </AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={riskTone(record.risk)}>
          {titleize(record.risk)}
        </AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{record.evidence}</AppTableText>
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{formatDate(record.updated_at)}</AppTableText>
      </AppTableCell>

      <AppTableCell align="right">
        <div className="flex justify-end gap-2">
          <AppIconButton label="Open evidence">
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} />
          </AppIconButton>

          <Button
            type="button"
            size="sm"
            variant={lower(record.status) === "blocked" ? "primary" : "secondary"}
            rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.15} />}
          >
            Review
          </Button>
        </div>
      </AppTableCell>
    </AppTableRow>
  );
}

function TruthTable({
  records,
  filters,
  openFilter,
  areaOptions,
  statusOptions,
  riskOptions,
  activeFilterCount,
  onOpenFilter,
  onPatchFilters,
  onClearFilters,
}) {
  return (
    <AppTableCard>
      <AppTableToolbar
        title="Truth records"
        description="Claims, evidence, and release-critical review state."
        filters={
          activeFilterCount ? (
            <Button type="button" variant="secondary" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          ) : null
        }
      />

      <div className="overflow-x-auto">
        <div className={TABLE_MIN_WIDTH}>
          <AppTableHeaderRow minWidthClass="w-full" gridStyle={TABLE_GRID_STYLE}>
            <AppTableHeaderFilter
              id="record"
              label="Record"
              openFilter={openFilter}
              active={Boolean(filters.record)}
              onOpen={onOpenFilter}
            >
              <AppFilterSearchInput
                value={filters.record}
                onChange={(value) => onPatchFilters({ record: value })}
                placeholder="Search record"
              />
              <AppFilterMenuShell>
                <AppFilterAction
                  onClick={() => onPatchFilters({ record: "" })}
                  disabled={!filters.record}
                >
                  Clear record filter
                </AppFilterAction>
              </AppFilterMenuShell>
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="area"
              label="Area"
              openFilter={openFilter}
              active={normalizeAppFilterList(filters.areas).length > 0}
              onOpen={onOpenFilter}
            >
              <AppMultiSelectMenu
                options={areaOptions}
                selectedValues={filters.areas}
                allLabel="All areas"
                onClear={() => onPatchFilters({ areas: [] })}
                onToggle={(value) =>
                  onPatchFilters({
                    areas: toggleAppFilterListValue(filters.areas, value),
                  })
                }
              />
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="status"
              label="Status"
              openFilter={openFilter}
              active={normalizeAppFilterList(filters.statuses).length > 0}
              onOpen={onOpenFilter}
            >
              <AppMultiSelectMenu
                options={statusOptions}
                selectedValues={filters.statuses}
                allLabel="All statuses"
                onClear={() => onPatchFilters({ statuses: [] })}
                onToggle={(value) =>
                  onPatchFilters({
                    statuses: toggleAppFilterListValue(filters.statuses, value),
                  })
                }
              />
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="risk"
              label="Risk"
              openFilter={openFilter}
              active={normalizeAppFilterList(filters.risks).length > 0}
              onOpen={onOpenFilter}
            >
              <AppMultiSelectMenu
                options={riskOptions}
                selectedValues={filters.risks}
                allLabel="All risk"
                onClear={() => onPatchFilters({ risks: [] })}
                onToggle={(value) =>
                  onPatchFilters({
                    risks: toggleAppFilterListValue(filters.risks, value),
                  })
                }
              />
            </AppTableHeaderFilter>

            <AppTableHeaderCell>Evidence</AppTableHeaderCell>

            <AppTableHeaderFilter
              id="updated"
              label="Updated"
              openFilter={openFilter}
              active={filters.updatedSort === "oldest"}
              onOpen={onOpenFilter}
            >
              <AppFilterMenuShell>
                <AppFilterOption
                  selected={filters.updatedSort === "newest"}
                  onClick={() => onPatchFilters({ updatedSort: "newest" })}
                >
                  Newest first
                </AppFilterOption>

                <AppFilterOption
                  selected={filters.updatedSort === "oldest"}
                  onClick={() => onPatchFilters({ updatedSort: "oldest" })}
                >
                  Oldest first
                </AppFilterOption>

                <AppFilterAction
                  onClick={() => onPatchFilters({ updatedSort: "newest" })}
                  disabled={filters.updatedSort === "newest"}
                >
                  Reset sort
                </AppFilterAction>
              </AppFilterMenuShell>
            </AppTableHeaderFilter>

            <AppTableHeaderCell align="right">Action</AppTableHeaderCell>
          </AppTableHeaderRow>

          {records.length ? (
            records.map((record) => <TruthRow key={record.id} record={record} />)
          ) : (
            <AppTableEmptyState
              icon={<ShieldCheck className="h-5 w-5" strokeWidth={1.9} />}
              title="No matching truth records"
              description="Adjust filters to bring governance records back into view."
            />
          )}
        </div>
      </div>
    </AppTableCard>
  );
}

export default function TruthViewerPage() {
  const [records] = useState(TRUTH_RECORDS);
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [openFilter, setOpenFilter] = useState("");
  const [page, setPage] = useState(1);

  const areaOptions = useMemo(
    () => uniqueOptions(records.map((record) => record.area), AREA_PRIORITY),
    [records]
  );

  const statusOptions = useMemo(
    () => uniqueOptions(records.map((record) => record.status), STATUS_PRIORITY),
    [records]
  );

  const riskOptions = useMemo(
    () => uniqueOptions(records.map((record) => record.risk), RISK_PRIORITY),
    [records]
  );

  const filteredRecords = useMemo(() => {
    const areas = normalizeAppFilterList(filters.areas);
    const statuses = normalizeAppFilterList(filters.statuses);
    const risks = normalizeAppFilterList(filters.risks);

    return records
      .filter((record) => matchesRecord(record, filters.record))
      .filter((record) => (areas.length ? areas.includes(lower(record.area)) : true))
      .filter((record) =>
        statuses.length ? statuses.includes(lower(record.status)) : true
      )
      .filter((record) => (risks.length ? risks.includes(lower(record.risk)) : true))
      .sort(recordComparator(filters.updatedSort));
  }, [records, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, safePage]);

  const metrics = useMemo(() => {
    const total = records.length;
    const verified = records.filter(
      (record) => lower(record.status) === "verified"
    ).length;
    const review = records.filter((record) => lower(record.status) === "review").length;
    const blocked = records.filter(
      (record) => lower(record.status) === "blocked"
    ).length;

    return { total, verified, review, blocked };
  }, [records]);

  const activeFilterCount = countActiveFilters(filters);

  function patchFilters(next = {}) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Truth review"
        description="Inspect governed system claims, supporting evidence, and release-critical verification state."
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
        <AppStatCard icon={ShieldCheck} label="Truth records" value={metrics.total} />
        <AppStatCard icon={CheckCircle2} label="Verified" value={metrics.verified} />
        <AppStatCard icon={TriangleAlert} label="Needs review" value={metrics.review} />
        <AppStatCard icon={ShieldAlert} label="Blocked" value={metrics.blocked} />
      </div>

      <TruthTable
        records={pageItems}
        filters={filters}
        openFilter={openFilter}
        areaOptions={areaOptions}
        statusOptions={statusOptions}
        riskOptions={riskOptions}
        activeFilterCount={activeFilterCount}
        onOpenFilter={setOpenFilter}
        onPatchFilters={patchFilters}
        onClearFilters={() => {
          setFilters(createDefaultFilters());
          setPage(1);
        }}
      />

      <AppPaginationFooter
        currentPage={safePage}
        totalPages={totalPages}
        totalItems={filteredRecords.length}
        pageSize={PAGE_SIZE}
        filtered={activeFilterCount > 0}
        onPageChange={setPage}
      />
    </PageCanvas>
  );
}