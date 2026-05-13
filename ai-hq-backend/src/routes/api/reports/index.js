import express from "express";

import { isDbReady, okJson } from "../../../utils/http.js";
import { requireOperatorSurfaceAccess } from "../../../utils/auth.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isMissingSchemaError(error) {
  const code = s(error?.code).toUpperCase();
  const message = s(error?.message).toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    message.includes("does not exist") ||
    message.includes("undefined column") ||
    message.includes("undefined table")
  );
}

const RANGE_DAYS = Object.freeze({
  "24h": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
});

function normalizeRange(value = "") {
  const key = lower(value || "7d");
  return RANGE_DAYS[key] ? key : "7d";
}

function buildDateSeries(days) {
  const result = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - i
    ));

    result.push({
      date: date.toISOString().slice(0, 10),
      apiCalls: 0,
      aiUnits: 0,
      messagesIn: 0,
      messagesOut: 0,
      aiReplies: 0,
      webhookEvents: 0,
      leads: 0,
    });
  }

  return result;
}

function addSeriesValue(seriesByDate, date, patch = {}) {
  const key = s(date).slice(0, 10);
  if (!key || !seriesByDate.has(key)) return;

  const row = seriesByDate.get(key);

  for (const [field, value] of Object.entries(patch)) {
    row[field] = n(row[field]) + n(value);
  }
}

async function safeQuery(db, sql, values, degraded, reasonCode) {
  try {
    const result = await db.query(sql, values);
    return result.rows || [];
  } catch (error) {
    if (isMissingSchemaError(error)) {
      degraded.push(reasonCode);
      return [];
    }

    throw error;
  }
}

function sumSeries(series, field) {
  return series.reduce((total, row) => total + n(row[field]), 0);
}

