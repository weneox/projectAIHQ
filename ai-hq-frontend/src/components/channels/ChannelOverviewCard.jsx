import { cx } from "../../lib/cx.js";
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
  const hasSummary = Boolean(s(channel?.summary));

  return (
    <article
      className={cx(
        "group relative overflow-hidden rounded-[24px] border px-5 py-5 transition-all duration-200",
        "bg-[rgba(255,255,255,0.88)] shadow-[0_24px_60px_-46px_rgba(15,23,42,0.14)]",
        selected
          ? "border-[rgba(37,99,235,0.12)] shadow-[0_28px_70px_-48px_rgba(37,99,235,0.18)]"
          : "border-[rgba(15,23,42,0.06)] hover:border-[rgba(15,23,42,0.10)] hover:shadow-[0_28px_70px_-48px_rgba(15,23,42,0.16)]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="mt-0.5 shrink-0">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0">
            <div className="truncate text-[15px] font-semibold text-[rgba(15,23,42,0.96)]">
              {channel.name}
            </div>

            {channel.eyebrow ? (
              <div className="mt-1 truncate text-[12.5px] text-[rgba(100,116,139,0.96)]">
                {channel.eyebrow}
              </div>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          <ChannelStatus status={channel.status} className="!text-[11px]" />
        </div>
      </div>

      {hasSummary ? (
        <div className="mt-5">
          <div className="text-[13px] font-medium text-[rgba(15,23,42,0.94)]">
            {channel.detailSummary || channel.summary}
          </div>

          {channel.summary && channel.detailSummary ? (
            <div className="mt-2 text-[13px] leading-7 text-[rgba(100,116,139,0.96)]">
              {channel.summary}
            </div>
          ) : (
            <div className="mt-2 text-[13px] leading-7 text-[rgba(100,116,139,0.96)]">
              {channel.summary}
            </div>
          )}
        </div>
      ) : null}

      {hasCapabilities ? (
        <div className="mt-4 border-t border-[rgba(15,23,42,0.05)] pt-4">
          <div className="text-[12px] font-medium text-[rgba(100,116,139,0.96)]">
            {capabilityText}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-[rgba(15,23,42,0.05)] pt-4">
        <ChannelInspectButton
          onClick={() => onInspect?.(channel.id)}
          aria-label={`Details ${channel.name}`}
          className="!text-[12.5px] !text-[rgba(100,116,139,0.96)] hover:!text-[rgba(15,23,42,0.94)]"
        >
          Details
        </ChannelInspectButton>

        <ChannelActionButton
          onClick={() => onRunPrimaryAction?.(channel)}
          ariaLabel={`${channel.primaryAction.label} ${channel.name}`}
          className="!h-11 !rounded-[14px] !px-4 !text-[13px] !font-semibold"
        >
          {channel.primaryAction.label}
        </ChannelActionButton>
      </div>
    </article>
  );
}