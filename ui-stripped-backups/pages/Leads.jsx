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

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function initialsFromName(value = "") {
  const parts = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) return "C";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function avatarTone(seed = "") {
  const tones = [
    "bg-[linear-gradient(180deg,rgba(239,246,255,0.96),rgba(219,234,254,0.96))] text-[rgba(37,99,235,0.96)] ring-[rgba(37,99,235,0.10)]",
    "bg-[linear-gradient(180deg,rgba(245,243,255,0.96),rgba(237,233,254,0.96))] text-[rgba(109,40,217,0.96)] ring-[rgba(109,40,217,0.10)]",
    "bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(209,250,229,0.96))] text-[rgba(5,150,105,0.96)] ring-[rgba(5,150,105,0.10)]",
    "bg-[linear-gradient(180deg,rgba(255,247,237,0.96),rgba(254,215,170,0.96))] text-[rgba(194,65,12,0.96)] ring-[rgba(194,65,12,0.10)]",
    "bg-[linear-gradient(180deg,rgba(254,242,242,0.96),rgba(254,226,226,0.96))] text-[rgba(220,38,38,0.96)] ring-[rgba(220,38,38,0.10)]",
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
  if (!normalized) return "Conversation";
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
  if (selectedThread?.status) {
    return s(selectedThread.status)
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return "Active";
}

function prettyStage(relatedLead = null) {
  const value = s(relatedLead?.stage || "");
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
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

function resolveRealtimeLabel(wsState = "") {
  const next = s(wsState).toLowerCase();
  if (!next) return "Connected";
  if (next === "open") return "Connected";
  if (next === "connecting") return "Connecting";
  if (next === "closed") return "Offline";
  return next.replace(/\b\w/g, (char) => char.toUpperCase());
}

function MetaBadge({ children, tone = "neutral" }) {
  const tones = {
    neutral:
      "bg-[rgba(248,250,252,0.96)] text-[rgba(71,85,105,0.96)] border-[rgba(15,23,42,0.06)]",
    brand:
      "bg-[rgba(239,246,255,0.96)] text-[rgba(37,99,235,0.98)] border-[rgba(37,99,235,0.12)]",
    success:
      "bg-[rgba(236,253,245,0.96)] text-[rgba(5,150,105,0.96)] border-[rgba(5,150,105,0.12)]",
    warning:
      "bg-[rgba(255,247,237,0.96)] text-[rgba(180,83,9,0.96)] border-[rgba(245,158,11,0.16)]",
  };

  return (
    <span
      className={[
        "inline-flex items-center rounded-[10px] border px-2.5 py-1 text-[11px] font-semibold",
        tones[tone] || tones.neutral,
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function DetailSection({ icon: Icon, title, action = null, children }) {
  return (
    <section className="rounded-[22px] border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.88)] shadow-[0_24px_60px_-46px_rgba(15,23,42,0.16)]">
      <div className="flex items-center justify-between gap-3 border-b border-[rgba(15,23,42,0.05)] px-5 py-4">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4 text-[rgba(100,116,139,0.96)]" /> : null}
          <h3 className="text-[14px] font-semibold text-[rgba(15,23,42,0.94)]">
            {title}
          </h3>
        </div>

        {action}
      </div>

      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function InfoGrid({ items = [] }) {
  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-[92px_minmax(0,1fr)] items-start gap-4 rounded-[16px] bg-[rgba(248,250,252,0.78)] px-4 py-3"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgba(148,163,184,0.96)]">
            {item.label}
          </div>
          <div
            className={[
              "min-w-0 text-right text-[13px] leading-6",
              item.strong
                ? "font-medium text-[rgba(15,23,42,0.94)]"
                : "text-[rgba(71,85,105,0.96)]",
            ].join(" ")}
          >
            <div className="break-words">{item.value || "--"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function IdentityHero({ selectedThread, relatedLead, owner, wsState }) {
  const name = resolveDisplayName(selectedThread, relatedLead);
  const handle = resolveHandle(selectedThread, relatedLead);
  const avatarUrl = resolveAvatarUrl(selectedThread);
  const sourceLabel = relatedLead
    ? prettyLeadSource(relatedLead)
    : prettyThreadSource(selectedThread?.channel);
  const stage = prettyStage(relatedLead);
  const statusLabel = prettyStatus(selectedThread, relatedLead);

  return (
    <section className="rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.92))] px-5 py-5 shadow-[0_30px_70px_-52px_rgba(15,23,42,0.18)]">
      <div className="flex items-start gap-4">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-[rgba(15,23,42,0.06)]"
            loading="lazy"
          />
        ) : (
          <div
            className={[
              "flex h-16 w-16 shrink-0 items-center justify-center rounded-md text-[18px] font-semibold ring-1",
              avatarTone(name),
            ].join(" ")}
          >
            {initialsFromName(name)}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="truncate text-[18px] font-semibold text-[rgba(15,23,42,0.96)]">
            {name}
          </div>

          {handle ? (
            <div className="mt-1 truncate text-[13px] text-[rgba(100,116,139,0.96)]">
              @{handle.replace(/^@/, "")}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap gap-2">
            <MetaBadge tone="neutral">{sourceLabel || "Conversation"}</MetaBadge>
            {stage ? <MetaBadge tone="brand">{stage}</MetaBadge> : null}
            <MetaBadge tone={selectedThread?.handoff_active ? "warning" : "success"}>
              {statusLabel}
            </MetaBadge>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <div className="rounded-[16px] bg-[rgba(248,250,252,0.78)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgba(148,163,184,0.96)]">
            Owner
          </div>
          <div className="mt-1 text-[13px] font-medium text-[rgba(15,23,42,0.94)]">
            {owner}
          </div>
        </div>

        <div className="rounded-[16px] bg-[rgba(248,250,252,0.78)] px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[rgba(148,163,184,0.96)]">
            Realtime
          </div>
          <div className="mt-1 text-[13px] font-medium text-[rgba(15,23,42,0.94)]">
            {resolveRealtimeLabel(wsState)}
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyDrawerState() {
  return (
    <div className="px-5 py-8">
      <div className="rounded-[24px] border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.88)] px-5 py-8 text-center shadow-[0_24px_60px_-46px_rgba(15,23,42,0.16)]">
        <div className="text-[15px] font-semibold text-[rgba(15,23,42,0.96)]">
          No conversation selected
        </div>
        <div className="mt-2 text-[13px] leading-6 text-[rgba(100,116,139,0.96)]">
          Select a thread to view profile, routing, and conversation context.
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

  const preview =
    s(selectedThread?.last_message_text) ||
    "No message preview is available yet for this conversation.";

  const showSurfaceBanner =
    surface?.unavailable ||
    surface?.availability === "unavailable" ||
    surface?.error;

  return (
    <section className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))]">
      <div className="shrink-0 border-b border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.86)] px-5 py-5 backdrop-blur supports-[backdrop-filter]:bg-[rgba(255,255,255,0.76)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[rgba(15,23,42,0.96)]">
              Conversation details
            </h2>
            <div className="mt-1 text-[12.5px] text-[rgba(100,116,139,0.96)]">
              Profile, routing, and live context
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(15,23,42,0.08)] bg-white text-[rgba(100,116,139,0.96)] transition-all hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.92)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!hasThread ? (
          <EmptyDrawerState />
        ) : surface?.loading && !hasLead ? (
          <InboxLeadSkeleton />
        ) : (
          <div className="space-y-4 px-5 py-5">
            <IdentityHero
              selectedThread={selectedThread}
              relatedLead={relatedLead}
              owner={owner}
              wsState={wsState}
            />

            {showSurfaceBanner ? (
              <SurfaceBanner
                surface={surface}
                unavailableMessage="Related context is temporarily unavailable."
                refreshLabel="Refresh context"
              />
            ) : null}

            <DetailSection icon={Radio} title="Routing">
              <InfoGrid
                items={[
                  { label: "Source", value: sourceLabel || "--" },
                  {
                    label: "Status",
                    value: prettyStatus(selectedThread, relatedLead),
                    strong: true,
                  },
                  {
                    label: "Assigned",
                    value: owner,
                    strong: true,
                  },
                ]}
              />
            </DetailSection>

            {websiteContext.visible ? (
              <DetailSection icon={Globe2} title="Website context">
                <InfoGrid
                  items={[
                    { label: "Page", value: websiteContext.title || "--" },
                    { label: "URL", value: websiteContext.url || "--" },
                    { label: "Referrer", value: websiteContext.referrer || "--" },
                  ]}
                />
              </DetailSection>
            ) : null}

            {hasLead ? (
              <DetailSection
                icon={UserRound}
                title="Related lead"
                action={
                  <button
                    type="button"
                    onClick={() => openLeadDetail?.(relatedLead)}
                    className="inline-flex items-center gap-2 rounded-[12px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-2 text-[12px] font-medium text-[rgba(71,85,105,0.96)] transition-all hover:bg-[rgba(248,250,252,0.96)] hover:text-[rgba(15,23,42,0.94)]"
                  >
                    <span>Open</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                }
              >
                <div className="rounded-[18px] bg-[rgba(248,250,252,0.78)] px-4 py-4">
                  <div className="text-[15px] font-semibold text-[rgba(15,23,42,0.96)]">
                    {leadName(relatedLead) || "Lead"}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {prettyStage(relatedLead) ? (
                      <MetaBadge tone="brand">{prettyStage(relatedLead)}</MetaBadge>
                    ) : null}

                    {s(relatedLead?.status) ? (
                      <MetaBadge tone="success">
                        {s(relatedLead.status)
                          .replace(/[_-]+/g, " ")
                          .replace(/\b\w/g, (char) => char.toUpperCase())}
                      </MetaBadge>
                    ) : null}

                    {leadHandle(relatedLead) ? (
                      <MetaBadge tone="neutral">{leadHandle(relatedLead)}</MetaBadge>
                    ) : null}
                  </div>
                </div>
              </DetailSection>
            ) : null}

            <DetailSection icon={MessageSquareText} title="Latest message">
              <div className="rounded-[18px] bg-[rgba(248,250,252,0.78)] px-4 py-4 text-[13px] leading-7 text-[rgba(71,85,105,0.96)]">
                {preview}
              </div>
            </DetailSection>
          </div>
        )}
      </div>
    </section>
  );
}