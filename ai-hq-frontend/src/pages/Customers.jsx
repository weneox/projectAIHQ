import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Trophy,
  UserRound,
  Users,
} from "lucide-react";

import { listContacts } from "../api/leads.js";
import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppIdentityMark from "../components/ui/AppIdentityMark.jsx";
import AppInfoRow from "../components/ui/AppInfoRow.jsx";
import AppPaginationFooter from "../components/ui/AppPaginationFooter.jsx";
import AppStatCard from "../components/ui/AppStatCard.jsx";
import AppStatusText from "../components/ui/AppStatusText.jsx";
import {
  AppWorkspaceMain,
  AppWorkspaceSplit,
} from "../components/ui/AppWorkspace.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import AppDetailPane, {
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
  AppTableCell,
  AppTableEmptyState,
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
} from "../components/ui/AppShellPrimitives.jsx";

const PAGE_SIZE = 7;

const TABLE_MIN_WIDTH = "w-full";

const TABLE_GRID_STYLE = {
  gridTemplateColumns:
    "minmax(210px,1.2fr) minmax(190px,1fr) minmax(96px,.52fr) minmax(108px,.55fr) minmax(96px,.52fr) minmax(112px,.54fr)",
};

const STAGE_PRIORITY = [
  "new",
  "qualified",
  "demo requested",
  "proposal",
  "won",
  "lost",
];

const STATUS_PRIORITY = ["open", "active", "converted", "closed", "lost"];

const SOURCE_PRIORITY = [
  "website",
  "website chat",
  "instagram",
  "facebook",
  "telegram",
  "email",
];


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


function normalizeResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.customers)) return payload.customers;
  if (Array.isArray(payload?.leads)) return payload.leads;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function customerName(customer = {}) {
  return s(
    customer.full_name ||
      customer.fullName ||
      customer.name ||
      customer.display_name ||
      customer.customer_name ||
      customer.username ||
      customer.email ||
      customer.phone ||
      "Unknown contact"
  );
}

function customerEmail(customer = {}) {
  return s(customer.email || customer.user_email);
}

function customerPhone(customer = {}) {
  return s(customer.phone || customer.phone_number);
}

function customerUsername(customer = {}) {
  return s(customer.username || customer.handle);
}

function customerContact(customer = {}) {
  return [
    customerEmail(customer),
    customerPhone(customer),
    customerUsername(customer),
  ]
    .filter(Boolean)
    .join("  •  ");
}

function customerSource(customer = {}) {
  return lower(
    customer.source ||
      customer.channel ||
      customer.channel_type ||
      customer.provider ||
      customer.source_type ||
      "direct"
  );
}

function customerStage(customer = {}) {
  return lower(
    customer.displayStage ||
      customer.display_stage ||
      customer.stageLabel ||
      customer.stage ||
      "new"
  );
}

function customerStatus(customer = {}) {
  return lower(
    customer.displayStatus ||
      customer.display_status ||
      customer.statusLabel ||
      customer.status ||
      "open"
  );
}

function customerOpportunityCount(customer = {}) {
  return n(
    customer.opportunities ??
      customer.opportunity_count ??
      customer.opportunityCount ??
      customer.lead_count ??
      customer.leadCount ??
      arr(customer.lead_ids || customer.leadIds).length ??
      1,
    1
  );
}
function customerValue(customer = {}) {
  return n(
    customer.value_azn ??
      customer.valueAzn ??
      customer.value ??
      customer.estimated_value ??
      customer.deal_value ??
      0
  );
}

function customerThreadId(customer = {}) {
  return s(
    customer.inbox_thread_id || customer.inboxThreadId || customer.thread_id
  );
}

function customerUpdatedRaw(customer = {}) {
  return s(
    customer.updated_at ||
      customer.updatedAt ||
      customer.created_at ||
      customer.createdAt
  );
}

function customerCreatedRaw(customer = {}) {
  return s(
    customer.created_at ||
      customer.createdAt ||
      customer.updated_at ||
      customer.updatedAt
  );
}

function customerKey(customer = {}, index = 0) {
  return s(
    customer.id ||
      customer.customer_id ||
      customer.lead_id ||
      customer.inbox_thread_id ||
      customer.inboxThreadId ||
      customer.thread_id ||
      customer.email ||
      customer.phone ||
      customer.username ||
      `customer-${index}`
  );
}