export function reportsRoutes({ db }) {
  const r = express.Router();

  r.get("/reports/overview", requireOperatorSurfaceAccess, async (req, res) => {
    const tenantKey = lower(req?.auth?.tenantKey || req?.tenantKey);
    const range = normalizeRange(req.query?.range);
    const days = RANGE_DAYS[range];
    const degraded = [];

    if (!tenantKey) {
      return okJson(res, {
        ok: false,
        error: "tenant context required",
        code: "tenant_context_required",
      });
    }

    if (!isDbReady(db)) {
      return okJson(res, {
        ok: true,
        range,
        tenantKey,
        degraded: ["database_unavailable"],
        summary: {},
        timeseries: buildDateSeries(days),
        channels: [],
        leadStages: [],
        leadOwners: [],
        customers: {},
        team: { members: [], summary: {} },
        inboxSla: {},
        current: {},
      });
    }

    try {
      const series = buildDateSeries(days);
      const seriesByDate = new Map(series.map((row) => [row.date, row]));

      const usageRows = await safeQuery(
        db,
        `
        select
          usage_date::text as date,
          coalesce(sum(api_calls), 0)::int as api_calls,
          coalesce(sum(ai_units), 0)::int as ai_units,
          coalesce(sum(messages_in), 0)::int as messages_in,
          coalesce(sum(messages_out), 0)::int as messages_out,
          coalesce(sum(webhook_events), 0)::int as webhook_events,
          coalesce(sum(quota_rejections), 0)::int as quota_rejections
        from tenant_usage_daily
        where tenant_key = $1::text
          and usage_date >= current_date - (($2::int - 1) * interval '1 day')
        group by usage_date
        order by usage_date asc
        `,
        [tenantKey, days],
        degraded,
        "usage_schema_unavailable"
      );

      for (const row of usageRows) {
        addSeriesValue(seriesByDate, row.date, {
          apiCalls: row.api_calls,
          aiUnits: row.ai_units,
          messagesIn: row.messages_in,
          messagesOut: row.messages_out,
          webhookEvents: row.webhook_events,
        });
      }

      const messageRows = await safeQuery(
        db,
        `
        select
          coalesce(sent_at, created_at)::date::text as date,
          count(*) filter (where lower(coalesce(direction, '')) = 'inbound')::int as messages_in,
          count(*) filter (where lower(coalesce(direction, '')) = 'outbound')::int as messages_out,
          count(*) filter (
            where lower(coalesce(direction, '')) = 'outbound'
              and lower(coalesce(sender_type, '')) in ('ai', 'assistant', 'bot')
          )::int as ai_replies
        from inbox_messages
        where tenant_key = $1::text
          and coalesce(sent_at, created_at) >= now() - ($2::int * interval '1 day')
        group by coalesce(sent_at, created_at)::date
        order by coalesce(sent_at, created_at)::date asc
        `,
        [tenantKey, days],
        degraded,
        "inbox_messages_schema_unavailable"
      );

      for (const row of messageRows) {
        addSeriesValue(seriesByDate, row.date, {
          messagesIn: row.messages_in,
          messagesOut: row.messages_out,
          aiReplies: row.ai_replies,
        });
      }

      const leadRows = await safeQuery(
        db,
        `
        select
          created_at::date::text as date,
          count(*)::int as leads
        from leads
        where tenant_key = $1::text
          and created_at >= now() - ($2::int * interval '1 day')
        group by created_at::date
        order by created_at::date asc
        `,
        [tenantKey, days],
        degraded,
        "leads_schema_unavailable"
      );

      for (const row of leadRows) {
        addSeriesValue(seriesByDate, row.date, {
          leads: row.leads,
        });
      }

      const channelRows = await safeQuery(
        db,
        `
        select
          lower(coalesce(t.channel, 'unknown')) as channel,
          count(*) filter (where lower(coalesce(m.direction, '')) = 'inbound')::int as messages_in,
          count(*) filter (where lower(coalesce(m.direction, '')) = 'outbound')::int as messages_out,
          count(*) filter (
            where lower(coalesce(m.direction, '')) = 'outbound'
              and lower(coalesce(m.sender_type, '')) in ('ai', 'assistant', 'bot')
          )::int as ai_replies
        from inbox_messages m
        left join inbox_threads t
          on t.id = m.thread_id
          and t.tenant_key = m.tenant_key
        where m.tenant_key = $1::text
          and coalesce(m.sent_at, m.created_at) >= now() - ($2::int * interval '1 day')
        group by lower(coalesce(t.channel, 'unknown'))
        order by messages_in desc, messages_out desc, channel asc
        `,
        [tenantKey, days],
        degraded,
        "channel_breakdown_unavailable"
      );

      const leadStageRows = await safeQuery(
        db,
        `
        select
          lower(coalesce(stage, 'new')) as stage,
          count(*)::int as count
        from leads
        where tenant_key = $1::text
          and created_at >= now() - ($2::int * interval '1 day')
        group by lower(coalesce(stage, 'new'))
        order by count desc, stage asc
        `,
        [tenantKey, days],
        degraded,
        "lead_stage_breakdown_unavailable"
      );

      const currentRows = await safeQuery(
        db,
        `
        select
          count(*) filter (where status = 'open')::int as open_threads,
          coalesce(sum(unread_count), 0)::int as unread_messages,
          count(*) filter (where coalesce(handoff_active, false) = true)::int as handoffs
        from inbox_threads
        where tenant_key = $1::text
        `,
        [tenantKey],
        degraded,
        "current_inbox_state_unavailable"
      );

      const leadOwnerRows = await safeQuery(
        db,
        `
        select
          coalesce(nullif(btrim(owner), ''), 'unassigned') as owner,
          count(*)::int as total,
          count(*) filter (where lower(coalesce(status, 'open')) = 'open')::int as open,
          count(*) filter (where lower(coalesce(stage, 'new')) = 'won')::int as won,
          count(*) filter (where lower(coalesce(stage, 'new')) = 'lost')::int as lost,
          coalesce(sum(coalesce(value_azn, 0)), 0)::numeric as pipeline_value_azn,
          count(*) filter (
            where follow_up_at is not null
              and follow_up_at <= now()
              and lower(coalesce(status, 'open')) = 'open'
          )::int as followups_due
        from leads
        where tenant_key = $1::text
          and created_at >= now() - ($2::int * interval '1 day')
        group by coalesce(nullif(btrim(owner), ''), 'unassigned')
        order by total desc, owner asc
        limit 12
        `,
        [tenantKey, days],
        degraded,
        "lead_owner_breakdown_unavailable"
      );

      const customerRows = await safeQuery(
        db,
        `
        select
          count(*)::int as total_leads,
          count(distinct coalesce(
            nullif(lower(btrim(email)), ''),
            nullif(lower(btrim(phone)), ''),
            nullif(lower(btrim(username)), ''),
            nullif(inbox_thread_id::text, ''),
            nullif(concat_ws(':', nullif(lower(btrim(full_name)), ''), nullif(lower(btrim(source)), '')), ''),
            id::text
          ))::int as customers,
          count(*) filter (where lower(coalesce(stage, 'new')) = 'won')::int as won_leads,
          count(*) filter (where lower(coalesce(status, 'open')) = 'open')::int as active_leads,
          coalesce(sum(coalesce(value_azn, 0)), 0)::numeric as pipeline_value_azn,
          count(*) filter (
            where follow_up_at is not null
              and follow_up_at <= now()
              and lower(coalesce(status, 'open')) = 'open'
          )::int as followups_due
        from leads
        where tenant_key = $1::text
          and created_at >= now() - ($2::int * interval '1 day')
        `,
        [tenantKey, days],
        degraded,
        "customer_summary_unavailable"
      );

      const teamRows = await safeQuery(
        db,
        `
        select
          u.id::text as id,
          coalesce(nullif(btrim(u.full_name), ''), nullif(btrim(u.user_email), ''), 'Team member') as name,
          coalesce(nullif(btrim(u.user_email), ''), '') as email,
          lower(coalesce(u.role, 'operator')) as role,
          lower(coalesce(u.status, 'invited')) as status,
          coalesce(u.last_seen_at, u.last_login_at, u.updated_at, u.created_at)::text as last_seen_at,
          coalesce(thread_stats.open_threads, 0)::int as open_threads,
          coalesce(thread_stats.handoffs, 0)::int as handoffs,
          coalesce(lead_stats.owned_leads, 0)::int as owned_leads,
          coalesce(lead_stats.won_leads, 0)::int as won_leads
        from tenant_users u
        join tenants tenant
          on tenant.id = u.tenant_id
          and lower(tenant.tenant_key) = lower($1::text)
        left join lateral (
          select
            count(*) filter (where lower(coalesce(status, 'open')) = 'open')::int as open_threads,
            count(*) filter (where coalesce(handoff_active, false) = true)::int as handoffs
          from inbox_threads
          where tenant_key = $1::text
            and lower(nullif(btrim(assigned_to), '')) in (
              lower(nullif(btrim(u.user_email), '')),
              lower(nullif(btrim(u.full_name), '')),
              lower(u.id::text)
            )
        ) thread_stats on true
        left join lateral (
          select
            count(*)::int as owned_leads,
            count(*) filter (where lower(coalesce(stage, 'new')) = 'won')::int as won_leads
          from leads
          where tenant_key = $1::text
            and created_at >= now() - ($2::int * interval '1 day')
            and lower(nullif(btrim(owner), '')) in (
              lower(nullif(btrim(u.user_email), '')),
              lower(nullif(btrim(u.full_name), '')),
              lower(u.id::text)
            )
        ) lead_stats on true
        order by
          case lower(coalesce(u.role, 'operator'))
            when 'owner' then 1
            when 'admin' then 2
            when 'operator' then 3
            else 4
          end,
          lower(coalesce(u.status, 'invited')) asc,
          name asc
        limit 20
        `,
        [tenantKey, days],
        degraded,
        "team_report_unavailable"
      );

      const inboxSlaRows = await safeQuery(
        db,
        `
        with first_inbound as (
          select
            thread_id,
            min(coalesce(sent_at, created_at)) as first_inbound_at
          from inbox_messages
          where tenant_key = $1::text
            and lower(coalesce(direction, '')) = 'inbound'
            and coalesce(sent_at, created_at) >= now() - ($2::int * interval '1 day')
          group by thread_id
        ),
        first_outbound as (
          select
            thread_id,
            min(coalesce(sent_at, created_at)) as first_outbound_at
          from inbox_messages
          where tenant_key = $1::text
            and lower(coalesce(direction, '')) = 'outbound'
          group by thread_id
        )
        select
          count(*)::int as conversations,
          count(*) filter (where o.first_outbound_at is null)::int as waiting_first_response,
          coalesce(avg(extract(epoch from (o.first_outbound_at - i.first_inbound_at))) filter (
            where o.first_outbound_at is not null
              and o.first_outbound_at >= i.first_inbound_at
          ), 0) as avg_first_response_seconds
        from first_inbound i
        left join first_outbound o on o.thread_id = i.thread_id
        `,
        [tenantKey, days],
        degraded,
        "inbox_response_report_unavailable"
      );

      const current = currentRows[0] || {
        open_threads: 0,
        unread_messages: 0,
        handoffs: 0,
      };
      const customerSummary = customerRows[0] || {
        total_leads: 0,
        customers: 0,
        won_leads: 0,
        active_leads: 0,
        pipeline_value_azn: 0,
        followups_due: 0,
      };
      const inboxSla = inboxSlaRows[0] || {
        conversations: 0,
        waiting_first_response: 0,
        avg_first_response_seconds: 0,
      };

      const activeTeamMembers = teamRows.filter(
        (row) => lower(row.status) === "active"
      ).length;

      const summary = {
        apiCalls: sumSeries(series, "apiCalls"),
        aiUnits: sumSeries(series, "aiUnits"),
        messagesIn: sumSeries(series, "messagesIn"),
        messagesOut: sumSeries(series, "messagesOut"),
        aiReplies: sumSeries(series, "aiReplies"),
        webhookEvents: sumSeries(series, "webhookEvents"),
        leads: sumSeries(series, "leads"),
        openThreads: n(current.open_threads),
        unreadMessages: n(current.unread_messages),
        handoffs: n(current.handoffs),
        customers: n(customerSummary.customers),
        activeLeads: n(customerSummary.active_leads),
        wonLeads: n(customerSummary.won_leads),
        pipelineValueAzn: n(customerSummary.pipeline_value_azn),
        followupsDue: n(customerSummary.followups_due),
        activeTeamMembers,
        avgFirstResponseSeconds: n(inboxSla.avg_first_response_seconds),
        waitingFirstResponse: n(inboxSla.waiting_first_response),
      };

      return okJson(res, {
        ok: true,
        tenantKey,
        range,
        days,
        degraded: [...new Set(degraded)],
        summary,
        timeseries: series,
        channels: channelRows.map((row) => ({
          channel: s(row.channel, "unknown"),
          messagesIn: n(row.messages_in),
          messagesOut: n(row.messages_out),
          aiReplies: n(row.ai_replies),
        })),
        leadStages: leadStageRows.map((row) => ({
          stage: s(row.stage, "new"),
          count: n(row.count),
        })),
        leadOwners: leadOwnerRows.map((row) => ({
          owner: s(row.owner, "unassigned"),
          total: n(row.total),
          open: n(row.open),
          won: n(row.won),
          lost: n(row.lost),
          pipelineValueAzn: n(row.pipeline_value_azn),
          followupsDue: n(row.followups_due),
        })),
        customers: {
          totalLeads: n(customerSummary.total_leads),
          customers: n(customerSummary.customers),
          wonLeads: n(customerSummary.won_leads),
          activeLeads: n(customerSummary.active_leads),
          pipelineValueAzn: n(customerSummary.pipeline_value_azn),
          followupsDue: n(customerSummary.followups_due),
        },
        team: {
          summary: {
            totalMembers: teamRows.length,
            activeMembers: activeTeamMembers,
            admins: teamRows.filter((row) => lower(row.role) === "admin").length,
            owners: teamRows.filter((row) => lower(row.role) === "owner").length,
            operators: teamRows.filter((row) => lower(row.role) === "operator").length,
          },
          members: teamRows.map((row) => ({
            id: s(row.id),
            name: s(row.name, "Team member"),
            email: s(row.email),
            role: s(row.role, "operator"),
            status: s(row.status, "invited"),
            lastSeenAt: s(row.last_seen_at),
            openThreads: n(row.open_threads),
            handoffs: n(row.handoffs),
            ownedLeads: n(row.owned_leads),
            wonLeads: n(row.won_leads),
          })),
        },
        inboxSla: {
          conversations: n(inboxSla.conversations),
          waitingFirstResponse: n(inboxSla.waiting_first_response),
          avgFirstResponseSeconds: n(inboxSla.avg_first_response_seconds),
        },
        current: {
          openThreads: n(current.open_threads),
          unreadMessages: n(current.unread_messages),
          handoffs: n(current.handoffs),
        },
      });
    } catch (error) {
      return okJson(res, {
        ok: false,
        error: "Reports overview could not be loaded",
        details: { message: String(error?.message || error) },
      });
    }
  });

  return r;
}
