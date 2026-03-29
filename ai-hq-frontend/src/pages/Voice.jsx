import {
  Activity,
  ArrowRightLeft,
  BadgeCheck,
  Ban,
  Clock3,
  Languages,
  Mic,
  Phone,
  PhoneCall,
  PhoneOff,
  Settings2,
  UserRound,
} from "lucide-react";

import AdminPageShell from "../components/admin/AdminPageShell.jsx";
import { useVoiceSurface } from "./hooks/useVoiceSurface.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function dt(v) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function shortDur(sec) {
  const x = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(x / 60);
  const s2 = x % 60;
  return `${m}:${String(s2).padStart(2, "0")}`;
}

function pickCallId(x) {
  return s(x?.id || x?.callId || x?.call_id || x?.sid);
}

function pickSessionId(x) {
  return s(x?.id || x?.sessionId || x?.session_id);
}

function pickSessionCallId(x) {
  return s(x?.callId || x?.call_id || x?.voiceCallId || x?.voice_call_id);
}

function pickStatus(x) {
  return s(x?.status || x?.callStatus || x?.call_status || "unknown").toLowerCase();
}

function pickDirection(x) {
  return s(x?.direction || "inbound").toLowerCase();
}

function pickFrom(x) {
  return s(x?.from || x?.fromNumber || x?.caller || x?.phone || "Unknown");
}

function pickLang(x) {
  return s(x?.language || x?.lang || x?.detectedLanguage || "—");
}

function pickDuration(x) {
  return n(x?.durationSec ?? x?.duration_sec ?? x?.duration ?? 0, 0);
}

function pickStartedAt(x) {
  return x?.startedAt || x?.started_at || x?.createdAt || x?.created_at || null;
}

function pickEndedAt(x) {
  return x?.endedAt || x?.ended_at || null;
}

function pickOperatorName(x) {
  return s(x?.operatorName || x?.operator_name || x?.operatorLabel || "—");
}

function statCard(icon, label, value, hint) {
  const Icon = icon;
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_10px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2">
          <Icon className="h-4 w-4 text-white/80" />
        </div>
        <div className="text-xs uppercase tracking-[0.24em] text-white/45">{label}</div>
      </div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/45">{hint}</div>
    </div>
  );
}

function StatusPill({ status }) {
  const x = s(status || "unknown").toLowerCase();
  const live = ["live", "active", "in_progress", "ongoing", "ringing", "queued", "bridged"].includes(x);

  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
        live
          ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
          : "border border-white/10 bg-white/5 text-white/70",
      ].join(" ")}
    >
      <span
        className={[
          "h-2 w-2 rounded-full",
          live ? "bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.9)]" : "bg-white/30",
        ].join(" ")}
      />
      {x || "unknown"}
    </div>
  );
}

function CallRow({ item, active, onClick }) {
  const id = pickCallId(item);
  const status = pickStatus(item);
  const from = pickFrom(item);
  const lang = pickLang(item);
  const startedAt = pickStartedAt(item);
  const duration = pickDuration(item);

  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      className={[
        "w-full rounded-3xl border p-4 text-left transition",
        active
          ? "border-cyan-400/40 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]"
          : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{from}</div>
          <div className="mt-1 text-xs text-white/45">{id || "No call id"}</div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-white/60">
        <div>
          <div className="text-white/35">Direction</div>
          <div className="mt-1 text-white/80">{pickDirection(item)}</div>
        </div>
        <div>
          <div className="text-white/35">Language</div>
          <div className="mt-1 text-white/80">{lang}</div>
        </div>
        <div>
          <div className="text-white/35">Duration</div>
          <div className="mt-1 text-white/80">{shortDur(duration)}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-white/40">{dt(startedAt)}</div>
    </button>
  );
}

function EventRow({ item }) {
  const type = s(item?.type || item?.event || item?.name || "event");
  const text = s(item?.text || item?.message || item?.content || item?.summary || item?.detail || item?.payload?.text || "");
  const at = item?.createdAt || item?.created_at || item?.timestamp || item?.time || null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">{type}</div>
        <div className="text-[11px] text-white/40">{dt(at)}</div>
      </div>
      <div className="mt-2 text-sm text-white/65">{text || "—"}</div>
    </div>
  );
}