function updatedTimestamp(customer = {}) {
  const date = new Date(customerUpdatedRaw(customer));
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
  if (!parts.length) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function sourceTone(source = "") {
  const safe = lower(source);

  if (["instagram", "facebook", "telegram"].includes(safe)) return "info";
  if (["website", "website chat"].includes(safe)) return "brand";
  if (safe === "email") return "neutral";

  return "neutral";
}

function stageTone(stage = "") {
  const safe = lower(stage);

  if (["won", "converted", "customer"].includes(safe)) return "success";
  if (["proposal", "negotiation"].includes(safe)) return "brand";
  if (["qualified", "demo requested"].includes(safe)) return "info";
  if (["lost", "closed_lost"].includes(safe)) return "danger";

  return "neutral";
}

function statusTone(status = "") {
  const safe = lower(status);

  if (["won", "converted", "active", "resolved"].includes(safe)) {
    return "success";
  }

  if (["pending", "waiting", "invited"].includes(safe)) return "warning";
  if (["lost", "closed", "disabled", "blocked"].includes(safe)) return "danger";

  return "brand";
}

function uniqueOptions(values = [], priority = []) {
  const priorityMap = new Map(priority.map((item, index) => [item, index]));
  const unique = [
    ...new Set(values.map((value) => lower(value)).filter(Boolean)),
  ];

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
    customer: "",
    contact: "",
    sources: [],
    stages: [],
    statuses: [],
    updatedSort: "newest",
  };
}

function countActiveFilters(filters = {}) {
  return [
    s(filters.customer),
    s(filters.contact),
    normalizeAppFilterList(filters.sources).length ? "sources" : "",
    normalizeAppFilterList(filters.stages).length ? "stages" : "",
    normalizeAppFilterList(filters.statuses).length ? "statuses" : "",
    filters.updatedSort && filters.updatedSort !== "newest" ? "updatedSort" : "",
  ].filter(Boolean).length;
}

function customerComparator(sortValue = "newest") {
  return (a, b) => {
    const aTime = updatedTimestamp(a);
    const bTime = updatedTimestamp(b);

    if (sortValue === "oldest") return aTime - bTime;
    return bTime - aTime;
  };
}

function matchesContactText(customer = {}, query = "") {
  const q = lower(query);
  if (!q) return true;

  return lower(
    [
      customerName(customer),
      customerContact(customer),
      titleize(customerSource(customer)),
      titleize(customerStage(customer)),
      titleize(customerStatus(customer)),
      customer.interest,
      customer.owner,
      customer.assigned_to,
    ].join(" ")
  ).includes(q);
}

function ContactIdentity({ customer }) {
  const name = customerName(customer);

  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <AppIdentityMark label={initialsFromName(name)} />
      <div className="min-w-0">
        <div className="truncate text-[14.5px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {name}
        </div>
        <div className="mt-0.5 truncate text-[12.5px] font-medium text-text-muted">
          {s(customer.interest) || "Customer contact"}
        </div>
      </div>
    </div>
  );
}

function ContactRow({ customer, selected, onOpenDetail }) {
  const source = customerSource(customer);
  const stage = customerStage(customer);
  const status = customerStatus(customer);

  return (
    <AppTableRow
      selected={selected}
      onClick={onOpenDetail}
      minWidthClass={TABLE_MIN_WIDTH}
      gridStyle={TABLE_GRID_STYLE}
      className="!min-h-[66px]"
    >
      <AppTableCell>
        <ContactIdentity customer={customer} />
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>
          {customerContact(customer) || "No contact details"}
        </AppTableText>
      </AppTableCell>

      <AppTableCell>
        <AppTag tone={sourceTone(source)}>{titleize(source)}</AppTag>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={stageTone(stage)}>{titleize(stage)}</AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppStatusText tone={statusTone(status)}>
          {titleize(status)}
        </AppStatusText>
      </AppTableCell>

      <AppTableCell>
        <AppTableText muted>{formatDate(customerUpdatedRaw(customer))}</AppTableText>
      </AppTableCell>
    </AppTableRow>
  );
}

