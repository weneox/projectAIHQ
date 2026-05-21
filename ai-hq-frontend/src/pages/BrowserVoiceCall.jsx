import {
  ClipboardCheck,
  Mic,
  PhoneOff,
  Radio,
  ShieldCheck,
  Star,
} from "lucide-react";

import useBrowserVoiceCall from "./hooks/useBrowserVoiceCall.js";
import useBrowserVoiceEvaluation from "./hooks/useBrowserVoiceEvaluation.js";
import Button from "../components/ui/Button.jsx";
import {
  InlineNotice,
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { SCORE_OPTIONS } from "./voice/browserVoiceEvaluation.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

export default function BrowserVoiceCall() {
  const {
    status,
    error: callError,
    model,
    voice,
    runtimeMeta,
    events,
    remoteAudioRef,
    startCall,
    stopCall,
  } = useBrowserVoiceCall();

  const {
    scenarioId,
    setScenarioId,
    scenarios,
    scenario,
    evaluation,
    updateEvaluation,
    capturedSlots,
    updateCapturedSlot,
    captureSlots,
    averageScore,
    readyLabel,
    evaluationHistory,
    savingEvaluation,
    saveEvaluation,
    resetEvaluation,
    evaluationError,
  } = useBrowserVoiceEvaluation({ model, voice, runtimeMeta });

  const error = callError || evaluationError;
  const isLive = status === "live";
  const isBusy = !["idle", "live"].includes(status);

  return (
    <PageCanvas>
      <PageHeader
        eyebrow="Browser voice call"
        title="Browser voice call"
        description="SIP/Twilio qoşulmamışdan əvvəl real voice engine-i browser audio ilə yoxla."
        actions={
          isLive ? (
            <Button variant="danger" leftIcon={<PhoneOff className="h-4 w-4" />} onClick={stopCall}>
              Stop call
            </Button>
          ) : (
            <Button
              leftIcon={<Mic className="h-4 w-4" />}
              loading={isBusy}
              onClick={startCall}
            >
              Start browser call
            </Button>
          )
        }
      />

      <InlineNotice
        tone="info"
        title="Browser call adapter"
        description="Danışıq beyni backend voice engine-dən gəlir. Browser sadəcə SIP/Twilio gələnə qədər müvəqqəti audio transportdur."
      />

      {runtimeMeta ? (
        <InlineNotice
          tone={runtimeMeta.runtimeApplied ? "success" : "warning"}
          title={runtimeMeta.runtimeApplied ? "Production runtime applied" : "Fallback runtime"}
          description={
            runtimeMeta.runtimeApplied
              ? "Agent tenant voice runtime və backend voice engine ilə başladı."
              : `Runtime tətbiq olunmadı: ${s(runtimeMeta.reasonCode, "fallback")}.`
          }
        />
      ) : null}

      {error ? (
        <InlineNotice tone="danger" title="Browser voice error" description={error} />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className="rounded-[28px] border border-line-soft bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-soft bg-surface-subtle">
                <Radio className="h-5 w-5 text-text" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text">Browser call booth</h2>
                <p className="text-sm text-text-muted">Status: {status}</p>
              </div>
            </div>

            <audio ref={remoteAudioRef} autoPlay />

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
              <label className="space-y-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-text-subtle">
                  Evaluation scenario
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
              <div className="text-sm font-semibold text-text">Evaluation scenario:</div>
              <p className="mt-2 text-sm leading-6 text-text-muted">{scenario.callerScript}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-line-soft bg-white p-4">
              <div className="text-sm font-semibold text-text">Evaluation expectation:</div>
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
                  Start browser call etdikdən sonra statuslar burada görünəcək.
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </PageCanvas>
  );
}
