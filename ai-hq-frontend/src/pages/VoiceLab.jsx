import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck,
  Mic,
  PhoneOff,
  Radio,
  ShieldCheck,
  Star,
} from "lucide-react";

import {
  createVoiceLabEvaluation,
  createVoiceLabSession,
  listVoiceLabEvaluations,
  listVoiceLabScenarios,
} from "../api/voice.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";

const VOICE_LAB_SCENARIOS = [
  {
    id: "hotel_booking_inquiry",
    title: "Otel rezervasiya müraciəti",
    goal: "Müştəri otel otağı üçün qiymət və mövcudluq soruşur.",
    callerScript:
      "Salam, iki nəfər üçün sabahdan iki gecə otaq lazımdır. Qiyməti və boş yer olub-olmadığını bilmək istəyirəm.",
    expectedOutcome:
      "Agent qiymət və boş yer uydurmamalıdır. Ad, telefon, giriş tarixi, çıxış tarixi, qonaq sayı və otaq istəyi toplamalı, sonra müraciəti resepsiyaya ötürməyi təklif etməlidir.",
    requiredSlots: [
      { key: "customer_name", label: "Müştərinin adı" },
      { key: "customer_phone", label: "Telefon nömrəsi" },
      { key: "check_in_date", label: "Giriş tarixi" },
      { key: "check_out_date", label: "Çıxış tarixi" },
      { key: "guest_count", label: "Qonaq sayı" },
      { key: "room_preference", label: "Otaq istəyi" },
    ],
    optionalSlots: [{ key: "notes", label: "Əlavə qeydlər" }],
  },
  {
    id: "hotel_business_faq",
    title: "Otel məlumatları",
    goal: "Müştəri otelin təsdiqli məlumatlarını soruşur.",
    callerScript:
      "Salam, otelin ünvanı haradadır? Saytı hansıdır? Resepsiya neçə saat işləyir? Səhər yeməyi saat neçədədir?",
    expectedOutcome:
      "Agent yalnız approved Avrora Hotel truth-a əsasən cavab verməlidir. Ünvanı, saytı, resepsiya saatını və səhər yeməyi saatını düzgün deməlidir. Bilmədiyi məlumatı uydurmamalıdır.",
    requiredSlots: [{ key: "question_topic", label: "Sual mövzusu" }],
    optionalSlots: [{ key: "customer_phone", label: "Telefon nömrəsi" }],
  },
  {
    id: "restaurant_order",
    title: "Restaurant order",
    goal: "Müştəri sifariş vermək istəyir.",
    callerScript:
      "Salam, pizza sifariş vermək istəyirəm. Çatdırılma olsun. Əvvəl qiymət və təxmini çatdırılma vaxtını soruş, sonra ünvanı de.",
    expectedOutcome:
      "Agent sifariş, çatdırılma/pickup, ad, telefon və ünvanı toplamalı, qiymət/menyu uydurmamalıdır.",
    requiredSlots: [
      { key: "items", label: "Order items" },
      { key: "fulfillment", label: "Delivery or pickup" },
      { key: "customer_name", label: "Customer name" },
      { key: "customer_phone", label: "Customer phone" },
    ],
    optionalSlots: [{ key: "address", label: "Delivery address" }],
  },
  {
    id: "appointment_booking",
    title: "Appointment booking",
    goal: "Müştəri görüş/qəbul vaxtı istəyir.",
    callerScript:
      "Salam, sabah üçün qəbul vaxtı istəyirəm. Əvvəl uyğun saat olub-olmadığını soruş, sonra qiyməti soruş.",
    expectedOutcome:
      "Agent xidmət, tarix, saat, ad və telefonu toplamalı, real availability uydurmamalıdır.",
    requiredSlots: [
      { key: "service_type", label: "Service" },
      { key: "preferred_date", label: "Preferred date" },
      { key: "preferred_time", label: "Preferred time" },
      { key: "customer_name", label: "Customer name" },
      { key: "customer_phone", label: "Customer phone" },
    ],
    optionalSlots: [{ key: "notes", label: "Notes" }],
  },
  {
    id: "business_faq",
    title: "Business info / FAQ",
    goal: "Müştəri biznes məlumatı soruşur.",
    callerScript:
      "Salam, iş saatınız necədir? Ünvan haradadır? Bir də qiymətlər haqqında məlumat verə bilərsiniz?",
    expectedOutcome:
      "Agent yalnız approved business truth-a əsasən cavab verməli, bilmədiyini uydurmamalıdır.",
    requiredSlots: [{ key: "question_topic", label: "Question topic" }],
    optionalSlots: [{ key: "customer_phone", label: "Customer phone" }],
  },
];

