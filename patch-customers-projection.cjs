const fs = require("fs");

function write(file, src) {
  fs.writeFileSync(file, src, "utf8");
  console.log(`${file}: OK`);
}

/* 1) Backend: leads handlers içinə customer projection helper + getCustomers əlavə et */
{
  const file = "ai-hq-backend/src/routes/api/leads/handlers.js";
  let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  if (!src.includes("function customerProjectionKey(")) {
    const marker = "\nexport function createLeadHandlers({ db, wsHub }) {";
    const idx = src.indexOf(marker);
    if (idx === -1) throw new Error("createLeadHandlers marker tapılmadı.");

    const helpers = `
function customerProjectionKey(lead = {}) {
  const email = s(lead.email).toLowerCase();
  const phone = s(lead.phone).toLowerCase();
  const username = s(lead.username).toLowerCase();
  const threadId = s(lead.inbox_thread_id || lead.inboxThreadId).toLowerCase();
  const name = s(lead.full_name || lead.fullName).toLowerCase();
  const source = s(lead.source).toLowerCase();

  if (email) return \`email:\${email}\`;
  if (phone) return \`phone:\${phone}\`;
  if (username) return \`username:\${username}\`;
  if (threadId) return \`thread:\${threadId}\`;
  return \`name-source:\${name}:\${source}\`;
}

function customerProjectionValue(lead = {}) {
  return Number(lead.value_azn ?? lead.valueAzn ?? lead.value ?? 0) || 0;
}

function customerProjectionTime(lead = {}) {
  const value = lead.updated_at || lead.updatedAt || lead.created_at || lead.createdAt || "";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function buildCustomerProjection(leads = []) {
  const map = new Map();

  for (const lead of Array.isArray(leads) ? leads : []) {
    const key = customerProjectionKey(lead);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...lead,
        id: lead.id,
        customer_id: key,
        customerId: key,
        lead_ids: [lead.id].filter(Boolean),
        leadIds: [lead.id].filter(Boolean),
        opportunities: 1,
        value_azn: customerProjectionValue(lead),
        valueAzn: customerProjectionValue(lead),
        value: customerProjectionValue(lead),
      });
      continue;
    }

    const existingTime = customerProjectionTime(existing);
    const nextTime = customerProjectionTime(lead);
    const newer = nextTime >= existingTime ? lead : existing;

    map.set(key, {
      ...existing,
      ...newer,
      customer_id: key,
      customerId: key,
      lead_ids: [...new Set([...(existing.lead_ids || []), lead.id].filter(Boolean))],
      leadIds: [...new Set([...(existing.leadIds || []), lead.id].filter(Boolean))],
      opportunities: Number(existing.opportunities || 1) + 1,
      value_azn: Number(existing.value_azn || 0) + customerProjectionValue(lead),
      valueAzn: Number(existing.valueAzn || 0) + customerProjectionValue(lead),
      value: Number(existing.value || 0) + customerProjectionValue(lead),
    });
  }

  return [...map.values()].sort(
    (a, b) => customerProjectionTime(b) - customerProjectionTime(a)
  );
}

`;
    src = src.slice(0, idx) + helpers + src.slice(idx);
  }

  if (!src.includes("async function getCustomers(")) {
    const marker = "\n  async function getLeadById(req, res) {";
    const idx = src.indexOf(marker);
    if (idx === -1) throw new Error("getLeadById marker tapılmadı.");

    const fn = `
  async function getCustomers(req, res) {
    const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));
    const stage = fixText(String(req.query?.stage || "").trim()).toLowerCase();
    const status = fixText(String(req.query?.status || "").trim()).toLowerCase();
    const owner = fixText(String(req.query?.owner || "").trim());
    const priority = fixText(String(req.query?.priority || "").trim()).toLowerCase();
    const q = fixText(String(req.query?.q || "").trim());
    const limit = clamp(Number(req.query?.limit ?? 200), 1, 200);

    try {
      if (!isDbReady(db)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          customers: [],
          leads: [],
          dbDisabled: true,
        });
      }

      const leads = await listLeads(db, {
        tenantKey,
        stage,
        status,
        owner,
        priority,
        q,
        limit,
      });

      const customers = buildCustomerProjection(leads);

      return okJson(res, {
        ok: true,
        tenantKey,
        customers,
        leads,
        projection: "lead_customer_projection",
      });
    } catch (e) {
      if (isMissingSchemaError(e)) {
        return okJson(res, {
          ok: true,
          tenantKey,
          customers: [],
          leads: [],
          degraded: true,
          reasonCode: "customers_projection_unavailable",
        });
      }

      return okJson(res, {
        ok: false,
        error: "Error",
        details: { message: String(e?.message || e) },
      });
    }
  }

`;
    src = src.slice(0, idx) + fn + src.slice(idx);
  }

  src = src.replace(
    `    ingestLead,
    getLeads,`,
    `    ingestLead,
    getLeads,
    getCustomers,`
  );

  write(file, src);
}

/* 2) Backend: route əlavə et */
{
  const file = "ai-hq-backend/src/routes/api/leads/index.js";
  let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  if (!src.includes('r.get("/customers", requireOperatorSurfaceAccess, h.getCustomers);')) {
    src = src.replace(
      `  r.get("/leads", requireOperatorSurfaceAccess, h.getLeads);`,
      `  r.get("/customers", requireOperatorSurfaceAccess, h.getCustomers);
  r.get("/leads", requireOperatorSurfaceAccess, h.getLeads);`
    );
  }

  write(file, src);
}

/* 3) Frontend API: listCustomers əlavə et */
{
  const file = "ai-hq-frontend/src/api/leads.js";
  let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  if (!src.includes("export async function listCustomers(")) {
    const insertAfter = `  return apiGet(\`/api/leads?\${search.toString()}\`);
}
`;
    if (!src.includes(insertAfter)) throw new Error("listLeads sonu tapılmadı.");

    const fn = `
export async function listCustomers({
  q = "",
  stage = "",
  status = "",
  owner = "",
  priority = "",
  limit = 200,
} = {}) {
  const search = new URLSearchParams();

  if (s(q)) search.set("q", s(q));
  if (s(stage)) search.set("stage", s(stage));
  if (s(status)) search.set("status", s(status));
  if (s(owner)) search.set("owner", s(owner));
  if (s(priority)) search.set("priority", s(priority));
  search.set("limit", String(Math.max(1, Math.min(200, Number(limit || 200)))));

  return apiGet(\`/api/customers?\${search.toString()}\`);
}
`;
    src = src.replace(insertAfter, insertAfter + fn);
  }

  write(file, src);
}

/* 4) Customers.jsx artıq listCustomers istifadə etsin */
{
  const file = "ai-hq-frontend/src/pages/Customers.jsx";
  let src = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

  src = src.replace(
    `import { listLeads } from "../api/leads.js";`,
    `import { listCustomers } from "../api/leads.js";`
  );

  src = src.replace(
    `  if (Array.isArray(payload?.leads)) return payload.leads;`,
    `  if (Array.isArray(payload?.customers)) return payload.customers;
  if (Array.isArray(payload?.leads)) return payload.leads;`
  );

  src = src.replace(
    `      const response = await listLeads({ limit: 200 });`,
    `      const response = await listCustomers({ limit: 200 });`
  );

  write(file, src);
}

console.log("Customer projection backend/frontend tamamlandı.");
