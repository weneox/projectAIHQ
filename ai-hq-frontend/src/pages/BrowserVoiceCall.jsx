import { useCallback, useEffect, useState } from "react";
import { Mic, PhoneOff, Radio, RefreshCw, SatelliteDish, Square, Volume2 } from "lucide-react";

import useBrowserVoiceCall from "./hooks/useBrowserVoiceCall.js";
import usePioneroLiveKitRoom from "./hooks/usePioneroLiveKitRoom.js";
import { getVoiceSpeechGatewayReadiness } from "../api/voice.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function readProviderLabel(runtimeMeta = {}) {
  const provider = s(
    runtimeMeta?.provider ||
      runtimeMeta?.activeVoiceChannel?.provider ||
      runtimeMeta?.match?.provider
  ).toLowerCase();

  if (
    provider === "browser" ||
    provider === "browser_lab" ||
    provider === "browserlab" ||
    provider === "browser_adapter" ||
    provider === "pre_sip_browser"
  ) {
    return "OpenAI Realtime";
  }

  return "OpenAI Realtime";
}

function readEventText(event = {}) {
  return s(
    event.text ||
      event.message ||
      event.transcript ||
      event.delta ||
      event.type
  );
}

function readPioneroLiveKitStatusLabel(status = "") {
  const normalizedStatus = s(status, "idle");

  if (normalizedStatus === "live") return "Live";
  if (normalizedStatus === "creating") return "Creating session";
  if (normalizedStatus === "connecting") return "Connecting";
  if (normalizedStatus === "publishing_microphone") return "Publishing mic";
  if (normalizedStatus === "stopping") return "Ending";
  if (normalizedStatus === "error") return "Unavailable";

  return "Idle";
}

