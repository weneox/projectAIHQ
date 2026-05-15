import { useEffect, useRef, useState } from "react";
import { Mic, PhoneOff, Radio, ShieldCheck } from "lucide-react";

import { createVoiceLabSession } from "../api/voice.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";

const DEFAULT_INSTRUCTIONS =
  "You are a premium business receptionist. Speak naturally and calmly. Keep answers short. Ask one question at a time. If the user asks about services, pricing, booking, address, or contact, answer clearly. If unsure, ask a short clarifying question.";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function readRealtimeClientSecret(payload = {}) {
  return (
    s(payload?.clientSecret) ||
    s(payload?.session?.client_secret?.value) ||
    s(payload?.session?.clientSecret?.value)
  );
}

function normalizeLogEvent(event = {}) {
  const type = s(event?.type, "event");
  const text =
    s(event?.transcript) ||
    s(event?.text) ||
    s(event?.delta) ||
    s(event?.error?.message) ||
    "";
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type,
    text: text.slice(0, 220),
  };
}

export default function VoiceLab() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [model, setModel] = useState("gpt-4o-realtime-preview");
  const [voice, setVoice] = useState("alloy");
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [events, setEvents] = useState([]);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  function addEvent(event) {
    setEvents((current) => [normalizeLogEvent(event), ...current].slice(0, 12));
  }

  async function stopLab() {
    setStatus("stopping");

    try {
      dcRef.current?.close?.();
    } catch (err) {
      void err;
    }

    try {
      pcRef.current?.close?.();
    } catch (err) {
      void err;
    }

    try {
      localStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    } catch (err) {
      void err;
    }

    dcRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setStatus("idle");
  }

  async function startLab() {
    setError("");
    setEvents([]);
    setStatus("requesting_microphone");

    try {
      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = localStream;

      setStatus("creating_session");
      const session = await createVoiceLabSession({
        model,
        voice,
        instructions,
      });

      const clientSecret = readRealtimeClientSecret(session);
      if (!clientSecret) {
        throw new Error("Realtime client secret alınmadı.");
      }

      setStatus("connecting");
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (!remoteAudioRef.current) return;
        const [stream] = event.streams || [];
        if (stream) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play?.().catch(() => {});
        }
      };

      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;

      dc.onopen = () => {
        setStatus("live");
        addEvent({ type: "lab.connected", text: "Voice Lab connected." });
      };

      dc.onmessage = (message) => {
        try {
          addEvent(JSON.parse(message.data));
        } catch {
          addEvent({ type: "message", text: message.data });
        }
      };

      dc.onerror = () => {
        addEvent({ type: "lab.data_channel_error" });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${clientSecret}`,
            "Content-Type": "application/sdp",
          },
        }
      );

      if (!sdpResponse.ok) {
        throw new Error(`Realtime WebRTC connect failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (err) {
      setError(s(err?.message || err, "Voice Lab başlatmaq alınmadı."));
      await stopLab();
    }
  }

  useEffect(() => {
    return () => {
      stopLab();
    };
  }, []);

  const isLive = status === "live";
  const isBusy = !["idle", "live"].includes(status);

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Voice Lab"
        title="Browser Voice Lab"
        description="Twilio və SIP olmadan mikrofonla professional voice assistant danışığını test et. Bu lab real telefon zəngi deyil, danışıq keyfiyyəti, prompt, səs və interruption davranışı üçündür."
        actions={
          isLive ? (
            <Button variant="danger" leftIcon={<PhoneOff className="h-4 w-4" />} onClick={stopLab}>
              Stop test
            </Button>
          ) : (
            <Button
              leftIcon={<Mic className="h-4 w-4" />}
              loading={isBusy}
              onClick={startLab}
            >
              Start voice test
            </Button>
          )
        }
      />

      <InlineNotice
        tone="info"
        title="Test qaydası"
        description="Qulaqlıq tax, sakit otaqda danış, assistant sözünü kəsəndə dayanırmı, qısa cavab verirmi və dili düzgün tuturmu yoxla."
      />

      {error ? (
        <InlineNotice tone="danger" title="Voice Lab error" description={error} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
              <Radio className="h-5 w-5 text-text" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text">Live microphone session</h2>
              <p className="text-sm text-text-muted">Status: {status}</p>
            </div>
          </div>

          <audio ref={remoteAudioRef} autoPlay />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Model
              </span>
              <input
                className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                value={model}
                onChange={(event) => setModel(event.target.value)}
                disabled={isLive || isBusy}
              />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Voice
              </span>
              <select
                className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                value={voice}
                onChange={(event) => setVoice(event.target.value)}
                disabled={isLive || isBusy}
              >
                {["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Test prompt
            </span>
            <textarea
              className="min-h-[180px] w-full resize-y rounded-2xl border border-line-soft bg-white px-3 py-3 text-sm leading-6 text-text outline-none focus:border-text"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              disabled={isLive || isBusy}
            />
          </label>
        </section>

        <aside className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
              <ShieldCheck className="h-5 w-5 text-text" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text">Session events</h2>
              <p className="text-xs text-text-muted">Realtime data channel logs</p>
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
                Start voice test etdikdən sonra realtime event-lər burada görünəcək.
              </div>
            )}
          </div>
        </aside>
      </div>
    </PageCanvas>
  );
}