function ContactTable({
  customers,
  selectedKey,
  filters,
  openFilter,
  sourceOptions,
  stageOptions,
  statusOptions,
  activeFilterCount,
  currentPage,
  totalPages,
  totalItems,
  onOpenFilter,
  onPatchFilters,
  onClearFilters,
  onOpenDetail,
  onOpenInbox,
  onPageChange,
}) {
  return (
    <div className="flex h-full min-h-[690px] min-w-0 flex-col">
      <AppTableToolbar
        title="Contacts"
        description="People who message your business across connected channels."
        filters={
          activeFilterCount ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClearFilters}
            >
              Clear filters
            </Button>
          ) : null
        }
      />

      <div className="min-h-0 flex-1 overflow-visible">
        <div className={TABLE_MIN_WIDTH}>
          <AppTableHeaderRow
            minWidthClass="w-full"
            gridStyle={TABLE_GRID_STYLE}
            className="bg-surface-subtle"
          >
            <AppTableHeaderFilter
              id="customer"
              label="Name"
              openFilter={openFilter}
              active={Boolean(filters.customer)}
              onOpen={onOpenFilter}
            >
              <AppFilterSearchInput
                value={filters.customer}
                onChange={(value) => onPatchFilters({ customer: value })}
                placeholder="Search names"
              />
              <AppFilterMenuShell>
                <AppFilterAction
                  onClick={() => onPatchFilters({ customer: "" })}
                  disabled={!filters.customer}
                >
                  Clear name filter
                </AppFilterAction>
              </AppFilterMenuShell>
            </AppTableHeaderFilter>

            <AppTableHeaderFilter
              id="contact"
              label="Reach"
              openFilter={openFilter}
              active={Boolean(filters.contact)}
              onOpen={onOpenFilter}
            >
              <AppFilterSearchInput
                value={filters.contact}
                onChange={(value) => onPatchFilters({ contact: value })}
                placeholder="Search email, phone, or username"
              />
              <AppFilterMenuShell>
                <AppFilterAction
                  onClick={() => onPatchFilters({ contact: "" })}
                  disabled={!filters.contact}
                >
                  Clear name filter
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
          </AppTableHeaderRow>

          {customers.length ? (
            customers.map((customer, index) => {
              const key = customerKey(customer, index);

              return (
                <ContactRow
                  key={key}
                  customer={customer}
                  selected={selectedKey === key}
                  onOpenDetail={() => onOpenDetail(customer, key)}
                />
              );
            })
          ) : (
            <AppTableEmptyState
              icon={<Users className="h-5 w-5" strokeWidth={1.9} />}
              title={activeFilterCount ? "No matching contacts" : "No contacts yet"}
              description={
                activeFilterCount
                  ? "Adjust the active filters to bring contacts back into view."
                  : "No contacts yet. Connect a channel and handle your first conversation in Inbox."
              }
                          action={activeFilterCount ? null : (<Button type="button" onClick={onOpenInbox} rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}>Open Inbox</Button>)}
            />
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-line-soft">
        <AppPaginationFooter
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={PAGE_SIZE}
          filtered={activeFilterCount > 0}
          minWidthClass="w-full"
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}

