import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input from "../components/ui/Input.jsx";
import AppIcon from "../components/ui/AppIcon.jsx";
import AppIconButton from "../components/ui/AppIconButton.jsx";
import AppPaginationFooter from "../components/ui/AppPaginationFooter.jsx";
import AppStatCard from "../components/ui/AppStatCard.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import {
  AppFilterAction,
  AppFilterMenuShell,
  AppFilterOption,
  AppFilterSearchInput,
  AppMultiSelectMenu,
  AppTableHeaderFilter,
  normalizeAppFilterList,
  toggleAppFilterListValue,
} from "../components/ui/AppTableFilters.jsx";
import {
  AppTableCard,
  AppTableCell,
  AppTableEmptyState,
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

const PAGE_SIZE = 7;

const TABLE_MIN_WIDTH = "min-w-[1180px] w-full";

const TABLE_GRID_STYLE = {
  gridTemplateColumns:
    "320px minmax(260px,1fr) 150px 150px 150px 130px 96px",
};

const TYPE_PRIORITY = ["document", "website", "faq", "policy"];
const STATUS_PRIORITY = ["ready", "syncing", "needs review", "disabled"];

const SOURCES = [
  {
    id: "kb_001",
    title: "AIHQ product overview",
    type: "document",
    status: "ready",
    owner: "system",
    chunks: 84,
    updated_at: daysAgo(0),
    description: "Core platform positioning, capabilities, and product language.",
  },
  {
    id: "kb_002",
    title: "Website service FAQ",
    type: "faq",
    status: "ready",
    owner: "operator",
    chunks: 42,
    updated_at: daysAgo(1),
    description: "Frequently asked questions for website build and automation services.",
  },
  {
    id: "kb_003",
    title: "Pricing and proposal rules",
    type: "policy",
    status: "needs review",
    owner: "Emil",
    chunks: 28,
    updated_at: daysAgo(2),
    description: "Proposal boundaries, pricing notes, and handoff requirements.",
  },
  {
    id: "kb_004",
    title: "Public website copy",
    type: "website",
    status: "syncing",
    owner: "system",
    chunks: 66,
    updated_at: daysAgo(0),
    description: "Synced website content used for public-facing assistant answers.",
  },
  {
    id: "kb_005",
    title: "Automation onboarding guide",
    type: "document",
    status: "ready",
    owner: "operator",
    chunks: 51,
    updated_at: daysAgo(3),
    description: "Steps for qualifying automation projects and collecting requirements.",
  },
  {
    id: "kb_006",
    title: "Customer support boundaries",
    type: "policy",
    status: "ready",
    owner: "system",
    chunks: 19,
    updated_at: daysAgo(5),
    description: "Rules for escalation, unsupported claims, and sensitive actions.",
  },
  {
    id: "kb_007",
    title: "Legacy launch checklist",
    type: "document",
    status: "disabled",
    owner: "system",
    chunks: 17,
    updated_at: daysAgo(8),
    description: "Old launch checklist retained for reference but excluded from answers.",
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

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
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

function updatedTimestamp(source = {}) {
  const date = new Date(source.updated_at);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function sourceIcon(type = "") {
  const safe = lower(type);

  if (safe === "website") return Globe2;
  if (safe === "faq") return BookOpen;
  if (safe === "policy") return Database;

  return FileText;
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "ready") return "success";
  if (safe === "syncing") return "brand";
  if (safe === "needs review") return "warning";
  if (safe === "disabled") return "neutral";

  return "neutral";
}

function createDefaultFilters() {
  return {
    source: "",
    types: [],
    statuses: [],
    owner: "",
    updatedSort: "newest",
  };
}

function countActiveFilters(filters = {}) {
  return [
    s(filters.source),
    normalizeAppFilterList(filters.types).length ? "types" : "",
    normalizeAppFilterList(filters.statuses).length ? "statuses" : "",
    s(filters.owner),
    filters.updatedSort && filters.updatedSort !== "newest" ? "updatedSort" : "",
  ].filter(Boolean).length;
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

function sourceComparator(sortValue = "newest") {
  return (a, b) => {
    const aTime = updatedTimestamp(a);
    const bTime = updatedTimestamp(b);

    if (sortValue === "oldest") return aTime - bTime;
    return bTime - aTime;
  };
}

function matchesSource(source = {}, query = "") {
  const q = lower(query);
  if (!q) return true;

  return lower(
    [
      source.title,
      source.description,
      source.type,
      source.status,
      source.owner,
    ].join(" ")
  ).includes(q);
}

function KnowledgeSourceIdentity({ source }) {
  const Icon = sourceIcon(source.type);

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
          {source.title}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
          {source.description}
        </div>
      </div>
    </div>
  );
}

function KnowledgeRow({ source }) {
  return (
    <AppTableRow
      minWidthClass={TABLE_MIN_WIDTH}
      gridStyle={TABLE_GRID_STYLE}
      className="min-h-[62px]"
    >
      <AppTableCell>
        <KnowledgeSourceIdentity source={source} />
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{source.description}</AppTableText>
      </AppTableCell>

      <AppTableCell>
        <AppTag>{titleize(source.type)}</AppTag>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={statusTone(source.status)}>
          {titleize(source.status)}
        </AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{titleize(source.owner)}</AppTableText>
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{formatDate(source.updated_at)}</AppTableText>
      </AppTableCell>

      <AppTableCell align="right">
        <div className="flex items-center justify-end gap-2">
          <AppIconButton label="Open source">
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} />
          </AppIconButton>
        </div>
      </AppTableCell>
    </AppTableRow>
  );
}

function KnowledgeTable({
  sources,
  filters,
  openFilter,
  typeOptions,
  statusOptions,
  activeFilterCount,
  onOpenFilter,
  onPatchFilters,
  onClearFilters,
}) {
  return (
    <AppTableCard>
      <AppTableToolbar
        title="Knowledge sources"
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
              id="source"
              label="Source"
              openFilter={openFilter}
              active={Boolean(filters.source)}
              onOpen={onOpenFilter}
            >
              <AppFilterSearchInput
                value={filters.source}
                onChange={(value) => onPatchFilters({ source: value })}
                placeholder="Search source"
              />
              <AppFilterMenuShell>
                <AppFilterAction
                  onClick={() => onPatchFilters({ source: "" })}
                  disabled={!filters.source}
                >
                  Clear source filter
                </AppFilterAction>
              </AppFilterMenuShell>
            </AppTableHeaderFilter>

            <AppTableHeaderCell>Purpose</AppTableHeaderCell>

            <AppTableHeaderFilter
              id="type"
              label="Type"
              openFilter={openFilter}
              active={normalizeAppFilterList(filters.types).length > 0}
              onOpen={onOpenFilter}
            >
              <AppMultiSelectMenu
                options={typeOptions}
                selectedValues={filters.types}
                allLabel="All types"
                onClear={() => onPatchFilters({ types: [] })}
                onToggle={(value) =>
                  onPatchFilters({
                    types: toggleAppFilterListValue(filters.types, value),
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
              id="owner"
              label="Owner"
              openFilter={openFilter}
              active={Boolean(filters.owner)}
              onOpen={onOpenFilter}
            >
              <AppFilterSearchInput
                value={filters.owner}
                onChange={(value) => onPatchFilters({ owner: value })}
                placeholder="Search owner"
              />
              <AppFilterMenuShell>
                <AppFilterAction
                  onClick={() => onPatchFilters({ owner: "" })}
                  disabled={!filters.owner}
                >
                  Clear owner filter
                </AppFilterAction>
              </AppFilterMenuShell>
            </AppTableHeaderFilter>

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

          {sources.length ? (
            sources.map((source) => <KnowledgeRow key={source.id} source={source} />)
          ) : (
            <AppTableEmptyState
              icon={<BookOpen className="h-5 w-5" strokeWidth={1.9} />}
              title="No matching sources"
              description="Adjust the active filters to bring knowledge sources back into view."
            />
          )}
        </div>
      </div>
    </AppTableCard>
  );
}

export default function Knowledge() {
  const [sources] = useState(SOURCES);
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [openFilter, setOpenFilter] = useState("");
  const [page, setPage] = useState(1);

  const typeOptions = useMemo(
    () => uniqueOptions(sources.map((source) => source.type), TYPE_PRIORITY),
    [sources]
  );

  const statusOptions = useMemo(
    () => uniqueOptions(sources.map((source) => source.status), STATUS_PRIORITY),
    [sources]
  );

  const filteredSources = useMemo(() => {
    const types = normalizeAppFilterList(filters.types);
    const statuses = normalizeAppFilterList(filters.statuses);

    return sources
      .filter((source) => matchesSource(source, filters.source))
      .filter((source) =>
        types.length ? types.includes(lower(source.type)) : true
      )
      .filter((source) =>
        statuses.length ? statuses.includes(lower(source.status)) : true
      )
      .filter((source) =>
        filters.owner ? lower(source.owner).includes(lower(filters.owner)) : true
      )
      .sort(sourceComparator(filters.updatedSort));
  }, [sources, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredSources.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredSources.slice(start, start + PAGE_SIZE);
  }, [filteredSources, safePage]);

  const metrics = useMemo(() => {
    const total = sources.length;
    const ready = sources.filter((source) => lower(source.status) === "ready").length;
    const review = sources.filter(
      (source) => lower(source.status) === "needs review"
    ).length;
    const chunks = sources.reduce((sum, source) => sum + n(source.chunks), 0);

    return { total, ready, review, chunks };
  }, [sources]);

  const activeFilterCount = countActiveFilters(filters);

  function patchFilters(next = {}) {
    setFilters((current) => ({ ...current, ...next }));
    setPage(1);
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Knowledge base"
        description="Manage trusted sources used by assistants, routing, and customer-facing answers."
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
              Add source
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard icon={BookOpen} label="Sources" value={metrics.total} />
        <AppStatCard icon={CheckCircle2} label="Ready" value={metrics.ready} />
        <AppStatCard icon={Search} label="Needs review" value={metrics.review} />
        <AppStatCard icon={Database} label="Indexed chunks" value={metrics.chunks} />
      </div>

      <div className="flex justify-end">
        <div className="w-full xl:w-[420px]">
          <Input
            value={filters.source}
            onChange={(event) => patchFilters({ source: event.target.value })}
            placeholder="Search knowledge sources..."
            appearance="quiet"
            leftIcon={<Search className="h-4 w-4" strokeWidth={2.1} />}
          />
        </div>
      </div>

      <KnowledgeTable
        sources={pageItems}
        filters={filters}
        openFilter={openFilter}
        typeOptions={typeOptions}
        statusOptions={statusOptions}
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
        totalItems={filteredSources.length}
        pageSize={PAGE_SIZE}
        filtered={activeFilterCount > 0}
        onPageChange={setPage}
      />
    </PageCanvas>
  );
}