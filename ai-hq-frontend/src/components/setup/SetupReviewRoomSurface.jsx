import { normalizeSetupReviewRoom } from "../../lib/setupReviewRoom.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function compactText(value = "", max = 140) {
  const text = s(value).replace(/\s+/g, " ");
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function statusLabel(value = "") {
  return s(value, "pending").replace(/_/g, " ");
}

function sourceQualityLabel(value = "") {
  const key = lower(value);
  if (key === "strong") return "Yüksək";
  if (key === "partial") return "Qismən";
  if (key === "conflicting") return "Ziddiyyət var";
  if (key === "missing") return "Mənbə yoxdur";
  return statusLabel(value);
}

function sourceTypeLabel(value = "") {
  const key = lower(value);
  if (key === "website") return "Website";
  if (key === "google_maps") return "Google Maps";
  if (key === "instagram") return "Instagram";
  if (key === "facebook") return "Facebook";
  if (key === "manual") return "Manual brief";
  return "Mənbə";
}

function decisionLabel(value = "") {
  const key = lower(value);
  if (key === "approve_truth") return "Təsdiqə hazır";
  if (key === "answer_missing_facts") return "Məlumat çatışır";
  if (key === "resolve_conflicts") return "Ziddiyyət həll olunmalıdır";
  if (key === "review_or_continue") return "Yoxlama mərhələsi";
  if (key === "clarify_input") return "Dəqiqləşdirmə lazımdır";
  return "Setup davam edir";
}

function buildTruthRows(room = {}) {
  const details = arr(room.sectionDetails);

  if (details.length) {
    return details.map((section) => {
      const facts = arr(section.facts)
        .map((fact) => ({
          key: s(fact.key || fact.label),
          label: s(fact.label || fact.key),
          value: compactText(fact.value, 180),
          verified: section.sourceBacked === true,
        }))
        .filter((fact) => fact.key && fact.value);

      const items = arr(section.items)
        .map((item) => compactText(item, 110))
        .filter(Boolean);

      return {
        key: s(section.key || section.title),
        label: s(section.title || section.label || section.key),
        status: s(section.status),
        sourceBacked: section.sourceBacked === true,
        facts,
        items,
      };
    });
  }

  return arr(room.sections).map((section) => ({
    key: s(section.key),
    label: s(section.label || section.key),
    status: s(section.status),
    sourceBacked: section.sourceBacked === true,
    facts: [],
    items: [],
  }));
}

function buildMissingFacts(room = {}) {
  const brain = obj(room.brain);
  const missingPlan = obj(brain.missingFactsPlan);
  const missingSections = arr(missingPlan.missingSections)
    .map((item) => s(item))
    .filter(Boolean);

  const blocking = arr(room.issues)
    .filter((issue) => s(issue.severity) === "blocking")
    .map((issue) => ({
      key: s(issue.id || issue.section || issue.message),
      label: s(issue.section || issue.type || "missing"),
      body: s(issue.message),
    }))
    .filter((item) => item.key || item.body);

  if (blocking.length) return blocking;

  return missingSections.map((key) => ({
    key,
    label: statusLabel(key),
    body:
      s(missingPlan.nextQuestion?.prompt) && key === s(missingPlan.nextQuestionKey)
        ? s(missingPlan.nextQuestion.prompt)
        : "Bu məlumat təsdiqdən əvvəl tamamlanmalıdır.",
  }));
}

function buildRuntimeRows(room = {}) {
  const brainRows = arr(obj(obj(room.brain).runtimeSimulation).afterApproval);
  if (brainRows.length) {
    return brainRows.map((surface) => ({
      key: s(surface.key),
      label: s(surface.label || surface.key),
      state: s(surface.state),
      authority: s(surface.authority),
    }));
  }

  return arr(obj(room.runtimeConsumers).consumers).map((consumer) => ({
    key: s(consumer.key),
    label: s(consumer.label || consumer.key),
    state: s(consumer.currentState),
    authority: s(obj(room.runtimeConsumers).authority || room.runtimeAuthority),
  }));
}

