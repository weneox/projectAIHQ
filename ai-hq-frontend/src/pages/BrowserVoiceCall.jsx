import { useEffect, useState } from "react";
import {
  Mic,
  PhoneOff,
  Radio,
  ShieldCheck,
} from "lucide-react";

import useBrowserVoiceCall from "./hooks/useBrowserVoiceCall.js";
import { getVoiceActionRuntime } from "../api/voice.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function listToolNames(value = []) {
  return Array.isArray(value)
    ? value.map((item) => s(item?.name || item)).filter(Boolean).join(", ")
    : "";
}

function adapterLabel(value = "") {
  const raw = s(value).toLowerCase();
  if (raw === "browser" || raw === "browser_lab" || raw === "browserlab") {
    return "Browser voice adapter";
  }
  if (raw === "browser_adapter" || raw === "pre_sip_browser") {
    return "Browser voice adapter";
  }
  return s(value, "Voice channel");
}

export default function BrowserVoiceCall() {
  const {
    status,
    error: callError,
    voice,
    runtimeMeta,
    events,
    remoteAudioRef,
    startCall,
    stopCall,
  } = useBrowserVoiceCall();

  const [actionRuntime, setActionRuntime] = useState(null);
  const [actionRuntimeError, setActionRuntimeError] = useState("");

  const error = callError || actionRuntimeError;
  const isLive = status === "live";
  const isBusy = !["idle", "live"].includes(status);
  const activeChannel = runtimeMeta?.activeVoiceChannel || null;
  const runtimeSource = runtimeMeta?.runtimeApplied
    ? "Tenant voice runtime"
    : "Fallback runtime";

  useEffect(() => {
    let active = true;

    getVoiceActionRuntime({ provider: "browser", toNumber: "browser" })
      .then((runtime) => {
        if (!active) return;
        setActionRuntime(runtime || null);
        setActionRuntimeError("");
      })
      .catch((err) => {
        if (!active) return;
        setActionRuntimeError(s(err?.message || err, "Voice action runtime oxunmadı."));
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Voice Assistant"
        title="Voice Assistant"
        description="Browser mikrofonu ilə tenant voice assistant-a real pre-SIP zəng et."
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
        title="Pre-SIP browser call"
        description="Browser yalnız müvəqqəti audio adapterdir; assistant qərarları backend tenant voice runtime-dan gəlir."
      />

      {runtimeMeta ? (
        <InlineNotice
          tone={runtimeMeta.runtimeApplied ? "success" : "warning"}
          title={runtimeSource}
          description={
            runtimeMeta.runtimeApplied
              ? `Runtime tətbiq olundu${runtimeMeta.tenantKey ? `: ${runtimeMeta.tenantKey}` : ""}.`
              : `Runtime tətbiq olunmadı: ${s(runtimeMeta.reasonCode, "fallback")}.`
          }
        />
      ) : null}

      {error ? (
        <InlineNotice tone="danger" title="Voice assistant error" description={error} />
      ) : null}

      <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
            <Radio className="h-5 w-5 text-text" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text">Call status</h2>
            <p className="text-sm text-text-muted">{status}</p>
          </div>
        </div>

        <audio ref={remoteAudioRef} autoPlay />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Runtime
            </div>
            <div className="mt-1 text-sm font-semibold text-text">{runtimeSource}</div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Adapter
            </div>
            <div className="mt-1 text-sm font-semibold text-text">
              {adapterLabel(activeChannel?.provider || runtimeMeta?.match?.provider)}
            </div>
          </div>

          <div className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Voice
            </div>
            <div className="mt-1 text-sm font-semibold text-text">{voice || "runtime"}</div>
          </div>
        </div>
      </section>

      {actionRuntime ? (
        <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-text-subtle">
                Tenant voice runtime
              </div>
              <h2 className="mt-1 text-base font-semibold text-text">
                {s(actionRuntime?.actionRuntime?.businessFamily, "generic")} tools
              </h2>
            </div>
            <div className="rounded-full border border-line-soft bg-surface-subtle px-3 py-1 text-xs font-semibold text-text-muted">
              {actionRuntime.runtimeApplied ? "runtime applied" : "fallback"}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            {[
              ["Availability", actionRuntime?.actionRuntime?.availabilityMode],
              ["Ordering", actionRuntime?.actionRuntime?.orderingMode],
              ["Reservation", actionRuntime?.actionRuntime?.reservationMode],
              ["Appointment", actionRuntime?.actionRuntime?.appointmentMode],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  {label}
                </div>
                <div className="mt-1 text-sm font-semibold text-text">
                  {s(value, "disabled")}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-2xl border border-line-soft bg-surface-subtle p-3 text-sm text-text-muted">
            <span className="font-semibold text-text">Enabled tools:</span>{" "}
            {listToolNames(actionRuntime.tools) || "No action tools enabled"}
          </div>
        </section>
      ) : null}

      <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
            <ShieldCheck className="h-5 w-5 text-text" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text">Connection log</h2>
            <p className="text-xs text-text-muted">Technical status and transcript events.</p>
          </div>
        </div>

        <div className="space-y-2">
          {events.length ? (
            events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
                <div className="text-xs font-semibold text-text">{event.type}</div>
                {event.text ? (
                  <div className="mt-1 text-xs leading-5 text-text-muted">{event.text}</div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-line-soft p-4 text-sm text-text-muted">
              Start call etdikdən sonra connection statusu burada görünəcək.
            </div>
          )}
        </div>
      </section>
    </PageCanvas>
  );
}
