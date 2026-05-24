import { useState } from "react";
import { Mic, PhoneOff, Radio, Square, Volume2 } from "lucide-react";

import useBrowserVoiceCall from "./hooks/useBrowserVoiceCall.js";
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

  const [speechBridgeDraftText, setSpeechBridgeDraftText] = useState("");

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
        title="Two voice lanes"
        description="GPT Realtime WebRTC canlı danışıq üçün qalır. Speech Bridge paneli isə browser mic → STT və text → TTS axınını ayrıca yoxlamaq üçündür."
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
