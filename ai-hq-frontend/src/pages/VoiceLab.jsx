import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardCheck,
  Mic,
  PhoneOff,
  Radio,
  ShieldCheck,
  Star,
  Wand2,
} from "lucide-react";

import {
  createVoiceLabEvaluation,
  createVoiceLabSession,
  listVoiceLabEvaluations,
} from "../api/voice.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";

const DEFAULT_INSTRUCTIONS =
  "You are a premium business receptionist. Speak naturally and calmly. Keep answers short. Ask one question at a time. If the user asks about services, pricing, booking, address, or contact, answer clearly. If unsure, ask a short clarifying question.";

const VOICE_LAB_SCENARIOS = [
  {
    id: "restaurant_order",
    title: "Restaurant order",
    goal: "Müştəri sifariş vermək istəyir.",
    prompt:
      "Act as a restaurant order assistant. Ask for order items, delivery or pickup, name, phone, address when needed, and confirm the order briefly.",
    checklist: [
      "Sifarişi aydın topladı",
      "Bir dəfəyə bir sual verdi",
      "Ünvan/telefonu qarışdırmadı",
      "Sonda sifarişi təsdiqlədi",
    ],
  },
  {
    id: "clinic_booking",
    title: "Clinic booking",
    goal: "Müştəri qəbul vaxtı bron etmək istəyir.",
    prompt:
      "Act as a clinic receptionist. Ask what service is needed, preferred day/time, patient name and phone. Do not invent unavailable doctors or prices.",
    checklist: [
      "Xidmət növünü soruşdu",
      "Tarix/saatı dəqiqləşdirdi",
      "Ad və telefonu topladı",
      "Yalan məlumat uydurmadı",
    ],
  },
  {
    id: "support_triage",
    title: "Support triage",
    goal: "Müştəri problem bildirir.",
    prompt:
      "Act as a support receptionist. Identify the issue, ask one clarifying question, summarize the case, and offer operator handoff if needed.",
    checklist: [
      "Problemi düzgün anladı",
      "Qısa follow-up sualı verdi",
      "Case summary yaratdı",
      "Handoff məntiqi düzgün idi",
    ],
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

function readinessLabel(score, evaluation = DEFAULT_EVALUATION) {
  if (evaluation.language !== "good") return "Not ready";
  if (score >= 4.4) return "Ready for pilot";
  if (score >= 3.8) return "Needs one more tuning pass";
  return "Not ready";
}

export default function VoiceLab() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [model, setModel] = useState("gpt-4o-realtime-preview");
  const [voice, setVoice] = useState("alloy");
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS);
  const [useTenantRuntime, setUseTenantRuntime] = useState(true);
  const [runtimeMeta, setRuntimeMeta] = useState(null);
  const [scenarioId, setScenarioId] = useState("restaurant_order");
  const [evaluation, setEvaluation] = useState(DEFAULT_EVALUATION);
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [events, setEvents] = useState([]);

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const scenario = useMemo(
    () =>
      VOICE_LAB_SCENARIOS.find((item) => item.id === scenarioId) ||
      VOICE_LAB_SCENARIOS[0],
    [scenarioId]
  );

  const averageScore = scoreAverage(evaluation);
  const readyLabel = readinessLabel(averageScore, evaluation);

  async function loadEvaluationHistory() {
    try {
      const history = await listVoiceLabEvaluations();
      setEvaluationHistory(Array.isArray(history) ? history : []);
    } catch {
      setEvaluationHistory([]);
    }
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

  function addEvent(event) {
    setEvents((current) => [normalizeLogEvent(event), ...current].slice(0, 12));
  }

  function updateEvaluation(key, value) {
    setEvaluation((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyScenarioPrompt() {
    setInstructions(`${DEFAULT_INSTRUCTIONS}\n\nScenario: ${scenario.title}. ${scenario.prompt}`);
  }

  function resetEvaluation() {
    setEvaluation(DEFAULT_EVALUATION);
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

      const scenarioInstructions = [
        instructions,
        `Test scenario: ${scenario.title}.`,
        scenario.goal,
        scenario.prompt,
        "Evaluation priority: natural speech, short answers, one question at a time, no invented facts.",
      ]
        .filter(Boolean)
        .join("\n");

      const session = await createVoiceLabSession({
        model,
        voice,
        instructions: scenarioInstructions,
        useTenantRuntime,
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

      const sessionModel = s(session?.model, model);
      const sessionVoice = s(session?.voice, voice);

      if (sessionModel && sessionModel !== model) {
        setModel(sessionModel);
      }

      if (sessionVoice && sessionVoice !== voice) {
        setVoice(sessionVoice);
      }

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
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(sessionModel)}`,
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
    loadEvaluationHistory();

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
        description="SIP və real nömrə almadan əvvəl agentin danışıq keyfiyyətini, prompt davranışını və biznes flow-u test et."
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
        title="Əsas qayda"
        description="Hələ SIP nömrə almırıq. Əvvəl Browser Lab-da agentin danışığı qane etməlidir; yalnız sonra real nömrə və SIP mərhələsinə keçirik."
      />

      {runtimeMeta ? (
        <InlineNotice
          tone={runtimeMeta.runtimeApplied ? "info" : "warning"}
          title={runtimeMeta.runtimeApplied ? "Tenant runtime applied" : "Manual fallback mode"}
          description={
            runtimeMeta.runtimeApplied
              ? "Voice Lab tenant config ilə başladı. Channel: " +
                s(runtimeMeta.activeVoiceChannel?.id, "default") +
                "."
              : "Tenant runtime tətbiq olunmadı: " +
                s(runtimeMeta.reasonCode, "manual fallback") +
                "."
          }
        />
      ) : null}

      {error ? (
        <InlineNotice tone="danger" title="Voice Lab error" description={error} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
        <section className="space-y-4">
          <div className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <Wand2 className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">Test scenario</h2>
                <p className="text-sm text-text-muted">Agentin real biznes flow-u aparmasını yoxla.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Scenario
                </span>
                <select
                  className="w-full rounded-2xl border border-line-soft bg-white px-3 py-2 text-sm text-text outline-none focus:border-text"
                  value={scenarioId}
                  onChange={(event) => setScenarioId(event.target.value)}
                  disabled={isLive || isBusy}
                >
                  {VOICE_LAB_SCENARIOS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                variant="secondary"
                leftIcon={<ClipboardCheck className="h-4 w-4" />}
                onClick={applyScenarioPrompt}
                disabled={isLive || isBusy}
              >
                Apply prompt
              </Button>
            </div>

            <div className="mt-4 rounded-2xl border border-line-soft bg-surface-subtle p-4">
              <div className="text-sm font-semibold text-text">{scenario.goal}</div>
              <ul className="mt-2 space-y-1 text-sm leading-6 text-text-muted">
                {scenario.checklist.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
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

            <label className="mb-4 flex items-start gap-3 rounded-2xl border border-line-soft bg-surface-subtle p-3 text-sm text-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={useTenantRuntime}
                onChange={(event) => setUseTenantRuntime(event.target.checked)}
                disabled={isLive || isBusy}
              />
              <span>
                <span className="block font-semibold">Use tenant voice runtime</span>
                <span className="block text-xs leading-5 text-text-muted">
                  Enabled olanda lab tenant voice config/prompt/channel metadata istifadə edir,
                  alınmasa manual prompt-a fallback edir.
                </span>
              </span>
            </label>

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
                {useTenantRuntime ? "Fallback / override prompt" : "Test prompt"}
              </span>
              <textarea
                className="min-h-[180px] w-full resize-y rounded-2xl border border-line-soft bg-white px-3 py-3 text-sm leading-6 text-text outline-none focus:border-text"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                disabled={isLive || isBusy}
              />
            </label>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <Star className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">Evaluation scorecard</h2>
                <p className="text-xs text-text-muted">Real nömrəyə keçməzdən əvvəl qərar.</p>
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
                ["taskCompletion", "Task completion"],
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

              <label className="block space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Notes
                </span>
                <textarea
                  className="min-h-[100px] w-full resize-y rounded-2xl border border-line-soft bg-white px-3 py-3 text-sm leading-6 text-text outline-none focus:border-text"
                  placeholder="Nə yaxşı idi, nə pis idi, nəyi dəyişək?"
                  value={evaluation.notes}
                  onChange={(event) => updateEvaluation("notes", event.target.value)}
                />
              </label>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button loading={savingEvaluation} onClick={saveEvaluation}>
                  Save evaluation
                </Button>
                <Button variant="secondary" onClick={resetEvaluation}>
                  Reset scorecard
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <ClipboardCheck className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">Evaluation history</h2>
                <p className="text-xs text-text-muted">Son saxlanmış lab nəticələri.</p>
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
                      {s(item.readiness).replace(/_/g, " ")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-line-soft p-4 text-sm text-text-muted">
                  Hələ saxlanmış evaluation yoxdur.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
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
          </section>
        </aside>
      </div>
    </PageCanvas>
  );
}
