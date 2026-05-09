import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ExternalLink,
  Flame,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
  UserRound,
  Users,
  X,
} from "lucide-react";

import { listLeads } from "../api/leads.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppIconButton from "../components/ui/AppIconButton.jsx";
import AppIdentityMark from "../components/ui/AppIdentityMark.jsx";
import AppInfoRow from "../components/ui/AppInfoRow.jsx";
import AppPaginationFooter from "../components/ui/AppPaginationFooter.jsx";
import AppStatCard from "../components/ui/AppStatCard.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import {
  AppDetailBody,
  AppDetailEmpty,
  AppDetailHeader,
} from "../components/ui/AppDetailPane.jsx";
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
  InlineNotice,
  LoadingSurface,
  PageCanvas,
  PageHeader,
  SlidingDetailOverlay,
} from "../components/ui/AppShellPrimitives.jsx";

const PAGE_SIZE = 6;

const TABLE_MIN_WIDTH = "min-w-[1320px] w-full";

const TABLE_GRID_STYLE = {
  gridTemplateColumns:
    "280px minmax(260px,1fr) 145px 135px 135px 135px 150px 112px",
};

const STAGE_PRIORITY = [
  "new",
  "qualified",
  "discovery",
  "demo requested",
  "proposal",
  "negotiation",
  "won",
  "lost",
];

const STATUS_PRIORITY = ["open", "active", "waiting", "converted", "closed", "lost"];

const PRIORITY_PRIORITY = ["urgent", "high", "medium", "low"];

const SOURCE_PRIORITY = [
  "website",
  "instagram",
  "facebook",
  "telegram",
  "email",
  "whatsapp",
  "manual",
];

const LOCAL_LEADS = [
  {
    id: "local_lead_01",
    full_name: "Aylin Məmmədova",
    email: "lead@local.design",
    phone: "+994 50 000 00 00",
    username: "aylinm",
    source: "instagram",
    stage: "qualified",
    status: "open",
    priority: "high",
    value: 3200,
    owner: "operator",
    company: "Local Design",
    interest: "Customer profile",
    inbox_thread_id: "local_thread_lead_01",
    created_at: daysAgo(1),
    updated_at: daysAgo(0),
    last_message_text: "Asked about AI assistant setup for customer support.",
  },
  {
    id: "local_lead_02",
    full_name: "Website visitor",
    email: "lead@local.design",
    phone: "+994 50 000 00 00",
    username: "website",
    source: "website chat",
    stage: "demo requested",
    status: "open",
    priority: "medium",
    value: 1800,
    owner: "operator",
    company: "",
    interest: "Customer profile",
    inbox_thread_id: "local_thread_lead_02",
    created_at: daysAgo(1),
    updated_at: daysAgo(0),
    last_message_text: "Requested a quick demo for website chat automation.",
  },
  {
    id: "local_lead_03",
    full_name: "Marcus Hale",
    email: "marcus@northline.co",
    phone: "+44 20 4420 1882",
    username: "marcushale",
    source: "instagram",
    stage: "proposal",
    status: "open",
    priority: "urgent",
    value: 7800,
    owner: "Emil",
    company: "Northline",
    interest: "CRM automation",
    inbox_thread_id: "local_thread_lead_03",
    created_at: daysAgo(3),
    updated_at: daysAgo(0),
    last_message_text: "Waiting for automation architecture and price.",
  },
  {
    id: "local_lead_04",
    full_name: "Aylin Carter",
    email: "aylin@studioflow.ai",
    phone: "+994 50 120 32 11",
    username: "aylincarter",
    source: "website",
    stage: "qualified",
    status: "open",
    priority: "high",
    value: 4200,
    owner: "Emil",
    company: "Studioflow",
    interest: "AI website assistant",
    inbox_thread_id: "local_thread_lead_04",
    created_at: daysAgo(4),
    updated_at: daysAgo(1),
    last_message_text: "Asked for a website automation proposal.",
  },
  {
    id: "local_lead_05",
    full_name: "Maya Stone",
    email: "maya@stonecapital.ae",
    phone: "+971 55 182 9004",
    username: "mayastone",
    source: "facebook",
    stage: "qualified",
    status: "open",
    priority: "medium",
    value: 5600,
    owner: "Emil",
    company: "Stone Capital",
    interest: "Investor relations landing page",
    inbox_thread_id: "local_thread_lead_05",
    created_at: daysAgo(5),
    updated_at: daysAgo(1),
    last_message_text: "Needs premium landing page with CRM routing.",
  },
  {
    id: "local_lead_06",
    full_name: "Selin Ward",
    email: "selin@brightlabs.dev",
    phone: "+90 532 410 92 40",
    username: "selinward",
    source: "telegram",
    stage: "won",
    status: "converted",
    priority: "low",
    value: 12500,
    owner: "Emil",
    company: "Brightlabs",
    interest: "Internal AI operations dashboard",
    inbox_thread_id: "local_thread_lead_06",
    created_at: daysAgo(8),
    updated_at: daysAgo(2),
    last_message_text: "Approved the first milestone.",
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

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
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

function isLocalDesignMode() {
  const host =
    typeof window !== "undefined" ? lower(window.location.hostname) : "";

  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    Boolean(import.meta.env?.DEV)
  );
}

function normalizeResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.leads)) return payload.leads;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function leadKey(lead = {}, index = 0) {
  return s(
    lead.id ||
      lead.lead_id ||
      lead.customer_id ||
      lead.inbox_thread_id ||
      lead.inboxThreadId ||
      lead.thread_id ||
      lead.email ||
      lead.phone ||
      lead.username ||
      `lead-${index}`
  );
}

