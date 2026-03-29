function s(v) {
  return String(v ?? "").trim();
}

function lower(v) {
  return s(v).toLowerCase();
}

function obj(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : {};
}

function arr(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(values = []) {
  return [...new Set(arr(values).map((item) => s(item)).filter(Boolean))];
}

function pushLayer(layers, key, title, content) {
  const normalized = s(content);
  if (!normalized) return;
  layers.push({ key: s(key), title: s(title), content: normalized });
}

function pickFirst(...values) {
  for (const value of values) {
    const normalized = s(value);
    if (normalized) return normalized;
  }
  return "";
}

export function inferPromptChannel({ event = "", usecase = "", extra = {} } = {}) {
  const explicit = lower(extra.channel || extra.surface || "");
  if (explicit) return explicit;

  const normalizedUsecase = lower(usecase || event);
  if (normalizedUsecase.startsWith("inbox.")) return "inbox";
  if (normalizedUsecase.includes("comment")) return "comments";
  if (normalizedUsecase.includes("voice")) return "voice";
  if (normalizedUsecase.startsWith("content.")) return "content";
  if (normalizedUsecase.includes("media")) return "media";

  return "general";
}

export function composePromptLayers({
  foundation = "",
  industry = "",
  usecase = "",
  tenantContext = "",
  tenant = {},
  extra = {},
  outputContract = null,
  event = "",
  usecaseKey = "",
} = {}) {
  const layers = [];
  const tenantValue = obj(tenant);
  const extraValue = obj(extra);
  const behavior = obj(
    extraValue.behavior ||
      extraValue.runtimeBehavior ||
      tenantValue.behavior
  );
  const channelKey = inferPromptChannel({
    event,
    usecase: usecaseKey || event,
    extra: extraValue,
  });
  const channelBehavior = obj(obj(behavior.channelBehavior)[channelKey]);
  const disallowedClaims = uniqStrings(behavior.disallowedClaims);
  const handoffTriggers = uniqStrings(behavior.handoffTriggers);
  const policy = obj(extraValue.policy || extraValue.guardrails);
  const output = obj(outputContract || extraValue.outputContract);

  pushLayer(layers, "foundation", "Foundation", foundation);
  pushLayer(layers, "runtime_context", "Runtime Context", tenantContext);
  pushLayer(layers, "industry", "Industry", industry);
  pushLayer(layers, "usecase", "Usecase", usecase);

  pushLayer(
    layers,
    "runtime_behavior",
    "Approved Runtime Behavior",
    [
      behavior.niche ? `- niche: ${behavior.niche}` : "",
      behavior.conversionGoal
        ? `- conversionGoal: ${behavior.conversionGoal}`
        : "",
      behavior.primaryCta ? `- primaryCta: ${behavior.primaryCta}` : "",
      behavior.toneProfile ? `- toneProfile: ${behavior.toneProfile}` : "",
      handoffTriggers.length
        ? `- handoffTriggers: ${handoffTriggers.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  pushLayer(
    layers,
    "channel_behavior",
    "Channel Behavior",
    [
      `- channel: ${channelKey}`,
      channelBehavior.primaryAction
        ? `- primaryAction: ${channelBehavior.primaryAction}`
        : "",
      channelBehavior.qualificationDepth
        ? `- qualificationDepth: ${channelBehavior.qualificationDepth}`
        : "",
      channelBehavior.ctaMode ? `- ctaMode: ${channelBehavior.ctaMode}` : "",
      channelBehavior.contentAngle
        ? `- contentAngle: ${channelBehavior.contentAngle}`
        : "",
      channelBehavior.visualDirection
        ? `- visualDirection: ${channelBehavior.visualDirection}`
        : "",
      channelBehavior.reviewBias
        ? `- reviewBias: ${channelBehavior.reviewBias}`
        : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  pushLayer(
    layers,
    "policy",
    "Safety And Policy",
    [
      disallowedClaims.length
        ? `- disallowedClaims: ${disallowedClaims.join(", ")}`
        : "",
      handoffTriggers.length && channelKey !== "content" && channelKey !== "media"
        ? `- escalate when triggered: ${handoffTriggers.join(", ")}`
        : "",
      policy.reviewBias ? `- reviewBias: ${policy.reviewBias}` : "",
      policy.contentReviewRequired === true
        ? "- contentReviewRequired: true"
        : "",
      policy.humanReviewRequired === true
        ? "- humanReviewRequired: true"
        : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  pushLayer(
    layers,
    "output_contract",
    "Output Contract",
    [
      output.mode ? `- outputMode: ${output.mode}` : "",
      output.schemaKey ? `- schemaKey: ${output.schemaKey}` : "",
      output.strictJson === true ? "- strictJson: true" : "",
      output.hint ? `- hint: ${output.hint}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  );

  return {
    channelKey,
    layers,
    fullPrompt: layers
      .map((layer) => `${layer.title}:\n${layer.content}`)
      .join("\n\n"),
  };
}
