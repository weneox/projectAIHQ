import { useCallback, useEffect, useRef, useState } from "react";

import {
  appendBrowserVoiceCallEvent,
  createBrowserVoiceSession,
  executeBrowserVoiceTool,
} from "../../api/voice.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
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

function parseRealtimeToolArguments(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  return {};
}

function readRealtimeToolCallFromCandidate(candidate = {}) {
  if (!candidate || typeof candidate !== "object") return null;

  const name = s(candidate.name || candidate.functionName || candidate.function_name);
  if (!name) return null;

  return {
    id: s(candidate.call_id || candidate.callId || candidate.id),
    itemId: s(candidate.item_id || candidate.itemId),
    name,
    arguments: parseRealtimeToolArguments(candidate.arguments || candidate.args),
  };
}

function extractRealtimeToolCall(event = {}) {
  const type = s(event?.type);

  if (type === "response.function_call_arguments.done") {
    return readRealtimeToolCallFromCandidate(event);
  }

  if (type === "response.output_item.done") {
    return readRealtimeToolCallFromCandidate(event.item || {});
  }

  if (type === "response.done") {
    const output = Array.isArray(event?.response?.output) ? event.response.output : [];
    for (const item of output) {
      const toolCall = readRealtimeToolCallFromCandidate(item);
      if (toolCall) return toolCall;
    }
  }

  return null;
}

function sendRealtimeToolOutput(dc, toolCall = {}, result = {}) {
  if (!dc || dc.readyState !== "open") return false;

  const callId = s(toolCall.id || toolCall.call_id || toolCall.callId);
  if (!callId) return false;

  dc.send(
    JSON.stringify({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(result || {}),
      },
    })
  );

  dc.send(
    JSON.stringify({
      type: "response.create",
    })
  );

  return true;
}

