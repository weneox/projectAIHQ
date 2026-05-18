import { useMemo, useState } from "react";
import SetupReviewRoomSurface from "./SetupReviewRoomSurface.jsx";
import { resolveSetupSourceInput } from "./setupSourceIntake.js";

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

function pickReviewRoom(reviewPayload = {}) {
  const root = obj(reviewPayload);
  return (
    obj(obj(root.setup).reviewRoom) ||
    obj(root.reviewRoom) ||
    obj(obj(root.review).reviewRoom) ||
    {}
  );
}

function assistantState(assistant = {}) {
  const root = obj(assistant);
  return obj(root.assistant || root);
}

function activeMissingQuestion(reviewRoom = {}, assistant = {}) {
  const brain = obj(reviewRoom.brain);
  const missing = obj(brain.missingFactsPlan);
  const brainQuestion = obj(missing.nextQuestion);

  if (s(brainQuestion.key || brainQuestion.action || brainQuestion.prompt)) {
    return {
      key: lower(brainQuestion.key || missing.nextQuestionKey),
      step: lower(brainQuestion.key || missing.nextQuestionKey || "company"),
      prompt: s(brainQuestion.prompt),
    };
  }

  const state = assistantState(assistant);
  const question = obj(state.nextQuestion);

  return {
    key: lower(question.key || question.step || "company"),
    step: lower(question.step || question.key || "company"),
    prompt: s(question.prompt),
  };
}

function hasAnySetupState(reviewRoom = {}, assistant = {}) {
  const state = assistantState(assistant);
  const session = obj(assistant).session;

  return Boolean(
    Object.keys(obj(reviewRoom)).length ||
      s(session?.id) ||
      s(state.message || state.assistantMessage) ||
      arr(state.sections).length ||
      Object.keys(obj(state.draft)).length ||
      Object.keys(obj(state.reviewDraft)).length
  );
}

function resolveTypedSourceInput(value = "") {
  const text = s(value);
  const auto = resolveSetupSourceInput(text);

  return {
    ...auto,
    value: auto.value || text,
  };
}

function buildFallbackReviewRoom({ reviewRoom = {}, assistant = {} } = {}) {
  if (Object.keys(obj(reviewRoom)).length) return reviewRoom;

  const state = assistantState(assistant);
  const sections = arr(state.sections);

  return {
    runtimeAuthority: "approved_truth",
    header: {
      title: "Biznesini AI üçün tanıdaq",
      subtitle:
        "Website, Google Maps, Instagram və ya qısa izah əlavə et. Sistem faktları çıxarıb təsdiq üçün göstərəcək.",
      statusLabel: hasAnySetupState(reviewRoom, assistant)
        ? "Hazırlanır"
        : "Mənbə gözləyir",
      badgeTone: "neutral",
      trustNote:
        "Təsdiqlənməmiş draft müştəriyə cavab vermir. Runtime yalnız approved truth istifadə edir.",
    },
    sections,
    sectionDetails: [],
    issues: arr(state.confirmationBlockers).map((item, index) => ({
      id: `blocker-${index}`,
      severity: "blocking",
      section: s(item.suggestedField || item.field || "missing"),
      message: s(item.reason || item.message || item.input),
    })),
    actions: {
      primary: {
        id: state.readyForApproval ? "approve_and_publish_truth" : "add_business_input",
        label: state.readyForApproval ? "Təsdiqlə" : "Mənbə və ya məlumat əlavə et",
        intent: state.readyForApproval ? "finalize_review" : "continue_setup",
        enabled: true,
      },
    },
    runtimeConsumers: {
      consumers: [],
    },
    brain: {
      version: 0,
      sourceIntelligence: {
        quality: "missing",
        evidenceCount: 0,
      },
      sectionCompletion: {
        percent: 0,
      },
      missingFactsPlan: {
        required: true,
        missingSections: [],
      },
      conflictPlan: {
        hasConflicts: false,
      },
      decisionPlan: {
        operatorDecision: "add_business_input",
        reason: "Mənbə əlavə et ki, sistem biznes faktlarını çıxarsın.",
      },
      runtimeSimulation: {
        canActivateAfterApproval: false,
      },
    },
  };
}

export default function SetupReviewRoomShell({
  assistant = {},
  reviewPayload = null,
  saving = false,
  finalizing = false,
  capturingSource = false,
  errorMessage = "",
  onParseMessage,
  onFinalize,
  onStartSetup,
}) {
  const [sourceValue, setSourceValue] = useState("");
  const [localStatus, setLocalStatus] = useState("");

  const rawReviewRoom = useMemo(
    () => pickReviewRoom(reviewPayload),
    [reviewPayload]
  );

  const reviewRoom = useMemo(
    () =>
      buildFallbackReviewRoom({
        reviewRoom: rawReviewRoom,
        assistant,
      }),
    [rawReviewRoom, assistant]
  );

  const activeQuestion = useMemo(
    () => activeMissingQuestion(reviewRoom, assistant),
    [reviewRoom, assistant]
  );

  const busy = saving || finalizing || capturingSource;
  const sourceBusy = busy;

  async function handleSubmitSource() {
    const text = s(sourceValue);
    if (!text || busy) return;

    const resolvedSource = resolveTypedSourceInput(text);
    const isSourceImport = resolvedSource.isImportedSource === true;

    setLocalStatus(isSourceImport ? "Biznes məlumatları oxunur" : "");

    try {
      await onStartSetup?.();

      await onParseMessage?.({
        text,
        step: isSourceImport
          ? "source"
          : s(activeQuestion.step || activeQuestion.key || "company"),
        source: resolvedSource,
      });

      setSourceValue("");
      setLocalStatus("");
    } catch {
      setLocalStatus("");
    }
  }

  async function handleAction(action = {}) {
    const id = s(action.id || action.action);
    const intent = s(action.intent);

    if (busy || action.enabled === false) return;

    if (id === "approve_and_publish_truth" || intent === "finalize_review") {
      await onFinalize?.();
      return;
    }

    setLocalStatus(
      activeQuestion.prompt ||
        "Çatışmayan məlumatı mənbə inputuna yaz və əlavə et."
    );
  }

  return (
    <div className="min-h-full bg-white">
      <SetupReviewRoomSurface
        reviewRoom={reviewRoom}
        sourceValue={sourceValue}
        sourceBusy={sourceBusy}
        sourceStatus={errorMessage || localStatus}
        onSourceValueChange={setSourceValue}
        onSubmitSource={handleSubmitSource}
        onAction={handleAction}
      />
    </div>
  );
}
