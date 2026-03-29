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

function Button({ children, onClick, tone = "default", disabled = false, icon: Icon }) {
  const toneMap = {
    violet:
      "border-[#e6def1] bg-[#f7f3fc] text-violet-900 hover:border-[#d9cdea] hover:bg-[#f1ebfa]",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full border px-3.5 py-2 text-[12px] font-medium transition",
        toneMap[tone] || toneMap.violet,
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
    <div className="rounded-[30px] border border-[#ece2d3] bg-[#fffdf9]/92 p-5 shadow-[0_18px_44px_rgba(120,102,73,0.08)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#e8decf] bg-[#fffaf4]">
          <BriefcaseBusiness className="h-4 w-4 text-stone-600" />
        </div>
        <div>
          <div className="text-[16px] font-semibold tracking-[-0.03em] text-stone-900">Related Lead</div>
          <div className="mt-1 text-sm text-stone-500">Lead context linked to the selected conversation appears here.</div>
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

      <div className="mt-5 rounded-[22px] border border-[#ece2d3] bg-[#fffdfa] p-4">
        {!hasThread ? (
          <div className="text-sm text-stone-500">No thread selected.</div>
        ) : surface?.loading ? (
          <div className="text-sm text-stone-500">Loading related lead...</div>
        ) : !hasLead ? (
          <div className="rounded-[18px] border border-dashed border-[#ece2d3] px-4 py-8 text-center">
            <div className="text-sm font-medium text-stone-700">No related lead</div>
            <div className="mt-2 text-sm leading-6 text-stone-500">No lead is linked to this thread yet.</div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold tracking-[-0.03em] text-stone-900">{leadName(relatedLead)}</div>
                <div className="mt-1 text-sm text-stone-500">{leadHandle(relatedLead)}</div>
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

            <div className="mt-4 rounded-2xl border border-[#ece2d3] bg-white px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-stone-400">Score band</div>
              <div className="mt-2">
                <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${scoreTone(relatedLeadScore)}`}>
                  {scoreBand(relatedLeadScore)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button tone="violet" icon={ArrowUpRight} onClick={() => openLeadDetail(relatedLead)} disabled={!hasLead}>
                Open in Leads
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