function ContactDetailPanel({ customer, onOpenThread }) {
  if (!customer) {
    return (
      <AppDetailPane className="flex h-full min-h-[690px] flex-col">
        <AppDetailEmpty
          icon={<UserRound className="h-5 w-5" strokeWidth={1.9} />}
          title="Select a contact"
          description="Choose a contact to see their latest context and open the conversation."
        />
      </AppDetailPane>
    );
  }

  const name = customerName(customer);
  const email = customerEmail(customer);
  const phone = customerPhone(customer);
  const source = customerSource(customer);
  const stage = customerStage(customer);
  const status = customerStatus(customer);
  const threadId = customerThreadId(customer);
  const latest =
    s(customer.latestMessageText) ||
    s(customer.latest_message_text) ||
    s(customer.lastMessageText) ||
    s(customer.last_message_text) ||
    s(customer.latest_message) ||
    "No conversation preview yet.";

  return (
    <AppDetailPane className="flex h-full min-h-[690px] flex-col">
      <AppDetailHeader>
        <div className="flex items-start gap-4">
          <AppIdentityMark label={initialsFromName(name)} size="lg" />

          <div className="min-w-0 flex-1">
            <div className="truncate text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              {name}
            </div>
            <div className="mt-1 truncate text-[13px] font-medium text-text-muted">
              {s(customer.interest) || "Customer contact"}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <AppTag tone={sourceTone(source)}>{titleize(source)}</AppTag>
              <AppTag tone={stageTone(stage)} dot>
                {titleize(stage)}
              </AppTag>
              <AppTag tone={statusTone(status)} dot>
                {titleize(status)}
              </AppTag>
            </div>
          </div>
        </div>
      </AppDetailHeader>

      <AppDetailBody className="flex flex-1 flex-col">
        <div className="grid gap-2">
          <Button
            type="button"
            size="md"
            fullWidth
            disabled={!threadId}
            onClick={() => threadId && onOpenThread(threadId)}
            leftIcon={<MessageCircle className="h-4 w-4" strokeWidth={2.1} />}
          >
            Open conversation
          </Button>

          <div className="grid grid-cols-2 gap-2">
            <Button
              as="a"
              href={email ? `mailto:${email}` : undefined}
              variant="secondary"
              size="md"
              fullWidth
              disabled={!email}
              leftIcon={<Mail className="h-4 w-4" strokeWidth={2.1} />}
            >
              Email
            </Button>

            <Button
              as="a"
              href={phone ? `tel:${phone}` : undefined}
              variant="secondary"
              size="md"
              fullWidth
              disabled={!phone}
              leftIcon={<Phone className="h-4 w-4" strokeWidth={2.1} />}
            >
              Call
            </Button>
          </div>
        </div>

        <AppInfoRow
          label="Contact"
          value={customerContact(customer) || "Not recorded"}
        />
        <AppInfoRow label="Source" value={titleize(source)} />
        <AppInfoRow label="Stage" value={titleize(stage)} />
        <AppInfoRow label="Status" value={titleize(status)} />
        <AppInfoRow
          label="Related opportunities"
          value={`${customerOpportunityCount(customer)} related ${
            customerOpportunityCount(customer) === 1 ? "opportunity" : "opportunities"
          }`}
        />
        <AppInfoRow label="Pipeline value" value={formatMoney(customerValue(customer))} />
        <AppInfoRow
          label="Owner"
          value={s(customer.owner || customer.assigned_to) || "Unassigned"}
        />
        <AppInfoRow label="Created" value={formatDate(customerCreatedRaw(customer))} />
        <AppInfoRow label="Updated" value={formatDate(customerUpdatedRaw(customer))} />

        <Card padded="sm" className="mt-auto bg-surface-subtle">
          <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
            Latest conversation
          </div>
          <div className="mt-2 text-[13px] font-medium leading-6 text-text">
            {latest}
          </div>

          {threadId ? (
            <button
              type="button"
              onClick={() => onOpenThread(threadId)}
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand"
            >
              Open conversation
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          ) : null}
        </Card>
      </AppDetailBody>
    </AppDetailPane>
  );
}

function ContactWorkspace({
  customers,
  selectedContact,
  selectedKey,
  filters,
  openFilter,
  sourceOptions,
  stageOptions,
  statusOptions,
  activeFilterCount,
  currentPage,
  totalPages,
  totalItems,
  onOpenFilter,
  onPatchFilters,
  onClearFilters,
  onOpenDetail,
  onOpenInbox,
  onOpenThread,
  onPageChange,
}) {
  return (
    <AppWorkspaceSplit>
        <AppWorkspaceMain>
          <ContactTable
            customers={customers}
            selectedKey={selectedKey}
            filters={filters}
            openFilter={openFilter}
            sourceOptions={sourceOptions}
            stageOptions={stageOptions}
            statusOptions={statusOptions}
            activeFilterCount={activeFilterCount}
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            onOpenFilter={onOpenFilter}
            onPatchFilters={onPatchFilters}
            onClearFilters={onClearFilters}
            onOpenDetail={onOpenDetail}
            onOpenInbox={onOpenInbox}
            onPageChange={onPageChange}
          />
        </AppWorkspaceMain>

        <ContactDetailPanel
          customer={selectedContact}
          onOpenThread={onOpenThread}
        />
    </AppWorkspaceSplit>
  );
}

