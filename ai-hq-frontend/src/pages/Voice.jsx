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
import { MetricCard, Surface } from "../components/ui/AppShellPrimitives.jsx";
import { useVoiceSurface } from "./hooks/useVoiceSurface.js";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function n(v, d = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

function dt(v) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
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
  return s(x?.language || x?.lang || x?.detectedLanguage || "-");
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
  return s(x?.operatorName || x?.operator_name || x?.operatorLabel || "-");
}

function StatusPill({ status }) {
  const x = s(status || "unknown").toLowerCase();
  const live = ["live", "active", "in_progress", "ongoing", "ringing", "queued", "bridged"].includes(x);

  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        live
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-line bg-surface text-text-muted",
      ].join(" ")}
    >
      <span className={["h-2 w-2 rounded-full", live ? "bg-emerald-500" : "bg-text-subtle"].join(" ")} />
      {x || "unknown"}
    </div>
  );
}

function CallRow({ item, active, onClick }) {
  const id = pickCallId(item);
  const status = pickStatus(item);

  return (
    <button
      type="button"
      onClick={() => onClick?.(item)}
      className={[
        "w-full rounded-[22px] border p-4 text-left transition",
        active
          ? "border-brand/15 bg-brand-soft"
          : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{pickFrom(item)}</div>
          <div className="mt-1 text-xs text-text-subtle">{id || "No call id"}</div>
        </div>
        <StatusPill status={status} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-xs text-text-muted">
        <div>
          <div className="text-text-subtle">Direction</div>
          <div className="mt-1 text-text">{pickDirection(item)}</div>
        </div>
        <div>
          <div className="text-text-subtle">Language</div>
          <div className="mt-1 text-text">{pickLang(item)}</div>
        </div>
        <div>
          <div className="text-text-subtle">Duration</div>
          <div className="mt-1 text-text">{shortDur(pickDuration(item))}</div>
        </div>
      </div>

      <div className="mt-3 text-xs text-text-subtle">{dt(pickStartedAt(item))}</div>
    </button>
  );
}

function EventRow({ item }) {
  const type = s(item?.type || item?.event || item?.name || "event");
  const text = s(
    item?.text ||
      item?.message ||
      item?.content ||
      item?.summary ||
      item?.detail ||
      item?.payload?.text ||
      ""
  );
  const at = item?.createdAt || item?.created_at || item?.timestamp || item?.time || null;

  return (
    <div className="rounded-[18px] border border-line bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-text">{type}</div>
        <div className="text-[11px] text-text-subtle">{dt(at)}</div>
      </div>
      <div className="mt-2 text-sm text-text-muted">{text || "-"}</div>
    </div>
  );
}

function SessionRow({ item }) {
  const role = s(item?.role || item?.participantRole || item?.kind || "session");
  const joined = item?.joinedAt || item?.joined_at || item?.createdAt || item?.created_at;
  const left = item?.leftAt || item?.left_at || null;
  const label = s(item?.label || item?.participantName || item?.identity || item?.userId || role);

  return (
    <div className="rounded-[18px] border border-line bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-text">{label}</div>
          <div className="mt-1 text-xs text-text-subtle">{role}</div>
        </div>
        <BadgeCheck className="h-4 w-4 text-text-subtle" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <div className="text-text-subtle">Joined</div>
          <div className="mt-1 text-text">{dt(joined)}</div>
        </div>
        <div>
          <div className="text-text-subtle">Left</div>
          <div className="mt-1 text-text">{dt(left)}</div>
        </div>
      </div>
    </div>
  );
}

function InfoTile({ label, value }) {
  return (
    <div className="rounded-[18px] border border-line bg-surface-muted p-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-text-subtle">{label}</div>
      <div className="mt-2 text-sm text-text">{value}</div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-line bg-surface-muted px-3 py-3 text-sm">
      <span className="text-text-muted">{label}</span>
      <span className="truncate text-text">{value}</span>
    </div>
  );
}

function ControlButton({ icon: Icon, label, onClick, disabled = false, pending = false, tone = "neutral" }) {
  const toneClass =
    tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300"
      : tone === "accent"
        ? "border-brand/15 bg-brand-soft text-brand hover:border-brand/25"
        : "border-line bg-surface text-text hover:border-line-strong";

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
    <AdminPageShell
      eyebrow="Voice"
      title="Voice center"
      description="Active calls, live events, session timeline, and live intervention controls."
      surface={surface}
      refreshLabel="Refresh voice surface"
      unavailableMessage="Voice operations are temporarily unavailable."
      actions={
        <button
          type="button"
          disabled={!selectedId || surface.saving || !selectedLive}
          onClick={joinSelectedCall}
          className="inline-flex items-center gap-2 rounded-2xl border border-brand/15 bg-brand-soft px-4 py-3 text-sm text-brand transition hover:border-brand/25 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <PhoneCall className="h-4 w-4" />
          {actionState.isActionPending("join") ? "Joining..." : "Join call"}
        </button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Live calls" value={surface.loading ? "..." : String(overviewData?.liveCalls ?? liveCount)} hint="Currently active calls" tone="brand" />
        <MetricCard label="Total calls" value={surface.loading ? "..." : String(overviewData?.totalCalls ?? totalCount)} hint="Latest loaded call list" />
        <MetricCard label="Talk minutes" value={surface.loading ? "..." : String(overviewData?.totalMinutes ?? totalMinutes)} hint="Total tracked duration" />
        <MetricCard label="Default language" value={s(overviewData?.defaultLanguage || overviewData?.language || "-")} hint="Tenant voice overview" />
      </div>

      <Surface className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-lg font-semibold text-text">Live session controls</div>
            <div className="mt-1 text-sm text-text-muted">
              Live session state and intervention controls.
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface px-3 py-2 text-xs text-text-muted">
            {surface.loading ? "Loading..." : `${liveSessions.length} live session${liveSessions.length === 1 ? "" : "s"}`}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="grid gap-3 md:grid-cols-2">
            <InfoTile label="Selected live session" value={pickSessionId(selectedLiveSession) || "No live session selected"} />
            <InfoTile label="Live session state" value={selectedLiveSessionStatus || "-"} />
            <InfoTile label="Operator" value={pickOperatorName(selectedLiveSession)} />
            <InfoTile label="Call link" value={pickSessionCallId(selectedLiveSession) || selectedId || "-"} />
          </div>

          <Surface className="space-y-3 border-brand/15 bg-brand-soft">
            {surface.saveError ? (
              <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-700">
                {surface.saveError}
              </div>
            ) : null}
            {surface.saveSuccess ? (
              <div className="rounded-[18px] border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
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

            <div className="text-xs text-text-muted">
              {!canControlSelectedLiveSession
                ? "No live session is selected for this call, so live controls are unavailable."
                : "Live session state refreshes automatically while active sessions exist."}
            </div>
          </Surface>
        </div>
      </Surface>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Surface className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-text">Call list</div>
              <div className="text-sm text-text-muted">Active and recent calls</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface px-3 py-2 text-xs text-text-muted">
              {surface.loading ? "Loading..." : `${calls.length} items`}
            </div>
          </div>

          <div className="space-y-3">
            {surface.loading ? (
              <div className="rounded-[22px] border border-line bg-surface-muted px-4 py-5 text-sm text-text-muted">Loading calls...</div>
            ) : calls.length ? (
              calls.map((item, i) => {
                const id = pickCallId(item);
                const key = id || `call-${i}`;
                return <CallRow key={key} item={item} active={id === selectedId} onClick={() => setSelectedId(id)} />;
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-line bg-surface-muted px-4 py-6">
                <PhoneOff className="h-8 w-8 text-text-subtle" />
                <div className="mt-3 text-sm text-text-muted">No calls found.</div>
              </div>
            )}
          </div>
        </Surface>

        <Surface className="space-y-5">
          {!detailSurface.unavailable && detailSurface.error ? (
            <div className="rounded-[20px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {detailSurface.error}
            </div>
          ) : null}

          <div className="flex flex-col gap-4 border-b border-line-soft pb-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <StatusPill status={selectedStatus} />
                <div className="rounded-full border border-line bg-surface px-3 py-1 text-xs text-text-muted">
                  {pickDirection(selectedCall)}
                </div>
              </div>

              <div className="truncate text-2xl font-semibold text-text">{pickFrom(selectedCall) || "No selected call"}</div>
              <div className="mt-2 text-sm text-text-muted">{selectedId || "No call selected"}</div>
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
                <Mic className="h-4 w-4 text-text-subtle" />
                <div className="text-sm font-medium text-text">Live transcript and events</div>
              </div>

              <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
                {detailSurface.loading ? (
                  <div className="rounded-[22px] border border-line bg-surface-muted px-4 py-5 text-sm text-text-muted">
                    Loading call detail...
                  </div>
                ) : events.length ? (
                  events.map((item, i) => <EventRow key={s(item?.id || item?.event || item?.name || `event-${i}`)} item={item} />)
                ) : (
                  <div className="rounded-[22px] border border-dashed border-line bg-surface-muted px-4 py-5 text-sm text-text-muted">
                    No call events recorded.
                  </div>
                )}
              </div>
            </div>

            <div className="min-w-0 space-y-6">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-text-subtle" />
                  <div className="text-sm font-medium text-text">Sessions</div>
                </div>

                <div className="space-y-3">
                  {detailSurface.loading ? (
                    <div className="rounded-[22px] border border-line bg-surface-muted px-4 py-5 text-sm text-text-muted">
                      Loading sessions...
                    </div>
                  ) : sessions.length ? (
                    sessions.map((item, i) => <SessionRow key={pickSessionId(item) || `session-${i}`} item={item} />)
                  ) : (
                    <div className="rounded-[22px] border border-dashed border-line bg-surface-muted px-4 py-5 text-sm text-text-muted">
                      No sessions recorded.
                    </div>
                  )}
                </div>
              </div>

              <Surface className="space-y-3 border-brand/15 bg-brand-soft">
                <div className="mb-1 flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-brand" />
                  <div className="text-sm font-medium text-text">Join call</div>
                </div>

                <div className="space-y-3 text-sm text-text-muted">
                  <InfoRow label="Selected call" value={selectedId || "-"} />
                  <InfoRow label="Call state" value={selectedStatus || "-"} />
                  <InfoRow label="Session" value={pickSessionId(sessions?.[0]) || "-"} />

                  <button
                    type="button"
                    disabled={!selectedId || surface.saving || !selectedLive}
                    onClick={joinSelectedCall}
                    className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-brand bg-brand px-4 py-3 text-sm text-white transition hover:border-brand-strong hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <PhoneCall className="h-4 w-4" />
                    {actionState.isActionPending("join") ? "Joining..." : "Join selected call"}
                  </button>

                  {!selectedLive ? (
                    <div className="text-xs text-text-muted">Join is only enabled for live or in-progress calls.</div>
                  ) : null}
                </div>
              </Surface>
            </div>
          </div>
        </Surface>
      </div>
    </AdminPageShell>
  );
}
