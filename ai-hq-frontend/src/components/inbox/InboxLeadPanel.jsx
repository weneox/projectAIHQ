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
import InboxMiniInfo from "./InboxMiniInfo.jsx";

function Button({ children, onClick, tone = "default", disabled = false, icon: Icon }) {
  const toneMap = {
    violet:
      "border-violet-400/20 bg-violet-400/[0.08] text-violet-100 hover:border-violet-400/30 hover:bg-violet-400/[0.12]",
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

export default function InboxLeadPanel({
  selectedThread,
  loadingLead,
  relatedLead,
  openLeadDetail,
}) {
  const hasThread = Boolean(selectedThread?.id);
  const hasLead = Boolean(relatedLead?.id);
  const relatedLeadValue = hasLead ? formatMoneyAZN(pickLeadValue(relatedLead)) : "—";
  const relatedLeadScore = Number(relatedLead?.score || 0);

  return (
    <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <BriefcaseBusiness className="h-4 w-4 text-white/72" />
        </div>
        <div>
          <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">
            Related Lead
          </div>
          <div className="mt-1 text-sm text-white/46">
            Bu thread-ə bağlı lead varsa burada görünəcək.
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4">
        {!hasThread ? (
          <div className="text-sm text-white/46">No thread selected.</div>
        ) : loadingLead ? (
          <div className="text-sm text-white/52">Loading related lead...</div>
        ) : !hasLead ? (
          <div className="rounded-[18px] border border-dashed border-white/10 px-4 py-8 text-center">
            <div className="text-sm font-medium text-white/66">No related lead</div>
            <div className="mt-2 text-sm leading-6 text-white/40">
              Bu thread üçün hələ lead yaradılmayıb və ya sistemdə görünmür.
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-[17px] font-semibold tracking-[-0.03em] text-white">
                  {leadName(relatedLead)}
                </div>
                <div className="mt-1 text-sm text-white/44">
                  {leadHandle(relatedLead)}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${stageTone(
                    relatedLead.stage
                  )}`}
                >
                  {relatedLead.stage || "new"}
                </span>

                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(
                    relatedLead.status
                  )}`}
                >
                  {relatedLead.status || "open"}
                </span>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InboxMiniInfo
                label="Source"
                value={prettyLeadSource(relatedLead)}
                icon={Link2}
              />
              <InboxMiniInfo
                label="Interest"
                value={relatedLead.interest || "—"}
                icon={BriefcaseBusiness}
              />
              <InboxMiniInfo
                label="Score"
                value={String(relatedLead.score ?? 0)}
                icon={Target}
              />
              <InboxMiniInfo
                label="Pipeline value"
                value={relatedLeadValue}
                icon={BadgeDollarSign}
              />
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">
                Score band
              </div>
              <div className="mt-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${scoreTone(
                    relatedLeadScore
                  )}`}
                >
                  {scoreBand(relatedLeadScore)}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                tone="violet"
                icon={ArrowUpRight}
                onClick={() => openLeadDetail(relatedLead)}
                disabled={!hasLead}
              >
                Open in Leads
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}