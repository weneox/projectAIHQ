import {
  ArrowUpRight,
  Globe2,
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
import SurfaceBanner from "../feedback/SurfaceBanner.jsx";
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

function prettyThreadSource(value = "") {
  const normalized = s(value).toLowerCase();
  if (!normalized) return "conversation";
  if (["web", "website", "webchat"].includes(normalized)) return "Website chat";
  return normalized
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function resolveWebsiteContext(selectedThread = {}) {
  const widget = obj(selectedThread?.meta)?.websiteWidget || {};
  const page = obj(widget.page);

  return {
    title: s(page.title),
    url: s(page.url),
    referrer: s(page.referrer),
    visible: Boolean(s(page.title) || s(page.url) || s(page.referrer)),
  };
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function Tag({ children, tone = "default" }) {
  const tones = {
    default: "border-line bg-surface-subtle text-text-muted",
    muted: "border-line bg-surface text-text-muted",
    success: "border-[rgba(var(--color-success),0.18)] bg-success-soft text-success",
    brand: "border-[rgba(var(--color-brand),0.18)] bg-brand-soft text-brand",
    warning: "border-[rgba(var(--color-warning),0.2)] bg-warning-soft text-warning",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-pill border px-2.5 py-1 text-[11px] font-medium",
        tones[tone] || tones.default,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function InfoRow({ label, value, valueTone = "default" }) {
  return (
    <div className="grid grid-cols-[90px_minmax(0,1fr)] gap-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.08em] text-text-subtle">
        {label}
      </div>
      <div
        className={[
          "min-w-0 text-right text-[13px]",
          valueTone === "strong" ? "font-medium text-text" : "text-text-muted",
        ].join(" ")}
      >
        {value || "--"}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children, action = null }) {
  return (
    <section className="border-t border-line-soft px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[14px] font-medium text-text">
          {Icon ? <Icon className="h-4 w-4 text-text-subtle" /> : null}
          <span>{title}</span>
        </div>

        {action}
      </div>

      <div className="mt-3">{children}</div>
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
            "-ml-2 first:ml-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold",
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
    : prettyThreadSource(selectedThread?.channel);
  const stage = prettyStage(relatedLead);
  const statusLabel = prettyStatus(selectedThread, relatedLead);

  return (
    <div className="px-4 py-4">
      <div className="rounded-panel border border-line bg-surface p-4">
        <div className="flex flex-col items-center text-center">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-16 w-16 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className={[
                "flex h-16 w-16 items-center justify-center rounded-full text-[20px] font-semibold",
                avatarTone(name),
              ].join(" ")}
            >
              {initialsFromName(name)}
            </div>
          )}

          <div className="mt-3 text-[16px] font-semibold text-text">{name}</div>

          {handle ? (
            <div className="mt-1 text-[13px] text-text-muted">
              @{handle.replace(/^@/, "")}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Tag tone="muted">{sourceLabel || "conversation"}</Tag>
            <Tag tone="brand">{stage || "context"}</Tag>
            <Tag tone={selectedThread?.handoff_active ? "warning" : "success"}>
              {statusLabel}
            </Tag>
          </div>
        </div>

        <div className="mt-4 border-t border-line-soft pt-2">
          <InfoRow label="Owner" value={owner} valueTone="strong" />
          <div className="border-t border-line-soft" />
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
    : prettyThreadSource(selectedThread?.channel || "--");
  const websiteContext = resolveWebsiteContext(selectedThread);

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
    <section className="flex h-full min-h-0 flex-col bg-surface">
      <div className="border-b border-line-soft bg-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-text">
              Conversation details
            </h2>
            <div className="mt-0.5 text-[12px] text-text-muted">
              Profile, routing, and recent context
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="flex h-9 w-9 items-center justify-center rounded-soft border border-line bg-surface text-text-muted transition-colors hover:bg-surface-subtle hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!hasThread ? (
          <div className="px-4 py-6 text-[13px] text-text-muted">
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
              <div className="px-4 pb-2">
                <SurfaceBanner
                  surface={surface}
                  unavailableMessage="Related context is temporarily unavailable."
                  refreshLabel="Refresh context"
                />
              </div>
            ) : null}

            <Section icon={Radio} title="Routing">
              <div className="rounded-panel border border-line bg-surface px-4">
                <InfoRow label="Source" value={sourceLabel || "--"} />
                <div className="border-t border-line-soft" />
                <InfoRow
                  label="Status"
                  value={prettyStatus(selectedThread, relatedLead)}
                  valueTone="strong"
                />
                <div className="border-t border-line-soft" />
                <InfoRow label="Assigned" value={owner} valueTone="strong" />
              </div>
            </Section>

            {websiteContext.visible ? (
              <Section icon={Globe2} title="Website context">
                <div className="rounded-panel border border-line bg-surface px-4">
                  <InfoRow label="Page" value={websiteContext.title || "--"} />
                  <div className="border-t border-line-soft" />
                  <InfoRow label="URL" value={websiteContext.url || "--"} />
                  <div className="border-t border-line-soft" />
                  <InfoRow label="Referrer" value={websiteContext.referrer || "--"} />
                </div>
              </Section>
            ) : null}

            <Section
              icon={UserRound}
              title="People"
              action={
                people.length ? <Tag tone="muted">{people.length}</Tag> : null
              }
            >
              <div className="rounded-panel border border-line bg-surface px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <AvatarStack people={people} />

                  <div className="min-w-0 text-right">
                    <div className="truncate text-[13px] font-medium text-text">
                      {resolveDisplayName(selectedThread, relatedLead)}
                    </div>
                    <div className="mt-1 truncate text-[12px] text-text-muted">
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
                    className="inline-flex items-center gap-2 rounded-soft border border-line bg-surface px-3 py-1.5 text-[12px] text-text-muted transition-colors hover:bg-surface-subtle hover:text-text"
                  >
                    Open
                  </button>
                }
              >
                <div className="rounded-panel border border-line bg-surface px-4 py-4">
                  <div className="text-[15px] font-medium text-text">
                    {leadName(relatedLead) || "Lead"}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {prettyStage(relatedLead) ? (
                      <Tag tone="brand">{prettyStage(relatedLead)}</Tag>
                    ) : null}
                    {s(relatedLead?.status) ? (
                      <Tag tone="success">{s(relatedLead.status)}</Tag>
                    ) : null}
                    {leadHandle(relatedLead) ? (
                      <Tag tone="muted">{leadHandle(relatedLead)}</Tag>
                    ) : null}
                  </div>
                </div>
              </Section>
            ) : null}

            <Section icon={MessageSquareText} title="Latest message">
              <div className="rounded-panel border border-line bg-surface px-4 py-4">
                <div className="text-[13px] leading-6 text-text-muted">{preview}</div>
              </div>
            </Section>
          </>
        )}
      </div>
    </section>
  );
}