function buildPreviewFacts(room = {}) {
  const rows = buildTruthRows(room);
  const flat = [];

  for (const row of rows) {
    for (const fact of arr(row.facts)) {
      if (fact.value) flat.push({ label: fact.label, value: fact.value });
    }

    if (!arr(row.facts).length && arr(row.items).length) {
      flat.push({
        label: row.label,
        value: row.items.slice(0, 3).join(", "),
      });
    }
  }

  return flat.slice(0, 4);
}

const SOURCE_OPTIONS = [
  {
    id: "website",
    label: "Website",
    hint: "URL",
    placeholder: "https://medhouse.az",
  },
  {
    id: "google_maps",
    label: "Google Maps",
    hint: "Biznes profili",
    placeholder: "Google Maps linki",
  },
  {
    id: "instagram",
    label: "Instagram",
    hint: "Profil",
    placeholder: "@medhouse.klinika və ya profil linki",
  },
  {
    id: "manual",
    label: "Manual brief",
    hint: "Qısa izah",
    placeholder: "Biznes nə edir, xidmətləri və əlaqə məlumatları...",
  },
];

export default function SetupReviewRoomSurface({
  reviewRoom = {},
  sourceValue = "",
  sourceType = "website",
  sourceBusy = false,
  sourceStatus = "",
  onSourceTypeChange = () => {},
  onSourceValueChange = () => {},
  onSubmitSource = () => {},
  onAction = () => {},
}) {
  const room = normalizeSetupReviewRoom(reviewRoom);
  const brain = obj(room.brain);
  const hasBrain = Number(brain.version || 0) > 0;
  const decision = obj(brain.decisionPlan);
  const source = obj(brain.sourceIntelligence);
  const completion = obj(brain.sectionCompletion);
  const missingFacts = buildMissingFacts(room);
  const truthRows = buildTruthRows(room);
  const runtimeRows = buildRuntimeRows(room);
  const previewFacts = buildPreviewFacts(room);
  const primaryAction = obj(room.actions.primary);
  const approvalPreview = obj(room.approvalPreview);
  const publishItems = arr(approvalPreview.publishes);
  const excludedItems = arr(approvalPreview.excludedFromTruth);
  const activeSource = SOURCE_OPTIONS.find((item) => item.id === sourceType) || SOURCE_OPTIONS[0];

  const readyForApproval =
    primaryAction.enabled === true &&
    (s(primaryAction.id).includes("approve") ||
      s(primaryAction.intent).includes("finalize") ||
      approvalPreview.canApprove === true);

  return (
    <section
      aria-label="Business setup workspace"
      className="min-h-full bg-white text-slate-950"
    >
      <div className="grid min-h-full gap-0 xl:grid-cols-[minmax(0,1fr)_390px]">
        <main className="min-w-0 border-r border-slate-100">
          <div className="border-b border-slate-100 px-7 py-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Business setup
                </p>
                <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.055em] text-slate-950">
                  Biznesini AI üçün tanıdaq
                </h1>
                <p className="mt-2 max-w-[720px] text-[14px] leading-7 text-slate-600">
                  Mənbə əlavə et. Sistem faktları çıxarsın, çatışmayanları göstərsin və yalnız təsdiqdən sonra AI-larda istifadə etsin.
                </p>
              </div>

              <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-semibold text-slate-700">
                {hasBrain ? decisionLabel(decision.operatorDecision) : "Mənbə gözləyir"}
              </div>
            </div>
          </div>

          <div className="px-7 py-6">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitSource();
              }}
              className="rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfcfe)] p-5 shadow-[0_18px_50px_rgba(15,23,42,0.05)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-[-0.035em] text-slate-950">
                    1. Mənbə əlavə et
                  </h2>
                  <p className="mt-1 text-[13px] leading-6 text-slate-600">
                    Website, profil linki və ya qısa izah ver. Setup sual-cavab yox, mənbədən başlasın.
                  </p>
                </div>

                {sourceStatus ? (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
                    {sourceStatus}
                  </span>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {SOURCE_OPTIONS.map((option) => {
                  const active = option.id === sourceType;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => onSourceTypeChange(option.id)}
                      className={`rounded-[18px] border px-4 py-3 text-left transition ${
                        active
                          ? "border-emerald-500 bg-emerald-50 text-slate-950"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-[13px] font-semibold">{option.label}</div>
                      <div className="mt-1 text-[12px] text-slate-500">{option.hint}</div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                {sourceType === "manual" ? (
                  <textarea
                    rows={3}
                    value={sourceValue}
                    onChange={(event) => onSourceValueChange(event.target.value)}
                    placeholder={activeSource.placeholder}
                    className="min-h-[88px] flex-1 resize-none border-0 px-4 py-3 text-[14px] outline-none placeholder:text-slate-400"
                  />
                ) : (
                  <input
                    value={sourceValue}
                    onChange={(event) => onSourceValueChange(event.target.value)}
                    placeholder={activeSource.placeholder}
                    className="h-12 flex-1 border-0 px-4 text-[14px] outline-none placeholder:text-slate-400"
                  />
                )}

                <button
                  type="submit"
                  disabled={!s(sourceValue) || sourceBusy}
                  className="min-w-[150px] bg-slate-950 px-5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {sourceBusy ? "Oxunur..." : sourceType === "manual" ? "Əlavə et" : "Oxumağa başla"}
                </button>
              </div>
            </form>

            <div className="mt-5 grid gap-4 md:grid-cols-4">
              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Mənbə
                </p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.04em]">
                  {hasBrain ? sourceQualityLabel(source.quality) : "Gözləyir"}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {Number(source.evidenceCount || 0)} sübut elementi
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Tamlıq
                </p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.04em]">
                  {Number(completion.percent || 0)}%
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Faktlar hazırlanır
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Çatışmayan
                </p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.04em]">
                  {missingFacts.length}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  Lazım olan suallar
                </p>
              </div>

              <div className="rounded-[20px] border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Növbəti
                </p>
                <p className="mt-2 text-[18px] font-semibold tracking-[-0.04em]">
                  {readyForApproval ? "Təsdiq" : missingFacts.length ? "Tamamla" : "Review"}
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {decision.reason || "Sistem vəziyyəti yoxlayır"}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[26px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.04)]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                  <h2 className="text-[17px] font-semibold tracking-[-0.035em]">
                    2. Tapılan biznes faktları
                  </h2>
                  <p className="mt-1 text-[13px] text-slate-500">
                    Bunlar təsdiq üçün hazırlanır. Lazım olsa düzəliş əlavə et.
                  </p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-[12px] font-semibold text-slate-600">
                  {truthRows.length} bölmə
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {truthRows.length ? (
                  truthRows.map((row) => (
                    <div key={row.key || row.label} className="grid gap-4 px-5 py-4 lg:grid-cols-[180px_minmax(0,1fr)_120px]">
                      <div>
                        <p className="text-[13px] font-semibold text-slate-950">{row.label}</p>
                        <p className="mt-1 text-[12px] text-slate-500">
                          {row.sourceBacked ? "Mənbə ilə dəstəklənir" : "Yoxlanmalıdır"}
                        </p>
                      </div>

                      <div className="min-w-0">
                        {arr(row.facts).length ? (
                          <div className="grid gap-2 sm:grid-cols-2">
                            {row.facts.map((fact) => (
                              <div key={fact.key} className="rounded-[14px] bg-slate-50 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                                  {fact.label}
                                </p>
                                <p className="mt-1 text-[13px] leading-5 text-slate-900">
                                  {fact.value}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : arr(row.items).length ? (
                          <div className="flex flex-wrap gap-2">
                            {row.items.map((item) => (
                              <span key={item} className="rounded-full bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-700">
                                {item}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[13px] text-slate-500">Hələ məlumat yoxdur.</p>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                          {statusLabel(row.status)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-5 py-12 text-center">
                    <p className="text-[15px] font-semibold text-slate-950">
                      Hələ fakt çıxarılmayıb
                    </p>
                    <p className="mt-2 text-[13px] text-slate-500">
                      Yuxarıdan website, profil və ya manual brief əlavə et.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <aside className="min-w-0 bg-slate-50/70 px-5 py-6">
          <div className="sticky top-5 grid gap-4">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    3. Təsdiq
                  </p>
                  <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.045em]">
                    {readyForApproval ? "Truth hazırdır" : "Hələ tamamlanır"}
                  </h2>
                  <p className="mt-2 text-[13px] leading-6 text-slate-600">
                    Təsdiqdən əvvəl draft müştəriyə cavab vermir. Runtime yalnız approved truth istifadə edir.
                  </p>
                </div>
              </div>

              {publishItems.length ? (
                <div className="mt-4 rounded-[18px] bg-slate-50 p-3">
                  <p className="text-[12px] font-semibold text-slate-700">
                    Truth-a gedəcək
                  </p>
                  <div className="mt-2 grid gap-2">
                    {publishItems.slice(0, 4).map((item) => (
                      <div key={s(item.key || item.label)} className="text-[12px] leading-5 text-slate-600">
                        <span className="font-semibold text-slate-900">{s(item.label || item.key)}:</span>{" "}
                        {compactText(item.summary, 90)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                disabled={!primaryAction.enabled}
                onClick={() => onAction(primaryAction)}
                className={`mt-4 flex h-11 w-full items-center justify-center rounded-[14px] text-[13px] font-semibold transition ${
                  primaryAction.enabled
                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {primaryAction.label || "Təsdiq üçün hazır deyil"}
              </button>

              {excludedItems.length ? (
                <p className="mt-3 text-[12px] leading-5 text-slate-500">
                  Truth-a düşməyəcək: {excludedItems.slice(0, 3).map(statusLabel).join(", ")}
                </p>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Çatışmayanlar
              </p>

              <div className="mt-3 grid gap-2">
                {missingFacts.length ? (
                  missingFacts.map((item) => (
                    <div key={item.key || item.body} className="rounded-[16px] bg-amber-50 px-3 py-3">
                      <p className="text-[13px] font-semibold text-slate-950">
                        {statusLabel(item.label)}
                      </p>
                      <p className="mt-1 text-[12px] leading-5 text-slate-600">
                        {item.body}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[16px] bg-emerald-50 px-3 py-3">
                    <p className="text-[13px] font-semibold text-emerald-800">
                      Kritik boşluq görünmür
                    </p>
                    <p className="mt-1 text-[12px] leading-5 text-emerald-700">
                      İndi faktları yoxlayıb təsdiq edə bilərsən.
                    </p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Canlı preview
              </p>

              <div className="mt-4 rounded-[22px] bg-slate-950 p-4 text-white">
                <p className="text-[12px] text-slate-400">Müştəri soruşur</p>
                <p className="mt-1 text-[14px] font-semibold">
                  “Xidmətlər və əlaqə məlumatı nədir?”
                </p>

                <div className="mt-4 rounded-[18px] bg-white/10 p-3">
                  <p className="text-[12px] text-slate-300">AI cavabı yalnız təsdiqli truth-dan gələcək:</p>
                  <div className="mt-2 grid gap-2">
                    {previewFacts.length ? (
                      previewFacts.map((fact) => (
                        <p key={`${fact.label}-${fact.value}`} className="text-[12px] leading-5 text-white">
                          <span className="text-slate-400">{fact.label}:</span>{" "}
                          {fact.value}
                        </p>
                      ))
                    ) : (
                      <p className="text-[12px] leading-5 text-slate-300">
                        Mənbə əlavə edildikdən sonra preview burada görünəcək.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Aktiv olacaq sistemlər
              </p>

              <div className="mt-3 grid gap-2">
                {runtimeRows.length ? (
                  runtimeRows.map((item) => (
                    <div key={item.key} className="flex items-center justify-between gap-3 rounded-[14px] bg-slate-50 px-3 py-2.5">
                      <span className="text-[13px] font-semibold text-slate-900">
                        {item.label}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {statusLabel(item.state)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] leading-6 text-slate-500">
                    Widget, inbox, voice və automation readiness təsdiqdən sonra görünəcək.
                  </p>
                )}
              </div>
            </section>
          </div>
        </aside>
      </div>
    </section>
  );
}