export default function BrowserVoiceCall() {
  const {
    status,
    error,
    voice,
    runtimeMeta,
    events = [],
    remoteAudioRef,
    speechBridge,
    startCall,
    stopCall,
  } = useBrowserVoiceCall();
  const {
    status: pioneroLiveKitStatus,
    error: pioneroLiveKitError,
    roomName: pioneroLiveKitRoomName,
    identity: pioneroLiveKitIdentity,
    participants: pioneroLiveKitParticipants = [],
    connect: connectPioneroLiveKit,
    disconnect: disconnectPioneroLiveKit,
    localMicEnabled: pioneroLiveKitLocalMicEnabled,
    agentStatus: pioneroLiveKitAgentStatus,
    agentReasonCode: pioneroLiveKitAgentReasonCode,
    agentNetworkIo: pioneroLiveKitAgentNetworkIo,
    agentReady: pioneroLiveKitAgentReady,
    agentAudioIngestStatus: pioneroLiveKitAgentAudioIngestStatus,
    agentAudioFramesObserved: pioneroLiveKitAgentAudioFramesObserved,
    agentAudioBytesObserved: pioneroLiveKitAgentAudioBytesObserved,
    agentAudioLastObservedAt: pioneroLiveKitAgentAudioLastObservedAt,
    agentAudioReasonCode: pioneroLiveKitAgentAudioReasonCode,
  } = usePioneroLiveKitRoom();

  const [speechBridgeDraftText, setSpeechBridgeDraftText] = useState("");
  const [speechReadiness, setSpeechReadiness] = useState(null);
  const [speechReadinessStatus, setSpeechReadinessStatus] = useState("idle");
  const [speechReadinessError, setSpeechReadinessError] = useState("");

  const isLive = status === "live";
  const isBusy = !["idle", "live"].includes(status);
  const providerLabel = readProviderLabel(runtimeMeta);
  const runtimeLabel = runtimeMeta?.runtimeApplied
    ? "Tenant runtime active"
    : "Fallback runtime";

  const visibleEvents = Array.isArray(events)
    ? events.slice(-8).reverse()
    : [];

  const speechBridgeAvailable = speechBridge?.available === true;
  const speechBridgeRecording = speechBridge?.recording === true;
  const speechBridgeText = speechBridgeDraftText || s(speechBridge?.text);
  const speechBridgeStatus = s(speechBridge?.status, "idle");
  const speechBridgePlaybackStatus = s(speechBridge?.playbackStatus, "idle");
  const speechBridgeError = s(speechBridge?.error);
  const sonioxReadiness = speechReadiness?.soniox || {};
  const gatewayReadiness = speechReadiness?.gateway || {};
  const sonioxConfigured = sonioxReadiness.configured === true;
  const sonioxSttReady = sonioxReadiness?.stt?.ok === true;
  const sonioxTtsReady = sonioxReadiness?.tts?.ok === true;
  const speechReadinessLoading = speechReadinessStatus === "loading";
  const speechReadinessLabel = speechReadinessLoading
    ? "Checking"
    : sonioxConfigured
      ? "Configured"
      : speechReadinessStatus === "error"
        ? "Unavailable"
        : "Not configured";
  const speechReadinessReason = s(
    speechReadinessError ||
      sonioxReadiness.reasonCode ||
      gatewayReadiness?.readiness?.reasonCode ||
      speechReadiness?.runtimeReasonCode,
    "readiness_not_checked"
  );
  const pioneroLiveKitLive = pioneroLiveKitStatus === "live";
  const pioneroLiveKitLoading = [
    "creating",
    "connecting",
    "publishing_microphone",
    "stopping",
  ].includes(pioneroLiveKitStatus);
  const pioneroLiveKitLabel = readPioneroLiveKitStatusLabel(pioneroLiveKitStatus);
  const pioneroLiveKitParticipantCount = Array.isArray(pioneroLiveKitParticipants)
    ? pioneroLiveKitParticipants.length
    : 0;
  const pioneroLiveKitMicLabel = pioneroLiveKitLocalMicEnabled
    ? "published"
    : "idle";
  const pioneroLiveKitAgentStatusLabel = s(pioneroLiveKitAgentStatus, "idle");
  const pioneroLiveKitAgentReadyLabel = pioneroLiveKitAgentReady
    ? "ready"
    : "not ready";
  const pioneroLiveKitAgentNetworkIoLabel = pioneroLiveKitAgentNetworkIo
    ? "yes"
    : "no";
  const pioneroLiveKitAgentAudioIngestStatusLabel = s(
    pioneroLiveKitAgentAudioIngestStatus,
    "idle"
  );
  const pioneroLiveKitAgentAudioLastObservedLabel = s(
    pioneroLiveKitAgentAudioLastObservedAt,
    "not observed"
  );

  const refreshSpeechReadiness = useCallback(async () => {
    setSpeechReadinessStatus("loading");
    setSpeechReadinessError("");

    try {
      const result = await getVoiceSpeechGatewayReadiness({
        language: "az",
        provider: "browser",
        sttProvider: "soniox",
        toNumber: "browser",
        ttsProvider: "soniox",
      });

      setSpeechReadiness(result);
      setSpeechReadinessStatus("ready");
    } catch (err) {
      setSpeechReadiness(null);
      setSpeechReadinessStatus("error");
      setSpeechReadinessError(s(err?.message || err, "speech_readiness_failed"));
    }
  }, []);

  useEffect(() => {
    const readinessTimer = window.setTimeout(() => {
      void refreshSpeechReadiness();
    }, 0);

    return () => {
      window.clearTimeout(readinessTimer);
    };
  }, [refreshSpeechReadiness]);

  const handleSpeakSpeechBridge = () => {
    speechBridge?.speakText?.(speechBridgeText);
  };

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Voice Assistant"
        title="Browser Voice Call"
        description="Eyni səhifədə həm GPT Realtime WebRTC zəngi, həm də Soniox speech bridge test edilir."
        actions={
          isLive ? (
            <Button
              variant="danger"
              leftIcon={<PhoneOff className="h-4 w-4" />}
              onClick={stopCall}
            >
              End GPT Realtime call
            </Button>
          ) : (
            <Button
              leftIcon={<Mic className="h-4 w-4" />}
              loading={isBusy}
              onClick={startCall}
            >
              Start GPT Realtime call
            </Button>
          )
        }
      />

      <InlineNotice
        tone="info"
        title="Three voice lanes"
        description="GPT Realtime WebRTC canlı danışıq üçün qalır. Pionero LiveKit yeni realtime agent lane-ni yoxlayır. Speech Bridge paneli isə browser mic → STT və text → TTS axınını ayrıca yoxlamaq üçündür."
      />

      {runtimeMeta ? (
        <InlineNotice
          tone={runtimeMeta.runtimeApplied ? "success" : "warning"}
          title={runtimeLabel}
          description={
            runtimeMeta.runtimeApplied
              ? `Runtime tətbiq olundu${runtimeMeta.tenantKey ? `: ${runtimeMeta.tenantKey}` : ""}.`
              : `Runtime tətbiq olunmadı: ${s(runtimeMeta.reasonCode, "fallback")}.`
          }
        />
      ) : null}

      {error ? (
        <InlineNotice
          tone="danger"
          title="Voice call error"
          description={s(error)}
        />
      ) : null}

      <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
              <Radio className="h-5 w-5 text-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">GPT Realtime WebRTC</h2>
              <p className="text-sm text-text-muted">
                Canlı browser zəngi: danış, assistant cavab versin, tool event-ləri və latency-ni yoxla.
              </p>
            </div>
          </div>

          <div className="rounded-full border border-line-soft bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-muted">
            {isLive ? "Live" : s(status, "idle")}
          </div>
        </div>

        <audio ref={remoteAudioRef} autoPlay />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Provider
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {providerLabel}
            </div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Transport
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              Browser WebRTC
            </div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Voice
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {voice || "runtime default"}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
              <SatelliteDish className="h-5 w-5 text-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">Pionero LiveKit realtime lane</h2>
              <p className="text-sm text-text-muted">
                GPT Realtime-dan ayrı yeni canlı assistant xətti: LiveKit transport, Soniox STT, fast LLM və Cartesia TTS.
              </p>
            </div>
          </div>

          <div className="rounded-full border border-line-soft bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-muted">
            {pioneroLiveKitLabel}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">Status</div>
            <div className="mt-1 text-sm font-semibold text-text">{pioneroLiveKitLabel}</div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">Room</div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitRoomName, "not connected")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">Identity</div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitIdentity, "not connected")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">Participants</div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitParticipantCount}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">Mic</div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitMicLabel}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-text-muted">
          Agent start-plan and ingest skeleton only; full AI loop is not running yet.
        </p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Agent start-plan status
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentStatusLabel} ({pioneroLiveKitAgentReadyLabel})
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Agent reason code
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentReasonCode, "not requested")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Agent network IO
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentNetworkIoLabel}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Audio ingest status
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentAudioIngestStatusLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Frames observed
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentAudioFramesObserved}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Bytes observed
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentAudioBytesObserved}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last observed
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentAudioLastObservedLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Audio reason code
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentAudioReasonCode, "not requested")}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {pioneroLiveKitLive ? (
            <Button
              variant="danger"
              leftIcon={<PhoneOff className="h-4 w-4" />}
              onClick={disconnectPioneroLiveKit}
            >
              End Pionero realtime call
            </Button>
          ) : (
            <Button
              leftIcon={<SatelliteDish className="h-4 w-4" />}
              loading={pioneroLiveKitLoading}
              onClick={connectPioneroLiveKit}
            >
              Start Pionero realtime call
            </Button>
          )}
        </div>

        {pioneroLiveKitError ? (
          <InlineNotice
            tone="warning"
            title="Pionero LiveKit warning"
            description={pioneroLiveKitError}
          />
        ) : null}
      </section>

      <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
              <Mic className="h-5 w-5 text-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">Speech Bridge / Soniox lane</h2>
              <p className="text-sm text-text-muted">
                Browser mic səsini backend speech bridge-ə göndər, transcript al, sonra mətni TTS ilə səsləndir.
              </p>
            </div>
          </div>

          <div className="rounded-full border border-line-soft bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-muted">
            {speechBridgeRecording ? "Recording" : speechBridgeStatus}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Provider
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              Speech Bridge
            </div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              STT
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              Browser mic → transcribe
            </div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              TTS
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              Text → synthesize
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-line-soft bg-surface-subtle p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Soniox readiness
              </div>
              <div className="mt-1 text-sm font-semibold text-text">
                {speechReadinessLabel}
              </div>
              <div className="mt-1 text-xs leading-5 text-text-muted">
                {speechReadinessReason}
              </div>
            </div>

            <Button
              leftIcon={<RefreshCw className="h-4 w-4" />}
              loading={speechReadinessLoading}
              onClick={refreshSpeechReadiness}
            >
              Refresh readiness
            </Button>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-line-soft bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Gateway language
              </div>
              <div className="mt-1 text-sm font-semibold text-text">
                {s(gatewayReadiness.language, "az")}
              </div>
            </div>

            <div className="rounded-2xl border border-line-soft bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                STT readiness
              </div>
              <div className="mt-1 text-sm font-semibold text-text">
                {sonioxSttReady ? "Ready" : "Not ready"}
              </div>
            </div>

            <div className="rounded-2xl border border-line-soft bg-white p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                TTS readiness
              </div>
              <div className="mt-1 text-sm font-semibold text-text">
                {sonioxTtsReady ? "Ready" : "Not ready"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {speechBridgeRecording ? (
            <Button
              variant="danger"
              leftIcon={<Square className="h-4 w-4" />}
              onClick={speechBridge?.stopRecording}
            >
              Stop speech bridge recording
            </Button>
          ) : (
            <Button
              leftIcon={<Mic className="h-4 w-4" />}
              disabled={!speechBridgeAvailable}
              onClick={speechBridge?.startRecording}
            >
              Start speech bridge recording
            </Button>
          )}

          <Button
            leftIcon={<Volume2 className="h-4 w-4" />}
            disabled={!s(speechBridgeText) || speechBridgePlaybackStatus === "synthesizing"}
            onClick={handleSpeakSpeechBridge}
          >
            Speak via speech bridge
          </Button>
        </div>

        <label
          className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle"
          htmlFor="speech-bridge-text"
        >
          Speech bridge text
        </label>

        <textarea
          className="mt-2 min-h-28 w-full rounded-2xl border border-line-soft bg-surface-subtle p-3 text-sm text-text outline-none focus:border-brand"
          id="speech-bridge-text"
          onChange={(event) => setSpeechBridgeDraftText(event.target.value)}
          placeholder="Transcript burada görünəcək və ya TTS üçün mətni buraya yaz..."
          value={speechBridgeText}
        />

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Recorder status
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {speechBridgeStatus}
            </div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Playback status
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {speechBridgePlaybackStatus}
            </div>
          </div>
        </div>

        {speechBridgeError ? (
          <InlineNotice
            tone="warning"
            title="Speech bridge warning"
            description={speechBridgeError}
          />
        ) : null}
      </section>

      <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">Live call log</h2>
          <p className="text-sm text-text-muted">
            Zəng və speech bridge zamanı gələn əsas transcript və connection event-ləri.
          </p>
        </div>

        <div className="space-y-2">
          {visibleEvents.length ? (
            visibleEvents.map((event, index) => (
              <div
                key={event.id || `${event.type || "event"}-${index}`}
                className="rounded-2xl border border-line-soft bg-surface-subtle p-3"
              >
                <div className="text-xs font-semibold text-text">
                  {s(event.type, "voice.event")}
                </div>
                {readEventText(event) ? (
                  <div className="mt-1 text-xs leading-5 text-text-muted">
                    {readEventText(event)}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-line-soft p-4 text-sm text-text-muted">
              Start call və ya speech bridge testindən sonra log burada görünəcək.
            </div>
          )}
        </div>
      </section>
    </PageCanvas>
  );
}
