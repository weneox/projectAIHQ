import { useLocation, useNavigate } from "react-router-dom";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  Target,
  Trophy,
  Users,
  RefreshCw,
  CircleDot,
  Link2,
  ShieldCheck,
  UserRound,
  FolderKanban,
  Save,
  CalendarDays,
  UserCog,
  Flag,
  FileText,
  ArrowUpRight,
  Clock3,
  Activity,
  Mail,
} from "lucide-react";

import {
  fmtRelative,
  fmtDateTime,
  stageTone,
  statusTone,
  priorityTone,
  formatMoneyAZN,
  pickLeadValue,
  prettySource,
  leadName,
  leadHandle,
  scoreBand,
  scoreTone,
  eventTone,
  prettyEventType,
} from "../features/leads/lead-utils.js";

import { useLeadsData } from "../hooks/useLeadsData.js";

import LeadStatCard from "../components/leads/LeadStatCard.jsx";
import LeadRow from "../components/leads/LeadRow.jsx";
import LeadMiniInfo from "../components/leads/LeadMiniInfo.jsx";
import {
  LeadField,
  LeadInput,
  LeadSelect,
  LeadTextArea,
} from "../components/leads/LeadFormControls.jsx";
import { areInternalRoutesEnabled } from "../lib/appEntry.js";

