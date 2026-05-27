import { useCallback, useEffect, useState } from "react";
import { Mic, PhoneOff, Radio, RefreshCw, SatelliteDish, Square, Volume2 } from "lucide-react";

import useBrowserVoiceCall from "./hooks/useBrowserVoiceCall.js";
import usePioneroLiveKitRoom from "./hooks/usePioneroLiveKitRoom.js";
import { getPioneroVoiceReadiness, getVoiceSpeechGatewayReadiness } from "../api/voice.js";
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

function readReadinessComponent(snapshot = {}, name = "") {
  const components = Array.isArray(snapshot?.components) ? snapshot.components : [];
  return components.find((component) => component?.name === name) || {};
}

function readinessTone(status = "") {
  const normalized = s(status).toLowerCase();
  if (normalized === "ready") return "success";
  if (normalized === "degraded") return "warning";
  if (normalized === "blocked" || normalized === "failed") return "danger";
  return "info";
}

function readinessLabel(component = {}) {
  const status = s(component.status, component.ok ? "ready" : "blocked");
  const reasonCode = s(component.reasonCode);
  return reasonCode ? `${status} · ${reasonCode}` : status;
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
    playLatestAgentAudio: playLatestPioneroAgentAudio,
    refreshAgentStatus: refreshPioneroLiveKitAgentStatus,
    localMicEnabled: pioneroLiveKitLocalMicEnabled,
    monitorOnlyMode: pioneroLiveKitMonitorOnlyMode,
    agentStatus: pioneroLiveKitAgentStatus,
    agentReasonCode: pioneroLiveKitAgentReasonCode,
    agentNetworkIo: pioneroLiveKitAgentNetworkIo,
    agentReady: pioneroLiveKitAgentReady,
    agentAudioIngestStatus: pioneroLiveKitAgentAudioIngestStatus,
    agentAudioFramesObserved: pioneroLiveKitAgentAudioFramesObserved,
    agentAudioBytesObserved: pioneroLiveKitAgentAudioBytesObserved,
    agentAudioLastObservedAt: pioneroLiveKitAgentAudioLastObservedAt,
    agentAudioReasonCode: pioneroLiveKitAgentAudioReasonCode,
    agentSttProvider: pioneroLiveKitAgentSttProvider,
    agentSttStatus: pioneroLiveKitAgentSttStatus,
    agentSttEnabled: pioneroLiveKitAgentSttEnabled,
    agentSttNetworkIo: pioneroLiveKitAgentSttNetworkIo,
    agentSttTranscriptsObserved: pioneroLiveKitAgentSttTranscriptsObserved,
    agentSttLastTranscript: pioneroLiveKitAgentSttLastTranscript,
    agentSttLastObservedAt: pioneroLiveKitAgentSttLastObservedAt,
    agentSttReasonCode: pioneroLiveKitAgentSttReasonCode,
    agentLlmProvider: pioneroLiveKitAgentLlmProvider,
    agentLlmStatus: pioneroLiveKitAgentLlmStatus,
    agentLlmEnabled: pioneroLiveKitAgentLlmEnabled,
    agentLlmNetworkIo: pioneroLiveKitAgentLlmNetworkIo,
    agentLlmTurnsPlanned: pioneroLiveKitAgentLlmTurnsPlanned,
    agentLlmLastInputTranscript: pioneroLiveKitAgentLlmLastInputTranscript,
    agentLlmLastPlannedResponse: pioneroLiveKitAgentLlmLastPlannedResponse,
    agentLlmLastObservedAt: pioneroLiveKitAgentLlmLastObservedAt,
    agentLlmReasonCode: pioneroLiveKitAgentLlmReasonCode,
    agentTtsProvider: pioneroLiveKitAgentTtsProvider,
    agentTtsStatus: pioneroLiveKitAgentTtsStatus,
    agentTtsEnabled: pioneroLiveKitAgentTtsEnabled,
    agentTtsNetworkIo: pioneroLiveKitAgentTtsNetworkIo,
    agentTtsSpeechPlansCreated: pioneroLiveKitAgentTtsSpeechPlansCreated,
    agentTtsSynthesesSucceeded: pioneroLiveKitAgentTtsSynthesesSucceeded,
    agentTtsAudioByteLength: pioneroLiveKitAgentTtsAudioByteLength,
    agentTtsAudioChunkCount: pioneroLiveKitAgentTtsAudioChunkCount,
    agentTtsLastInputText: pioneroLiveKitAgentTtsLastInputText,
    agentTtsLastAudioPlan: pioneroLiveKitAgentTtsLastAudioPlan,
    agentTtsLastObservedAt: pioneroLiveKitAgentTtsLastObservedAt,
    agentTtsReasonCode: pioneroLiveKitAgentTtsReasonCode,
    agentAudioPlaybackStatus: pioneroLiveKitAgentAudioPlaybackStatus,
    agentAudioPlaybackReasonCode: pioneroLiveKitAgentAudioPlaybackReasonCode,
    agentAudioPlaybackByteLength: pioneroLiveKitAgentAudioPlaybackByteLength,
    agentAudioPlaybackSynthesizedAt: pioneroLiveKitAgentAudioPlaybackSynthesizedAt,
  } = usePioneroLiveKitRoom();

  const [speechBridgeDraftText, setSpeechBridgeDraftText] = useState("");
  const [speechReadiness, setSpeechReadiness] = useState(null);
  const [speechReadinessStatus, setSpeechReadinessStatus] = useState("idle");
  const [speechReadinessError, setSpeechReadinessError] = useState("");
  const [pioneroVoiceReadiness, setPioneroVoiceReadiness] = useState(null);
  const [pioneroVoiceReadinessStatus, setPioneroVoiceReadinessStatus] = useState("idle");
  const [pioneroVoiceReadinessError, setPioneroVoiceReadinessError] = useState("");
  const [pioneroAgentRefreshStatus, setPioneroAgentRefreshStatus] = useState("idle");

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
  const pioneroVoiceReadinessSnapshot = pioneroVoiceReadiness || {};
  const pioneroVoiceReadinessLabel = pioneroVoiceReadinessStatus === "loading"
    ? "checking"
    : s(pioneroVoiceReadinessSnapshot.status, "not_checked");
  const pioneroVoiceReadinessReason = s(
    pioneroVoiceReadinessError || pioneroVoiceReadinessSnapshot.reasonCode,
    "readiness_not_checked"
  );
  const pioneroVoiceReadinessComponents = [
    ["LiveKit", readReadinessComponent(pioneroVoiceReadinessSnapshot, "livekit")],
    ["Soniox STT", readReadinessComponent(pioneroVoiceReadinessSnapshot, "sonioxStt")],
    ["Soniox TTS", readReadinessComponent(pioneroVoiceReadinessSnapshot, "sonioxTts")],
    ["OpenAI composer", readReadinessComponent(pioneroVoiceReadinessSnapshot, "openaiComposer")],
    ["Speech-loop smoke", readReadinessComponent(pioneroVoiceReadinessSnapshot, "speechLoopSmoke")],
  ];

  const pioneroLiveKitLive = pioneroLiveKitStatus === "live";
  const pioneroLiveKitLoading = [
    "creating",
    "connecting",
    "publishing_microphone",
    "stopping",
  ].includes(pioneroLiveKitStatus);
  const pioneroAgentRefreshLoading = pioneroAgentRefreshStatus === "loading";
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
  const pioneroLiveKitAgentSttEnabledLabel = pioneroLiveKitAgentSttEnabled
    ? "yes"
    : "no";
  const pioneroLiveKitAgentSttNetworkIoLabel = pioneroLiveKitAgentSttNetworkIo
    ? "yes"
    : "no";
  const pioneroLiveKitAgentSttLastTranscriptLabel = s(
    pioneroLiveKitAgentSttLastTranscript,
    "not observed"
  );
  const pioneroLiveKitAgentSttLastObservedLabel = s(
    pioneroLiveKitAgentSttLastObservedAt,
    "not observed"
  );
  const pioneroLiveKitAgentLlmEnabledLabel = pioneroLiveKitAgentLlmEnabled
    ? "yes"
    : "no";
  const pioneroLiveKitAgentLlmNetworkIoLabel = pioneroLiveKitAgentLlmNetworkIo
    ? "yes"
    : "no";
  const pioneroLiveKitAgentLlmLastInputTranscriptLabel = s(
    pioneroLiveKitAgentLlmLastInputTranscript,
    "not observed"
  );
  const pioneroLiveKitAgentLlmLastPlannedResponseLabel = s(
    pioneroLiveKitAgentLlmLastPlannedResponse,
    "not planned"
  );
  const pioneroLiveKitAgentLlmLastObservedLabel = s(
    pioneroLiveKitAgentLlmLastObservedAt,
    "not observed"
  );
  const pioneroLiveKitAgentTtsEnabledLabel = pioneroLiveKitAgentTtsEnabled
    ? "yes"
    : "no";
  const pioneroLiveKitAgentTtsNetworkIoLabel = pioneroLiveKitAgentTtsNetworkIo
    ? "yes"
    : "no";
  const pioneroLiveKitAgentTtsAudioLabel = pioneroLiveKitAgentTtsAudioByteLength > 0
    ? `${pioneroLiveKitAgentTtsAudioByteLength} bytes / ${pioneroLiveKitAgentTtsAudioChunkCount} chunks`
    : "not synthesized";
  const pioneroLiveKitAgentTtsLastInputTextLabel = s(
    pioneroLiveKitAgentTtsLastInputText,
    "not planned"
  );
  const pioneroLiveKitAgentTtsLastAudioPlanLabel = s(
    pioneroLiveKitAgentTtsLastAudioPlan,
    "not planned"
  );
  const pioneroLiveKitAgentTtsLastObservedLabel = s(
    pioneroLiveKitAgentTtsLastObservedAt,
    "not observed"
  );
  const pioneroLiveKitAgentAudioPlaybackLabel = s(
    pioneroLiveKitAgentAudioPlaybackStatus,
    "idle"
  );
  const pioneroLiveKitAgentAudioPlaybackDetail = s(
    pioneroLiveKitAgentAudioPlaybackReasonCode ||
      pioneroLiveKitAgentAudioPlaybackSynthesizedAt,
    "not played"
  );
  const pioneroLiveKitAgentAudioPlaybackBytesLabel =
    pioneroLiveKitAgentAudioPlaybackByteLength > 0
      ? `${pioneroLiveKitAgentAudioPlaybackByteLength} bytes`
      : "";
  const pioneroLiveKitShowAgentAudioPlayButton = [
    "blocked",
    "error",
  ].includes(pioneroLiveKitAgentAudioPlaybackStatus);

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

  const refreshPioneroVoiceReadiness = useCallback(async () => {
    setPioneroVoiceReadinessStatus("loading");
    setPioneroVoiceReadinessError("");

    try {
      const result = await getPioneroVoiceReadiness();
      setPioneroVoiceReadiness(result);
      setPioneroVoiceReadinessStatus("ready");
    } catch (err) {
      setPioneroVoiceReadiness(null);
      setPioneroVoiceReadinessStatus("error");
      setPioneroVoiceReadinessError(s(err?.message || err, "pionero_readiness_failed"));
    }
  }, []);

  useEffect(() => {
    const readinessTimer = window.setTimeout(() => {
      void refreshPioneroVoiceReadiness();
    }, 0);

    return () => {
      window.clearTimeout(readinessTimer);
    };
  }, [refreshPioneroVoiceReadiness]);

  const handleRefreshPioneroAgentStatus = useCallback(async () => {
    setPioneroAgentRefreshStatus("loading");

    try {
      await refreshPioneroLiveKitAgentStatus?.();
      setPioneroAgentRefreshStatus("ready");
    } catch {
      setPioneroAgentRefreshStatus("error");
    }
  }, [refreshPioneroLiveKitAgentStatus]);

  const handlePlayLatestPioneroAgentAudio = useCallback(async () => {
    await playLatestPioneroAgentAudio?.();
  }, [playLatestPioneroAgentAudio]);

  const handleSpeakSpeechBridge = () => {
    speechBridge?.speakText?.(speechBridgeText);
  };

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Voice Assistant"
        title="Browser Voice Call"
        description="Eyni sÉ™hifÉ™dÉ™ hÉ™m GPT Realtime WebRTC zÉ™ngi, hÉ™m dÉ™ Soniox speech bridge test edilir."
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
        description="GPT Realtime WebRTC canlÄ± danÄ±ÅŸÄ±q Ã¼Ã§Ã¼n qalÄ±r. Pionero LiveKit yeni realtime agent lane-ni yoxlayÄ±r. Speech Bridge paneli isÉ™ browser mic â†’ STT vÉ™ text â†’ TTS axÄ±nÄ±nÄ± ayrÄ±ca yoxlamaq Ã¼Ã§Ã¼ndÃ¼r."
      />

      <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">Pionero readiness snapshot</h2>
            <p className="text-sm text-text-muted">
              LiveKit, Soniox STT/TTS, OpenAI composer və speech-loop smoke statusu.
            </p>
          </div>

          <Button
            variant="secondary"
            leftIcon={<RefreshCw className="h-4 w-4" />}
            loading={pioneroVoiceReadinessStatus === "loading"}
            onClick={refreshPioneroVoiceReadiness}
          >
            Refresh Pionero readiness
          </Button>
        </div>

        <InlineNotice
          tone={readinessTone(pioneroVoiceReadinessLabel)}
          title={"Pionero readiness: " + pioneroVoiceReadinessLabel}
          description={pioneroVoiceReadinessReason}
        />

        <div className="mt-4 grid gap-3 md:grid-cols-5">
          {pioneroVoiceReadinessComponents.map(([label, component]) => (
            <div key={label} className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                {label}
              </div>
              <div className="mt-1 text-sm font-semibold text-text">
                {readinessLabel(component)}
              </div>
            </div>
          ))}
        </div>
      </section>
      {runtimeMeta ? (
        <InlineNotice
          tone={runtimeMeta.runtimeApplied ? "success" : "warning"}
          title={runtimeLabel}
          description={
            runtimeMeta.runtimeApplied
              ? `Runtime tÉ™tbiq olundu${runtimeMeta.tenantKey ? `: ${runtimeMeta.tenantKey}` : ""}.`
              : `Runtime tÉ™tbiq olunmadÄ±: ${s(runtimeMeta.reasonCode, "fallback")}.`
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
                CanlÄ± browser zÉ™ngi: danÄ±ÅŸ, assistant cavab versin, tool event-lÉ™ri vÉ™ latency-ni yoxla.
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
                GPT Realtime-dan ayrÄ± yeni canlÄ± assistant xÉ™tti: LiveKit transport, Soniox STT, fast LLM vÉ™ Cartesia TTS.
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
          Agent start-plan, ingest skeleton, STT skeleton, LLM turn-plan skeleton, and TTS skeleton only; full AI loop is not running yet.
        </p>

        {pioneroLiveKitMonitorOnlyMode ? (
          <InlineNotice
            tone="info"
            title="Pionero monitor-only mode"
            description="Pionero monitor-only mode: browser publishes mic without starting backend agent."
          />
        ) : null}

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

        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
          STT skeleton
        </p>

        <div className="mt-2 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Provider
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentSttProvider, "soniox")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Status
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentSttStatus, "idle")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Enabled
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentSttEnabledLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Network IO
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentSttNetworkIoLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Transcripts observed
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentSttTranscriptsObserved}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last transcript
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {pioneroLiveKitAgentSttLastTranscriptLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last observed
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentSttLastObservedLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Reason code
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentSttReasonCode, "not requested")}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
          LLM turn-plan skeleton
        </p>

        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Provider
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentLlmProvider, "fast_text_llm")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Status
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentLlmStatus, "idle")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Enabled
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentLlmEnabledLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Network IO
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentLlmNetworkIoLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Turns planned
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentLlmTurnsPlanned}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last input transcript
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {pioneroLiveKitAgentLlmLastInputTranscriptLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last planned response
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {pioneroLiveKitAgentLlmLastPlannedResponseLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last observed
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentLlmLastObservedLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Reason code
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentLlmReasonCode, "not requested")}
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
          TTS skeleton
        </p>

        <div className="mt-2 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Provider
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentTtsProvider, "cartesia")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Status
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentTtsStatus, "idle")}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Enabled
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsEnabledLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Network IO
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsNetworkIoLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Speech plans created
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsSpeechPlansCreated}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Syntheses succeeded
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsSynthesesSucceeded}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Synthesized audio
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsAudioLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Playback
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentAudioPlaybackLabel}
            </div>
            <div className="mt-1 break-words text-xs text-text-muted">
              {pioneroLiveKitAgentAudioPlaybackBytesLabel || pioneroLiveKitAgentAudioPlaybackDetail}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last input text
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsLastInputTextLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last audio plan
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsLastAudioPlanLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Last observed
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {pioneroLiveKitAgentTtsLastObservedLabel}
            </div>
          </div>
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Reason code
            </div>
            <div className="mt-1 break-words text-sm font-semibold text-text">
              {s(pioneroLiveKitAgentTtsReasonCode, "not requested")}
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

          <Button
            leftIcon={<RefreshCw className="h-4 w-4" />}
            disabled={!pioneroLiveKitRoomName || pioneroLiveKitLoading}
            loading={pioneroAgentRefreshLoading}
            onClick={handleRefreshPioneroAgentStatus}
          >
            Refresh Pionero status
          </Button>

          {pioneroLiveKitShowAgentAudioPlayButton ? (
            <Button
              leftIcon={<Volume2 className="h-4 w-4" />}
              disabled={!pioneroLiveKitRoomName}
              onClick={handlePlayLatestPioneroAgentAudio}
            >
              Play agent audio
            </Button>
          ) : null}
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
                Browser mic sÉ™sini backend speech bridge-É™ gÃ¶ndÉ™r, transcript al, sonra mÉ™tni TTS ilÉ™ sÉ™slÉ™ndir.
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
              Browser mic â†’ transcribe
            </div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              TTS
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              Text â†’ synthesize
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
          placeholder="Transcript burada gÃ¶rÃ¼nÉ™cÉ™k vÉ™ ya TTS Ã¼Ã§Ã¼n mÉ™tni buraya yaz..."
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
            ZÉ™ng vÉ™ speech bridge zamanÄ± gÉ™lÉ™n É™sas transcript vÉ™ connection event-lÉ™ri.
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
              Start call vÉ™ ya speech bridge testindÉ™n sonra log burada gÃ¶rÃ¼nÉ™cÉ™k.
            </div>
          )}
        </div>
      </section>
    </PageCanvas>
  );
}
