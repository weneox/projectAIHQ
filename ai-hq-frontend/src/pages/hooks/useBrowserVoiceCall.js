import { useCallback, useEffect, useRef, useState } from "react";

import { createBrowserVoiceSession } from "../../api/voice.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function readRealtimeClientSecret(payload = {}) {
  return (
    s(payload?.clientSecret) ||
    s(payload?.value) ||
    s(payload?.session?.value) ||
    s(payload?.session?.client_secret?.value) ||
    s(payload?.session?.clientSecret?.value)
  );
}

function readBrowserVoiceOpeningResponse(payload = {}) {
  const opening =
    payload?.openingResponse &&
    typeof payload.openingResponse === "object" &&
    !Array.isArray(payload.openingResponse)
      ? payload.openingResponse
      : {};

  return {
    enabled: opening.enabled !== false,
    maxOutputTokens: Math.max(
      40,
      Math.min(240, Number(opening.maxOutputTokens || 120))
    ),
    instructions: s(opening.instructions),
  };
}

function startBrowserVoiceOpening(dc, session) {
  if (!dc || dc.readyState !== "open") return false;

  const opening = readBrowserVoiceOpeningResponse(session);
  if (!opening.enabled || !opening.instructions) return false;

  dc.send(
    JSON.stringify({
      type: "response.create",
      response: {
        instructions: opening.instructions,
        max_output_tokens: opening.maxOutputTokens,
      },
    })
  );

  return true;
}

function normalizeVoiceEvent(event = {}) {
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

export default function useBrowserVoiceCall() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [runtimeMeta, setRuntimeMeta] = useState(null);
  const [events, setEvents] = useState([]);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const addEvent = useCallback((event) => {
    setEvents((current) => [normalizeVoiceEvent(event), ...current].slice(0, 8));
  }, []);

  const stopCall = useCallback(() => {
    setStatus("stopping");

    try {
      dcRef.current?.close?.();
    } catch {
      // noop
    }

    try {
      pcRef.current?.close?.();
    } catch {
      // noop
    }

    try {
      localStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    } catch {
      // noop
    }

    dcRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setStatus("idle");
  }, []);

  const startCall = useCallback(async () => {
    setError("");
    setEvents([]);
    setRuntimeMeta(null);
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

      const session = await createBrowserVoiceSession({
        provider: "browser",
        toNumber: "browser",
      });

      setRuntimeMeta({
        runtimeApplied: session?.runtimeApplied === true,
        reasonCode: s(session?.runtimeReasonCode),
        tenantKey: s(session?.tenantKey),
        activeVoiceChannel: session?.activeVoiceChannel || null,
        match: session?.match || null,
      });

      const sessionModel = s(session?.model, "gpt-realtime-1.5");
      const sessionVoice = s(session?.voice, "coral");
      setModel(sessionModel);
      setVoice(sessionVoice);

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
        addEvent({
          type: "browser_voice.connected",
          text: "Browser voice call connected.",
        });

        try {
          const openingStarted = startBrowserVoiceOpening(dc, session);
          addEvent({
            type: openingStarted
              ? "browser_voice.opening_started"
              : "browser_voice.opening_skipped",
            text: openingStarted
              ? "Backend voice assistant opening started."
              : "No backend opening response was available.",
          });
        } catch (err) {
          addEvent({
            type: "browser_voice.opening_failed",
            text: s(err?.message || err),
          });
        }
      };

      dc.onmessage = (message) => {
        try {
          addEvent(JSON.parse(message.data));
        } catch {
          addEvent({ type: "message", text: message.data });
        }
      };

      dc.onerror = () => {
        addEvent({ type: "browser_voice.data_channel_error" });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`Realtime WebRTC connect failed: ${sdpResponse.status}`);
      }

      const answerSdp = await sdpResponse.text();
      await pc.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (err) {
      setError(s(err?.message || err, "Browser voice call başlatmaq alınmadı."));
      stopCall();
    }
  }, [addEvent, stopCall]);

  useEffect(() => {
    return () => {
      stopCall();
    };
  }, [stopCall]);

  return {
    status,
    error,
    model,
    voice,
    runtimeMeta,
    events,
    remoteAudioRef,
    startCall,
    stopCall,
  };
}
