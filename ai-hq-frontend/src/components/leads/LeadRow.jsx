import React from "react";
import {
  Instagram,
  Facebook,
  MessageCircleMore,
  Mail,
  Globe,
} from "lucide-react";
import {
  channelIconFromLead,
  sourceTone,
  stageTone,
  statusTone,
  formatMoneyAZN,
  pickLeadValue,
  prettySource,
  leadName,
  leadHandle,
} from "../../features/leads/lead-utils.js";

export default function LeadRow({ lead, selected, onSelect }) {
  const name = leadName(lead);
  const source = prettySource(lead);
  const interest = lead?.interest || "—";
  const stage = String(lead?.stage || "new").toLowerCase();
  const value = formatMoneyAZN(pickLeadValue(lead));
  const status = String(lead?.status || "open").toLowerCase();

  const ChannelIcon = channelIconFromLead(lead, {
    Instagram,
    Facebook,
    MessageCircleMore,
    Mail,
    Globe,
  });

  return (
    <button
      type="button"
      onClick={() => onSelect?.(lead)}
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
        selected
          ? "border-cyan-400/20 bg-cyan-400/[0.05]"
          : "border-white/8 bg-black/20 hover:border-white/12 hover:bg-black/26"
      }`}
    >
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.9fr_1fr_0.8fr_0.8fr_0.7fr] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full border ${sourceTone(
                lead
              )}`}
            >
              <ChannelIcon className="h-3.5 w-3.5" />
            </div>
            <div className="truncate text-sm font-semibold text-white">{name}</div>
          </div>
          <div className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-white/34">
            {leadHandle(lead)}
          </div>
        </div>

        <div className="text-sm text-white/62">{source}</div>
        <div className="truncate text-sm text-white/62">{interest}</div>

        <div>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${stageTone(
              stage
            )}`}
          >
            {stage}
          </span>
        </div>

        <div>
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(
              status
            )}`}
          >
            {status}
          </span>
        </div>

        <div className="text-right text-sm font-medium text-white/74">{value}</div>
      </div>
    </button>
  );
}