export default function Leads() {
  const location = useLocation();
  const navigate = useNavigate();
  const showInternalDebug = areInternalRoutesEnabled();

  const requestedLeadId = String(location?.state?.selectedLeadId || "").trim();

  const {
    selectedLead,
    setSelectedLead,
    stageFilter,
    setStageFilter,
    loading,
    dbDisabled,
    error,
    wsState,
    events,
    eventsLoading,
    savingField,
    noteText,
    setNoteText,
    form,
    setForm,
    filteredLeads,
    stats,
    sourceMix,
    stageMix,
    loadLeadsData,
    saveStage,
    saveStatus,
    saveOwner,
    saveCoreFields,
    saveFollowUp,
    saveNote,
    quickSetStage,
    openInboxThread,
  } = useLeadsData({
    requestedLeadId,
    navigate,
  });

  const sel = selectedLead;
  const selExtra = sel?.extra && typeof sel.extra === "object" ? sel.extra : {};
  const score = Number(sel?.score || 0);

  return (
    <div className="premium-page px-6 pb-8 pt-3 md:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="premium-kicker">Revenue Workspace</div>
          <div className="mt-2 text-[32px] font-semibold tracking-[-0.055em] text-slate-950">
            Leads
          </div>
          <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Leads from Inbox, direct messages, and sales follow-up in one workspace.
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="premium-pill">
            WS: {wsState}
          </div>

          {dbDisabled ? (
            <div className="premium-pill border-amber-200 bg-amber-50 text-amber-700">
              DB disabled
            </div>
          ) : null}

          <button
            type="button"
            onClick={loadLeadsData}
            className="ui-button-secondary"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mb-6 border-l-2 border-rose-300 pl-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <LeadStatCard label="Total Leads" value={stats.total} icon={Users} />
        <LeadStatCard label="Open Leads" value={stats.open} icon={CircleDot} tone="cyan" />
        <LeadStatCard label="Won" value={stats.won} icon={Trophy} tone="emerald" />
        <LeadStatCard
          label="Pipeline Value"
          value={formatMoneyAZN(stats.pipelineValue)}
          icon={BadgeDollarSign}
          tone="violet"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="premium-panel p-5">
          <div className="flex flex-col gap-4 border-b premium-divider pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
                Lead Pipeline
              </div>
              <div className="mt-1 text-sm text-slate-500">
                Leads captured from inbox activity and stored for follow-up.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {["all", "new", "contacted", "qualified", "proposal", "won", "lost"].map((stage) => (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(stage)}
                  className={`premium-pill ${
                    stageFilter === stage
                      ? "is-active"
                      : "hover:text-slate-900"
                  }`}
                >
                  {stage}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="hidden xl:grid xl:grid-cols-[1.25fr_0.9fr_1fr_0.8fr_0.8fr_0.7fr] xl:gap-3 xl:px-2 xl:text-[11px] xl:uppercase xl:tracking-[0.18em] xl:text-slate-400">
              <div>Name</div>
              <div>Source</div>
              <div>Interest</div>
              <div>Stage</div>
              <div>Status</div>
              <div className="text-right">Value</div>
            </div>

            {loading ? (
              <div className="premium-empty px-4 py-10 text-center text-sm text-slate-500">
                Loading leads...
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="premium-empty px-4 py-10 text-center">
                <div className="text-sm font-medium text-slate-700">No leads yet</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">
                  Inbox və satış axını bağlandıqca lead-lər burada görünəcək.
                </div>
              </div>
            ) : (
              filteredLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  selected={selectedLead?.id === lead.id}
                  onSelect={setSelectedLead}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="premium-panel p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)]">
                <BriefcaseBusiness className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <div className="text-[16px] font-semibold tracking-[-0.03em] text-slate-950">
                  Lead Detail
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  Seçilmiş lead üçün interaktiv CRM görünüşü.
                </div>
              </div>
            </div>

            <div className="premium-panel-subtle mt-5 p-4">
              {!sel ? (
                <div className="px-2 py-8 text-center">
                  <div className="text-sm font-medium text-slate-700">No lead selected</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">
                    Sol tərəfdən bir lead seç.
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-[18px] font-semibold tracking-[-0.03em] text-slate-950">
                        {leadName(sel)}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">{leadHandle(sel)}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${stageTone(
                          sel.stage
                        )}`}
                      >
                        {sel.stage || "new"}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(
                          sel.status
                        )}`}
                      >
                        {sel.status || "open"}
                      </span>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${priorityTone(
                          sel.priority
                        )}`}
                      >
                        {sel.priority || "normal"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openInboxThread}
                      disabled={!sel?.inbox_thread_id}
                      className="premium-pill disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open Inbox Thread
                    </button>

                    <button
                      type="button"
                      onClick={() => quickSetStage("contacted")}
                      disabled={savingField === "stage"}
                      className="premium-pill"
                    >
                      <CircleDot className="h-3.5 w-3.5" />
                      Mark Contacted
                    </button>

                    <button
                      type="button"
                      onClick={() => quickSetStage("qualified")}
                      disabled={savingField === "stage"}
                      className="premium-pill"
                    >
                      <Target className="h-3.5 w-3.5" />
                      Move to Qualified
                    </button>

                    <button
                      type="button"
                      onClick={() => quickSetStage("won")}
                      disabled={savingField === "stage"}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-3.5 py-2 text-[12px] font-medium text-emerald-100 transition hover:bg-emerald-400/[0.1]"
                    >
                      <Trophy className="h-3.5 w-3.5" />
                      Mark Won
                    </button>

                    <button
                      type="button"
                      onClick={() => quickSetStage("lost")}
                      disabled={savingField === "stage"}
                      className="inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/[0.06] px-3.5 py-2 text-[12px] font-medium text-rose-100 transition hover:bg-rose-400/[0.1]"
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Mark Lost
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <LeadMiniInfo label="Source" value={prettySource(sel)} icon={Link2} />
                    <LeadMiniInfo label="Score" value={String(sel.score ?? 0)} icon={Target} />
                    <LeadMiniInfo label="Interest" value={sel.interest || "—"} icon={FolderKanban} />
                    <LeadMiniInfo
                      label="Pipeline value"
                      value={formatMoneyAZN(pickLeadValue(sel))}
                      icon={BadgeDollarSign}
                    />
                    <LeadMiniInfo label="Company" value={sel.company || "—"} icon={BriefcaseBusiness} />
                    <LeadMiniInfo label="Created" value={fmtDateTime(sel.created_at)} icon={CircleDot} />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <LeadField label="Stage">
                      <div className="flex gap-2">
                        <LeadSelect
                          value={form.stage}
                          onChange={(e) => setForm((prev) => ({ ...prev, stage: e.target.value }))}
                        >
                          <option value="new">new</option>
                          <option value="contacted">contacted</option>
                          <option value="qualified">qualified</option>
                          <option value="proposal">proposal</option>
                          <option value="won">won</option>
                          <option value="lost">lost</option>
                        </LeadSelect>
                        <button
                          type="button"
                          onClick={() => saveStage(form.stage)}
                          disabled={savingField === "stage"}
                          className="premium-panel-subtle inline-flex items-center justify-center px-4 text-slate-700 transition hover:border-slate-300"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      </div>
                    </LeadField>

                    <LeadField label="Status">
                      <div className="flex gap-2">
                        <LeadSelect
                          value={form.status}
                          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                        >
                          <option value="open">open</option>
                          <option value="archived">archived</option>
                          <option value="spam">spam</option>
                          <option value="closed">closed</option>
                        </LeadSelect>
                        <button
                          type="button"
                          onClick={() => saveStatus(form.status)}
                          disabled={savingField === "status"}
                          className="premium-panel-subtle inline-flex items-center justify-center px-4 text-slate-700 transition hover:border-slate-300"
                        >
                          <Save className="h-4 w-4" />
                        </button>
                      </div>
                    </LeadField>

                    <LeadField label="Owner">
                      <div className="flex gap-2">
                        <LeadInput
                          value={form.owner}
                          onChange={(e) => setForm((prev) => ({ ...prev, owner: e.target.value }))}
                          placeholder="Assign owner"
                        />
                        <button
                          type="button"
                          onClick={saveOwner}
                          disabled={savingField === "owner"}
                          className="premium-panel-subtle inline-flex items-center justify-center px-4 text-slate-700 transition hover:border-slate-300"
                        >
                          <UserCog className="h-4 w-4" />
                        </button>
                      </div>
                    </LeadField>

                    <LeadField label="Priority">
                      <LeadSelect
                        value={form.priority}
                        onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))}
                      >
                        <option value="low">low</option>
                        <option value="normal">normal</option>
                        <option value="high">high</option>
                        <option value="urgent">urgent</option>
                      </LeadSelect>
                    </LeadField>

                    <LeadField label="Value (AZN)">
                      <LeadInput
                        type="number"
                        value={form.valueAzn}
                        onChange={(e) => setForm((prev) => ({ ...prev, valueAzn: e.target.value }))}
                        placeholder="0"
                      />
                    </LeadField>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={saveCoreFields}
                        disabled={savingField === "core"}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.08] px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-400/[0.12]"
                      >
                        <Save className="h-4 w-4" />
                        Save CRM Fields
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <LeadField label="Follow-up date">
                      <LeadInput
                        type="datetime-local"
                        value={form.followUpAt}
                        onChange={(e) => setForm((prev) => ({ ...prev, followUpAt: e.target.value }))}
                      />
                    </LeadField>

                    <LeadField label="Next action">
                      <LeadInput
                        value={form.nextAction}
                        onChange={(e) => setForm((prev) => ({ ...prev, nextAction: e.target.value }))}
                        placeholder="Call, send proposal, demo..."
                      />
                    </LeadField>
                  </div>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={saveFollowUp}
                      disabled={savingField === "followup"}
                      className="premium-panel-subtle inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      <CalendarDays className="h-4 w-4" />
                      Save Follow-up
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <LeadMiniInfo label="Phone" value={sel.phone || "—"} icon={UserRound} />
                    <LeadMiniInfo label="Email" value={sel.email || "—"} icon={Mail} />
                    <LeadMiniInfo
                      label="Inbox thread"
                      value={sel.inbox_thread_id || "—"}
                      icon={Link2}
                    />
                    <LeadMiniInfo
                      label="Updated"
                      value={fmtDateTime(sel.updated_at)}
                      icon={RefreshCw}
                    />
                  </div>

                  <div className="premium-panel-subtle mt-4 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      Score band
                    </div>
                    <div className="mt-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${scoreTone(
                          score
                        )}`}
                      >
                        {scoreBand(score)}
                      </span>
                    </div>
                  </div>

                  <div className="premium-panel-subtle mt-4 px-4 py-3">
                    <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      <FileText className="h-3.5 w-3.5" />
                      Add Note
                    </div>
                    <LeadTextArea
                      rows={4}
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Write internal note..."
                    />
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={saveNote}
                        disabled={savingField === "note" || !noteText.trim()}
                        className="premium-panel-subtle inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Save className="h-4 w-4" />
                        Save Note
                      </button>
                    </div>
                  </div>

                  <div className="premium-panel-subtle mt-4 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      Full Notes
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {sel.notes || "—"}
                    </div>
                  </div>

                  {showInternalDebug && selExtra && Object.keys(selExtra).length > 0 ? (
                    <div className="premium-panel-subtle mt-4 p-3">
                      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Internal Payload
                      </div>
                      <pre className="overflow-auto text-xs leading-6 text-slate-600">
                        {JSON.stringify(selExtra, null, 2)}
                      </pre>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="premium-panel p-5">
            <div className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.03em] text-slate-950">
              <Activity className="h-4 w-4 text-slate-500" />
              Activity Timeline
            </div>

            <div className="mt-5 space-y-3">
              {!sel ? (
                <div className="premium-empty px-4 py-8 text-center text-sm text-slate-500">
                  Select a lead to see activity.
                </div>
              ) : eventsLoading ? (
                <div className="premium-empty px-4 py-8 text-center text-sm text-slate-500">
                  Loading activity...
                </div>
              ) : events.length === 0 ? (
                <div className="premium-empty px-4 py-8 text-center text-sm text-slate-500">
                  No events yet.
                </div>
              ) : (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="premium-panel-subtle p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${eventTone(
                            ev.type
                          )}`}
                        >
                          {prettyEventType(ev.type)}
                        </span>
                        <div className="mt-3 text-sm font-medium text-slate-800">
                          {ev.actor || "system"}
                        </div>
                        <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
                          {fmtDateTime(ev.created_at)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        {fmtRelative(ev.created_at)}
                      </div>
                    </div>

                    {showInternalDebug && ev?.payload ? (
                      <pre className="mt-3 overflow-auto rounded-2xl border border-slate-200/80 bg-white/66 p-3 text-xs leading-6 text-slate-600">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="premium-panel p-5">
            <div className="text-[16px] font-semibold tracking-[-0.03em] text-slate-950">
              Source Mix
            </div>

            <div className="mt-5 space-y-4">
              {sourceMix.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="text-slate-600">{item.label}</span>
                    <span className="text-slate-400">{item.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-200/70">
                    <div
                      className="h-2 rounded-full bg-slate-500/70"
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-panel p-5">
            <div className="text-[16px] font-semibold tracking-[-0.03em] text-slate-950">
              Stage Overview
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              {Object.entries(stageMix).map(([stage, count]) => (
                <div
                  key={stage}
                  className="premium-panel-subtle px-4 py-3"
                >
                  <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    {stage}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-slate-950">{count}</div>
                </div>
              ))}
            </div>

            <div className="premium-panel-subtle mt-5 px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                Last refresh
              </div>
              <div className="mt-2 text-sm text-slate-700">
                {fmtRelative(new Date().toISOString())}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
