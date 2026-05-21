import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createVoiceLabEvaluation,
  listVoiceLabEvaluations,
  listVoiceLabScenarios,
} from "../../api/voice.js";
import {
  BROWSER_VOICE_EVALUATION_SCENARIOS,
  DEFAULT_EVALUATION,
  buildEmptyCapturedSlots,
  missingCapturedSlots,
  readinessLabel,
  scoreAverage,
} from "../voice/browserVoiceEvaluation.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

export default function useBrowserVoiceEvaluation({
  model = "",
  voice = "",
  runtimeMeta = null,
} = {}) {
  const [scenarioId, setScenarioId] = useState("hotel_booking_inquiry");
  const [scenarios, setScenarios] = useState(BROWSER_VOICE_EVALUATION_SCENARIOS);
  const [evaluation, setEvaluation] = useState(DEFAULT_EVALUATION);
  const [capturedSlots, setCapturedSlots] = useState({});
  const [evaluationHistory, setEvaluationHistory] = useState([]);
  const [savingEvaluation, setSavingEvaluation] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");

  const scenario = useMemo(
    () =>
      scenarios.find((item) => item.id === scenarioId) ||
      scenarios[0] ||
      BROWSER_VOICE_EVALUATION_SCENARIOS[0],
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

  const loadScenarios = useCallback(async () => {
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
      setScenarios(BROWSER_VOICE_EVALUATION_SCENARIOS);
    }
  }, []);

  const loadEvaluationHistory = useCallback(async () => {
    try {
      const history = await listVoiceLabEvaluations();
      setEvaluationHistory(Array.isArray(history) ? history : []);
    } catch {
      setEvaluationHistory([]);
    }
  }, []);

  const updateEvaluation = useCallback((key, value) => {
    setEvaluation((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const updateCapturedSlot = useCallback((key, value) => {
    setCapturedSlots((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const resetEvaluation = useCallback(() => {
    setEvaluation(DEFAULT_EVALUATION);
    setCapturedSlots(buildEmptyCapturedSlots(scenario));
  }, [scenario]);

  const saveEvaluation = useCallback(async () => {
    setEvaluationError("");
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
      setEvaluationError(s(err?.message || err, "Evaluation save alınmadı."));
    } finally {
      setSavingEvaluation(false);
    }
  }, [
    capturedSlots,
    evaluation,
    loadEvaluationHistory,
    model,
    runtimeMeta?.runtimeApplied,
    runtimeMeta?.tenantKey,
    scenario.id,
    scenario.title,
    voice,
  ]);

  useEffect(() => {
    loadScenarios();
    loadEvaluationHistory();
  }, [loadEvaluationHistory, loadScenarios]);

  useEffect(() => {
    setCapturedSlots(buildEmptyCapturedSlots(scenario));
  }, [scenario]);

  return {
    scenarioId,
    setScenarioId,
    scenarios,
    scenario,
    evaluation,
    updateEvaluation,
    capturedSlots,
    updateCapturedSlot,
    captureSlots,
    missingSlots,
    averageScore,
    readyLabel,
    evaluationHistory,
    savingEvaluation,
    saveEvaluation,
    resetEvaluation,
    evaluationError,
  };
}
