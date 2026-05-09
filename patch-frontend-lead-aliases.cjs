const fs = require("fs");

function patchFile(file, patches) {
  let src = fs.readFileSync(file, "utf8");
  src = src.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  for (const [label, from, to] of patches) {
    if (!src.includes(from)) {
      throw new Error(`${file}: ${label} tapılmadı.`);
    }
    src = src.replace(from, to);
  }

  fs.writeFileSync(file, src, "utf8");
  console.log(`${file}: real backend alias patch OK`);
}

patchFile("ai-hq-frontend/src/pages/Customers.jsx", [
  [
    "customerStage",
    `function customerStage(customer = {}) {
  return lower(customer.stage || "new");
}`,
    `function customerStage(customer = {}) {
  return lower(
    customer.displayStage ||
      customer.display_stage ||
      customer.stageLabel ||
      customer.stage ||
      "new"
  );
}`
  ],
  [
    "customerStatus",
    `function customerStatus(customer = {}) {
  return lower(customer.status || "open");
}`,
    `function customerStatus(customer = {}) {
  return lower(
    customer.displayStatus ||
      customer.display_status ||
      customer.statusLabel ||
      customer.status ||
      "open"
  );
}`
  ],
  [
    "customerValue",
    `function customerValue(customer = {}) {
  return n(customer.value || customer.estimated_value || customer.deal_value || 0);
}`,
    `function customerValue(customer = {}) {
  return n(
    customer.value_azn ??
      customer.valueAzn ??
      customer.value ??
      customer.estimated_value ??
      customer.deal_value ??
      0
  );
}`
  ],
  [
    "formatMoney currency",
    `    currency: "USD",`,
    `    currency: "AZN",`
  ],
  [
    "latest context",
    `    s(customer.last_message_text) ||
    s(customer.latest_message) ||
    "No message preview is available yet.";`,
    `    s(customer.latestMessageText) ||
    s(customer.latest_message_text) ||
    s(customer.lastMessageText) ||
    s(customer.last_message_text) ||
    s(customer.latest_message) ||
    "No message preview is available yet.";`
  ],
]);

patchFile("ai-hq-frontend/src/pages/Leads.jsx", [
  [
    "leadStage",
    `function leadStage(lead = {}) {
  return lower(lead.stage || lead.pipeline_stage || "new");
}`,
    `function leadStage(lead = {}) {
  return lower(
    lead.displayStage ||
      lead.display_stage ||
      lead.stageLabel ||
      lead.stage ||
      lead.pipeline_stage ||
      "new"
  );
}`
  ],
  [
    "leadStatus",
    `function leadStatus(lead = {}) {
  return lower(lead.status || "open");
}`,
    `function leadStatus(lead = {}) {
  return lower(
    lead.displayStatus ||
      lead.display_status ||
      lead.statusLabel ||
      lead.status ||
      "open"
  );
}`
  ],
  [
    "leadPriority",
    `function leadPriority(lead = {}) {
  return lower(lead.priority || lead.urgency || "medium");
}`,
    `function leadPriority(lead = {}) {
  return lower(
    lead.displayPriority ||
      lead.display_priority ||
      lead.priorityLabel ||
      lead.priority ||
      lead.urgency ||
      "medium"
  );
}`
  ],
  [
    "leadValue",
    `function leadValue(lead = {}) {
  return n(lead.value || lead.estimated_value || lead.deal_value || lead.amount || 0);
}`,
    `function leadValue(lead = {}) {
  return n(
    lead.value_azn ??
      lead.valueAzn ??
      lead.value ??
      lead.estimated_value ??
      lead.deal_value ??
      lead.amount ??
      0
  );
}`
  ],
  [
    "formatMoney currency",
    `    currency: "USD",`,
    `    currency: "AZN",`
  ],
  [
    "matchesText latest",
    `      lead.last_message_text,
      lead.latest_message,`,
    `      lead.latestMessageText,
      lead.latest_message_text,
      lead.lastMessageText,
      lead.last_message_text,
      lead.latest_message,`
  ],
  [
    "detail context",
    `              s(lead.last_message_text) ||
              s(lead.latest_message) ||
              "No message preview is available yet."`,
    `              s(lead.latestMessageText) ||
              s(lead.latest_message_text) ||
              s(lead.lastMessageText) ||
              s(lead.last_message_text) ||
              s(lead.latest_message) ||
              "No message preview is available yet."`
  ],
]);

console.log("Customers + Leads frontend real-data aliasları tamamlandı.");
