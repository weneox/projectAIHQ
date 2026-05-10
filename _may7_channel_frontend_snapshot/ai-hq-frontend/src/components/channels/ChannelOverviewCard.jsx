import { cx } from "../../lib/cx.js";
import Card from "../ui/Card.jsx";
import ChannelIcon from "./ChannelIcon.jsx";
import {
  ChannelActionButton,
  ChannelInspectButton,
  ChannelStatus,
} from "./ChannelPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function buildCapabilityText(capabilities = []) {
  if (!Array.isArray(capabilities) || !capabilities.length) return "";
  return capabilities.slice(0, 3).join(" · ");
}

export default function ChannelOverviewCard({
  channel,
  selected = false,
  onInspect,
  onRunPrimaryAction,
}) {
  const capabilityText = buildCapabilityText(channel?.capabilities);
  const hasCapabilities = Boolean(capabilityText);
  const summary = s(channel?.detailSummary || channel?.summary);
  const supportingSummary =
    s(channel?.summary) && s(channel?.detailSummary) ? s(channel.summary) : "";

  return (
    <Card
      padded={false}
      interactive
      className={cx(
        "group relative overflow-hidden transition-[border-color,background-color,box-shadow] duration-base ease-premium",
        selected
          ? "border-[rgba(var(--color-brand),0.18)] bg-brand-soft/40"
          : "bg-surface"
      )}
    >
      <article className="px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <div className="mt-0.5 shrink-0">
              <ChannelIcon channel={channel} size="lg" />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
                {channel?.name}
              </div>

              {channel?.eyebrow ? (
                <div className="mt-1 truncate text-[12.5px] font-medium text-text-muted">
                  {channel.eyebrow}
                </div>
              ) : null}
            </div>
          </div>

          <div className="shrink-0">
            <ChannelStatus status={channel?.status} />
          </div>
        </div>

        {summary ? (
          <div className="mt-5">
            <div className="text-[13.5px] font-semibold leading-6 tracking-[var(--tracking-tight-sm)] text-text">
              {summary}
            </div>

            {supportingSummary ? (
              <div className="mt-2 text-[13px] font-medium leading-7 text-text-muted">
                {supportingSummary}
              </div>
            ) : null}
          </div>
        ) : null}

        {hasCapabilities ? (
          <div className="mt-4 border-t border-line-soft pt-4">
            <div className="text-[12.5px] font-medium leading-5 text-text-muted">
              {capabilityText}
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
          <ChannelInspectButton
            onClick={() => onInspect?.(channel?.id)}
            aria-label={`Details ${channel?.name}`}
            className="!h-9 !px-3 !text-[12.5px]"
          >
            Details
          </ChannelInspectButton>

          <ChannelActionButton
            onClick={() => onRunPrimaryAction?.(channel)}
            ariaLabel={`${channel?.primaryAction?.label || "Open"} ${channel?.name}`}
            className="!h-10 !px-4 !text-[13px]"
          >
            {channel?.primaryAction?.label || "Open"}
          </ChannelActionButton>
        </div>
      </article>
    </Card>
  );
}