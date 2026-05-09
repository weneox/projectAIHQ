const fs = require("fs");

const file = "ai-hq-backend/src/routes/api/leads/repository.js";
let src = fs.readFileSync(file, "utf8");

src = src.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");

if (!src.includes("function leadSelectForAlias(")) {
  const marker = "const LEAD_EVENT_SELECT = `";
  const idx = src.indexOf(marker);

  if (idx === -1) {
    throw new Error("LEAD_EVENT_SELECT marker tapılmadı.");
  }

  const helper = `
function leadSelectForAlias(alias = "") {
  const prefix = alias ? \`\${alias}.\` : "";

  return [
    "id",
    "tenant_key",
    "source",
    "source_ref",
    "inbox_thread_id",
    "proposal_id",
    "full_name",
    "username",
    "company",
    "phone",
    "email",
    "interest",
    "notes",
    "stage",
    "score",
    "status",
    "owner",
    "priority",
    "value_azn",
    "follow_up_at",
    "next_action",
    "won_reason",
    "lost_reason",
    "extra",
    "created_at",
    "updated_at",
  ].map((column) => \`  \${prefix}\${column}\`).join(",\\n");
}

function isOptionalInboxProjectionMissing(error) {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("inbox_threads") ||
    message.includes("inbox_messages") ||
    message.includes("undefined column") ||
    message.includes("undefined table")
  );
}

`;

  src = src.slice(0, idx) + helper + src.slice(idx);
}

const start = src.indexOf("export async function listLeads(db, { tenantKey, stage, status, owner, priority, q, limit }) {");
const end = src.indexOf("\nexport async function updateLeadById(", start);

if (start === -1 || end === -1) {
  throw new Error("listLeads funksiyası tapılmadı.");
}

const replacement = `export async function listLeads(db, { tenantKey, stage, status, owner, priority, q, limit }) {
  const values = [tenantKey];
  const where = [\`l.tenant_key = $1::text\`];

  if (stage) {
    values.push(stage);
    where.push(\`l.stage = $\${values.length}::text\`);
  }

  if (status) {
    values.push(status);
    where.push(\`l.status = $\${values.length}::text\`);
  }

  if (owner) {
    values.push(owner);
    where.push(\`coalesce(l.owner, '') = $\${values.length}::text\`);
  }

  if (priority) {
    values.push(priority);
    where.push(\`l.priority = $\${values.length}::text\`);
  }

  if (q) {
    values.push(\`%\${q}%\`);
    const i = values.length;
    where.push(\`
      (
        coalesce(l.full_name, '') ilike $\${i}
        or coalesce(l.username, '') ilike $\${i}
        or coalesce(l.company, '') ilike $\${i}
        or coalesce(l.phone, '') ilike $\${i}
        or coalesce(l.email, '') ilike $\${i}
        or coalesce(l.interest, '') ilike $\${i}
        or coalesce(l.notes, '') ilike $\${i}
        or coalesce(l.owner, '') ilike $\${i}
        or coalesce(l.next_action, '') ilike $\${i}
      )
    \`);
  }

  values.push(limit);

  const whereSql = where.join(" and ");
  const limitParam = \`$\${values.length}::int\`;

  const baseSql = \`
    select
      \${leadSelectForAlias("l")}
    from leads l
    where \${whereSql}
    order by l.updated_at desc, l.created_at desc
    limit \${limitParam}
  \`;

  const enrichedSql = \`
    select
      \${leadSelectForAlias("l")},
      coalesce(latest_message.text, '') as latest_message_text,
      latest_message.sent_at as latest_message_at,
      coalesce(latest_thread.status, '') as thread_status,
      coalesce(latest_thread.unread_count, 0) as thread_unread_count
    from leads l
    left join inbox_threads latest_thread
      on latest_thread.id = l.inbox_thread_id
      and latest_thread.tenant_key = l.tenant_key
    left join lateral (
      select
        m.text,
        coalesce(m.sent_at, m.created_at) as sent_at
      from inbox_messages m
      where m.thread_id = l.inbox_thread_id
        and m.tenant_key = l.tenant_key
        and nullif(btrim(coalesce(m.text, '')), '') is not null
        and lower(coalesce(m.message_type, 'text')) not in (
          'system',
          'typing',
          'typing_on',
          'typing_off',
          'mark_seen',
          'seen',
          'read',
          'delivery',
          'reaction',
          'echo'
        )
        and lower(coalesce(m.sender_type, '')) not in ('system', 'decision')
      order by coalesce(m.sent_at, m.created_at) desc, m.created_at desc
      limit 1
    ) latest_message on true
    where \${whereSql}
    order by l.updated_at desc, l.created_at desc
    limit \${limitParam}
  \`;

  try {
    const result = await db.query(enrichedSql, values);
    return (result.rows || []).map(normalizeLead);
  } catch (error) {
    if (!isOptionalInboxProjectionMissing(error)) {
      throw error;
    }

    const result = await db.query(baseSql, values);
    return (result.rows || []).map(normalizeLead);
  }
}
`;

src = src.slice(0, start) + replacement + src.slice(end);

fs.writeFileSync(file, src, "utf8");
console.log("Leads list real inbox latest message projection əlavə edildi.");
