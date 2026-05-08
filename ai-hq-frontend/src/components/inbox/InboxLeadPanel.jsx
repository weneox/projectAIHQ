import {
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
} from "../../lib/inbox-ui.js";import { InboxLeadSkeleton } from "./InboxLoadingSurface.jsx";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Button from "../ui/Button.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";

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

  if (!parts.length) return "U";

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function avatarTone(seed = "") {
  const tones = [
    "border-[rgba(var(--color-line),0.9)] bg-[linear-gradient(180deg,#F8FBFF_0%,#E8F1FA_100%)] text-[#235B98]",
    "border-[rgba(var(--color-line),0.9)] bg-[linear-gradient(180deg,#FFFFFF_0%,#EEF3F8_100%)] text-[#43566E]",
    "border-[rgba(var(--color-success),0.16)] bg-[linear-gradient(180deg,#F8FFFB_0%,#E8F6EF_100%)] text-success",
    "border-[rgba(var(--color-warning),0.16)] bg-[linear-gradient(180deg,#FFFDF9_0%,#F5EBDD_100%)] text-warning",
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

function toneForStatus(value = "") {
  const normalized = s(value).toLowerCase();

  if (normalized.includes("handoff")) return "warning";
  if (normalized.includes("active")) return "success";
  if (normalized.includes("resolved") || normalized.includes("closed")) {
    return "neutral";
  }

  return "success";
}

function Tag({ children, tone = "neutral" }) {
  return (
    <Badge
      tone={tone}
      size="sm"
      className="!min-h-[25px] !rounded-[10px] !px-2.5 !text-[11px]"
    >
      {children}
    </Badge>
  );
}

function InfoRow({ label, value, valueTone = "default" }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] items-center gap-4 border-b border-line-soft py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-subtle">
        {label}
      </div>

      <div
        title={s(value)}
        className={cx(
          "min-w-0 truncate text-right text-[13px] font-medium tracking-[var(--tracking-tight-xs)]",
          valueTone === "strong" ? "text-text" : "text-text-muted"
        )}
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
        <div className="flex items-center gap-2 text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {Icon ? <Icon className="h-4 w-4 text-text-subtle" strokeWidth={2.05} /> : null}
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
          className={cx(
            "-ml-2 first:ml-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-xs font-semibold shadow-[0_12px_24px_-18px_rgba(15,23,42,0.24)]",
            avatarTone(name)
          )}
        >
          {initialsFromName(name)}
        </div>
      ))}
    </div>
  );
}

function IdentityAvatar({ name, avatarUrl }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-16 w-16 rounded-[20px] border border-line-soft object-cover shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28)]"
        loading="lazy"
        decoding="async"
      />
    );
  }

  return (
    <div
      className={cx(
        "flex h-16 w-16 items-center justify-center rounded-[20px] border text-[20px] font-semibold shadow-[0_18px_36px_-28px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.95)]",
        avatarTone(name)
      )}
    >
      {initialsFromName(name)}
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
      <Card padded="md">
        <div className="flex flex-col items-center text-center">
          <IdentityAvatar name={name} avatarUrl={avatarUrl} />

          <div className="mt-3 max-w-full truncate text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
            {name}
          </div>

          {handle ? (
            <div className="mt-1 max-w-full truncate text-[13px] font-medium text-text-muted">
              @{handle.replace(/^@/, "")}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Tag tone="neutral">{sourceLabel || "conversation"}</Tag>
            <Tag tone="brand">{stage || "context"}</Tag>
            <Tag tone={toneForStatus(statusLabel)}>{statusLabel}</Tag>
          </div>
        </div>

        <div className="mt-4 border-t border-line-soft pt-2">
          <InfoRow label="Owner" value={owner} valueTone="strong" />
          <InfoRow
            label="Realtime"
            value={wsState ? `Realtime ${wsState}` : "Connected"}
          />
        </div>
      </Card>
    </div>
  );
}

function InfoCard({ children }) {
  return (
    <Card padded={false}>
      <div className="px-4">{children}</div>
    </Card>
  );
}

function TextCard({ children }) {
  return (
    <Card padded="sm">
      <div className="text-[13px] font-medium leading-6 tracking-[var(--tracking-tight-xs)] text-text-muted">
        {children}
      </div>
    </Card>
  );
}

export default function InboxLeadPanel({
  selectedThread,
  surface,
  relatedLead,
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
      <div className="border-b border-line-soft bg-surface px-4 py-4 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Conversation details
            </h2>
            <div className="mt-0.5 text-[12px] font-medium text-text-muted">
              Profile, routing, and recent context
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={onClose}
            aria-label="Close details"
            className="!h-9 !w-9"
          >
            <X className="h-4 w-4" strokeWidth={2.2} />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-surface-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {!hasThread ? (
          <div className="px-4 py-6">
            <InlineNotice
              tone="info"
              description="Select a conversation to load details."
              compact
            />
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
                <InlineNotice
                  tone="warning"
                  title="Context unavailable"
                  description={
                    surface?.error ||
                    surface?.message ||
                    "Related context is temporarily unavailable."
                  }
                  compact
                />
              </div>
            ) : null}

            <Section icon={Radio} title="Routing">
              <InfoCard>
                <InfoRow label="Source" value={sourceLabel || "--"} />
                <InfoRow
                  label="Status"
                  value={prettyStatus(selectedThread, relatedLead)}
                  valueTone="strong"
                />
                <InfoRow label="Assigned" value={owner} valueTone="strong" />
              </InfoCard>
            </Section>

            {websiteContext.visible ? (
              <Section icon={Globe2} title="Website context">
                <InfoCard>
                  <InfoRow label="Page" value={websiteContext.title || "--"} />
                  <InfoRow label="URL" value={websiteContext.url || "--"} />
                  <InfoRow
                    label="Referrer"
                    value={websiteContext.referrer || "--"}
                  />
                </InfoCard>
              </Section>
            ) : null}

            <Section
              icon={UserRound}
              title="People"
              action={people.length ? <Tag tone="neutral">{people.length}</Tag> : null}
            >
              <Card padded="sm">
                <div className="flex items-center justify-between gap-4">
                  <AvatarStack people={people} />

                  <div className="min-w-0 text-right">
                    <div className="truncate text-[13px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                      {resolveDisplayName(selectedThread, relatedLead)}
                    </div>
                    <div className="mt-1 truncate text-[12px] font-medium text-text-muted">
                      {resolveHandle(selectedThread, relatedLead)
                        ? `@${resolveHandle(selectedThread, relatedLead).replace(/^@/, "")}`
                        : "--"}
                    </div>
                  </div>
                </div>
              </Card>
            </Section>

            {hasLead ? (
              <Section icon={UserRound} title="Related lead">
                <Card padded="sm">
                  <div className="text-[15px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
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
                      <Tag tone="neutral">{leadHandle(relatedLead)}</Tag>
                    ) : null}
                  </div>
                </Card>
              </Section>
            ) : null}

            <Section icon={MessageSquareText} title="Latest message">
              <TextCard>{preview}</TextCard>
            </Section>
          </>
        )}
      </div>
    </section>
  );
}