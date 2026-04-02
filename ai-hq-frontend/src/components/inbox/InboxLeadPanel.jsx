import {
  ArrowUpRight,
  MessageSquareText,
  Radio,
  UserRound,
  X,
} from "lucide-react";

import {
  leadHandle,
  leadName,
  prettyLeadSource,
} from "../../lib/inbox-ui.js";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";
import { InboxLeadSkeleton } from "./InboxLoadingSurface.jsx";

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

function resolveAvatarUrl(entity = {}) {
  return (
    s(entity.avatar_url) ||
    s(entity.profile_image_url) ||
    s(entity.customer_avatar_url) ||
    s(entity.external_avatar_url) ||
    s(entity.photo_url)
  );
}

function resolveDisplayName(selectedThread = {}, relatedLead = null) {
  return (
    s(selectedThread?.customer_name) ||
    s(selectedThread?.external_username) ||
    s(relatedLead?.name) ||
    s(selectedThread?.external_user_id) ||
    "Conversation"
  );
}

function resolveHandle(selectedThread = {}, relatedLead = null) {
  return (
    (relatedLead ? s(leadHandle(relatedLead)) : "") ||
    s(selectedThread?.external_username) ||
    s(selectedThread?.external_user_id)
  );
}

function prettyStatus(selectedThread = {}, relatedLead = null) {
  if (selectedThread?.handoff_active) return "In handoff";
  if (relatedLead?.status) return s(relatedLead.status);
  if (selectedThread?.status) return s(selectedThread.status);
  return "Active";
}

function prettyStage(relatedLead = null) {
  return s(relatedLead?.stage || "");
}