function SessionRow({ item }) {
  const role = s(item?.role || item?.participantRole || item?.kind || "session");
  const joined = item?.joinedAt || item?.joined_at || item?.createdAt || item?.created_at;
  const left = item?.leftAt || item?.left_at || null;
  const label = s(item?.label || item?.participantName || item?.identity || item?.userId || role);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-white">{label}</div>
          <div className="mt-1 text-xs text-white/45">{role}</div>
        </div>
        <BadgeCheck className="h-4 w-4 text-white/45" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-white/35">Joined</div>
          <div className="mt-1 text-white/75">{dt(joined)}</div>
        </div>
        <div>
          <div className="text-white/35">Left</div>
          <div className="mt-1 text-white/75">{dt(left)}</div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">{label}</div>
      <div className="mt-2 text-sm text-white/80">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
      <span>{label}</span>
      <span className="truncate text-white/90">{value}</span>
    </div>
  );
}

function ControlButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  pending = false,
  tone = "neutral",
}) {
  const toneClass =
    tone === "danger"
      ? "border-rose-400/20 bg-rose-400/12 text-rose-100 hover:bg-rose-400/18"
      : tone === "accent"
        ? "border-cyan-400/20 bg-cyan-400/15 text-cyan-100 hover:bg-cyan-400/20"
        : "border-white/10 bg-white/[0.05] text-white/82 hover:bg-white/[0.08]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || pending}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${toneClass}`}
    >
      <Icon className="h-4 w-4" />
      {pending ? `${label}...` : label}
    </button>
  );
}

