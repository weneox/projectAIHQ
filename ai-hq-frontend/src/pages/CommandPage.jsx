// src/pages/CommandPage.jsx
// INTERNAL DEMO SURFACE
// - demo data is still local in this file
// - not a source-of-truth operational surface
// - retained temporarily as a reachable internal/demo route

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Command,
  FileText,
  Inbox,
  Send,
  Sparkles,
  Target,
  UserCog,
  FlaskConical,
} from "lucide-react";

function cx(...arr) {
  return arr.filter(Boolean).join(" ");
}

const TODAY_DRAFT = {
  id: "draft-2026-03-09",
  exists: true,
  title: "NEOX AI automation launch visual",
  format: "image",
  status: "waiting_review",
  language: "az",
  updatedAt: "8 min ago",
  summary:
    "Bugunku kontent drafti hazirdir. Vizual istiqameti ve caption mood-u artiq formalasib.",
  previewPoints: [
    "Futuristic automation control scene",
    "Premium, modern, direct caption direction",
    "Goal: trust + innovation perception",
  ],
};

const LEAD_RADAR = {
  todayCount: 6,
  hotCount: 2,
  items: [
    {
      id: "lead-1",
      name: "Medical clinic automation inquiry",
      source: "Instagram DM",
      priority: "Hot",
      href: "/leads",
    },
    {
      id: "lead-2",
      name: "Restaurant wants WhatsApp bot",
      source: "Website form",
      priority: "Warm",
      href: "/leads",
    },
  ],
};

const CONVERSATION_PULSE = {
  todayDmTouched: 12,
  activeThreads: 5,
  autoCommentsWaiting: 4,
  todayNewDm: 7,
};

const LIVE_ACTIVITY = [
  {
    id: "a1",
    label: "New draft created for today",
    meta: "8 min ago",
    tone: "violet",
    href: "/proposals?tab=draft",
  },
  {
    id: "a2",
    label: "Hot lead detected from Instagram DM",
    meta: "14 min ago",
    tone: "emerald",
    href: "/leads",
  },
  {
    id: "a3",
    label: "Comment paused for manual review",
    meta: "29 min ago",
    tone: "amber",
    href: "/comments",
  },
];

function toneDot(tone) {
  const map = {
    violet: "bg-violet-400",
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    sky: "bg-sky-400",
    rose: "bg-rose-400",
    slate: "bg-white/70",
  };
  return map[tone] || map.slate;
}

function statusLabel(status) {
  if (status === "waiting_review") return "Waiting review";
  if (status === "in_progress") return "In progress";
  if (status === "approved") return "Approved";
  return "Unknown";
}

function Eyebrow({ icon: Icon, children }) {
  return (
    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{children}</span>
    </div>
  );
}

function Surface({ className = "", children }) {
  return (
    <section
      className={cx(
        "relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.02))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] md:p-6",
        className
      )}
    >
      {children}
    </section>
  );
}

function InternalDemoBanner() {
  return (
    <div className="mb-5 rounded-[24px] border border-amber-300/20 bg-amber-300/10 px-4 py-4 text-sm text-amber-50/90">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full border border-amber-200/20 bg-amber-200/10 p-2">
          <FlaskConical className="h-4 w-4" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-100/70">
            Internal demo
          </div>
          <p className="mt-2 max-w-3xl leading-6 text-amber-50/88">
            This Command screen is still powered by local demo data in this file. It remains
            reachable for internal exploration only and should not be treated as a live operational
            source of truth.
          </p>
        </div>
      </div>
    </div>
  );
}

function CompactHeader({ navigate }) {
  const chips = [
    {
      id: "draft",
      label: TODAY_DRAFT.exists ? "1 demo draft today" : "No demo draft today",
      href: TODAY_DRAFT.exists ? `/proposals/${TODAY_DRAFT.id}` : "/proposals?tab=draft",
      tone: "violet",
    },
    {
      id: "lead",
      label: `${LEAD_RADAR.hotCount} demo hot leads`,
      href: "/leads",
      tone: "emerald",
    },
    {
      id: "dm",
      label: `${CONVERSATION_PULSE.todayDmTouched} demo DMs touched`,
      href: "/inbox",
      tone: "sky",
    },
    {
      id: "comments",
      label: `${CONVERSATION_PULSE.autoCommentsWaiting} demo comments waiting`,
      href: "/comments",
      tone: "amber",
    },
  ];

  return (
    <div className="mb-6">
      <Eyebrow icon={Command}>Command demo</Eyebrow>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <h1 className="text-[28px] font-semibold tracking-[-0.05em] text-white md:text-[40px]">
            Internal demo operational view.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/48">
            This screen is retained as a demo-only landing surface. Real operational work should
            happen in Setup Studio, Inbox, Leads, Comments, Voice, Proposals, Executions, and
            Settings.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/proposals")}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/78 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          <FileText className="h-4 w-4" />
          Open proposals
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => navigate(chip.href)}
            className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/76 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
          >
            <span className={cx("h-2 w-2 rounded-full", toneDot(chip.tone))} />
            <span>{chip.label}</span>
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </button>
        ))}
      </div>
    </div>
  );
}

