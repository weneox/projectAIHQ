const fs = require("fs");

const file = "ai-hq-backend/src/routes/api/leads/handlers.js";
let src = fs.readFileSync(file, "utf8");

// Windows CRLF fərqinə görə normalizasiya
src = src.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

function mustInclude(text, label) {
  if (!src.includes(text)) {
    throw new Error(`${label} tapılmadı.`);
  }
}

if (!src.includes("const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));\n    const data = cleanLeadPayload({\n      ...req.body,\n      tenantKey,\n    });")) {
  mustInclude(
    "  async function createLead(req, res) {\n    const data = cleanLeadPayload(req.body);",
    "createLead cleanLeadPayload"
  );

  src = src.replace(
    "  async function createLead(req, res) {\n    const data = cleanLeadPayload(req.body);",
    `  async function createLead(req, res) {
    const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));
    const data = cleanLeadPayload({
      ...req.body,
      tenantKey,
    });`
  );
}

const oldGuard = `      const before = await fetchLeadById(db, id);
      if (!before) return okJson(res, { ok: false, error: "not found" });`;

const newGuard = `      const tenantKey = getResolvedTenantKey(getAuthTenantKey(req));
      const before = await fetchLeadById(db, id);
      if (!before || (tenantKey && getResolvedTenantKey(before.tenant_key) !== tenantKey)) {
        return okJson(res, { ok: false, error: "not found" });
      }`;

let changedGuards = 0;

while (src.includes(oldGuard) && changedGuards < 6) {
  src = src.replace(oldGuard, newGuard);
  changedGuards += 1;
}

console.log(`Tenant guard əlavə edilən update handler sayı: ${changedGuards}`);

fs.writeFileSync(file, src, "utf8");
console.log("P0 leads tenant isolation patch tamamlandı.");
