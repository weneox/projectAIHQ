import {
  ArrowUpRight,
  BadgeDollarSign,
  BriefcaseBusiness,
  Link2,
  Target,
} from "lucide-react";

import {
  formatMoneyAZN,
  leadHandle,
  leadName,
  pickLeadValue,
  prettyLeadSource,
  scoreBand,
  scoreTone,
  stageTone,
  statusTone,
} from "../../lib/inbox-ui.js";
import SettingsSurfaceBanner from "../settings/SettingsSurfaceBanner.jsx";
import InboxMiniInfo from "./InboxMiniInfo.jsx";

function Button({ children, onClick, disabled = false, icon: Icon }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

export default function InboxLeadPanel({ selectedThread, surface, relatedLead, openLeadDetail }) {
  const hasThread = Boolean(selectedThread?.id);
  const hasLead = Boolean(relatedLead?.id);
  const relatedLeadValue = hasLead ? formatMoneyAZN(pickLeadValue(relatedLead)) : "—";
  const relatedLeadScore = Number(relatedLead?.score || 0);

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_18px_40px_rgba(15,23,42,0.04)]">
      <div className="border-b border-slate-200/80 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
            <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Intelligence rail
            </div>
            <div className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
              Customer context
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Lead status, pipeline value, and contact signals linked to the active conversation.
            </div>
          </div>
        </div>

        {hasThread ? (
          <div className="mt-4">
            <SettingsSurfaceBanner
              surface={surface}
              unavailableMessage="Related lead data is temporarily unavailable."
              refreshLabel="Refresh lead"
            />
          </div>
        ) : null}
      </div>

      <div className="px-5 py-4">
        {!hasThread ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <div className="text-sm font-medium text-slate-700">Customer intelligence block placeholder</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">
              Select a conversation to load customer and lead context here.
            </div>
          </div>
        ) : surface?.loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            Loading related lead...
          </div>
        ) : !hasLead ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <div className="text-sm font-medium text-slate-700">No related lead</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">
              Lead intelligence placeholder. No lead is linked to this thread yet.
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold tracking-[-0.03em] text-slate-900">
                  {leadName(relatedLead)}
                </div>
                <div className="mt-1 text-sm text-slate-500">{leadHandle(relatedLead)}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${stageTone(relatedLead.stage)}`}>
                  {relatedLead.stage || "new"}
                </span>
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(relatedLead.status)}`}>
                  {relatedLead.status || "open"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InboxMiniInfo label="Source" value={prettyLeadSource(relatedLead)} icon={Link2} />
              <InboxMiniInfo label="Interest" value={relatedLead.interest || "—"} icon={BriefcaseBusiness} />
              <InboxMiniInfo label="Score" value={String(relatedLead.score ?? 0)} icon={Target} />
              <InboxMiniInfo label="Pipeline value" value={relatedLeadValue} icon={BadgeDollarSign} />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Score band</div>
              <div className="mt-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${scoreTone(relatedLeadScore)}`}>
                  {scoreBand(relatedLeadScore)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button icon={ArrowUpRight} onClick={() => openLeadDetail(relatedLead)} disabled={!hasLead}>
                Open in Leads
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
