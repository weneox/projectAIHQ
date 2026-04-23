import { deepFix, fixText } from "../../../utils/textFix.js";

export function toInt(v, fallback) {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function s(v) {
  return String(v ?? "").trim();
}

export function truthy(v) {
  return ["1", "true", "yes", "on"].includes(
    String(v ?? "").trim().toLowerCase()
  );
}

function toMs(v) {
  if (!v) return 0;

  const n = Number(v);
  if (Number.isFinite(n) && n > 0) return n;

  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

function asObject(x) {
  return x && typeof x === "object" && !Array.isArray(x) ? deepFix(x) : {};
}

function asArray(x) {
  return Array.isArray(x) ? deepFix(x) : [];
}

function asStringArray(x) {
  return Array.isArray(x)
    ? x.map((v) => fixText(String(v ?? ""))).filter(Boolean)
    : [];
}

function splitSummaryToList(text) {
  return fixText(text || "")
    .split(/[,;\n]/g)
    .map((x) => fixText(x))
    .filter(Boolean);
}

function boolOr(v, fallback) {
  return typeof v === "boolean" ? v : fallback;
}

function lower(v, d = "") {
  return s(v || d).toLowerCase();
}

function looksLikeNumericIdentity(value = "") {
  const safe = s(value);
  if (!safe) return false;
  return /^\d{5,}$/.test(safe);
}

function isPlaceholderDisplayName(value = "") {
  const safe = lower(value);
  if (!safe) return true;

  return [
    "customer",
    "conversation",
    "instagram user",
    "telegram user",
    "facebook user",
    "whatsapp user",
    "website user",
    "web user",
    "user",
    "unknown",
  ].includes(safe);
}

function isControlLikeMessageType(value = "") {
  return [
    "system",
    "typing",
    "typing_on",
    "typing_off",
    "typing-on",
    "typing-off",
    "typingon",
    "typingoff",
    "typing_start",
    "typing_stop",
    "typing-start",
    "typing-stop",
    "mark_seen",
    "mark-seen",
    "markseen",
    "seen",
    "read",
    "delivery",
    "reaction",
    "echo",
  ].includes(lower(value));
}

function resolveMessageOriginalType(message = {}) {
  const meta = asObject(message?.meta);
  return lower(meta?.originalMessageType || meta?.original_message_type || "");
}

function normalizeUrlLike(value = "") {
  const next = s(value);
  if (!next) return "";
  if (
    next.startsWith("https://") ||
    next.startsWith("http://") ||
    next.startsWith("/")
  ) {
    return next;
  }
  return "";
}

function pickFirstUrl(...values) {
  for (const value of values) {
    const normalized = normalizeUrlLike(value);
    if (normalized) return normalized;
  }
  return "";
}

function cleanDisplayValue(value = "") {
  return fixText(value || "");
}

function joinNameParts(...parts) {
  return parts
    .map((part) => cleanDisplayValue(part))
    .filter(Boolean)
    .join(" ");
}

function normalizeUsernameCandidate(value = "") {
  const next = cleanDisplayValue(value).replace(/^@+/, "");
  if (!next) return "";
  if (looksLikeNumericIdentity(next)) return "";
  return next;
}

function normalizeDisplayNameCandidate(value = "") {
  const next = cleanDisplayValue(value);
  if (!next) return "";
  if (looksLikeNumericIdentity(next)) return "";
  if (isPlaceholderDisplayName(next)) return "";
  return next;
}

function pickBestUsername(...values) {
  for (const value of values) {
    const next = normalizeUsernameCandidate(value);
    if (next) return next;
  }
  return "";
}

function pickBestDisplayName(...values) {
  for (const value of values) {
    const next = normalizeDisplayNameCandidate(value);
    if (next) return next;
  }
  return "";
}

function resolveDisplayIdentityFromMeta(row = {}) {
  const meta = asObject(row?.meta);
  const identity = asObject(meta?.identity);
  const customerContext = asObject(meta?.customerContext);
  const profile = asObject(customerContext?.profile);
  const instagramCtx = asObject(customerContext?.instagram);
  const telegramCtx = asObject(customerContext?.telegram);
  const metaCtx = asObject(customerContext?.meta);
  const raw = asObject(meta?.raw);

  const rawFrom = asObject(raw?.from);
  const rawSender = asObject(raw?.sender);
  const rawProfile = asObject(raw?.profile);
  const rawUser = asObject(raw?.user);
  const rawContact = asObject(raw?.contact);

  const bestUsername = pickBestUsername(
    row?.external_username,
    identity?.externalUsername,
    customerContext?.username,
    profile?.username,
    instagramCtx?.username,
    telegramCtx?.username,
    metaCtx?.username,
    raw?.username,
    rawFrom?.username,
    rawSender?.username,
    rawProfile?.username,
    rawUser?.username,
    rawContact?.username
  );

  const bestDisplayName = pickBestDisplayName(
    row?.customer_name,
    identity?.customerName,
    meta?.customerName,
    meta?.customer_name,

    customerContext?.fullName,
    customerContext?.displayName,
    customerContext?.name,
    joinNameParts(customerContext?.firstName, customerContext?.lastName),

    profile?.fullName,
    profile?.displayName,
    profile?.name,
    joinNameParts(profile?.firstName, profile?.lastName),

    instagramCtx?.fullName,
    instagramCtx?.displayName,
    instagramCtx?.name,
    joinNameParts(instagramCtx?.firstName, instagramCtx?.lastName),

    telegramCtx?.fullName,
    telegramCtx?.displayName,
    telegramCtx?.name,
    joinNameParts(telegramCtx?.firstName, telegramCtx?.lastName),

    metaCtx?.fullName,
    metaCtx?.displayName,
    metaCtx?.name,
    joinNameParts(metaCtx?.firstName, metaCtx?.lastName),

    raw?.customerName,
    raw?.customer_name,
    raw?.name,
    raw?.full_name,
    joinNameParts(raw?.first_name, raw?.last_name),

    rawFrom?.name,
    rawFrom?.fullName,
    rawFrom?.full_name,
    joinNameParts(rawFrom?.first_name, rawFrom?.last_name),

    rawSender?.name,
    rawSender?.fullName,
    rawSender?.full_name,
    joinNameParts(rawSender?.first_name, rawSender?.last_name),

    rawProfile?.name,
    rawProfile?.fullName,
    rawProfile?.full_name,
    joinNameParts(rawProfile?.first_name, rawProfile?.last_name),

    rawUser?.name,
    rawUser?.fullName,
    rawUser?.full_name,
    joinNameParts(rawUser?.first_name, rawUser?.last_name),

    rawContact?.name,
    rawContact?.fullName,
    rawContact?.full_name,
    joinNameParts(rawContact?.first_name, rawContact?.last_name)
  );

  return {
    bestUsername,
    bestDisplayName,
  };
}

function resolveDirectAvatarUrl(row = {}) {
  const meta = asObject(row?.meta);
  const customerContext = asObject(meta?.customerContext);
  const profile = asObject(customerContext?.profile);
  const instagramCtx = asObject(customerContext?.instagram);
  const telegramCtx = asObject(customerContext?.telegram);
  const metaCtx = asObject(customerContext?.meta);
  const raw = asObject(meta?.raw);

  const rawSender = asObject(raw?.sender);
  const rawFrom = asObject(raw?.from);
  const rawProfile = asObject(raw?.profile);
  const rawContact = asObject(raw?.contact);
  const rawRecipient = asObject(raw?.recipient);

  const metaInstagram = asObject(meta?.instagram);
  const metaTelegram = asObject(meta?.telegram);
  const metaProfile = asObject(meta?.profile);

  return pickFirstUrl(
    row?.avatar_url,
    row?.avatarUrl,

    meta?.avatar_url,
    meta?.avatarUrl,
    meta?.profile_picture_url,
    meta?.profilePictureUrl,
    meta?.profile_pic,
    meta?.profilePic,
    meta?.picture,

    metaProfile?.avatar_url,
    metaProfile?.avatarUrl,
    metaProfile?.profile_picture_url,
    metaProfile?.profilePictureUrl,
    metaProfile?.profile_pic,
    metaProfile?.profilePic,

    customerContext?.avatar_url,
    customerContext?.avatarUrl,
    customerContext?.profile_picture_url,
    customerContext?.profilePictureUrl,
    customerContext?.profile_pic,
    customerContext?.profilePic,

    profile?.avatar_url,
    profile?.avatarUrl,
    profile?.profile_picture_url,
    profile?.profilePictureUrl,
    profile?.profile_pic,
    profile?.profilePic,

    instagramCtx?.avatar_url,
    instagramCtx?.avatarUrl,
    instagramCtx?.profile_picture_url,
    instagramCtx?.profilePictureUrl,
    instagramCtx?.profile_pic,
    instagramCtx?.profilePic,
    instagramCtx?.picture,

    telegramCtx?.avatar_url,
    telegramCtx?.avatarUrl,
    telegramCtx?.profile_picture_url,
    telegramCtx?.profilePictureUrl,
    telegramCtx?.profile_pic,
    telegramCtx?.profilePic,
    telegramCtx?.picture,

    metaCtx?.avatar_url,
    metaCtx?.avatarUrl,
    metaCtx?.profile_picture_url,
    metaCtx?.profilePictureUrl,
    metaCtx?.profile_pic,
    metaCtx?.profilePic,
    metaCtx?.picture,

    metaInstagram?.avatar_url,
    metaInstagram?.avatarUrl,
    metaInstagram?.profile_picture_url,
    metaInstagram?.profilePictureUrl,
    metaInstagram?.profile_pic,
    metaInstagram?.profilePic,
    metaInstagram?.picture,

    metaTelegram?.avatar_url,
    metaTelegram?.avatarUrl,
    metaTelegram?.profile_picture_url,
    metaTelegram?.profilePictureUrl,
    metaTelegram?.profile_pic,
    metaTelegram?.profilePic,
    metaTelegram?.picture,

    raw?.avatar_url,
    raw?.avatarUrl,
    raw?.profile_picture_url,
    raw?.profilePictureUrl,
    raw?.profile_pic,
    raw?.profilePic,
    raw?.picture,

    rawSender?.avatar_url,
    rawSender?.avatarUrl,
    rawSender?.profile_picture_url,
    rawSender?.profilePictureUrl,
    rawSender?.profile_pic,
    rawSender?.profilePic,
    rawSender?.picture,

    rawFrom?.avatar_url,
    rawFrom?.avatarUrl,
    rawFrom?.profile_picture_url,
    rawFrom?.profilePictureUrl,
    rawFrom?.profile_pic,
    rawFrom?.profilePic,
    rawFrom?.picture,

    rawProfile?.avatar_url,
    rawProfile?.avatarUrl,
    rawProfile?.profile_picture_url,
    rawProfile?.profilePictureUrl,
    rawProfile?.profile_pic,
    rawProfile?.profilePic,
    rawProfile?.picture,

    rawContact?.avatar_url,
    rawContact?.avatarUrl,
    rawContact?.profile_picture_url,
    rawContact?.profilePictureUrl,
    rawContact?.profile_pic,
    rawContact?.profilePic,
    rawContact?.picture,

    rawRecipient?.avatar_url,
    rawRecipient?.avatarUrl,
    rawRecipient?.profile_picture_url,
    rawRecipient?.profilePictureUrl,
    rawRecipient?.profile_pic,
    rawRecipient?.profilePic,
    rawRecipient?.picture
  );
}

export function isRenderableConversationMessage(message = {}) {
  if (!message || typeof message !== "object") return false;

  const storageType = lower(message?.message_type);
  const originalType = resolveMessageOriginalType(message);
  const senderType = lower(message?.sender_type);
  const meta = asObject(message?.meta);
  const source = lower(meta?.source);

  if (isControlLikeMessageType(storageType)) return false;
  if (isControlLikeMessageType(originalType)) return false;
  if (["system", "decision"].includes(senderType)) return false;
  if (
    ["decision", "decision_engine", "decision-event", "system"].includes(source)
  ) {
    return false;
  }

  return Boolean(fixText(message?.text || ""));
}

export function resolveThreadDisplayName(row = {}) {
  const channel = lower(
    row?.channel || row?.channel_type || row?.provider || row?.source_type
  );
  const { bestDisplayName, bestUsername } = resolveDisplayIdentityFromMeta(row);
  const externalUserId = fixText(row?.external_user_id || "");

  if (bestDisplayName) {
    return bestDisplayName;
  }

  if (bestUsername) {
    return bestUsername.startsWith("@") ? bestUsername : `@${bestUsername}`;
  }

  if (channel === "instagram") return "Instagram User";
  if (channel === "telegram") return "Telegram User";
  if (externalUserId) return "Customer";
  return "Conversation";
}

export function pickConversationPreviewText(value = "", fallback = "") {
  const safeValue = fixText(value || "");
  if (safeValue) return safeValue;

  const safeFallback = fixText(fallback || "");
  if (safeFallback) return safeFallback;

  return "";
}

export function resolveThreadAvatarState(row = {}) {
  const meta = asObject(row?.meta);
  const telegram = asObject(meta?.telegram);
  const customerTelegram = asObject(asObject(meta?.customerContext)?.telegram);

  const avatarFileId =
    fixText(
      telegram?.avatarFileId ||
        customerTelegram?.avatarFileId ||
        customerTelegram?.fileId ||
        customerTelegram?.file_id ||
        ""
    ) || "";
  const avatarFileUniqueId =
    fixText(
      telegram?.avatarFileUniqueId ||
        customerTelegram?.avatarFileUniqueId ||
        customerTelegram?.fileUniqueId ||
        customerTelegram?.file_unique_id ||
        ""
    ) || "";
  const avatarFilePath =
    fixText(
      telegram?.avatarFilePath ||
        customerTelegram?.avatarFilePath ||
        customerTelegram?.filePath ||
        customerTelegram?.file_path ||
        ""
    ) || "";
  const avatarFetchedAt =
    fixText(
      telegram?.avatarFetchedAt ||
        customerTelegram?.avatarFetchedAt ||
        customerTelegram?.fetchedAt ||
        customerTelegram?.fetched_at ||
        ""
    ) || "";
  const avatarUserId =
    fixText(
      telegram?.avatarUserId ||
        customerTelegram?.avatarUserId ||
        customerTelegram?.userId ||
        customerTelegram?.user_id ||
        ""
    ) || "";

  const directAvatarUrl = resolveDirectAvatarUrl(row);

  let avatarAvailable = null;
  if (typeof telegram?.avatarAvailable === "boolean") {
    avatarAvailable = telegram.avatarAvailable;
  } else if (typeof customerTelegram?.avatarAvailable === "boolean") {
    avatarAvailable = customerTelegram.avatarAvailable;
  } else if (avatarFilePath || avatarFileId || directAvatarUrl) {
    avatarAvailable = true;
  }

  return {
    avatarAvailable,
    avatarFileId,
    avatarFileUniqueId,
    avatarFilePath,
    avatarFetchedAt,
    avatarUserId,
    directAvatarUrl,
  };
}

function buildThreadAvatarUrl(row = {}, avatarState = null) {
  const threadId = s(row?.id);
  const channel = fixText(row?.channel || "").toLowerCase();

  const avatar = avatarState || resolveThreadAvatarState(row);
  const directAvatarUrl = normalizeUrlLike(avatar?.directAvatarUrl);

  if (directAvatarUrl) {
    return directAvatarUrl;
  }

  if (!threadId || channel !== "telegram") return "";

  const hasNegativeCache =
    avatar?.avatarAvailable === false &&
    !s(avatar?.avatarFilePath) &&
    !s(avatar?.avatarFileId);

  if (hasNegativeCache) return "";

  const lookupUserId =
    s(avatar?.avatarUserId) ||
    s(row?.external_user_id) ||
    s(row?.external_thread_id);

  const hasResolvedAvatar = Boolean(
    s(avatar?.avatarFilePath) || s(avatar?.avatarFileId)
  );
  const hasLookupIdentity = Boolean(lookupUserId);

  if (!hasResolvedAvatar && !hasLookupIdentity) return "";

  const versionSource =
    s(avatar?.avatarFetchedAt) ||
    s(avatar?.avatarFileUniqueId) ||
    s(avatar?.avatarFileId) ||
    s(row?.updated_at) ||
    s(row?.created_at) ||
    lookupUserId ||
    "1";

  return `/api/inbox/threads/${encodeURIComponent(
    threadId
  )}/avatar?v=${encodeURIComponent(versionSource)}`;
}

export function sortMessagesChronologically(list = []) {
  return [...(Array.isArray(list) ? list : [])].sort(
    (a, b) => toMs(a?.sent_at || a?.created_at) - toMs(b?.sent_at || b?.created_at)
  );
}

export function normalizeThread(row) {
  if (!row) return null;

  const meta = asObject(row.meta);
  const handoffMeta = asObject(meta.handoff);

  const labels = Array.isArray(row.labels)
    ? row.labels.map((x) => fixText(String(x ?? ""))).filter(Boolean)
    : [];

  const avatarState = resolveThreadAvatarState({
    ...row,
    meta,
  });

  const customerName = fixText(row.customer_name || "");
  const externalUsername = fixText(row.external_username || "");
  const externalUserId = fixText(row.external_user_id || "");
  const displayName = resolveThreadDisplayName({
    ...row,
    customer_name: customerName,
    external_username: externalUsername,
    external_user_id: externalUserId,
    meta,
  });

  return {
    ...row,
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: fixText(row.tenant_key || ""),
    channel: fixText(row.channel || ""),
    external_thread_id: fixText(row.external_thread_id || ""),
    external_user_id: externalUserId,
    external_username: externalUsername,
    customer_name: customerName,
    display_name: displayName,
    displayName,
    status: fixText(row.status || ""),
    unread_count: Number(row.unread_count || 0),
    assigned_to: fixText(row.assigned_to || ""),
    labels,
    meta,

    handoff_active:
      typeof row.handoff_active === "boolean"
        ? row.handoff_active
        : Boolean(handoffMeta.active),

    handoff_reason: fixText(row.handoff_reason || handoffMeta.reason || ""),
    handoff_priority: fixText(
      row.handoff_priority || handoffMeta.priority || "normal"
    ),
    handoff_at: row.handoff_at || handoffMeta.at || null,
    handoff_by: fixText(row.handoff_by || handoffMeta.by || ""),

    last_message_at: row.last_message_at || null,
    last_inbound_at: row.last_inbound_at || null,
    last_outbound_at: row.last_outbound_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,

    avatar_available: avatarState.avatarAvailable,
    avatar_updated_at: avatarState.avatarFetchedAt || null,
    avatar_direct_url: avatarState.directAvatarUrl || "",
    avatar_url: buildThreadAvatarUrl(row, avatarState),
  };
}

export function normalizeMessage(row) {
  if (!row) return null;

  const meta = asObject(row.meta);
  const normalized = {
    ...row,
    id: s(row.id),
    thread_id: s(row.thread_id),
    tenant_id: s(row.tenant_id),
    tenant_key: fixText(row.tenant_key || ""),
    direction: fixText(row.direction || ""),
    sender_type: fixText(row.sender_type || ""),
    external_message_id: fixText(row.external_message_id || ""),
    message_type: fixText(row.message_type || ""),
    text: fixText(row.text || ""),
    attachments: asArray(row.attachments),
    meta,
    sent_at: row.sent_at || null,
    created_at: row.created_at || null,
  };

  return {
    ...normalized,
    is_renderable: isRenderableConversationMessage(normalized),
  };
}

export function buildOutboundAttemptCorrelation({
  messageId,
  attemptIds = [],
  latestAttemptId = null,
  durableExecutionIds = [],
  referencedAttemptIds = [],
} = {}) {
  const normalizedMessageId = s(messageId);
  if (!normalizedMessageId) return null;

  const normalizedAttemptIds = Array.isArray(attemptIds)
    ? attemptIds.map((id) => s(id)).filter(Boolean)
    : [];
  const normalizedLatestAttemptId =
    s(latestAttemptId || normalizedAttemptIds[0] || "") || null;
  const normalizedDurableExecutionIds = Array.isArray(durableExecutionIds)
    ? durableExecutionIds.map((id) => s(id)).filter(Boolean)
    : [];
  const normalizedReferencedAttemptIds = Array.isArray(referencedAttemptIds)
    ? referencedAttemptIds.map((id) => s(id)).filter(Boolean)
    : [];

  let correlationState = "historical_missing_attempt";
  let reasonCode = "legacy_message_without_attempt_records";
  let historicalException = true;

  if (normalizedAttemptIds.length) {
    correlationState = "correlated";
    reasonCode = "attempt_records_present";
    historicalException = false;
  } else if (
    normalizedDurableExecutionIds.length ||
    normalizedReferencedAttemptIds.length
  ) {
    correlationState = "missing_attempt";
    reasonCode = "durable_execution_without_attempt_record";
    historicalException = false;
  }

  return {
    message_id: normalizedMessageId,
    latest_attempt_id: normalizedLatestAttemptId,
    attempt_ids: normalizedAttemptIds,
    durable_execution_ids: normalizedDurableExecutionIds,
    referenced_attempt_ids: normalizedReferencedAttemptIds,
    correlation_state: correlationState,
    reason_code: reasonCode,
    historical_exception: historicalException,
  };
}

export function withMessageOutboundAttemptCorrelation(message, correlation = null) {
  if (!message || typeof message !== "object") return message;
  if (s(message.direction).toLowerCase() !== "outbound") return message;

  const normalized =
    correlation && typeof correlation === "object"
      ? buildOutboundAttemptCorrelation({
          messageId: correlation.message_id || correlation.messageId || message.id,
          attemptIds: correlation.attempt_ids || correlation.attemptIds || [],
          latestAttemptId:
            correlation.latest_attempt_id || correlation.latestAttemptId || null,
        })
      : buildOutboundAttemptCorrelation({ messageId: message.id });

  return {
    ...message,
    outbound_attempt_correlation: normalized,
  };
}

export function normalizeLead(row) {
  if (!row) return null;

  return {
    ...row,
    id: s(row.id),
    tenant_id: s(row.tenant_id),
    tenant_key: fixText(row.tenant_key || ""),
    source: fixText(row.source || ""),
    source_ref: fixText(row.source_ref || ""),
    inbox_thread_id: s(row.inbox_thread_id),
    proposal_id: s(row.proposal_id),

    full_name: fixText(row.full_name || ""),
    username: fixText(row.username || ""),
    company: fixText(row.company || ""),
    phone: fixText(row.phone || ""),
    email: fixText(row.email || ""),

    interest: fixText(row.interest || ""),
    notes: fixText(row.notes || ""),

    stage: fixText(row.stage || ""),
    score: Number(row.score || 0),
    status: fixText(row.status || ""),

    owner: fixText(row.owner || ""),
    priority: fixText(row.priority || ""),
    value_azn: Number(row.value_azn || 0),
    follow_up_at: row.follow_up_at || null,
    next_action: fixText(row.next_action || ""),
    won_reason: fixText(row.won_reason || ""),
    lost_reason: fixText(row.lost_reason || ""),

    extra: asObject(row.extra),
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function normalizeTenant(row) {
  if (!row) return null;

  const communicationRules = asObject(row.communication_rules);
  const visualStyle = asObject(row.visual_style);
  const extraContext = asObject(row.extra_context);

  const quietHours = asObject(row.quiet_hours);
  const inboxPolicyRaw = asObject(row.inbox_policy);
  const commentPolicy = asObject(row.comment_policy);
  const contentPolicy = asObject(row.content_policy);
  const escalationRules = asObject(row.escalation_rules);
  const riskRules = asObject(row.risk_rules);
  const leadScoringRules = asObject(row.lead_scoring_rules);
  const publishPolicy = asObject(row.publish_policy);

  const supportedLanguages = asStringArray(row.supported_languages);
  const enabledLanguages = asStringArray(row.enabled_languages);
  const finalLanguages = supportedLanguages.length
    ? supportedLanguages
    : enabledLanguages.length
      ? enabledLanguages
      : [fixText(row.default_language || "az")];

  const bannedPhrases = asStringArray(row.banned_phrases);

  const brandName = fixText(
    row.brand_name || row.company_name || row.tenant_key || ""
  );
  const servicesList = splitSummaryToList(row.services_summary);
  const audienceSummary = fixText(row.audience_summary || "");
  const servicesSummary = fixText(row.services_summary || "");
  const valueProposition = fixText(row.value_proposition || "");
  const brandSummary = fixText(row.brand_summary || "");
  const toneOfVoice = fixText(row.tone_of_voice || "professional");
  const preferredCta = fixText(row.preferred_cta || "");
  const timezone = fixText(row.timezone || "Asia/Baku");
  const defaultLanguage = fixText(row.default_language || "az");
  const industryKey = fixText(row.industry_key || "generic_business");

  const aiPolicy = {
    auto_reply_enabled: boolOr(row.auto_reply_enabled, true),
    suppress_ai_during_handoff: boolOr(row.suppress_ai_during_handoff, true),
    mark_seen_enabled: boolOr(row.mark_seen_enabled, true),
    typing_indicator_enabled: boolOr(row.typing_indicator_enabled, true),
    create_lead_enabled: boolOr(row.create_lead_enabled, true),
    approval_required_content: boolOr(row.approval_required_content, true),
    approval_required_publish: boolOr(row.approval_required_publish, true),
    quiet_hours_enabled: boolOr(row.quiet_hours_enabled, false),
    quiet_hours: quietHours,
    inbox_policy: inboxPolicyRaw,
    comment_policy: commentPolicy,
    content_policy: contentPolicy,
    escalation_rules: escalationRules,
    risk_rules: riskRules,
    lead_scoring_rules: leadScoringRules,
    publish_policy: publishPolicy,
  };

  const inboxPolicy = {
    ...inboxPolicyRaw,

    autoReplyEnabled:
      typeof inboxPolicyRaw.autoReplyEnabled === "boolean"
        ? inboxPolicyRaw.autoReplyEnabled
        : aiPolicy.auto_reply_enabled,

    markSeenEnabled:
      typeof inboxPolicyRaw.markSeenEnabled === "boolean"
        ? inboxPolicyRaw.markSeenEnabled
        : aiPolicy.mark_seen_enabled,

    typingIndicatorEnabled:
      typeof inboxPolicyRaw.typingIndicatorEnabled === "boolean"
        ? inboxPolicyRaw.typingIndicatorEnabled
        : aiPolicy.typing_indicator_enabled,

    createLeadEnabled:
      typeof inboxPolicyRaw.createLeadEnabled === "boolean"
        ? inboxPolicyRaw.createLeadEnabled
        : aiPolicy.create_lead_enabled,

    suppressAiDuringHandoff:
      typeof inboxPolicyRaw.suppressAiDuringHandoff === "boolean"
        ? inboxPolicyRaw.suppressAiDuringHandoff
        : aiPolicy.suppress_ai_during_handoff,

    quietHoursEnabled:
      typeof inboxPolicyRaw.quietHoursEnabled === "boolean"
        ? inboxPolicyRaw.quietHoursEnabled
        : aiPolicy.quiet_hours_enabled,

    quietHours:
      Object.keys(asObject(inboxPolicyRaw.quietHours)).length
        ? asObject(inboxPolicyRaw.quietHours)
        : quietHours,

    timezone:
      fixText(inboxPolicyRaw.timezone || timezone) || "Asia/Baku",
  };

  return {
    id: s(row.id) || null,
    tenant_id: s(row.id) || null,
    tenant_key: fixText(row.tenant_key || ""),

    name: brandName,
    company_name: fixText(row.company_name || ""),
    legal_name: fixText(row.legal_name || ""),
    industry_key: industryKey,
    country_code: fixText(row.country_code || ""),
    timezone,
    default_language: defaultLanguage,
    supported_languages: finalLanguages,
    enabled_languages: finalLanguages,
    market_region: fixText(row.market_region || ""),
    plan_key: fixText(row.plan_key || ""),
    status: fixText(row.status || ""),
    active: row.active !== false,
    onboarding_completed_at: row.onboarding_completed_at || null,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,

    profile: {
      brand_name: brandName,
      website_url: fixText(row.website_url || ""),
      public_email: fixText(row.public_email || ""),
      public_phone: fixText(row.public_phone || ""),
      audience_summary: audienceSummary,
      services_summary: servicesSummary,
      value_proposition: valueProposition,
      brand_summary: brandSummary,
      tone_of_voice: toneOfVoice,
      preferred_cta: preferredCta,
      banned_phrases: bannedPhrases,
      communication_rules: communicationRules,
      visual_style: visualStyle,
      extra_context: extraContext,
      services: servicesList,
      languages: finalLanguages,
      industry_key: industryKey,
    },

    ai_policy: aiPolicy,

    brand: {
      displayName: brandName,
      name: brandName,
      email: fixText(row.public_email || ""),
      phone: fixText(row.public_phone || ""),
      website: fixText(row.website_url || ""),
      tone: toneOfVoice,
      industry: industryKey,
      languages: finalLanguages,
    },

    features: {
      industry: industryKey,
    },

    meta: {
      industry: industryKey,
      businessSummary: brandSummary || valueProposition || servicesSummary,
      audienceSummary,
      servicesSummary,
      services: servicesList,
      valueProposition,
      tone: toneOfVoice,
      preferredCta,
      bannedPhrases,
      communicationRules,
      visualStyle,
      extraContext,
      languages: finalLanguages,
    },

    inbox_policy: inboxPolicy,
    comment_policy: commentPolicy,
    content_policy: contentPolicy,
    quiet_hours: quietHours,
    escalation_rules: escalationRules,
    risk_rules: riskRules,
    lead_scoring_rules: leadScoringRules,
    publish_policy: publishPolicy,
  };
}