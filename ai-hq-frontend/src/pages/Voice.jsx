import { useEffect, useMemo, useState } from "react";
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Waves,
  Mic,
  Settings2,
  RefreshCw,
  Clock3,
  Languages,
  Activity,
  UserRound,
  BadgeCheck,
} from "lucide-react";

import {
  getVoiceOverview,
  listVoiceCalls,
  getVoiceCall,
  listVoiceCallEvents,
  listVoiceCallSessions,
  joinVoiceCall,
} from "../api/voice.js";

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

function pickOverviewData(x) {
  if (!x || typeof x !== "object") return {};
  if (x?.overview && typeof x.overview === "object") return x.overview;
  return x;
}

function isLiveStatus(status) {
  return ["live", "active", "in_progress", "ongoing", "ringing", "queued", "bridged"].includes(
    String(status || "").toLowerCase()
  );
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
  const live = isLiveStatus(x);

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

export default function Voice() {
  const [overview, setOverview] = useState(null);
  const [calls, setCalls] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedCall, setSelectedCall] = useState(null);
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function loadBase(preferredId = "") {
    setLoading(true);
    setError("");

    try {
      const [ov, rows] = await Promise.all([
        getVoiceOverview().catch(() => null),
        listVoiceCalls({ limit: 50 }).catch(() => []),
      ]);

      const safeRows = Array.isArray(rows) ? rows : [];

      setOverview(ov || null);
      setCalls(safeRows);

      const firstId = preferredId || pickCallId(safeRows[0]);
      if (firstId) {
        setSelectedId(firstId);
      } else {
        setSelectedId("");
        setSelectedCall(null);
        setEvents([]);
        setSessions([]);
      }
    } catch (e) {
      setError(s(e?.message || "Voice data yüklənmədi"));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(callId) {
    if (!callId) return;

    setDetailLoading(true);
    setError("");

    try {
      const [callRes, evs, ses] = await Promise.all([
        getVoiceCall(callId).catch(() => null),
        listVoiceCallEvents(callId, { limit: 100 }).catch(() => []),
        listVoiceCallSessions(callId, { limit: 50 }).catch(() => []),
      ]);

      const resolvedCall =
        callRes?.call && typeof callRes.call === "object"
          ? callRes.call
          : callRes && typeof callRes === "object"
            ? callRes
            : null;

      setSelectedCall(resolvedCall);
      setEvents(Array.isArray(evs) ? evs : []);
      setSessions(Array.isArray(ses) ? ses : []);
    } catch (e) {
      setError(s(e?.message || "Call detail yüklənmədi"));
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadDetail(selectedId);
  }, [selectedId]);

  const overviewData = useMemo(() => pickOverviewData(overview), [overview]);

  const selectedStatus = useMemo(() => pickStatus(selectedCall), [selectedCall]);
  const selectedLive = useMemo(() => isLiveStatus(selectedStatus), [selectedStatus]);

  const liveCount = useMemo(() => {
    return calls.filter((x) => isLiveStatus(pickStatus(x))).length;
  }, [calls]);

  const totalCount = useMemo(() => calls.length, [calls]);

  const totalMinutes = useMemo(() => {
    const sec = calls.reduce((sum, x) => sum + pickDuration(x), 0);
    return Math.floor(sec / 60);
  }, [calls]);

  async function handleRefresh() {
    await loadBase(selectedId);
    if (selectedId) {
      await loadDetail(selectedId);
    }
  }

  async function handleJoin() {
    if (!selectedId) return;

    const sessionId = pickSessionId(sessions?.[0]);
    if (!sessionId) {
      setError("Join üçün session tapılmadı");
      return;
    }

    setJoining(true);
    setError("");

    try {
      await joinVoiceCall(selectedId, {
        sessionId,
        joinMode: "live",
      });
      await loadDetail(selectedId);
      await loadBase(selectedId);
    } catch (e) {
      setError(s(e?.message || "Join alınmadı"));
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-cyan-200">
              <Waves className="h-3.5 w-3.5" />
              Voice Ops
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Voice Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-white/58">
              Active calls, live events, session timeline və operator join axını burada görünəcək.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 transition hover:bg-white/10"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>

            <button
              type="button"
              disabled={!selectedId || joining || !selectedLive}
              onClick={handleJoin}
              className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <PhoneCall className="h-4 w-4" />
              {joining ? "Joining..." : "Join call"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCard(
            Activity,
            "Live calls",
            loading ? "..." : String(overviewData?.liveCalls ?? liveCount),
            "Hazırda aktiv zənglər"
          )}
          {statCard(
            Phone,
            "Total calls",
            loading ? "..." : String(overviewData?.totalCalls ?? totalCount),
            "Son yüklənmiş siyahı"
          )}
          {statCard(
            Clock3,
            "Talk minutes",
            loading ? "..." : String(overviewData?.totalMinutes ?? totalMinutes),
            "Toplam duration"
          )}
          {statCard(
            Languages,
            "Default language",
            s(overviewData?.defaultLanguage || overviewData?.language || "—"),
            "Tenant voice overview"
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">Call list</div>
                <div className="text-sm text-white/45">Active və recent calls</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/50">
                {loading ? "Loading..." : `${calls.length} items`}
              </div>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                  Yüklənir...
                </div>
              ) : calls.length ? (
                calls.map((item, i) => {
                  const id = pickCallId(item);
                  const key = id || `call-${i}`;
                  return (
                    <CallRow
                      key={key}
                      item={item}
                      active={id === selectedId}
                      onClick={() => setSelectedId(id)}
                    />
                  );
                })
              ) : (
                <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
                  <PhoneOff className="mx-auto h-8 w-8 text-white/25" />
                  <div className="mt-3 text-sm text-white/65">Call tapılmadı</div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <StatusPill status={selectedStatus} />
                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/55">
                    {pickDirection(selectedCall)}
                  </div>
                </div>

                <div className="truncate text-2xl font-semibold text-white">
                  {pickFrom(selectedCall) || "No selected call"}
                </div>

                <div className="mt-2 text-sm text-white/45">{selectedId || "Call ID yoxdur"}</div>
              </div>

              <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Started</div>
                  <div className="mt-2 text-sm text-white/80">{dt(pickStartedAt(selectedCall))}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Ended</div>
                  <div className="mt-2 text-sm text-white/80">{dt(pickEndedAt(selectedCall))}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Language</div>
                  <div className="mt-2 text-sm text-white/80">{pickLang(selectedCall)}</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/35">Duration</div>
                  <div className="mt-2 text-sm text-white/80">{shortDur(pickDuration(selectedCall))}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <Mic className="h-4 w-4 text-white/55" />
                  <div className="text-sm font-medium text-white">Live transcript / events</div>
                </div>

                <div className="max-h-[620px] space-y-3 overflow-auto pr-1">
                  {detailLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                      Detail yüklənir...
                    </div>
                  ) : events.length ? (
                    events.map((item, i) => (
                      <EventRow key={s(item?.id || item?.event || item?.name || `event-${i}`)} item={item} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
                      Event yoxdur.
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
                  {detailLoading ? (
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                      Sessions yüklənir...
                    </div>
                  ) : sessions.length ? (
                    sessions.map((item, i) => (
                      <SessionRow key={pickSessionId(item) || `session-${i}`} item={item} />
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-white/50">
                      Session yoxdur.
                    </div>
                  )}
                </div>

                <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,211,238,0.08),rgba(255,255,255,0.02))] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-cyan-200" />
                    <div className="text-sm font-medium text-white">Join panel</div>
                  </div>

                  <div className="space-y-3 text-sm text-white/65">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <span>Selected call</span>
                      <span className="truncate text-white/90">{selectedId || "—"}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <span>Call state</span>
                      <span className="text-white/90">{selectedStatus || "—"}</span>
                    </div>

                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
                      <span>Session</span>
                      <span className="truncate text-white/90">{pickSessionId(sessions?.[0]) || "—"}</span>
                    </div>

                    <button
                      type="button"
                      disabled={!selectedId || joining || !selectedLive}
                      onClick={handleJoin}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/15 px-4 py-3 text-sm text-cyan-100 transition hover:bg-cyan-400/20 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <PhoneCall className="h-4 w-4" />
                      {joining ? "Joining..." : "Join selected call"}
                    </button>

                    {!selectedLive ? (
                      <div className="text-xs text-white/40">
                        Join yalnız live/in_progress call üçün aktiv olacaq.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}