import { normalizeLead, normalizeLeadEvent } from "./utils.js";

const LEAD_SELECT = `
  id,
  tenant_key,
  source,
  source_ref,
  inbox_thread_id,
  proposal_id,
  full_name,
  username,
  company,
  phone,
  email,
  interest,
  notes,
  stage,
  score,
  status,
  owner,
  priority,
  value_azn,
  follow_up_at,
  next_action,
  won_reason,
  lost_reason,
  extra,
  created_at,
  updated_at
`;


function leadSelectForAlias(alias = "") {
  const prefix = alias ? `${alias}.` : "";

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
  ].map((column) => `  ${prefix}${column}`).join(",\n");
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

const LEAD_EVENT_SELECT = `
  id,
  lead_id,
  tenant_key,
  type,
  actor,
  payload,
  created_at
`;

export async function fetchLeadById(db, id) {
  const result = await db.query(
    `
    select
      ${LEAD_SELECT}
    from leads
    where id = $1::uuid
    limit 1
    `,
    [id]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function fetchLeadEvents(db, leadId, limit) {
  const result = await db.query(
    `
    select
      ${LEAD_EVENT_SELECT}
    from lead_events
    where lead_id = $1::uuid
    order by created_at desc
    limit $2::int
    `,
    [leadId, limit]
  );

  return (result.rows || []).map(normalizeLeadEvent);
}

export async function findActiveLeadByInboxThreadId(db, tenantKey, inboxThreadId) {
  const result = await db.query(
    `
    select
      ${LEAD_SELECT}
    from leads
    where tenant_key = $1::text
      and inbox_thread_id = $2::uuid
      and status <> 'closed'
    order by updated_at desc, created_at desc
    limit 1
    `,
    [tenantKey, inboxThreadId]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function insertLead(db, data) {
  const result = await db.query(
    `
    insert into leads (
      tenant_key,
      source,
      source_ref,
      inbox_thread_id,
      proposal_id,
      full_name,
      username,
      company,
      phone,
      email,
      interest,
      notes,
      stage,
      score,
      status,
      owner,
      priority,
      value_azn,
      follow_up_at,
      next_action,
      won_reason,
      lost_reason,
      extra
    )
    values (
      $1::text,
      $2::text,
      $3::text,
      $4::uuid,
      $5::uuid,
      $6::text,
      $7::text,
      $8::text,
      $9::text,
      $10::text,
      $11::text,
      $12::text,
      $13::text,
      $14::int,
      $15::text,
      $16::text,
      $17::text,
      $18::numeric(12,2),
      $19::timestamptz,
      $20::text,
      $21::text,
      $22::text,
      $23::jsonb
    )
    returning
      ${LEAD_SELECT}
    `,
    [
      data.tenantKey,
      data.source,
      data.sourceRef,
      data.inboxThreadId,
      data.proposalId,
      data.fullName,
      data.username,
      data.company,
      data.phone,
      data.email,
      data.interest,
      data.notes,
      data.stage,
      data.score,
      data.status,
      data.owner,
      data.priority,
      data.valueAzn,
      data.followUpAt || null,
      data.nextAction,
      data.wonReason,
      data.lostReason,
      JSON.stringify(data.extra),
    ]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function updateLeadFromIngest(db, existingId, data) {
  const result = await db.query(
    `
    update leads
    set
      source_ref = coalesce($2::text, source_ref),
      proposal_id = coalesce($3::uuid, proposal_id),
      full_name = coalesce(nullif($4::text, ''), full_name),
      username = coalesce(nullif($5::text, ''), username),
      company = coalesce(nullif($6::text, ''), company),
      phone = coalesce(nullif($7::text, ''), phone),
      email = coalesce(nullif($8::text, ''), email),
      interest = coalesce(nullif($9::text, ''), interest),
      notes = case
        when nullif($10::text, '') is null then notes
        when coalesce(notes, '') = '' then $10::text
        else concat(notes, E'\\n\\n', $10::text)
      end,
      stage = coalesce(nullif($11::text, ''), stage),
      score = greatest(coalesce(score, 0), $12::int),
      status = coalesce(nullif($13::text, ''), status),
      owner = coalesce(nullif($14::text, ''), owner),
      priority = coalesce(nullif($15::text, ''), priority),
      value_azn = greatest(coalesce(value_azn, 0), $16::numeric(12,2)),
      follow_up_at = coalesce($17::timestamptz, follow_up_at),
      next_action = coalesce(nullif($18::text, ''), next_action),
      won_reason = coalesce(nullif($19::text, ''), won_reason),
      lost_reason = coalesce(nullif($20::text, ''), lost_reason),
      extra = coalesce(extra, '{}'::jsonb) || $21::jsonb,
      updated_at = now()
    where id = $1::uuid
    returning
      ${LEAD_SELECT}
    `,
    [
      existingId,
      data.sourceRef,
      data.proposalId || null,
      data.fullName || "",
      data.username || "",
      data.company || "",
      data.phone || "",
      data.email || "",
      data.interest || "",
      data.notes || "",
      data.stage || "",
      data.score,
      data.status || "",
      data.owner || "",
      data.priority || "",
      data.valueAzn,
      data.followUpAt || null,
      data.nextAction || "",
      data.wonReason || "",
      data.lostReason || "",
      JSON.stringify(data.extra),
    ]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function insertLeadEvent(db, { leadId, tenantKey, type, actor, payload }) {
  const result = await db.query(
    `
    insert into lead_events (
      lead_id,
      tenant_key,
      type,
      actor,
      payload
    )
    values (
      $1::uuid,
      $2::text,
      $3::text,
      $4::text,
      $5::jsonb
    )
    returning
      ${LEAD_EVENT_SELECT}
    `,
    [leadId, tenantKey, type, actor, JSON.stringify(payload || {})]
  );

  return normalizeLeadEvent(result.rows?.[0] || null);
}

export async function listLeads(db, { tenantKey, stage, status, owner, priority, q, limit }) {
  const values = [tenantKey];
  const where = [`l.tenant_key = $1::text`];

  if (stage) {
    values.push(stage);
    where.push(`l.stage = $${values.length}::text`);
  }

  if (status) {
    values.push(status);
    where.push(`l.status = $${values.length}::text`);
  }

  if (owner) {
    values.push(owner);
    where.push(`coalesce(l.owner, '') = $${values.length}::text`);
  }

  if (priority) {
    values.push(priority);
    where.push(`l.priority = $${values.length}::text`);
  }

  if (q) {
    values.push(`%${q}%`);
    const i = values.length;
    where.push(`
      (
        coalesce(l.full_name, '') ilike $${i}
        or coalesce(l.username, '') ilike $${i}
        or coalesce(l.company, '') ilike $${i}
        or coalesce(l.phone, '') ilike $${i}
        or coalesce(l.email, '') ilike $${i}
        or coalesce(l.interest, '') ilike $${i}
        or coalesce(l.notes, '') ilike $${i}
        or coalesce(l.owner, '') ilike $${i}
        or coalesce(l.next_action, '') ilike $${i}
      )
    `);
  }

  values.push(limit);

  const whereSql = where.join(" and ");
  const limitParam = `$${values.length}::int`;

  const baseSql = `
    select
      ${leadSelectForAlias("l")}
    from leads l
    where ${whereSql}
    order by l.updated_at desc, l.created_at desc
    limit ${limitParam}
  `;

  const enrichedSql = `
    select
      ${leadSelectForAlias("l")},
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
    where ${whereSql}
    order by l.updated_at desc, l.created_at desc
    limit ${limitParam}
  `;

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

export async function updateLeadById(db, id, fields, values, paramIndex) {
  const result = await db.query(
    `
    update leads
    set
      ${fields.join(", ")},
      updated_at = now()
    where id = $${paramIndex}::uuid
    returning
      ${LEAD_SELECT}
    `,
    values
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function updateLeadStage(db, id, stage) {
  const result = await db.query(
    `
    update leads
    set
      stage = $2::text,
      updated_at = now()
    where id = $1::uuid
    returning
      ${LEAD_SELECT}
    `,
    [id, stage]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function updateLeadStatus(db, id, status) {
  const result = await db.query(
    `
    update leads
    set
      status = $2::text,
      updated_at = now()
    where id = $1::uuid
    returning
      ${LEAD_SELECT}
    `,
    [id, status]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function updateLeadOwner(db, id, owner) {
  const result = await db.query(
    `
    update leads
    set
      owner = $2::text,
      updated_at = now()
    where id = $1::uuid
    returning
      ${LEAD_SELECT}
    `,
    [id, owner]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function updateLeadFollowup(db, id, followUpAt, nextAction) {
  const result = await db.query(
    `
    update leads
    set
      follow_up_at = $2::timestamptz,
      next_action = $3::text,
      updated_at = now()
    where id = $1::uuid
    returning
      ${LEAD_SELECT}
    `,
    [id, followUpAt, nextAction]
  );

  return normalizeLead(result.rows?.[0] || null);
}

export async function appendLeadNote(db, id, note) {
  const result = await db.query(
    `
    update leads
    set
      notes = case
        when coalesce(notes, '') = '' then $2::text
        else concat(notes, E'\\n\\n', $2::text)
      end,
      updated_at = now()
    where id = $1::uuid
    returning
      ${LEAD_SELECT}
    `,
    [id, note]
  );

  return normalizeLead(result.rows?.[0] || null);
}
