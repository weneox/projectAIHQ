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
          ? "border-sky-200 bg-sky-50/90 shadow-[0_16px_34px_-26px_rgba(14,165,233,0.28)]"
          : "border-slate-200/80 bg-white/62 hover:border-slate-300 hover:bg-white/82"
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
            <div className="truncate text-sm font-semibold text-slate-900">{name}</div>
          </div>
          <div className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-slate-400">
            {leadHandle(lead)}
          </div>
        </div>

        <div className="text-sm text-slate-600">{source}</div>
        <div className="truncate text-sm text-slate-600">{interest}</div>

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

        <div className="text-right text-sm font-medium text-slate-700">{value}</div>
      </div>
    </button>
  );
}
