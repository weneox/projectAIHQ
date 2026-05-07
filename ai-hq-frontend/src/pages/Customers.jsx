import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ExternalLink,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";

import { listLeads } from "../api/leads.js";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const STAGES = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "qualified", label: "Qualified" },
  { key: "proposal", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const AVATAR_TONES = [
  "bg-[#FCE7F3] text-[#DB2777]",
  "bg-[#FFF3E6] text-[#C46A16]",
  "bg-[#EEF4FF] text-[#315CFF]",
  "bg-[#ECFDF3] text-[#16845A]",
  "bg-[#F5F0FF] text-[#6D4FD8]",
  "bg-[#FFF7D6] text-[#B47B06]",
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleize(value = "") {
  return s(value || "new")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDate(value = "") {
  const raw = s(value);
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function pickName(lead = {}) {
  return s(
    lead.full_name ||
      lead.fullName ||
      lead.name ||
      lead.display_name ||
      lead.username ||
      lead.email ||
      lead.phone ||
      "Unknown customer"
  );
}

function pickContact(lead = {}) {
  return [s(lead.email), s(lead.phone), s(lead.username)]
    .filter(Boolean)
    .join("  •  ");
}

function leadStage(lead = {}) {
  return lower(lead.stage || "new");
}

function leadStatus(lead = {}) {
  return lower(lead.status || "open");
}

function leadThreadId(lead = {}) {
  return s(lead.inbox_thread_id || lead.inboxThreadId || lead.thread_id);
}

function leadKey(lead = {}, index = 0) {
  return s(
    lead.id ||
      lead.inbox_thread_id ||
      lead.inboxThreadId ||
      lead.thread_id ||
      lead.email ||
      lead.phone ||
      lead.username ||
      `lead-${index}`
  );
}

function initialsFromName(value = "") {
  const parts = s(value).split(/\s+/).filter(Boolean);
  if (!parts.length) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function avatarTone(seed = "") {
  const score = s(seed)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return AVATAR_TONES[score % AVATAR_TONES.length];
}

function toneForStage(stage = "") {
  const safe = lower(stage);

  if (["won", "converted", "customer"].includes(safe)) return "success";
  if (["lost", "closed_lost"].includes(safe)) return "danger";
  if (["proposal", "negotiation"].includes(safe)) return "proposal";
  if (["qualified"].includes(safe)) return "brand";

  return "neutral";
}

function stageDotClass(tone = "neutral") {
  if (tone === "success") return "bg-[#16A34A]";
  if (tone === "danger") return "bg-[#E11D48]";
  if (tone === "proposal") return "bg-[#38A3FF]";
  if (tone === "brand") return "bg-[#315CFF]";

  return "bg-[#94A3B8]";
}

function stagePillClass(tone = "neutral") {
  if (tone === "success") return "bg-[#EAF8EF] text-[#147A3E] ring-[#BFE8CD]";
  if (tone === "danger") return "bg-[#FFF1F3] text-[#BE123C] ring-[#FFD2DA]";
  if (tone === "proposal") return "bg-[#EAF6FF] text-[#1677C8] ring-[#C8E7FF]";
  if (tone === "brand") return "bg-[#EEF4FF] text-[#315CFF] ring-[#DDE8FF]";

  return "bg-white text-[#475569] ring-[#E4EAF2]";
}

function CustomerAvatar({ name, size = "md" }) {
  const sizeClass =
    size === "lg" ? "h-12 w-12 text-[17px]" : "h-10 w-10 text-[13px]";

  return (
    <div
      className={cx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold tracking-[-0.03em] ring-1 ring-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_14px_26px_-22px_rgba(15,23,42,0.28)]",
        sizeClass,
        avatarTone(name)
      )}
    >
      {initialsFromName(name)}
    </div>
  );
}

function StageLabel({ stage, pill = false }) {
  const tone = toneForStage(stage);

  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx("h-1.5 w-1.5 rounded-full", stageDotClass(tone))} />

      <span
        className={cx(
          "text-[12px] font-semibold leading-none",
          pill
            ? "rounded-[9px] px-2.5 py-1.5 ring-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)]"
            : "",
          pill ? stagePillClass(tone) : "text-[#73839A]"
        )}
      >
        {titleize(stage)}
      </span>
    </span>
  );
}



function EmptyState({ hasQuery }) {
  return (
    <div className="flex min-h-[360px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[520px]">
        <div className="mx-auto h-1.5 w-14 rounded-full bg-[#C9D5E4]" />

        <h2 className="mt-6 text-[20px] font-semibold tracking-[-0.03em] text-[#0F172A]">
          {hasQuery ? "No matching customers" : "No customers yet"}
        </h2>

        <p className="mt-2 text-[13.5px] font-medium leading-6 text-[#73839A]">
          {hasQuery
            ? "Try a different name, email, phone, username, or stage."
            : "Customer records will appear here when conversations create leads."}
        </p>
      </div>
    </div>
  );
}

/* customers-combo-picker:start */
function CustomerPicker({ leads, value = "all", onChange }) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");

  const items = useMemo(
    () =>
      arr(leads).map((lead, index) => ({
        lead,
        index,
        key: leadKey(lead, index),
        name: pickName(lead),
        contact: pickContact(lead),
      })),
    [leads]
  );

  const selected = value === "all" ? null : items.find((item) => item.key === value);
  const q = lower(term);

  const filteredItems = q
    ? items.filter((item) =>
        lower(
          `${item.name} ${item.contact} ${leadStage(item.lead)} ${leadStatus(item.lead)}`
        ).includes(q)
      )
    : items;

  function choose(nextValue) {
    onChange?.(nextValue);
    setOpen(false);
    setTerm("");
  }

  return (
    <div className="relative z-[120] w-full max-w-[260px]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full items-center gap-2 rounded-[12px] border border-[#D3DEEA] bg-white px-3 text-left text-[12.8px] font-semibold tracking-[-0.01em] text-[#0F172A] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_8px_18px_-17px_rgba(15,23,42,0.18)] outline-none transition-[border-color,box-shadow,background-color] duration-base ease-premium hover:border-[#B9C8DA] hover:bg-[#FBFDFF] focus-visible:ring-4 focus-visible:ring-[rgba(49,92,255,0.12)]"
      >
        <Search className="h-[14px] w-[14px] shrink-0 text-[#66768A]" strokeWidth={2.15} />
        <span className="min-w-0 flex-1 truncate">
          {selected ? selected.name : "All customers"}
        </span>
        <span className="shrink-0 text-[11px] font-semibold text-[#94A3B8]">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-[220] w-[320px] overflow-hidden rounded-[18px] border border-[#D7E1EC] bg-white shadow-[0_26px_70px_-38px_rgba(15,23,42,0.38),0_12px_28px_-22px_rgba(15,23,42,0.18)]">
          <div className="border-b border-[#E5EBF3] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFF_100%)] p-2">
            <div className="flex h-9 items-center gap-2 rounded-[12px] border border-[#D3DEEA] bg-white px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_8px_18px_-17px_rgba(15,23,42,0.12)]">
              <Search className="h-[14px] w-[14px] shrink-0 text-[#66768A]" strokeWidth={2.15} />
              <input
                autoFocus
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search or select customer"
                className="h-full min-w-0 flex-1 border-0 bg-transparent text-[13px] font-semibold text-[#0F172A] outline-none placeholder:text-[#94A3B8]"
              />
              {term ? (
                <button
                  type="button"
                  onClick={() => setTerm("")}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-[#94A3B8] hover:bg-[#F2F6FB] hover:text-[#0F172A]"
                  aria-label="Clear customer search"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.2} />
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[320px] overflow-y-auto py-1">
            <button
              type="button"
              onClick={() => choose("all")}
              className={cx(
                "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F6F9FC]",
                value === "all" ? "bg-[#EEF4FF]" : "bg-white"
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-[12px] font-bold text-[#315CFF] ring-1 ring-white">
                All
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                  All customers
                </div>
                <div className="truncate text-[12px] font-medium text-[#66768A]">
                  Show every customer
                </div>
              </div>

              <span
                className={cx(
                  "ml-auto text-[14px] font-bold",
                  value === "all" ? "text-[#315CFF]" : "text-transparent"
                )}
              >
                ✓
              </span>
            </button>

            {filteredItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => choose(item.key)}
                className={cx(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[#F6F9FC]",
                  value === item.key ? "bg-[#EEF4FF]" : "bg-white"
                )}
              >
                <CustomerAvatar name={item.name} />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-semibold tracking-[-0.02em] text-[#0F172A]">
                    {item.name}
                  </div>
                  <div className="truncate text-[12px] font-medium text-[#66768A]">
                    {item.contact || titleize(leadStage(item.lead))}
                  </div>
                </div>

                <span
                  className={cx(
                    "ml-auto text-[14px] font-bold",
                    value === item.key ? "text-[#315CFF]" : "text-transparent"
                  )}
                >
                  ✓
                </span>
              </button>
            ))}

            {!filteredItems.length ? (
              <div className="px-4 py-5 text-center text-[12.5px] font-semibold text-[#94A3B8]">
                No customer found
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
/* customers-combo-picker:end */
function CustomerTable({ leads, allLeads, selectedLead, selectedCustomerId, onCustomerChange, onSelect, onOpen, stageFilter, onStageFilterChange, dateFilter, onDateFilterChange }) {
  return (
    <table className="w-full table-fixed border-collapse">
      <colgroup>
        <col />
        <col className="w-[190px]" />
        <col className="w-[140px]" />
        <col className="w-[180px]" />
      </colgroup>

      
      <thead>
        <tr className="text-[10.5px] font-semibold uppercase tracking-[0.17em] text-[#66768A]">
          <th className="relative z-[80] border-y border-[#D9E3EE] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFD_100%)] px-6 py-1 text-left font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(216,226,238,0.95)]">
            <div className="flex min-w-0 items-center"><CustomerPicker
                leads={allLeads}
                value={selectedCustomerId}
                onChange={onCustomerChange}
              />
            </div>
          </th>

          <th className="relative z-[70] border-y border-[#D9E3EE] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFD_100%)] px-3 py-1 text-left font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(216,226,238,0.95)]">
            <select
              value={stageFilter}
              onChange={(event) => onStageFilterChange?.(event.target.value)}
              className="h-8 w-[140px] rounded-[12px] border border-[#D3DEEA] bg-white px-3 text-[12.8px] font-semibold normal-case tracking-[-0.01em] text-[#0F172A] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_8px_18px_-17px_rgba(15,23,42,0.18)] outline-none transition-[border-color,box-shadow] duration-base ease-premium hover:border-[#B9C8DA] focus:border-[#315CFF] focus:shadow-[0_0_0_4px_rgba(49,92,255,0.12)]"
            >
              {STAGES.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </th>

          <th className="border-y border-[#D9E3EE] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFD_100%)] px-3 py-1 text-left font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(216,226,238,0.95)]">
            <input
              type="date"
              value={dateFilter}
              onChange={(event) => onDateFilterChange?.(event.target.value)}
              className="h-8 w-[145px] rounded-[12px] border border-[#D3DEEA] bg-white px-3 text-[12.8px] font-semibold normal-case tracking-[-0.01em] text-[#0F172A] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_8px_18px_-17px_rgba(15,23,42,0.18)] outline-none transition-[border-color,box-shadow] duration-base ease-premium hover:border-[#B9C8DA] focus:border-[#315CFF] focus:shadow-[0_0_0_4px_rgba(49,92,255,0.12)]"
              aria-label="Filter by date"
            />
          </th>

          <th className="border-y border-[#D9E3EE] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFD_100%)] px-3 py-1 text-left font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.98),inset_0_-1px_0_rgba(216,226,238,0.95)]" aria-hidden="true" />
        </tr>
      </thead>

      <tbody>
        {leads.map((lead, index) => {
          const key = leadKey(lead, index);
          const selected = selectedLead && leadKey(selectedLead, index) === key;
          const name = pickName(lead);
          const contact = pickContact(lead);
          const stage = leadStage(lead);
          const threadId = leadThreadId(lead);
          const updated = formatDate(
            lead.updated_at || lead.updatedAt || lead.created_at || lead.createdAt
          );

          return (
            <tr
              key={key}
              onClick={() => onSelect?.(lead, key)}
              className={cx(
                "group cursor-pointer  #D9E3EE text-left transition-[background-color,box-shadow,color] duration-base ease-premium",
                selected ? "bg-[linear-gradient(90deg,#EEF6FF_0%,#F7FBFF_58%,#FFFFFF_100%)] shadow-[inset_3px_0_0_#315CFF,inset_0_1px_0_rgba(255,255,255,0.95)]" : "bg-white hover:bg-[#FAFCFF]"
              )}
            >
              <td className="px-6 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <CustomerAvatar name={name} />

                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold tracking-[-0.025em] text-[#0F172A]">
                      {name}
                    </div>

                    <div className="mt-1 truncate text-[12.5px] font-medium text-[#475569]">
                      {contact || "No contact details"}
                    </div>
                  </div>
                </div>
              </td>

              <td className="px-3 py-3.5 align-middle">
                <StageLabel stage={stage} pill />
              </td>

              <td className="px-3 py-3.5 align-middle text-[13px] font-semibold text-[#475569]">
                {updated || titleize(leadStatus(lead))}
              </td>

              <td className="px-3 py-3.5 align-middle">
                {threadId ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen?.(threadId);
                    }}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold text-[#315CFF] transition-colors duration-base ease-premium hover:bg-[#EEF4FF]"
                  >
                    Conversation
                    <ArrowRight
                      className="h-3.5 w-3.5 transition-transform duration-base ease-premium group-hover:translate-x-0.5"
                      strokeWidth={2.1}
                    />
                  </button>
                ) : (
                  <span className="text-[12px] font-medium text-[#94A3B8]">
                    No thread
                  </span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function DetailLine({ label, children }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-start gap-3 py-[5px]">
      <div className="text-[11px] font-semibold uppercase leading-5 tracking-[0.16em] text-[#66768A]">
        {label}
      </div>

      <div className="min-w-0 text-[13px] font-semibold leading-5 text-[#0F172A]">
        {children || <span className="text-[#94A3B8]">—</span>}
      </div>
    </div>
  );
}



function CustomerDetailPanel({ lead, onOpen }) {
  if (!lead) {
    return (
      <aside className="customers-detail-lines-off hidden h-full min-h-0 overflow-y-auto %)] px-6 pb-6 )] xl:block ] bg-white )] bg-white overflow-hidden">
        <div className="flex h-full min-h-[420px] items-center justify-center text-center">
          <div className="max-w-[240px]">
            <div className="text-[15px] font-semibold text-[#0F172A]">
              Select a customer
            </div>
            <div className="mt-2 text-[13px] font-medium leading-6 text-[#66768A]">
              Customer details will appear here.
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const name = pickName(lead);
  const email = s(lead.email);
  const phone = s(lead.phone);
  const stage = leadStage(lead);
  const threadId = leadThreadId(lead);
  const source = s(lead.source || lead.channel || lead.channel_type || "Conversation");
  const firstSeen = formatDate(lead.created_at || lead.createdAt);
  const updated = formatDate(lead.updated_at || lead.updatedAt || lead.created_at || lead.createdAt);
  const notes = s(lead.notes || lead.summary || lead.interest || lead.intent);

  return (
 <aside className="customers-detail-clean hidden h-full min-h-0 overflow-y-auto bg-white px-6 pb-6 xl:block">
      <div className="flex min-h-full flex-col py-5">
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <CustomerAvatar name={name} size="lg" />

            <div className="min-w-0 pt-0.5">
              <div className="truncate text-[15.5px] font-semibold tracking-[-0.03em] text-[#0F172A]">
                {name}
              </div>

              <div className="mt-2">
                <StageLabel stage={stage} pill />
              </div>
            </div>
          </div>

          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] text-[#66768A] transition-colors hover:bg-white hover:text-[#0F172A] hover:shadow-[0_8px_18px_-16px_rgba(15,23,42,0.25)]"
            aria-label="Customer actions"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2.1} />
          </button>
        </div>

        <div className="h-px bg-[linear-gradient(90deg,rgba(216,226,238,0)_0%,#D8E2EE_10%,#D8E2EE_90%,rgba(216,226,238,0)_100%)] shadow-[0_1px_0_rgba(255,255,255,0.95)]" />

        <div className="py-3">
          <DetailLine label="Email">{email || "—"}</DetailLine>
          <DetailLine label="Phone">{phone || "—"}</DetailLine>
          <DetailLine label="Source">{titleize(source)}</DetailLine>
          <DetailLine label="First seen">{firstSeen || "—"}</DetailLine>
          <DetailLine label="Updated">{updated || "—"}</DetailLine>
        </div>

        {notes ? (
          <>
            <div className="h-px bg-[linear-gradient(90deg,rgba(216,226,238,0)_0%,#D8E2EE_10%,#D8E2EE_90%,rgba(216,226,238,0)_100%)] shadow-[0_1px_0_rgba(255,255,255,0.95)]" />

            <div className="py-3.5">
              <div className="text-[11px] font-semibold uppercase leading-5 tracking-[0.18em] text-[#66768A]">
                Notes
              </div>

              <p className="mt-2 text-[13px] font-medium leading-[1.65] text-[#1F2937]">
                {notes}
              </p>
            </div>
          </>
        ) : null}

        <div className="mt-2 h-px bg-[linear-gradient(90deg,rgba(216,226,238,0)_0%,#D8E2EE_10%,#D8E2EE_90%,rgba(216,226,238,0)_100%)] shadow-[0_1px_0_rgba(255,255,255,0.95)]" />

        <div className="pt-4">
          <button
            type="button"
            disabled={!threadId}
            onClick={() => onOpen?.(threadId)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[16px] border border-[#D3DEEA] bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FBFD_100%)] text-[13px] font-semibold text-[#0F172A] shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_10px_24px_-22px_rgba(15,23,42,0.22)] transition-[border-color,background-color,box-shadow] hover:border-[#B9C8DA] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_14px_30px_-24px_rgba(15,23,42,0.30)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Open conversation
            <ExternalLink className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function Customers() {
  const navigate = useNavigate();
  const [query] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    degraded: false,
    reasonCode: "",
    leads: [],
  });

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const payload = await listLeads({
        q: query,
        limit: 150,
      });

      setState({
        loading: false,
        refreshing: false,
        error: "",
        degraded: payload?.degraded === true,
        reasonCode: s(payload?.reasonCode),
        leads: arr(payload?.leads),
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.error || error?.payload?.message || error?.message) ||
          "Customers could not be loaded.",
        degraded: false,
        reasonCode: "",
        leads: [],
      });
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredLeads = useMemo(() => {
    let source = arr(state.leads);

    if (stageFilter !== "all") {
      source = source.filter((lead) => leadStage(lead) === stageFilter);
    }

    if (customerFilter !== "all") {
      const target = s(customerFilter);
      source = source.filter((lead, index) => leadKey(lead, index) === target);
    }

    if (dateFilter) {
      source = source.filter((lead) => {
        const rawDate = s(
          lead.updated_at || lead.updatedAt || lead.created_at || lead.createdAt
        );
        if (!rawDate) return false;

        const d = new Date(rawDate);
        if (Number.isNaN(d.getTime())) return false;

        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}` === dateFilter;
      });
    }

    return source;
  }, [customerFilter, dateFilter, stageFilter, state.leads]);

  const selectedLead = useMemo(() => {
    if (!filteredLeads.length) return null;
    if (!selectedLeadId) return filteredLeads[0];

    return (
      filteredLeads.find((lead, index) => leadKey(lead, index) === selectedLeadId) ||
      filteredLeads[0]
    );
  }, [filteredLeads, selectedLeadId]);

  function openConversation(threadId = "") {
    const safeThreadId = s(threadId);
    if (!safeThreadId) return;
    navigate(`/inbox?threadId=${encodeURIComponent(safeThreadId)}`);
  }

  if (state.loading) {
    return (
      <PageCanvas className="customers-page-canvas !m-0 !mx-0 !h-[calc(100vh-64px)] !w-full !max-w-none !overflow-hidden !bg-white !p-0 !px-0 !py-0 !pt-0 !pb-0">
        <LoadingSurface title="Loading customers" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="customers-page-canvas !m-0 !mx-0 !h-[calc(100vh-64px)] !w-full !max-w-none !overflow-hidden !bg-white !p-0 !px-0 !py-0 !pt-0 !pb-0">
      {state.error ? (
        <div className="px-6 pb-4">
          <InlineNotice
            tone="danger"
            title="Customers unavailable"
            description={state.error}
            compact
          />
        </div>
      ) : null}

      {state.degraded ? (
        <div className="px-6 pb-4">
          <InlineNotice
            tone="warning"
            title="Customers unavailable in this environment"
            description="The customer surface is ready, but the backend lead table is not available here yet."
            compact
          />
        </div>
      ) : null}

      <section className="customers-premium-page h-full min-h-0 overflow-hidden bg-white">

        <div className="grid h-full min-h-0 overflow-hidden bg-white xl:grid-cols-[minmax(0,1fr)_386px]">
          <div className="min-w-0 overflow-y-auto bg-white">
            {filteredLeads.length ? (
              <>
                <CustomerTable
                  leads={filteredLeads}
                  allLeads={arr(state.leads)}
                  selectedLead={selectedLead}
                  selectedCustomerId={customerFilter}
                  onCustomerChange={(value) => {
                    setCustomerFilter(value);
                    setSelectedLeadId(value === "all" ? "" : value);
                  }}
                  onSelect={(lead, key) => setSelectedLeadId(key)}
                  onOpen={openConversation}
                  stageFilter={stageFilter}
                  onStageFilterChange={setStageFilter}
                  dateFilter={dateFilter}
                  onDateFilterChange={setDateFilter}
                />

                <div className="flex w-full items-center justify-between  #D9E3EE bg-white px-6 py-3 text-[13px] font-medium text-[#475569] shadow-[inset_0_1px_0_rgba(255,255,255,0.92)]">
                  <span>
                    Showing 1–{filteredLeads.length} of {filteredLeads.length}
                  </span>

                  <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-[10px] border border-[rgba(49,92,255,0.38)] bg-white px-3 text-[12px] font-semibold text-[#0F172A] shadow-[0_1px_2px_rgba(37,99,235,0.08)]">
                    1
                  </span>
                </div>
              </>
            ) : (
              <EmptyState hasQuery={Boolean(s(query) || stageFilter !== "all")} />
            )}
          </div>

          <CustomerDetailPanel lead={selectedLead} onOpen={openConversation} />
        </div>
      </section>
    </PageCanvas>
  );
}