export default function Voice() {
  const {
    overviewData,
    calls,
    liveSessions,
    liveCount,
    totalCount,
    totalMinutes,
    selectedId,
    setSelectedId,
    selectedCall,
    selectedLiveSession,
    selectedStatus,
    selectedLive,
    selectedLiveSessionStatus,
    events,
    sessions,
    surface,
    detailSurface,
    actionState,
    joinSelectedCall,
    requestSelectedLiveHandoff,
    takeoverSelectedLiveSession,
    endSelectedLiveSession,
    canControlSelectedLiveSession,
    canRequestHandoff,
    canTakeover,
    canEnd,
  } = useVoiceSurface();

  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
        <AdminPageShell
          eyebrow="Voice ops"
          title="Voice Center"
          description="Active calls, live events, session timeline, and operator live controls."
          surface={surface}
          refreshLabel="Refresh voice surface"
          unavailableMessage="Voice operations are temporarily unavailable."
          actions={
            <button
              type="button"
              disabled={!selectedId || surface.saving || !selectedLive}
              onClick={joinSelectedCall}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PhoneCall className="h-4 w-4" />
              {actionState.isActionPending("join") ? "Joining..." : "Join call"}
            </button>
          }
        >
          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCard(Activity, "Live calls", surface.loading ? "..." : String(overviewData?.liveCalls ?? liveCount), "Currently active calls")}
            {statCard(Phone, "Total calls", surface.loading ? "..." : String(overviewData?.totalCalls ?? totalCount), "Latest loaded call list")}
            {statCard(Clock3, "Talk minutes", surface.loading ? "..." : String(overviewData?.totalMinutes ?? totalMinutes), "Total tracked duration")}
            {statCard(Languages, "Default language", s(overviewData?.defaultLanguage || overviewData?.language || "—"), "Tenant voice overview")}
          </div>

          <section className="mb-6 rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-white">Live session controls</div>
                <div className="mt-1 text-sm text-white/45">
                  Canonical live-session state and operator interventions.
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/50">
                {surface.loading ? "Loading..." : `${liveSessions.length} live session${liveSessions.length === 1 ? "" : "s"}`}
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-3 md:grid-cols-2">
                <InfoTile label="Selected live session" value={pickSessionId(selectedLiveSession) || "No live session selected"} />
                <InfoTile label="Live session state" value={selectedLiveSessionStatus || "—"} />
                <InfoTile label="Operator" value={pickOperatorName(selectedLiveSession)} />
                <InfoTile label="Call link" value={pickSessionCallId(selectedLiveSession) || selectedId || "—"} />
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-4">
                {surface.saveError ? (
                  <div className="mb-3 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-3 py-3 text-sm text-rose-100">
                    {surface.saveError}
                  </div>
                ) : null}
                {surface.saveSuccess ? (
                  <div className="mb-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 text-sm text-emerald-100">
                    {surface.saveSuccess}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-3">
                  <ControlButton
                    icon={ArrowRightLeft}
                    label="Request handoff"
                    onClick={requestSelectedLiveHandoff}
                    disabled={!canRequestHandoff}
                    pending={actionState.isActionPending("handoff")}
                  />
                  <ControlButton
                    icon={PhoneCall}
                    label="Takeover"
                    onClick={takeoverSelectedLiveSession}
                    disabled={!canTakeover}
                    pending={actionState.isActionPending("takeover")}
                    tone="accent"
                  />
                  <ControlButton
                    icon={Ban}
                    label="End"
                    onClick={endSelectedLiveSession}
                    disabled={!canEnd}
                    pending={actionState.isActionPending("end")}
                    tone="danger"
                  />
                </div>

                {!canControlSelectedLiveSession ? (
                  <div className="mt-3 text-xs text-white/42">
                    No canonical live session is selected for the current call, so live controls are unavailable.
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-white/42">
                    Voice live-session state refreshes automatically while active sessions exist.
                  </div>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-white">Call list</div>
                  <div className="text-sm text-white/45">Active and recent calls</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
                  {surface.loading ? "Loading..." : `${calls.length} items`}
                </div>
              </div>

              <div className="space-y-3">
                {surface.loading ? (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">Loading calls...</div>
                ) : calls.length ? (
                  calls.map((item, i) => {
                    const id = pickCallId(item);
                    const key = id || `call-${i}`;
                    return <CallRow key={key} item={item} active={id === selectedId} onClick={() => setSelectedId(id)} />;
                  })
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                    <PhoneOff className="mx-auto h-8 w-8 text-white/25" />
                    <div className="mt-3 text-sm text-white/65">No calls found.</div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
              {!detailSurface.unavailable && detailSurface.error ? (
                <div className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                  {detailSurface.error}
                </div>
              ) : null}

              <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={selectedStatus} />
                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
                      {pickDirection(selectedCall)}
                    </div>
                  </div>

                  <div className="truncate text-2xl font-semibold text-white">{pickFrom(selectedCall) || "No selected call"}</div>
                  <div className="mt-2 text-sm text-white/45">{selectedId || "No call selected"}</div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                  <InfoTile label="Started" value={dt(pickStartedAt(selectedCall))} />
                  <InfoTile label="Ended" value={dt(pickEndedAt(selectedCall))} />
                  <InfoTile label="Language" value={pickLang(selectedCall)} />
                  <InfoTile label="Duration" value={shortDur(pickDuration(selectedCall))} />
                </div>
              </div>

              <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
                <div className="min-w-0">
                  <div className="mb-3 flex items-center gap-2">
                    <Mic className="h-4 w-4 text-white/55" />
                    <div className="text-sm font-medium text-white">Live transcript / events</div>
                  </div>

                  <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
                    {detailSurface.loading ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                        Loading call detail...
                      </div>
                    ) : events.length ? (
                      events.map((item, i) => <EventRow key={s(item?.id || item?.event || item?.name || `event-${i}`)} item={item} />)
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
                        No call events recorded.
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-3 flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-white/55" />
                    <div className="text-sm font-medium text-white">Sessions</div>
                  </div>

                  <div className="space-y-3">
                    {detailSurface.loading ? (
                      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                        Loading sessions...
                      </div>
                    ) : sessions.length ? (
                      sessions.map((item, i) => <SessionRow key={pickSessionId(item) || `session-${i}`} item={item} />)
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
                        No sessions recorded.
                      </div>
                    )}
                  </div>

                  <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Settings2 className="h-4 w-4 text-cyan-200" />
                      <div className="text-sm font-medium text-white">Join panel</div>
                    </div>

                    <div className="space-y-3 text-sm text-white/65">
                      <InfoRow label="Selected call" value={selectedId || "—"} />
                      <InfoRow label="Call state" value={selectedStatus || "—"} />
                      <InfoRow label="Session" value={pickSessionId(sessions?.[0]) || "—"} />

                      <button
                        type="button"
                        disabled={!selectedId || surface.saving || !selectedLive}
                        onClick={joinSelectedCall}
                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <PhoneCall className="h-4 w-4" />
                        {actionState.isActionPending("join") ? "Joining..." : "Join selected call"}
                      </button>

                      {!selectedLive ? (
                        <div className="text-xs text-white/40">Join is only enabled for live or in-progress calls.</div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </AdminPageShell>
      </div>
    </div>
  );
}
