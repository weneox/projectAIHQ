const fs = require("fs");

const file = "ai-hq-backend/src/routes/api/leads/utils.js";
let src = fs.readFileSync(file, "utf8");

src = src.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

const start = src.indexOf("export function normalizeLead(row) {");
const end = src.indexOf("\nexport function normalizeLeadEvent(row) {", start);

if (start === -1 || end === -1) {
  throw new Error("normalizeLead bloku tapılmadı.");
}

const replacement = `function titleizeLeadLabel(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\\b\\w/g, (char) => char.toUpperCase());
}

function firstLeadText(...values) {
  for (const value of values) {
    const text = fixText(s(value));
    if (text) return text;
  }
  return "";
}

function displayLeadStage(stage = "") {
  const normalized = normalizeStage(stage);
  if (normalized === "contacted") return "Contacted";
  if (normalized === "qualified") return "Qualified";
  if (normalized === "proposal") return "Proposal";
  if (normalized === "won") return "Won";
  if (normalized === "lost") return "Lost";
  return "New";
}

function displayLeadStatus(status = "", stage = "") {
  const normalizedStatus = normalizeStatus(status);
  const normalizedStage = normalizeStage(stage);

  if (normalizedStage === "won") return "Converted";
  if (normalizedStage === "lost") return "Lost";
  if (normalizedStatus === "closed") return "Closed";
  if (normalizedStatus === "archived") return "Archived";
  if (normalizedStatus === "spam") return "Spam";

  return "Open";
}

function displayLeadPriority(priority = "") {
  const normalized = normalizePriority(priority);
  if (normalized === "urgent") return "Urgent";
  if (normalized === "high") return "High";
  if (normalized === "low") return "Low";
  return "Medium";
}

export function normalizeLead(row) {
  if (!row) return row;

  const extra = deepFix(row.extra || {});
  const stage = normalizeStage(row.stage || "new");
  const status = normalizeStatus(row.status || "open");
  const priority = normalizePriority(row.priority || "normal");
  const valueAzn = Number(row.value_azn || 0);
  const latestMessageText = firstLeadText(
    row.latest_message_text,
    row.last_message_text,
    extra.latestMessageText,
    extra.latest_message_text,
    extra.lastMessageText,
    extra.last_message_text,
    row.next_action,
    row.notes
  );

  return {
    ...row,

    tenant_key: getResolvedTenantKey(row.tenant_key),
    full_name: fixText(row.full_name || ""),
    username: fixText(row.username || ""),
    company: fixText(row.company || ""),
    phone: fixText(row.phone || ""),
    email: fixText(row.email || ""),
    interest: fixText(row.interest || ""),
    notes: fixText(row.notes || ""),
    owner: fixText(row.owner || ""),
    stage,
    status,
    priority,
    next_action: fixText(row.next_action || ""),
    won_reason: fixText(row.won_reason || ""),
    lost_reason: fixText(row.lost_reason || ""),
    value_azn: valueAzn,
    extra,

    // Frontend-safe aliases. These do not change the DB contract.
    tenantKey: getResolvedTenantKey(row.tenant_key),
    sourceRef: fixText(row.source_ref || ""),
    inboxThreadId: row.inbox_thread_id || "",
    proposalId: row.proposal_id || "",
    fullName: fixText(row.full_name || ""),
    value: valueAzn,
    valueAzn,
    followUpAt: row.follow_up_at || null,
    nextAction: fixText(row.next_action || ""),
    wonReason: fixText(row.won_reason || ""),
    lostReason: fixText(row.lost_reason || ""),

    display_stage: displayLeadStage(stage),
    displayStage: displayLeadStage(stage),
    stageLabel: displayLeadStage(stage),

    display_status: displayLeadStatus(status, stage),
    displayStatus: displayLeadStatus(status, stage),
    statusLabel: displayLeadStatus(status, stage),

    display_priority: displayLeadPriority(priority),
    displayPriority: displayLeadPriority(priority),
    priorityLabel: displayLeadPriority(priority),

    latest_message_text: latestMessageText,
    latestMessageText,
    last_message_text: latestMessageText,
    lastMessageText: latestMessageText,

    sourceLabel: titleizeLeadLabel(row.source || "direct"),
  };
}
`;

src = src.slice(0, start) + replacement + src.slice(end);

fs.writeFileSync(file, src, "utf8");
console.log("Lead response UI aliases əlavə edildi.");
