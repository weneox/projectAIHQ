import {
  ArrowUpRight,
  CalendarDays,
  MessageSquareText,
  UserRound,
} from "lucide-react";

import {
  leadHandle,
  leadName,
  prettyLeadSource,
} from "../../lib/inbox-ui.js";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function initialsFromName(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "U";
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function avatarTone(seed = "") {
  const tones = [
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-sky-100 text-sky-700",
    "bg-violet-100 text-violet-700",
    "bg-emerald-100 text-emerald-700",
  ];
  const score = String(seed || "")
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);

  return tones[score % tones.length];
}

function Tag({ children, tone = "default" }) {
  const tones = {
    default: "border border-slate-200 bg-slate-100 text-slate-600",
    green: "border border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border border-sky-200 bg-sky-50 text-sky-700",
    amber: "border border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium",
        tones[tone] || tones.default,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="text-[13px] font-medium text-slate-700">{label}</div>
      <div className="truncate text-right text-[13px] text-slate-500">{value}</div>
    </div>
  );
}

function Section({ icon: Icon, title, count = null, children }) {
  return (
    <section className="border-t border-slate-200/70 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-medium text-slate-800">
          {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
          {title}
        </div>

        {count !== null ? (
          <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-slate-100 px-2 text-[12px] font-medium text-slate-600">
            {count}
          </span>
        ) : null}
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function AvatarStack({ names = [] }) {
  const safe = names.filter(Boolean).slice(0, 4);

  return (
    <div className="flex items-center">
      {safe.map((name, index) => (
        <div
          key={`${name}-${index}`}
          className={[
            "-ml-2 first:ml-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold shadow-[0_2px_8px_rgba(15,23,42,0.06)]",
            avatarTone(name),
          ].join(" ")}
          title={name}
        >
          {initialsFromName(name)}
        </div>
      ))}
    </div>
  );
}

function buildChecklist({ selectedThread, relatedLead }) {
  const items = [];

  items.push({
    label: `Review latest thread from ${
      s(selectedThread?.customer_name) ||
      s(selectedThread?.external_username) ||
      "customer"
    }`,
    done: Number(selectedThread?.unread_count || 0) === 0,
  });

  items.push({
    label: "Confirm delivery state",
    done: !selectedThread?.handoff_active,
  });

  if (relatedLead?.id) {
    items.push({
      label: `Follow up on ${s(relatedLead?.stage, "lead")} stage`,
      done: String(relatedLead?.status || "").toLowerCase() === "won",
    });
  } else {
    items.push({
      label: "Create or attach related lead",
      done: false,
    });
  }

  return items;
}

export default function InboxLeadPanel({
  selectedThread,
  surface,
  relatedLead,
  openLeadDetail,
  operatorName = "",
  wsState = "",
}) {
  const hasThread = Boolean(selectedThread?.id);
  const hasLead = Boolean(relatedLead?.id);

  const title =
    s(relatedLead?.interest) ||
    s(selectedThread?.customer_name) ||
    s(selectedThread?.external_username) ||
    s(selectedThread?.external_user_id) ||
    "Task Details";

  const owner = s(selectedThread?.assigned_to) || operatorName || "Unassigned";
  const sourceLabel = hasLead
    ? prettyLeadSource(relatedLead)
    : s(selectedThread?.channel, "--");
  const people = [
    s(selectedThread?.customer_name),
    s(selectedThread?.assigned_to),
    hasLead ? leadName(relatedLead) : "",
    operatorName,
  ].filter(Boolean);

  const checklist = buildChecklist({ selectedThread, relatedLead });

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#fbfbfc]">
      <div className="border-b border-slate-200/70 px-5 py-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
          {title}
        </h2>

        {hasThread ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag tone="green">{s(selectedThread?.channel, "thread")}</Tag>
              <Tag tone="blue">
                {hasLead ? s(relatedLead?.stage, "lead") : "context"}
              </Tag>
              <Tag tone="amber">
                {selectedThread?.handoff_active ? "in progress" : "active"}
              </Tag>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold",
                  avatarTone(owner),
                ].join(" ")}
              >
                {initialsFromName(owner)}
              </div>

              <div className="min-w-0">
                <div className="truncate text-[14px] font-medium text-slate-800">
                  {owner}
                </div>
                <div className="mt-0.5 truncate text-[13px] text-slate-500">
                  {wsState ? `Realtime ${wsState}` : "Just now"}
                </div>
              </div>
            </div>

            {surface?.unavailable ||
            surface?.availability === "unavailable" ||
            surface?.error ? (
              <div className="mt-4">
                <SettingsSurfaceBanner
                  surface={surface}
                  unavailableMessage="Related context is temporarily unavailable."
                  refreshLabel="Refresh context"
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="mt-3 text-sm text-slate-500">
            Select a conversation to load details.
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasThread ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            No thread selected.
          </div>
        ) : surface?.loading ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            Loading details...
          </div>
        ) : (
          <>
            <div className="px-5 py-3">
              <DetailRow label="Owner" value={owner} />
              <div className="border-t border-slate-200/70" />
              <DetailRow label="Source" value={sourceLabel || "--"} />
              <div className="border-t border-slate-200/70" />
              <DetailRow
                label="Due Date"
                value={selectedThread?.updated_at ? "Recently updated" : "--"}
              />
            </div>

            <Section icon={UserRound} title="People" count={people.length}>
              <div className="flex items-center justify-between gap-3">
                <AvatarStack names={people} />
                <div className="min-w-0 text-right text-[12px] text-slate-500">
                  <div className="truncate">
                    {hasLead
                      ? leadHandle(relatedLead)
                      : s(selectedThread?.external_username, "--")}
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={MessageSquareText} title="Description">
              <div className="space-y-3 rounded-[22px] border border-slate-200/80 bg-white/95 p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                {checklist.map((item) => (
                  <label
                    key={item.label}
                    className="flex items-start gap-3 text-[14px] leading-6 text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      readOnly
                      className="mt-1 h-4 w-4 rounded border-slate-300"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}

                <button
                  type="button"
                  className="pt-1 text-left text-[14px] text-slate-500 transition hover:text-slate-900"
                >
                  + Add subtask
                </button>
              </div>
            </Section>

            <Section icon={CalendarDays} title="Activity">
              <div className="rounded-[22px] border border-slate-200/80 bg-white/95 px-4 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <div className="text-[14px] leading-6 text-slate-800">
                  {owner} updated this conversation context
                </div>
                <div className="mt-1 text-[13px] leading-6 text-slate-500">
                  Latest thread and context details are available for review.
                </div>

                {hasLead ? (
                  <button
                    type="button"
                    onClick={() => openLeadDetail?.(relatedLead)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#f7f8fa] px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Open in Leads
                  </button>
                ) : null}
              </div>
            </Section>
          </>
        )}
      </div>
    </section>
  );
}