const SCORE_OPTIONS = [1, 2, 3, 4, 5];

const DEFAULT_EVALUATION = {
  language: "unknown",
  naturalness: 3,
  brevity: 3,
  taskCompletion: 3,
  truthfulness: 3,
  handoffSense: 3,
  notes: "",
};

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

function readBrowserVoiceOpeningResponse(payload = {}) {
  const opening =
    payload?.openingResponse &&
    typeof payload.openingResponse === "object" &&
    !Array.isArray(payload.openingResponse)
      ? payload.openingResponse
      : {};

  const instructions = s(opening.instructions);

  return {
    enabled: opening.enabled !== false,
    maxOutputTokens: Math.max(
      40,
      Math.min(240, Number(opening.maxOutputTokens || 140))
    ),
    instructions,
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

function startBrowserVoiceTurnResponse(dc) {
  if (!dc || dc.readyState !== "open") return false;

  dc.send(
    JSON.stringify({
      type: "response.create",
      response: {
        instructions:
          "Cavabı yalnız son istifadəçi sözünə əsasən ver. Approved business truth və session qaydalarına əməl et. Qısa, təbii, telefon resepsionisti kimi danış. Qiymət, mövcudluq və rezervasiya təsdiqi uydurma.",
        max_output_tokens: 180,
      },
    })
  );

  return true;
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

function scoreAverage(evaluation = DEFAULT_EVALUATION) {
  const values = [
    evaluation.naturalness,
    evaluation.brevity,
    evaluation.taskCompletion,
    evaluation.truthfulness,
    evaluation.handoffSense,
  ].map((value) => Number(value || 0));

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 10) / 10;
}

function readinessLabel(score, evaluation = DEFAULT_EVALUATION, missingCount = 0) {
  if (missingCount > 0) return "Missing captured info";
  if (evaluation.language !== "good") return "Not ready";
  if (score >= 4.4) return "Ready for pilot";
  if (score >= 3.8) return "Needs tuning";
  return "Not ready";
}

function buildEmptyCapturedSlots(scenario = {}) {
  return [...(scenario.requiredSlots || []), ...(scenario.optionalSlots || [])].reduce(
    (next, slot) => ({
      ...next,
      [slot.key]: "",
    }),
    {}
  );
}

function missingCapturedSlots(scenario = {}, capturedSlots = {}) {
  return (scenario.requiredSlots || []).filter((slot) => !s(capturedSlots[slot.key]));
}

export default function VoiceLab() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [model, setModel] = useState("");
  const [voice, setVoice] = useState("");
  const [runtimeMeta, setRuntimeMeta] = useState(null);
  const [scenarioId, setScenarioId] = useState("hotel_booking_inquiry");
  const [scenarios, setScenarios] = useState(VOICE_LAB_SCENARIOS);
  const [evaluation, setEvaluation] = useState(DEFAULT_EVALUATION);
  const [capturedSlots, setCapturedSlots] = useState({});
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [events, setEvents] = useState([]);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const responseActiveRef = useRef(false);
  const lastAssistantDoneAtRef = useRef(0);

  const scenario = useMemo(
    () =>
      scenarios.find((item) => item.id === scenarioId) ||
      scenarios[0] ||
      VOICE_LAB_SCENARIOS[0],
    [scenarioId, scenarios]
  );

  const captureSlots = useMemo(
    () => [...(scenario.requiredSlots || []), ...(scenario.optionalSlots || [])],
    [scenario]
  );

  const missingSlots = useMemo(
    () => missingCapturedSlots(scenario, capturedSlots),
    [scenario, capturedSlots]
  );

  const averageScore = scoreAverage(evaluation);
  const readyLabel = readinessLabel(averageScore, evaluation, missingSlots.length);

  const isLive = status === "live";
  const isBusy = !["idle", "live"].includes(status);

  async function loadScenarios() {
    try {
      const nextScenarios = await listVoiceLabScenarios();
      if (Array.isArray(nextScenarios) && nextScenarios.length) {
        setScenarios(nextScenarios);
        setScenarioId((current) =>
          nextScenarios.some((item) => item.id === current)
            ? current
            : nextScenarios[0].id
        );
      }
    } catch {
      setScenarios(VOICE_LAB_SCENARIOS);
    }
  }

  async function loadEvaluationHistory() {
    try {
      const history = await listVoiceLabEvaluations();
      setEvaluationHistory(Array.isArray(history) ? history : []);
    } catch {
      setEvaluationHistory([]);
    }
  }

  function addEvent(event) {
    setEvents((current) => [normalizeLogEvent(event), ...current].slice(0, 8));
  }

  function updateEvaluation(key, value) {
    setEvaluation((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateCapturedSlot(key, value) {
    setCapturedSlots((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetEvaluation() {
    setEvaluation(DEFAULT_EVALUATION);
    setCapturedSlots(buildEmptyCapturedSlots(scenario));
  }

  async function saveEvaluation() {
    setError("");
    setSavingEvaluation(true);

    try {
      const result = await createVoiceLabEvaluation({
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        model,
        voice,
        runtimeApplied: runtimeMeta?.runtimeApplied === true,
        tenantKey: s(runtimeMeta?.tenantKey),
        capturedSlots,
        evaluation,
      });

      if (Array.isArray(result?.evaluations)) {
        setEvaluationHistory(result.evaluations);
      } else {
        await loadEvaluationHistory();
      }
    } catch (err) {
      setError(s(err?.message || err, "Evaluation save alınmadı."));
    } finally {
      setSavingEvaluation(false);
    }
  }

  async function stopLab() {
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
  }

  async function startLab() {
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

      const session = await createVoiceLabSession({
        scenarioId: scenario.id,
        provider: "browser_lab",
        toNumber: "browser_lab",
      });

      setRuntimeMeta({
        runtimeApplied: session?.runtimeApplied === true,
        reasonCode: s(session?.runtimeReasonCode),
        tenantKey: s(session?.tenantKey),
        activeVoiceChannel: session?.activeVoiceChannel || null,
        match: session?.match || null,
      });

      const sessionModel = s(session?.model, "gpt-realtime-2");
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
        addEvent({ type: "browser_voice.connected", text: "Browser voice call connected." });

        try {
          const openingStarted = startBrowserVoiceOpening(dc, session);
          responseActiveRef.current = openingStarted;
          addEvent({
            type: openingStarted
              ? "browser_voice.opening_started"
              : "browser_voice.opening_skipped",
            text: openingStarted
              ? "Backend voice assistant opening started."
              : "No backend opening response was available.",
          });
        } catch (err) {
          responseActiveRef.current = false;
          addEvent({
            type: "browser_voice.opening_failed",
            text: s(err?.message || err),
          });
        }
      };

      dc.onmessage = (message) => {
        let event = null;

        try {
          event = JSON.parse(message.data);
          addEvent(event);
        } catch {
          addEvent({ type: "message", text: message.data });
          return;
        }

        const type = s(event?.type);

        if (type === "response.created") {
          responseActiveRef.current = true;
          return;
        }

        if (
          type === "response.done" ||
          type === "response.cancelled" ||
          type === "response.output_audio.done"
        ) {
          responseActiveRef.current = false;
          lastAssistantDoneAtRef.current = Date.now();
          return;
        }

        if (type === "input_audio_buffer.committed") {
          const sinceAssistantDone = Date.now() - Number(lastAssistantDoneAtRef.current || 0);

          if (responseActiveRef.current || sinceAssistantDone < 1200) {
            return;
          }

          try {
            const started = startBrowserVoiceTurnResponse(dc);
            responseActiveRef.current = started;

            if (started) {
              addEvent({
                type: "browser_voice.turn_response_started",
                text: "Assistant response started after caller turn.",
              });
            }
          } catch (err) {
            responseActiveRef.current = false;
            addEvent({
              type: "browser_voice.turn_response_failed",
              text: s(err?.message || err),
            });
          }
        }
      };

      dc.onerror = () => {      dc.onerror = () => {
        addEvent({ type: "lab.data_channel_error" });
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch(
        "https://api.openai.com/v1/realtime/calls",
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
      setError(s(err?.message || err, "Voice test başlatmaq alınmadı."));
      await stopLab();
    }
  }

  useEffect(() => {
    loadScenarios();
    loadEvaluationHistory();

    return () => {
      stopLab();
    };
  }, []);

  useEffect(() => {
    setCapturedSlots(buildEmptyCapturedSlots(scenario));
  }, [scenario]);

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Internal voice test"
        title="Browser test call"
        description="Real nömrə almadan əvvəl AI resepsionistin danışığını browserdən yoxla."
        actions={
          isLive ? (
            <Button variant="danger" leftIcon={<PhoneOff className="h-4 w-4" />} onClick={stopLab}>
              Stop call
            </Button>
          ) : (
            <Button
              leftIcon={<Mic className="h-4 w-4" />}
              loading={isBusy}
              onClick={startLab}
            >
              Start test call
            </Button>
          )
        }
      />

      <InlineNotice
        tone="info"
        title="Bu product deyil, test telefonudur"
        description="Danışıq beyni backend composer-dən gəlir. Burada prompt yazmırıq; sadəcə agentlə danışıb keyfiyyəti yoxlayırıq."
      />

      {runtimeMeta ? (
        <InlineNotice
          tone={runtimeMeta.runtimeApplied ? "success" : "warning"}
          title={runtimeMeta.runtimeApplied ? "Production runtime applied" : "Fallback runtime"}
          description={
            runtimeMeta.runtimeApplied
              ? "Agent tenant voice runtime və backend composer ilə başladı."
              : `Runtime tətbiq olunmadı: ${s(runtimeMeta.reasonCode, "fallback")}.`
          }
        />
      ) : null}

      {error ? (
        <InlineNotice tone="danger" title="Voice test error" description={error} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <Radio className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">Test call booth</h2>
                <p className="text-sm text-text-muted">Status: {status}</p>
              </div>
            </div>

            <audio ref={remoteAudioRef} autoPlay />

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Test scenario
                </span>
                <select
                  className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                  value={scenarioId}
                  onChange={(event) => setScenarioId(event.target.value)}
                  disabled={isLive || isBusy}
                >
                  {scenarios.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-2xl border border-line-soft bg-surface-subtle px-3 py-2">
                <div className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Voice
                </div>
                <div className="mt-1 text-sm font-semibold text-text">{voice || "runtime"}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-line-soft bg-surface-subtle p-4">
              <div className="text-sm font-semibold text-text">Sən zəng edən müştərini oynayırsan:</div>
              <p className="mt-2 text-sm leading-6 text-text-muted">{scenario.callerScript}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-line-soft bg-white p-4">
              <div className="text-sm font-semibold text-text">Agentdən gözlədiyimiz nəticə:</div>
              <p className="mt-2 text-sm leading-6 text-text-muted">{scenario.expectedOutcome}</p>
            </div>
          </div>

          <div className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <ClipboardCheck className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">Danışıqdan sonra yoxla</h2>
                <p className="text-xs text-text-muted">Agent bu məlumatları real söhbətdə topladımı?</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {captureSlots.length ? (
                captureSlots.map((slot) => (
                  <label key={slot.key} className="block space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                      {(scenario.requiredSlots || []).some((item) => item.key === slot.key)
                        ? "Required"
                        : "Optional"} · {slot.label || slot.key}
                    </span>
                    <input
                      className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                      placeholder="Danışıqdan sonra doldur"
                      value={s(capturedSlots[slot.key])}
                      onChange={(event) => updateCapturedSlot(slot.key, event.target.value)}
                    />
                  </label>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-line-soft p-4 text-sm text-text-muted">
                  Bu scenario üçün capture field yoxdur.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <Star className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">Test result</h2>
                <p className="text-xs text-text-muted">Qulaqla yoxladıqdan sonra qiymətləndir.</p>
              </div>
            </div>

            <InlineNotice
              tone={readyLabel === "Ready for pilot" ? "success" : "warning"}
              title={readyLabel}
              description={`Average score: ${averageScore}/5`}
            />

            <div className="mt-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Language
                </span>
                <select
                  className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                  value={evaluation.language}
                  onChange={(event) => updateEvaluation("language", event.target.value)}
                >
                  <option value="unknown">Not checked</option>
                  <option value="good">Good</option>
                  <option value="mixed">Mixed</option>
                  <option value="bad">Bad</option>
                </select>
              </label>

              {[
                ["naturalness", "Natural speech"],
                ["brevity", "Short answers"],
                ["taskCompletion", "Did the job"],
                ["truthfulness", "No hallucination"],
                ["handoffSense", "Handoff sense"],
              ].map(([key, label]) => (
                <label key={key} className="grid grid-cols-[1fr_92px] items-center gap-3">
                  <span className="text-sm text-text-muted">{label}</span>
                  <select
                    className="rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                    value={evaluation[key]}
                    onChange={(event) => updateEvaluation(key, Number(event.target.value))}
                  >
                    {SCORE_OPTIONS.map((score) => (
                      <option key={score} value={score}>
                        {score}/5
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <textarea
                className="min-h-[90px] w-full resize-y rounded-2xl border border-line-soft bg-white px-3 py-3 text-sm leading-6 text-text outline-none focus:border-text"
                placeholder="Nə yaxşı idi, nə pis idi, nəyi dəyişək?"
                value={evaluation.notes}
                onChange={(event) => updateEvaluation("notes", event.target.value)}
              />

              <div className="grid gap-2 sm:grid-cols-2">
                <Button loading={savingEvaluation} onClick={saveEvaluation}>
                  Save result
                </Button>
                <Button variant="secondary" onClick={resetEvaluation}>
                  Reset
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <ShieldCheck className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">Latest results</h2>
                <p className="text-xs text-text-muted">Son saxlanmış testlər.</p>
              </div>
            </div>

            <div className="space-y-2">
              {evaluationHistory.length ? (
                evaluationHistory.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-line-soft bg-surface-subtle p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold text-text">{s(item.scenarioTitle, item.scenarioId)}</div>
                      <div className="text-xs font-semibold text-text-muted">{item.averageScore}/5</div>
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      {s(item.report?.title || item.readiness).replace(/_/g, " ")}
                    </div>
                    <div className="mt-1 text-xs text-text-muted">
                      Capture: {item.captureSummary?.complete ? "complete" : "missing fields"}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-line-soft p-4 text-sm text-text-muted">
                  Hələ saxlanmış test nəticəsi yoxdur.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <Radio className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">Connection log</h2>
                <p className="text-xs text-text-muted">Sadəcə texniki connection statusu.</p>
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
                  Start test call etdikdən sonra statuslar burada görünəcək.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </PageCanvas>
  );
}