function withLocalLeads(leads = []) {
  const base = arr(leads);

  if (!isLocalDesignMode()) return base;
  if (base.length >= 4) return base;

  const existing = new Set(base.map((item, index) => leadKey(item, index)));

  return [
    ...base,
    ...LOCAL_LEADS.filter((item, index) => !existing.has(leadKey(item, index))),
  ];
}

function leadName(lead = {}) {
  return s(
    lead.full_name ||
      lead.fullName ||
      lead.name ||
      lead.display_name ||
      lead.customer_name ||
      lead.lead_name ||
      lead.username ||
      lead.email ||
      lead.phone ||
      "Unknown lead"
  );
}

function leadCompany(lead = {}) {
  return s(lead.company || lead.company_name || lead.business || lead.organization);
}

function leadContact(lead = {}) {
  return [s(lead.email), s(lead.phone), s(lead.username)]
    .filter(Boolean)
    .join("  •  ");
}

function leadEmail(lead = {}) {
  return s(lead.email || lead.user_email);
}

function leadPhone(lead = {}) {
  return s(lead.phone || lead.phone_number);
}

function leadSource(lead = {}) {
  return lower(
    lead.source ||
      lead.channel ||
      lead.channel_type ||
      lead.provider ||
      lead.source_type ||
      "direct"
  );
}

function leadStage(lead = {}) {
  return lower(
    lead.displayStage ||
      lead.display_stage ||
      lead.stageLabel ||
      lead.stage ||
      lead.pipeline_stage ||
      "new"
  );
}

function leadStatus(lead = {}) {
  return lower(
    lead.displayStatus ||
      lead.display_status ||
      lead.statusLabel ||
      lead.status ||
      "open"
  );
}

function leadPriority(lead = {}) {
  return lower(
    lead.displayPriority ||
      lead.display_priority ||
      lead.priorityLabel ||
      lead.priority ||
      lead.urgency ||
      "medium"
  );
}

function leadValue(lead = {}) {
  return n(
    lead.value_azn ??
      lead.valueAzn ??
      lead.value ??
      lead.estimated_value ??
      lead.deal_value ??
      lead.amount ??
      0
  );
}

function leadOwner(lead = {}) {
  return s(
    lead.owner ||
      lead.owner_name ||
      lead.assigned_to ||
      lead.assignee ||
      lead.operator ||
      "Unassigned"
  );
}

function leadThreadId(lead = {}) {
  return s(lead.inbox_thread_id || lead.inboxThreadId || lead.thread_id);
}

function leadUpdatedRaw(lead = {}) {
  return s(lead.updated_at || lead.updatedAt || lead.created_at || lead.createdAt);
}

function leadCreatedRaw(lead = {}) {
  return s(lead.created_at || lead.createdAt || lead.updated_at || lead.updatedAt);
}