function Tag({ children, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-slate-100 text-slate-600",
    soft: "border-slate-200 bg-white text-slate-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
        tones[tone] || tones.default,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function InfoRow({ label, value, valueTone = "default" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="text-[13px] font-medium text-slate-500">{label}</div>
      <div
        className={[
          "min-w-0 truncate text-right text-[13px]",
          valueTone === "strong" ? "font-medium text-slate-900" : "text-slate-700",
        ].join(" ")}
      >
        {value || "--"}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, action = null }) {
  return (
    <section className="border-t border-slate-200/70 px-5 py-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-medium text-slate-900">
          {Icon ? <Icon className="h-4 w-4 text-slate-400" /> : null}
          <span>{title}</span>
        </div>

        {action}
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function AvatarStack({ people = [] }) {
  const safe = people.filter(Boolean).slice(0, 4);

  return (
    <div className="flex items-center">
      {safe.map((name, index) => (
        <div
          key={`${name}-${index}`}
          title={name}
          className={[
            "-ml-2 first:ml-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold shadow-[0_4px_14px_rgba(15,23,42,0.08)]",
            avatarTone(name),
          ].join(" ")}
        >
          {initialsFromName(name)}
        </div>
      ))}
    </div>
  );
}

function IdentityCard({ selectedThread, relatedLead, owner, wsState }) {
  const name = resolveDisplayName(selectedThread, relatedLead);
  const handle = resolveHandle(selectedThread, relatedLead);
  const avatarUrl = resolveAvatarUrl(selectedThread);
  const sourceLabel = relatedLead
    ? prettyLeadSource(relatedLead)
    : s(selectedThread?.channel, "conversation");
  const stage = prettyStage(relatedLead);
  const statusLabel = prettyStatus(selectedThread, relatedLead);

  return (
    <div className="px-5 py-5">
      <div className="border-t border-slate-200/70 px-1 py-5">
        <div className="flex flex-col items-center text-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-20 w-20 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={[
                "flex h-20 w-20 items-center justify-center rounded-full text-[24px] font-semibold",
                avatarTone(name),
              ].join(" ")}
            >
              {initialsFromName(name)}
            </div>
          )}

          <div className="mt-4 text-[20px] font-semibold tracking-[-0.03em] text-slate-950">
            {name}
          </div>

          {handle ? (
            <div className="mt-1 text-[14px] text-slate-500">@{handle.replace(/^@/, "")}</div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Tag tone="soft">{sourceLabel || "conversation"}</Tag>
            <Tag tone="blue">{stage || "context"}</Tag>
            <Tag tone={selectedThread?.handoff_active ? "amber" : "green"}>
              {statusLabel}
            </Tag>
          </div>
        </div>

        <div className="mt-5 border-t border-slate-200/70 pt-2">
          <InfoRow label="Owner" value={owner} valueTone="strong" />
          <div className="border-t border-slate-200/70" />
          <InfoRow
            label="Realtime"
            value={wsState ? `Realtime ${wsState}` : "Connected"}
          />
        </div>
      </div>
    </div>
  );
}

export default function InboxLeadPanel({
  selectedThread,
  surface,
  relatedLead,
  openLeadDetail,
  operatorName = "",
  wsState = "",
  onClose,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const hasLead = Boolean(relatedLead?.id);

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

  const preview =
    s(selectedThread?.last_message_text) ||
    "No message preview is available yet for this conversation.";

  const showSurfaceBanner =
    surface?.unavailable ||
    surface?.availability === "unavailable" ||
    surface?.error;

  return (
    <section className="flex h-full min-h-0 flex-col bg-[#fbfbfc]">
      <div className="border-b border-slate-200/70 bg-[#fbfbfc] px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
              Conversation details
            </h2>
            <div className="mt-0.5 text-[12px] text-slate-500">
              Profile, routing, and recent context
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!hasThread ? (
          <div className="px-5 py-8 text-sm text-slate-500">
            Select a conversation to load details.
          </div>
        ) : surface?.loading && !hasLead ? (
          <InboxLeadSkeleton />
        ) : (
          <>
            <IdentityCard
              selectedThread={selectedThread}
              relatedLead={relatedLead}
              owner={owner}
              wsState={wsState}
            />

            {showSurfaceBanner ? (
              <div className="px-5 pb-2">
                <SettingsSurfaceBanner
                  surface={surface}
                  unavailableMessage="Related context is temporarily unavailable."
                  refreshLabel="Refresh context"
                />
              </div>
            ) : null}

            <Section icon={Radio} title="Routing">
              <div className="border-t border-slate-200/70 px-0 py-2">
                <InfoRow label="Source" value={sourceLabel || "--"} />
                <div className="border-t border-slate-200/70" />
                <InfoRow
                  label="Status"
                  value={prettyStatus(selectedThread, relatedLead)}
                  valueTone="strong"
                />
                <div className="border-t border-slate-200/70" />
                <InfoRow
                  label="Assigned to"
                  value={owner}
                  valueTone="strong"
                />
              </div>
            </Section>

            <Section
              icon={UserRound}
              title="People"
              action={
                people.length ? (
                  <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {people.length}
                  </span>
                ) : null
              }
            >
              <div className="border-t border-slate-200/70 px-0 py-4">
                <div className="flex items-center justify-between gap-4">
                  <AvatarStack people={people} />

                  <div className="min-w-0 text-right">
                    <div className="truncate text-[13px] font-medium text-slate-800">
                      {resolveDisplayName(selectedThread, relatedLead)}
                    </div>
                    <div className="mt-1 truncate text-[12px] text-slate-500">
                      {resolveHandle(selectedThread, relatedLead)
                        ? `@${resolveHandle(selectedThread, relatedLead).replace(/^@/, "")}`
                        : "--"}
                    </div>
                  </div>
                </div>
              </div>
            </Section>

            {hasLead ? (
              <Section
                icon={ArrowUpRight}
                title="Related lead"
                action={
                  <button
                    type="button"
                    onClick={() => openLeadDetail?.(relatedLead)}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    Open
                  </button>
                }
              >
                <div className="border-t border-slate-200/70 px-0 py-4">
                  <div className="text-[15px] font-medium text-slate-900">
                    {leadName(relatedLead) || "Lead"}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {prettyStage(relatedLead) ? (
                      <Tag tone="blue">{prettyStage(relatedLead)}</Tag>
                    ) : null}
                    {s(relatedLead?.status) ? (
                      <Tag tone="green">{s(relatedLead.status)}</Tag>
                    ) : null}
                    {leadHandle(relatedLead) ? (
                      <Tag tone="soft">{leadHandle(relatedLead)}</Tag>
                    ) : null}
                  </div>
                </div>
              </Section>
            ) : null}

            <Section icon={MessageSquareText} title="Latest message">
              <div className="border-t border-slate-200/70 px-0 py-4">
                <div className="text-[14px] leading-6 text-slate-700">{preview}</div>
              </div>
            </Section>
          </>
        )}
      </div>
    </section>
  );
}
