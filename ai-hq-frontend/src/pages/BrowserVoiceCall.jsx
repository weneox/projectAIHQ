import { Mic, PhoneOff, Radio } from "lucide-react";

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
    startCall,
    stopCall,
  } = useBrowserVoiceCall();

  const isLive = status === "live";
  const isBusy = !["idle", "live"].includes(status);
  const providerLabel = readProviderLabel(runtimeMeta);
  const runtimeLabel = runtimeMeta?.runtimeApplied
    ? "Tenant runtime active"
    : "Fallback runtime";

  const visibleEvents = Array.isArray(events)
    ? events.slice(-8).reverse()
    : [];

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Voice Assistant"
        title="Browser Voice Call"
        description="Browser mikrofonu ilə assistant-ı real vaxtda yoxla. OpenAI Realtime aktiv baseline kimi qalır."
        actions={
          isLive ? (
            <Button
              variant="danger"
              leftIcon={<PhoneOff className="h-4 w-4" />}
              onClick={stopCall}
            >
              End call
            </Button>
          ) : (
            <Button
              leftIcon={<Mic className="h-4 w-4" />}
              loading={isBusy}
              onClick={startCall}
            >
              Start call
            </Button>
          )
        }
      />

      <InlineNotice
        tone="info"
        title="OpenAI Realtime baseline"
        description="Bu səhifə hazırda işlək browser zəng testidir. Növbəti mərhələdə yanına Pionero LiveKit provider əlavə ediləcək."
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
              <h2 className="text-lg font-semibold text-text">Call booth</h2>
              <p className="text-sm text-text-muted">
                Danış, dinlə, latency və natural hissi real zəng kimi yoxla.
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
        <div className="mb-4">
          <h2 className="text-base font-semibold text-text">Live call log</h2>
          <p className="text-sm text-text-muted">
            Zəng zamanı gələn əsas transcript və connection event-ləri.
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
              Start call etdikdən sonra call log burada görünəcək.
            </div>
          )}
        </div>
      </section>
    </PageCanvas>
  );
}