function updatedTimestamp(lead = {}) {
  const date = new Date(leadUpdatedRaw(lead));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
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

function formatMoney(value = 0) {
  const amount = n(value);
  if (!amount) return "—";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AZN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function initialsFromName(value = "") {
  const parts = s(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return "L";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function stageTone(stage = "") {
  const safe = lower(stage);

  if (["won", "converted", "customer"].includes(safe)) return "success";
  if (["proposal", "negotiation", "demo requested"].includes(safe)) return "brand";
  if (["qualified", "discovery"].includes(safe)) return "info";
  if (["lost", "closed_lost"].includes(safe)) return "danger";
  return "neutral";
}

function statusTone(status = "") {
  const safe = lower(status);

  if (["won", "converted", "active", "resolved"].includes(safe)) return "success";
  if (["pending", "waiting", "invited"].includes(safe)) return "warning";
  if (["lost", "closed", "disabled", "blocked"].includes(safe)) return "danger";
  return "brand";
}

function priorityTone(priority = "") {
  const safe = lower(priority);

  if (safe === "urgent") return "danger";
  if (safe === "high") return "warning";
  if (safe === "low") return "neutral";
  return "brand";
}

function sourceTone() {
  return "neutral";
}

function matchesText(lead = {}, query = "") {
  const q = lower(query);
  if (!q) return true;

  return lower(
    [
      leadName(lead),
      leadCompany(lead),
      leadContact(lead),
      titleize(leadSource(lead)),
      titleize(leadStage(lead)),
      titleize(leadStatus(lead)),
      titleize(leadPriority(lead)),
      leadOwner(lead),
      lead.interest,
      lead.latestMessageText,
      lead.latest_message_text,
      lead.lastMessageText,
      lead.last_message_text,
      lead.latest_message,
    ].join(" ")
  ).includes(q);
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
    lead: "",
    contact: "",
    sources: [],
    stages: [],
    priorities: [],
    statuses: [],
    updatedSort: "newest",
  };
}

function countActiveFilters(filters = {}) {
  return [
    s(filters.lead),
    s(filters.contact),
    normalizeAppFilterList(filters.sources).length ? "sources" : "",
    normalizeAppFilterList(filters.stages).length ? "stages" : "",
    normalizeAppFilterList(filters.priorities).length ? "priorities" : "",
    normalizeAppFilterList(filters.statuses).length ? "statuses" : "",
    filters.updatedSort && filters.updatedSort !== "newest" ? "updatedSort" : "",
  ].filter(Boolean).length;
}

function leadComparator(sortValue = "newest") {
  return (a, b) => {
    const aTime = updatedTimestamp(a);
    const bTime = updatedTimestamp(b);

    if (sortValue === "oldest") return aTime - bTime;
    return bTime - aTime;
  };
}

function LeadIdentity({ lead }) {
  const name = leadName(lead);
  const company = leadCompany(lead);

  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <AppIdentityMark label={initialsFromName(name)} />
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {name}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
          {company || s(lead.interest) || "Lead profile"}
        </div>
      </div>
    </div>
  );
}

function LeadRow({ lead, selected, onOpenThread, onOpenDetail }) {
  const source = leadSource(lead);
  const stage = leadStage(lead);
  const priority = leadPriority(lead);
  const status = leadStatus(lead);
  const threadId = leadThreadId(lead);

  return (
    <AppTableRow
      selected={selected}
      onClick={onOpenDetail}
      minWidthClass={TABLE_MIN_WIDTH}
      gridStyle={TABLE_GRID_STYLE}
      className="min-h-[58px]"
    >
      <AppTableCell>
        <LeadIdentity lead={lead} />
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{leadContact(lead) || "No contact details"}</AppTableText>
      </AppTableCell>

      <AppTableCell>
        <AppTag tone={sourceTone(source)}>{titleize(source)}</AppTag>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={stageTone(stage)}>{titleize(stage)}</AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={priorityTone(priority)}>{titleize(priority)}</AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={statusTone(status)}>{titleize(status)}</AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{formatDate(leadUpdatedRaw(lead))}</AppTableText>
      </AppTableCell>

      <AppTableCell align="right">
        <div className="flex items-center justify-end gap-2">
          <AppIconButton
            label="View lead"
            onClick={(event) => {
              event.stopPropagation();
              onOpenDetail?.();
            }}
          >
            <UserRound className="h-3.5 w-3.5" strokeWidth={2.1} />
          </AppIconButton>

          {threadId ? (
            <AppIconButton
              label="Open thread"
              onClick={(event) => {
                event.stopPropagation();
                onOpenThread?.(threadId);
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.1} />
            </AppIconButton>
          ) : (
            <AppIconButton disabled label="No thread">
              —
            </AppIconButton>
          )}
        </div>
      </AppTableCell>
    </AppTableRow>
  );
}

function LeadsTable({
  leads,
  selectedKey,
  filters,
  openFilter,
  sourceOptions,
  stageOptions,
  priorityOptions,
  statusOptions,
  onOpenFilter,
  onPatchFilters,
  onClearFilters,
  activeFilterCount,
  onOpenThread,
  onOpenDetail,
}) {
  return (
    <AppTableCard>
      <AppTableToolbar
        title="Pipeline"
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
              id="lead"
              label="Lead"
              openFilter={openFilter}
              active={Boolean(filters.lead)}
              onOpen={onOpenFilter}
            >
              <AppFilterSearchInput
                value={filters.lead}
                onChange={(value) => onPatchFilters({ lead: value })}
                placeholder="Search lead"
              />
              <AppFilterMenuShell>
                <AppFilterAction
                  onClick={() => onPatchFilters({ lead: "" })}
                  disabled={!filters.lead}
                >
                  Clear lead filter
                </AppFilterAction>
              </AppFilterMenuShell>
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="contact"
              label="Contact"
              openFilter={openFilter}
              active={Boolean(filters.contact)}
              onOpen={onOpenFilter}
            >
              <AppFilterSearchInput
                value={filters.contact}
                onChange={(value) => onPatchFilters({ contact: value })}
                placeholder="Search contact"
              />
              <AppFilterMenuShell>
                <AppFilterAction
                  onClick={() => onPatchFilters({ contact: "" })}
                  disabled={!filters.contact}
                >
                  Clear contact filter
                </AppFilterAction>
              </AppFilterMenuShell>
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="source"
              label="Source"
              openFilter={openFilter}
              active={normalizeAppFilterList(filters.sources).length > 0}
              onOpen={onOpenFilter}
            >
              <AppMultiSelectMenu
                options={sourceOptions}
                selectedValues={filters.sources}
                allLabel="All sources"
                onClear={() => onPatchFilters({ sources: [] })}
                onToggle={(value) =>
                  onPatchFilters({
                    sources: toggleAppFilterListValue(filters.sources, value),
                  })
                }
              />
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="stage"
              label="Stage"
              openFilter={openFilter}
              active={normalizeAppFilterList(filters.stages).length > 0}
              onOpen={onOpenFilter}
            >
              <AppMultiSelectMenu
                options={stageOptions}
                selectedValues={filters.stages}
                allLabel="All stages"
                onClear={() => onPatchFilters({ stages: [] })}
                onToggle={(value) =>
                  onPatchFilters({
                    stages: toggleAppFilterListValue(filters.stages, value),
                  })
                }
              />
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="priority"
              label="Priority"
              openFilter={openFilter}
              active={normalizeAppFilterList(filters.priorities).length > 0}
              onOpen={onOpenFilter}
            >
              <AppMultiSelectMenu
                options={priorityOptions}
                selectedValues={filters.priorities}
                allLabel="All priorities"
                onClear={() => onPatchFilters({ priorities: [] })}
                onToggle={(value) =>
                  onPatchFilters({
                    priorities: toggleAppFilterListValue(filters.priorities, value),
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

            <AppTableHeaderCell align="right">Actions</AppTableHeaderCell>
          </AppTableHeaderRow>

          {leads.length ? (
            leads.map((lead, index) => {
              const key = leadKey(lead, index);

              return (
                <LeadRow
                  key={key}
                  lead={lead}
                  selected={selectedKey === key}
                  onOpenDetail={() => onOpenDetail(lead, key)}
                  onOpenThread={onOpenThread}
                />
              );
            })
          ) : (
            <AppTableEmptyState
              icon={<Target className="h-5 w-5" strokeWidth={1.9} />}
              title="No matching leads"
              description="Adjust the active filters to bring sales opportunities back into view."
            />
          )}
        </div>
      </div>
    </AppTableCard>
  );
}

function LeadDetailOverlay({ lead, open, onClose, onOpenThread }) {
  if (!lead) {
    return (
      <SlidingDetailOverlay
        open={open}
        onClose={onClose}
        className="!fixed !inset-auto !left-[calc(var(--shell-sidebar-w)+24px)] !right-6 !top-[calc(var(--shell-top-offset)+88px)] !bottom-6"
        panelWidthClassName="max-w-[560px]"
      >
        <Card padded={false} clip className="h-full">
          <AppDetailEmpty
            icon={<Target className="h-5 w-5" strokeWidth={1.9} />}
            title="Select a lead"
            description="Choose a row to inspect sales opportunity details."
          />
        </Card>
      </SlidingDetailOverlay>
    );
  }

  const name = leadName(lead);
  const email = leadEmail(lead);
  const phone = leadPhone(lead);
  const source = leadSource(lead);
  const stage = leadStage(lead);
  const priority = leadPriority(lead);
  const status = leadStatus(lead);
  const threadId = leadThreadId(lead);

  return (
    <SlidingDetailOverlay
      open={open}
      onClose={onClose}
      className="!fixed !inset-auto !left-[calc(var(--shell-sidebar-w)+24px)] !right-6 !top-[calc(var(--shell-top-offset)+88px)] !bottom-6"
      panelWidthClassName="max-w-[560px]"
    >
      <Card padded={false} clip className="h-full">
        <AppDetailHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <AppIdentityMark label={initialsFromName(name)} size="lg" />

              <div className="min-w-0">
                <div className="truncate text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  {name}
                </div>
                <div className="mt-1 truncate text-[13px] font-medium text-text-muted">
                  {leadContact(lead) || "No contact details"}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <AppTag tone={stageTone(stage)} dot>
                    {titleize(stage)}
                  </AppTag>
                  <AppTag tone={priorityTone(priority)} dot>
                    {titleize(priority)}
                  </AppTag>
                  <AppTag tone={statusTone(status)} dot>
                    {titleize(status)}
                  </AppTag>
                </div>
              </div>
            </div>

            <AppIconButton label="Close details" onClick={onClose}>
              <X className="h-3.5 w-3.5" strokeWidth={2.15} />
            </AppIconButton>
          </div>
        </AppDetailHeader>

        <AppDetailBody>
          <AppInfoRow label="Source" value={titleize(source)} />
          <AppInfoRow label="Company" value={leadCompany(lead) || "Not recorded"} />
          <AppInfoRow label="Interest" value={s(lead.interest) || "Not recorded"} />
          <AppInfoRow label="Value" value={formatMoney(leadValue(lead))} />
          <AppInfoRow label="Owner" value={leadOwner(lead)} />
          <AppInfoRow label="Created" value={formatDate(leadCreatedRaw(lead))} />
          <AppInfoRow label="Updated" value={formatDate(leadUpdatedRaw(lead))} />
          <AppInfoRow
            label="Context"
            value={
              s(lead.latestMessageText) ||
              s(lead.latest_message_text) ||
              s(lead.lastMessageText) ||
              s(lead.last_message_text) ||
              s(lead.latest_message) ||
              "No message preview is available yet."
            }
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <Button
              type="button"
              size="md"
              disabled={!threadId}
              onClick={() => threadId && onOpenThread(threadId)}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.15} />}
            >
              Open thread
            </Button>

            {email ? (
              <Button
                as="a"
                href={`mailto:${email}`}
                variant="secondary"
                size="md"
                leftIcon={<Mail className="h-4 w-4" strokeWidth={2.1} />}
              >
                Email
              </Button>
            ) : null}

            {phone ? (
              <Button
                as="a"
                href={`tel:${phone}`}
                variant="secondary"
                size="md"
                leftIcon={<Phone className="h-4 w-4" strokeWidth={2.1} />}
              >
                Call
              </Button>
            ) : null}
          </div>
        </AppDetailBody>
      </Card>
    </SlidingDetailOverlay>
  );
}

export default function Leads() {
  const navigate = useNavigate();

  const [leads, setLeads] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [openFilter, setOpenFilter] = useState("");
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadLeads = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await listLeads({ limit: 200 });
      const nextLeads = withLocalLeads(normalizeResponse(response));
      setLeads(nextLeads);
    } catch (err) {
      setError(
        s(err?.payload?.error || err?.payload?.message || err?.message) ||
          "Leads could not be loaded."
      );
      setLeads(withLocalLeads([]));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const activeFilterCount = countActiveFilters(filters);

  const filteredLeads = useMemo(() => {
    const sourceValues = normalizeAppFilterList(filters.sources);
    const stageValues = normalizeAppFilterList(filters.stages);
    const priorityValues = normalizeAppFilterList(filters.priorities);
    const statusValues = normalizeAppFilterList(filters.statuses);

    return arr(leads)
      .filter((lead) => {
        if (filters.lead && !matchesText(lead, filters.lead)) return false;

        if (filters.contact) {
          const q = lower(filters.contact);
          if (!lower(leadContact(lead)).includes(q)) return false;
        }

        if (sourceValues.length && !sourceValues.includes(leadSource(lead))) {
          return false;
        }

        if (stageValues.length && !stageValues.includes(leadStage(lead))) {
          return false;
        }

        if (
          priorityValues.length &&
          !priorityValues.includes(leadPriority(lead))
        ) {
          return false;
        }

        if (statusValues.length && !statusValues.includes(leadStatus(lead))) {
          return false;
        }

        return true;
      })
      .sort(leadComparator(filters.updatedSort));
  }, [filters, leads]);

  const stats = useMemo(() => {
    const total = arr(leads).length;
    const hot = arr(leads).filter((lead) =>
      ["urgent", "high"].includes(leadPriority(lead))
    ).length;
    const qualified = arr(leads).filter((lead) =>
      ["qualified", "demo requested", "proposal", "negotiation"].includes(
        leadStage(lead)
      )
    ).length;
    const won = arr(leads).filter((lead) =>
      ["won", "converted"].includes(leadStage(lead)) ||
      ["won", "converted"].includes(leadStatus(lead))
    ).length;

    return { total, hot, qualified, won };
  }, [leads]);

  const sourceOptions = useMemo(
    () => uniqueOptions(arr(leads).map((lead) => leadSource(lead)), SOURCE_PRIORITY),
    [leads]
  );

  const stageOptions = useMemo(
    () => uniqueOptions(arr(leads).map((lead) => leadStage(lead)), STAGE_PRIORITY),
    [leads]
  );

  const priorityOptions = useMemo(
    () =>
      uniqueOptions(
        arr(leads).map((lead) => leadPriority(lead)),
        PRIORITY_PRIORITY
      ),
    [leads]
  );

  const statusOptions = useMemo(
    () =>
      uniqueOptions(
        arr(leads).map((lead) => leadStatus(lead)),
        STATUS_PRIORITY
      ),
    [leads]
  );

  const totalItems = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const selectedLead = useMemo(() => {
    return filteredLeads.find((lead, index) => leadKey(lead, index) === selectedKey) || null;
  }, [filteredLeads, selectedKey]);

  const visibleLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredLeads]);

  function patchFilters(next = {}) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function clearFilters() {
    setFilters(createDefaultFilters());
    setOpenFilter("");
  }

  function openDetail(lead, key) {
    setSelectedKey(key);
    setDetailOpen(true);
  }

  function openThread(threadId = "") {
    if (!threadId) return;
    navigate(`/inbox?thread=${encodeURIComponent(threadId)}`);
  }

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading leads"
          description="Preparing the sales pipeline and lead context."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Lead pipeline"
        description="Track active opportunities, source quality, priority, and the conversations that need follow-up."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              loading={refreshing}
              onClick={() => loadLeads({ silent: true })}
              leftIcon={
                !refreshing ? (
                  <RefreshCw className="h-4 w-4" strokeWidth={2.1} />
                ) : undefined
              }
            >
              Refresh
            </Button>

            <Button
              type="button"
              onClick={() => navigate("/inbox")}
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
            >
              Open inbox
            </Button>
          </>
        }
      />

      {error ? (
        <InlineNotice
          tone="danger"
          title="Leads unavailable"
          description={error}
          compact
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard icon={Target} label="Total leads" value={stats.total} />
        <AppStatCard icon={Flame} label="Hot priority" value={stats.hot} />
        <AppStatCard
          icon={TrendingUp}
          label="Qualified"
          value={stats.qualified}
        />
        <AppStatCard icon={Users} label="Won / converted" value={stats.won} />
      </div>

      <LeadsTable
        leads={visibleLeads}
        selectedKey={selectedKey}
        filters={filters}
        openFilter={openFilter}
        sourceOptions={sourceOptions}
        stageOptions={stageOptions}
        priorityOptions={priorityOptions}
        statusOptions={statusOptions}
        onOpenFilter={setOpenFilter}
        onPatchFilters={patchFilters}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
        onOpenThread={openThread}
        onOpenDetail={openDetail}
      />

      {totalItems > PAGE_SIZE ? (
        <AppPaginationFooter
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          filtered={activeFilterCount > 0}
          minWidthClass="w-full"
          onPageChange={setPage}
        />
      ) : null}

      <LeadDetailOverlay
        lead={selectedLead}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onOpenThread={openThread}
      />
    </PageCanvas>
  );
}