function extractRealtimeTranscriptEvent(event = {}) {
  const type = s(event?.type);

  if (type === "conversation.item.input_audio_transcription.completed") {
    const transcript = s(event?.transcript);
    return transcript
      ? {
          eventType: "browser_voice.transcript.final",
          actor: "caller",
          role: "caller",
          text: transcript,
          payload: { realtimeType: type },
        }
      : null;
  }

  if (type === "response.audio_transcript.done") {
    const transcript = s(event?.transcript);
    return transcript
      ? {
          eventType: "browser_voice.transcript.final",
          actor: "assistant",
          role: "assistant",
          text: transcript,
          payload: { realtimeType: type },
        }
      : null;
  }

  if (type === "response.output_text.done") {
    const outputText = s(event?.text);
    return outputText
      ? {
          eventType: "browser_voice.transcript.final",
          actor: "assistant",
          role: "assistant",
          text: outputText,
          payload: { realtimeType: type },
        }
      : null;
  }

  if (type === "error") {
    return {
      eventType: "browser_voice.realtime_error",
      actor: "system",
      role: "system",
      text: s(event?.error?.message || event?.message || "Realtime error"),
      payload: {
        realtimeType: type,
        code: s(event?.error?.code),
      },
    };
  }

  return null;
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
  const callIdRef = useRef("");
  const endCallTimerRef = useRef(null);
  const sessionMetaRef = useRef({});

  const addEvent = useCallback((event) => {
    setEvents((current) => [normalizeVoiceEvent(event), ...current].slice(0, 8));
  }, []);

  const buildTracePayload = useCallback((payload = {}) => {
    const meta = obj(sessionMetaRef.current);
    const trace = {
      runtimeApplied: meta.runtimeApplied === true,
      tenantKey: s(meta.tenantKey),
      activeChannelProvider: s(meta.activeChannelProvider),
      activeChannelId: s(meta.activeChannelId),
      assistantPolicyVersion: s(meta.assistantPolicyVersion),
    };

    return Object.fromEntries(
      Object.entries({
        ...trace,
        ...obj(payload),
      }).filter(([, value]) => value !== "" && value !== undefined && value !== null)
    );
  }, []);

  const sendCallEvent = useCallback((event = {}) => {
    const callId = s(callIdRef.current);
    if (!callId) return;

    appendBrowserVoiceCallEvent(callId, {
      ...event,
      payload: buildTracePayload(event.payload),
    }).catch(() => {});
  }, [buildTracePayload]);

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

    const callId = s(callIdRef.current);
    if (callId) {
      appendBrowserVoiceCallEvent(callId, {
        eventType: "browser_voice.ended",
        actor: "system",
        role: "system",
        ended: true,
        outcome: "completed",
        payload: buildTracePayload({ status: "stopped_by_operator" }),
      }).catch(() => {});
    }

    dcRef.current = null;
    pcRef.current = null;
    localStreamRef.current = null;
    callIdRef.current = "";
    sessionMetaRef.current = {};

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    setStatus("idle");
  }, [buildTracePayload]);


  const endCallFromTool = useCallback((payload = {}) => {
    if (endCallTimerRef.current) return;

    sendCallEvent({
      eventType: "browser_voice.end_call_tool",
      actor: "assistant",
      role: "assistant",
      payload,
    });

    endCallTimerRef.current = window.setTimeout(() => {
      endCallTimerRef.current = null;
      stopCall();
    }, 1200);
  }, [sendCallEvent, stopCall]);

  const runToolCall = useCallback(async (toolCall = {}) => {
    const callId = s(callIdRef.current);
    if (!callId || !toolCall?.name) return;

    addEvent({
      type: "browser_voice.tool_call",
      text: toolCall.name,
    });

    try {
      const response = await executeBrowserVoiceTool(callId, {
        toolCallId: toolCall.id,
        name: toolCall.name,
        arguments: toolCall.arguments || {},
      });

      const result = response?.result || response || {};
      sendRealtimeToolOutput(dcRef.current, toolCall, result);

      sendCallEvent({
        eventType: "browser_voice.tool_result",
        actor: "system",
        role: "system",
        payload: {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result,
        },
      });

      if (toolCall.name === "end_call" || result?.shouldEndCall === true) {
        endCallFromTool({
          source: "backend_tool_result",
          toolName: toolCall.name,
          result,
        });
      }
    } catch (err) {
      const result = {
        ok: false,
        status: "tool_execution_failed",
        message: s(err?.message || err || "Tool execution failed."),
      };

      sendRealtimeToolOutput(dcRef.current, toolCall, result);

      sendCallEvent({
        eventType: "browser_voice.tool_failed",
        actor: "system",
        role: "system",
        payload: {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          error: result.message,
        },
      });
    }
  }, [addEvent, endCallFromTool, sendCallEvent]);

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

      const browserCallId = s(session?.browserCallId || session?.callId);
      callIdRef.current = browserCallId;
      const activeVoiceChannel = session?.activeVoiceChannel || null;
      const sessionMeta = {
        runtimeApplied: session?.runtimeApplied === true,
        reasonCode: s(session?.runtimeReasonCode),
        tenantKey: s(session?.tenantKey),
        activeChannelProvider: s(activeVoiceChannel?.provider || session?.match?.provider),
        activeChannelId: s(activeVoiceChannel?.id || session?.match?.voiceChannelId),
        assistantPolicyVersion: s(session?.assistantPolicyVersion || session?.brainPolicyVersion),
      };
      sessionMetaRef.current = sessionMeta;

      setRuntimeMeta({
        runtimeApplied: sessionMeta.runtimeApplied,
        reasonCode: sessionMeta.reasonCode,
        tenantKey: sessionMeta.tenantKey,
        activeVoiceChannel,
        match: session?.match || null,
        browserCallId,
        assistantPolicyVersion: sessionMeta.assistantPolicyVersion,
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
        sendCallEvent({
          eventType: "browser_voice.connected",
          actor: "system",
          role: "system",
          payload: {
            model: sessionModel,
            voice: sessionVoice,
          },
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
          sendCallEvent({
            eventType: openingStarted
              ? "browser_voice.opening_started"
              : "browser_voice.opening_skipped",
            actor: "system",
            role: "system",
            payload: { openingStarted },
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
          const event = JSON.parse(message.data);
          addEvent(event);

          const toolCall = extractRealtimeToolCall(event);
          if (toolCall?.name) {
            runToolCall({
              ...toolCall,
              realtimeType: event.type,
            });
            return;
          }

          const transcriptEvent = extractRealtimeTranscriptEvent(event);
          if (transcriptEvent) {
            sendCallEvent(transcriptEvent);
          }
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
  }, [addEvent, runToolCall, sendCallEvent, stopCall]);

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