export default function Contacts() {
  const navigate = useNavigate();

  const [customers, setContacts] = useState([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [openFilter, setOpenFilter] = useState("");
  const [filters, setFilters] = useState(() => createDefaultFilters());
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadContacts = useCallback(async ({ silent = false } = {}) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const response = await listContacts({ limit: 200 });
      const nextContacts = normalizeResponse(response);
      setContacts(nextContacts);
    } catch (err) {
      setError(
        s(err?.payload?.error || err?.payload?.message || err?.message) ||
          "Contacts could not be loaded."
      );
      setContacts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const activeFilterCount = countActiveFilters(filters);

  const filteredContacts = useMemo(() => {
    const sourceValues = normalizeAppFilterList(filters.sources);
    const stageValues = normalizeAppFilterList(filters.stages);
    const statusValues = normalizeAppFilterList(filters.statuses);

    return arr(customers)
      .filter((customer) => {
        if (filters.customer && !matchesContactText(customer, filters.customer)) {
          return false;
        }

        if (filters.contact) {
          const q = lower(filters.contact);
          if (!lower(customerContact(customer)).includes(q)) return false;
        }

        if (
          sourceValues.length &&
          !sourceValues.includes(customerSource(customer))
        ) {
          return false;
        }

        if (stageValues.length && !stageValues.includes(customerStage(customer))) {
          return false;
        }

        if (
          statusValues.length &&
          !statusValues.includes(customerStatus(customer))
        ) {
          return false;
        }

        return true;
      })
      .sort(customerComparator(filters.updatedSort));
  }, [customers, filters]);

  const stats = useMemo(() => {
    const total = arr(customers).length;
    const engaged = arr(customers).filter((customer) =>
      ["qualified", "demo requested", "proposal", "won"].includes(
        customerStage(customer)
      )
    ).length;
    const won = arr(customers).filter((customer) =>
      ["won", "converted"].includes(customerStage(customer)) ||
      ["won", "converted"].includes(customerStatus(customer))
    ).length;
    const value = arr(customers).reduce(
      (sum, customer) => sum + customerValue(customer),
      0
    );

    return { total, engaged, won, value };
  }, [customers]);

  const sourceOptions = useMemo(
    () =>
      uniqueOptions(
        arr(customers).map((customer) => customerSource(customer)),
        SOURCE_PRIORITY
      ),
    [customers]
  );

  const stageOptions = useMemo(
    () =>
      uniqueOptions(
        arr(customers).map((customer) => customerStage(customer)),
        STAGE_PRIORITY
      ),
    [customers]
  );

  const statusOptions = useMemo(
    () =>
      uniqueOptions(
        arr(customers).map((customer) => customerStatus(customer)),
        STATUS_PRIORITY
      ),
    [customers]
  );

  const totalItems = filteredContacts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const visibleContacts = filteredContacts.slice(
    pageStart,
    pageStart + PAGE_SIZE
  );

  const selectedContact = useMemo(() => {
    return (
      filteredContacts.find(
        (customer, index) => customerKey(customer, index) === selectedKey
      ) || null
    );
  }, [filteredContacts, selectedKey]);

  function patchFilters(next = {}) {
    setFilters((current) => ({ ...current, ...next }));
  }

  function clearFilters() {
    setFilters(createDefaultFilters());
    setOpenFilter("");
  }

  function openDetail(customer, key) {
    setSelectedKey(key);
  }

  function openThread(threadId = "") {
    if (!threadId) return;
    navigate(`/inbox?thread=${encodeURIComponent(threadId)}`);
  }

  if (loading) {
    return (
      <PageCanvas>
        <LoadingSurface
          title="Loading contacts"
          description="Loading contacts and conversation context."
          rows={5}
        />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Contacts"
        description="See every contact, their latest context, and the conversation they came from."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              loading={refreshing}
              onClick={() => loadContacts({ silent: true })}
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
          title="Contacts unavailable"
          description={error}
          compact
        />
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <AppStatCard icon={Users} label="Directory records" value={stats.total} />
        <AppStatCard
          icon={CheckCircle2}
          label="Engaged contacts"
          value={stats.engaged}
        />
        <AppStatCard icon={Trophy} label="Won accounts" value={stats.won} />
        <AppStatCard
          icon={MessageCircle}
          label="Pipeline value"
          value={formatMoney(stats.value)}
        />
      </div>

      <ContactWorkspace
        customers={visibleContacts}
        selectedContact={selectedContact}
        selectedKey={selectedKey}
        filters={filters}
        openFilter={openFilter}
        sourceOptions={sourceOptions}
        stageOptions={stageOptions}
        statusOptions={statusOptions}
        activeFilterCount={activeFilterCount}
        currentPage={safePage}
        totalPages={totalPages}
        totalItems={totalItems}
        onOpenFilter={setOpenFilter}
        onPatchFilters={patchFilters}
        onClearFilters={clearFilters}
        onOpenDetail={openDetail}
        onOpenThread={openThread}
        onPageChange={setCurrentPage}
      />
    </PageCanvas>
  );
}