export const BROWSER_VOICE_EVALUATION_SCENARIOS = [
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

export const SCORE_OPTIONS = [1, 2, 3, 4, 5];

export const DEFAULT_EVALUATION = {
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

export function scoreAverage(evaluation = DEFAULT_EVALUATION) {
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

export function readinessLabel(score, evaluation = DEFAULT_EVALUATION, missingCount = 0) {
  if (missingCount > 0) return "Missing captured info";
  if (evaluation.language !== "good") return "Not ready";
  if (score >= 4.4) return "Ready for pilot";
  if (score >= 3.8) return "Needs tuning";
  return "Not ready";
}

export function buildEmptyCapturedSlots(scenario = {}) {
  return [...(scenario.requiredSlots || []), ...(scenario.optionalSlots || [])].reduce(
    (next, slot) => ({
      ...next,
      [slot.key]: "",
    }),
    {}
  );
}

export function missingCapturedSlots(scenario = {}, capturedSlots = {}) {
  return (scenario.requiredSlots || []).filter((slot) => !s(capturedSlots[slot.key]));
}