function TodayDraftCard({ navigate }) {
  if (!TODAY_DRAFT.exists) {
    return (
      <Surface className="border-violet-400/12">
        <div className="pointer-events-none absolute -left-10 top-0 h-40 w-40 rounded-full bg-violet-500/10 blur-[90px]" />
        <div className="relative">
          <Eyebrow icon={FileText}>Demo draft</Eyebrow>
          <h2 className="text-[28px] font-semibold tracking-[-0.04em] text-white">
            No demo draft today
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/50">
            This demo surface does not currently have a fresh local draft fixture.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate("/proposals?tab=draft")}
              className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white/82 transition hover:border-white/16 hover:bg-white/[0.1] hover:text-white"
            >
              Open drafts
            </button>
            <button
              type="button"
              onClick={() => navigate("/setup/studio")}
              className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/72 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
            >
              Open Setup Studio
            </button>
          </div>
        </div>
      </Surface>
    );
  }

  return (
    <Surface className="border-violet-400/12">
      <div className="pointer-events-none absolute -left-12 top-0 h-44 w-44 rounded-full bg-violet-500/10 blur-[90px]" />
      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Eyebrow icon={Sparkles}>Featured demo fixture</Eyebrow>
            <h2 className="text-[30px] font-semibold tracking-[-0.05em] text-white md:text-[36px]">
              {TODAY_DRAFT.title}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-7 text-white/52">
              {TODAY_DRAFT.summary}
            </p>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">
              Updated
            </div>
            <div className="mt-1 text-lg font-medium text-white">{TODAY_DRAFT.updatedAt}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-sm text-white/68">
            {statusLabel(TODAY_DRAFT.status)}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-sm text-white/68">
            {TODAY_DRAFT.format}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-sm text-white/68">
            {TODAY_DRAFT.language.toUpperCase()}
          </span>
        </div>

        <div className="mt-5 grid gap-2">
          {TODAY_DRAFT.previewPoints.map((point) => (
            <div
              key={point}
              className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/64"
            >
              {point}
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate(`/proposals/${TODAY_DRAFT.id}`)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white/82 transition hover:border-white/16 hover:bg-white/[0.1] hover:text-white"
          >
            Open draft
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => navigate("/proposals?tab=draft")}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/72 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
          >
            All drafts
          </button>
        </div>
      </div>
    </Surface>
  );
}

function AgentTaskComposer({ navigate }) {
  const [agent, setAgent] = useState("nova");
  const [title, setTitle] = useState("");

  function submitTask(e) {
    e.preventDefault();
    console.log("assign demo agent task", { agent, title });
    navigate("/executions");
  }

  return (
    <Surface className="border-rose-400/12 h-full">
      <Eyebrow icon={UserCog}>Demo task console</Eyebrow>

      <h3 className="text-[24px] font-semibold tracking-[-0.04em] text-white">
        Internal task composer
      </h3>

      <p className="mt-2 text-sm leading-7 text-white/48">
        This panel is a local demo interaction, not a live agent assignment workflow.
      </p>

      <form onSubmit={submitTask} className="mt-5 space-y-3">
        <div>
          <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/32">
            Agent
          </label>
          <select
            value={agent}
            onChange={(e) => setAgent(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition focus:border-white/18"
          >
            <option value="nova" className="bg-[#0b0d12]">Nova</option>
            <option value="atlas" className="bg-[#0b0d12]">Atlas</option>
            <option value="echo" className="bg-[#0b0d12]">Echo</option>
            <option value="orion" className="bg-[#0b0d12]">Orion</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/32">
            Task title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Build content angle for AI call assistant"
            className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/26 outline-none transition focus:border-white/18"
          />
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm text-white/82 transition hover:border-white/16 hover:bg-white/[0.1] hover:text-white"
          >
            <Send className="h-4 w-4" />
            Log demo task
          </button>

          <button
            type="button"
            onClick={() => navigate("/executions")}
            className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/72 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
          >
            Open executions
          </button>
        </div>
      </form>
    </Surface>
  );
}

function LiveFeed({ navigate }) {
  return (
    <Surface>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <Eyebrow icon={Clock3}>Demo live activity</Eyebrow>
          <h3 className="text-[24px] font-semibold tracking-[-0.04em] text-white">
            Fixture activity
          </h3>
        </div>

        <button
          type="button"
          onClick={() => navigate("/executions")}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/74 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          View executions
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        {LIVE_ACTIVITY.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.href)}
            className="group flex w-full items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/14 hover:bg-white/[0.05]"
          >
            <span className={cx("h-2.5 w-2.5 rounded-full", toneDot(item.tone))} />
            <div className="min-w-0 flex-1 text-sm text-white/68">{item.label}</div>
            <div className="text-xs text-white/30">{item.meta}</div>
            <ArrowRight className="h-4 w-4 text-white/24 transition group-hover:translate-x-0.5 group-hover:text-white/68" />
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/16 bg-emerald-500/10 px-3 py-1.5 text-sm text-emerald-200">
          <CheckCircle2 className="h-4 w-4" />
          Demo workflow active
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/60">
          {LEAD_RADAR.hotCount} demo hot leads
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/60">
          {CONVERSATION_PULSE.activeThreads} demo active threads
        </div>
      </div>
    </Surface>
  );
}

function LeadRadar({ navigate }) {
  return (
    <Surface className="border-emerald-400/12 h-full">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <Eyebrow icon={Target}>Demo lead radar</Eyebrow>
          <h3 className="text-[24px] font-semibold tracking-[-0.04em] text-white">
            Fixture leads
          </h3>
          <p className="mt-2 text-sm leading-7 text-white/48">
            This summary is backed by local fixture data and is not a live sales signal.
          </p>
        </div>

        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.22em] text-white/30">Hot</div>
          <div className="mt-1 text-[28px] font-semibold tracking-[-0.05em] text-white">
            {LEAD_RADAR.hotCount}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">Today</div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-white">
            {LEAD_RADAR.todayCount}
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">Priority</div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-white">
            {LEAD_RADAR.hotCount}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {LEAD_RADAR.items.map((lead) => (
          <button
            key={lead.id}
            type="button"
            onClick={() => navigate(lead.href)}
            className="group flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/14 hover:bg-white/[0.05]"
          >
            <span className="mt-2 h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-white/86">{lead.name}</div>
              <div className="mt-1 text-sm text-white/42">
                {lead.source} · {lead.priority}
              </div>
            </div>
            <ArrowRight className="mt-1 h-4 w-4 text-white/26 transition group-hover:translate-x-0.5 group-hover:text-white/70" />
          </button>
        ))}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={() => navigate("/leads")}
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-white/74 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          Open leads
        </button>
      </div>
    </Surface>
  );
}

function ConversationPulse({ navigate }) {
  return (
    <Surface className="border-sky-400/12 h-full">
      <Eyebrow icon={Inbox}>Demo conversation pulse</Eyebrow>

      <h3 className="text-[24px] font-semibold tracking-[-0.04em] text-white">
        Demo DM + comments
      </h3>

      <p className="mt-2 text-sm leading-7 text-white/48">
        This panel shows local fixture counts and should not be treated as live message state.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">DM touched</div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-white">
            {CONVERSATION_PULSE.todayDmTouched}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">Threads</div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-white">
            {CONVERSATION_PULSE.activeThreads}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">New DM</div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-white">
            {CONVERSATION_PULSE.todayNewDm}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">Comments</div>
          <div className="mt-2 text-[26px] font-semibold tracking-[-0.05em] text-white">
            {CONVERSATION_PULSE.autoCommentsWaiting}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => navigate("/inbox")}
          className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/78 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          Open inbox
        </button>
        <button
          type="button"
          onClick={() => navigate("/comments")}
          className="rounded-full border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white/78 transition hover:border-white/16 hover:bg-white/[0.08] hover:text-white"
        >
          Open comments
        </button>
      </div>
    </Surface>
  );
}

export default function CommandPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#05060a] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-8%] h-[340px] w-[340px] rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute right-[-8%] top-[8%] h-[280px] w-[280px] rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[24%] h-[280px] w-[280px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1560px] px-5 py-6 md:px-8 md:py-8">
        <InternalDemoBanner />
        <CompactHeader navigate={navigate} />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_400px]">
          <TodayDraftCard navigate={navigate} />
          <AgentTaskComposer navigate={navigate} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_400px]">
          <LiveFeed navigate={navigate} />

          <div className="grid gap-5">
            <LeadRadar navigate={navigate} />
            <ConversationPulse navigate={navigate} />
          </div>
        </div>
      </div>
    </div>
  );
}
