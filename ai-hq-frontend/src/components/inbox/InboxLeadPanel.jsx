import { ArrowUpRight, CalendarDays, MessageSquareText, UserRound } from "lucide-react";

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

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200/80 px-5 py-4 first:border-t-0">
      <div className="text-[14px] font-medium text-slate-800">{label}</div>
      <div className="text-[13px] text-slate-500">{value}</div>
    </div>
  );
}

function Tag({ children, tone = "default" }) {
  const tones = {
    default: "bg-[#f4f5f7] text-slate-600",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    amber: "bg-amber-50 text-amber-700",
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

function AvatarStack({ names = [] }) {
  const safe = names.filter(Boolean).slice(0, 4);

  return (
    <div className="flex items-center">
      {safe.map((name, index) => (
        <div
          key={`${name}-${index}`}
          className={[
            "-ml-2 first:ml-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold",
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
  const sourceLabel = hasLead ? prettyLeadSource(relatedLead) : s(selectedThread?.channel, "--");
  const people = [
    s(selectedThread?.customer_name),
    s(selectedThread?.assigned_to),
    hasLead ? leadName(relatedLead) : "",
    operatorName,
  ].filter(Boolean);

  const checklist = buildChecklist({ selectedThread, relatedLead });

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#fbfbfc]">
      <div className="border-b border-slate-200/80 px-5 py-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
          {title}
        </h2>

        {hasThread ? (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <Tag tone="green">{s(selectedThread?.channel, "thread")}</Tag>
              <Tag tone="blue">{hasLead ? s(relatedLead?.stage, "lead") : "context"}</Tag>
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
              <div>
                <div className="text-[14px] font-medium text-slate-800">{owner}</div>
                <div className="mt-0.5 text-[13px] text-slate-500">
                  {wsState ? `Realtime ${wsState}` : "Just now"}
                </div>
              </div>
            </div>

            {surface?.availability === "unavailable" || surface?.error ? (
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
          <div className="px-5 py-8 text-sm text-slate-500">Loading details...</div>
        ) : (
          <>
            <div className="border-b border-slate-200/80">
              <DetailRow label="Owner" value={owner} />
              <DetailRow label="Source" value={sourceLabel || "--"} />
              <DetailRow
                label="Due Date"
                value={selectedThread?.updated_at ? "Recently updated" : "--"}
              />
            </div>

            <div className="border-b border-slate-200/80 px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[14px] font-medium text-slate-800">
                  <UserRound className="h-4 w-4 text-slate-400" />
                  People
                </div>
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-[#eef0f3] px-2 text-[12px] font-medium text-slate-600">
                  {people.length}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <AvatarStack names={people} />
                <div className="text-right text-[12px] text-slate-500">
                  {hasLead ? leadHandle(relatedLead) : s(selectedThread?.external_username, "--")}
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200/80 px-5 py-5">
              <div className="flex items-center gap-2 text-[14px] font-medium text-slate-800">
                <MessageSquareText className="h-4 w-4 text-slate-400" />
                Description
              </div>

              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                {checklist.map((item) => (
                  <label
                    key={item.label}
                    className="flex items-start gap-3 text-[14px] text-slate-700"
                  >
                    <input
                      type="checkbox"
                      checked={item.done}
                      readOnly
                      className="mt-0.5 h-4 w-4 rounded border-slate-300"
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
            </div>

            <div className="px-5 py-5">
              <div className="flex items-center gap-2 text-[14px] font-medium text-slate-800">
                <CalendarDays className="h-4 w-4 text-slate-400" />
                Activity
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <div className="text-[14px] text-slate-800">
                  {owner} updated this conversation context
                </div>
                <div className="mt-1 text-[13px] text-slate-500">
                  Latest thread and context details are available for review.
                </div>

                {hasLead ? (
                  <button
                    type="button"
                    onClick={() => openLeadDetail?.(relatedLead)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-[#f7f8fa] px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    Open in Leads
                  </button>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}