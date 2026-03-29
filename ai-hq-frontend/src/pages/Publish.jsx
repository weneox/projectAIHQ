import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listComments } from "../api/comments.js";
import { listProposals } from "../api/proposals.js";
import { getSettingsTrustView } from "../api/trust.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function parseDateMs(value) {
  const next = Date.parse(s(value));
  return Number.isFinite(next) ? next : 0;
}

function sortNewestFirst(a, b) {
  return (
    parseDateMs(
      b?.updated_at || b?.updatedAt || b?.created_at || b?.createdAt || b?.publishedAt
    ) -
    parseDateMs(
      a?.updated_at || a?.updatedAt || a?.created_at || a?.createdAt || a?.publishedAt
    )
  );
}

function uniqById(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const id = s(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }

  return out;
}

function pickProposalLabel(item = {}) {
  return (
    s(item?.title) ||
    s(item?.headline) ||
    s(item?.name) ||
    s(item?.topic) ||
    s(item?.summary) ||
    s(item?.brief) ||
    `Proposal ${s(item?.id || "").slice(0, 8)}`
  );
}

function pickCommentLabel(item = {}) {
  return (
    s(item?.postTitle) ||
    s(item?.author) ||
    s(item?.text).slice(0, 72) ||
    `Comment ${s(item?.id || "").slice(0, 8)}`
  );
}

function summarizeComments(payload = {}) {
  const comments = Array.isArray(payload?.comments)
    ? payload.comments
    : Array.isArray(payload)
      ? payload
      : [];

  let pending = 0;
  let completed = 0;
  let flagged = 0;

  for (const item of comments) {
    const status = s(item?.status).toLowerCase();
    if (status === "pending" || status === "manual_review") pending += 1;
    else if (
      status === "reviewed" ||
      status === "approved" ||
      status === "replied"
    ) {
      completed += 1;
    } else if (status === "flagged" || status === "ignored") {
      flagged += 1;
    }
  }

  return {
    total: comments.length,
    pending,
    completed,
    flagged,
    items: comments.sort(sortNewestFirst),
  };
}

function summarizeProposals(payloads = {}) {
  const waiting = uniqById([
    ...(Array.isArray(payloads.draft) ? payloads.draft : []),
    ...(Array.isArray(payloads.inProgress) ? payloads.inProgress : []),
    ...(Array.isArray(payloads.pending) ? payloads.pending : []),
  ]).sort(sortNewestFirst);
  const approved = Array.isArray(payloads.approved)
    ? [...payloads.approved].sort(sortNewestFirst)
    : [];
  const published = Array.isArray(payloads.published)
    ? [...payloads.published].sort(sortNewestFirst)
    : [];

  return {
    waiting,
    approved,
    published,
  };
}

function summarizePublishingPosture(trust = {}) {
  const autonomyItems = Array.isArray(trust?.summary?.channelAutonomy?.items)
    ? trust.summary.channelAutonomy.items
    : [];
  const relevant = autonomyItems.filter((item) => {
    const surface = s(item?.surface).toLowerCase();
    return (
      surface.includes("publish") ||
      surface.includes("comment") ||
      surface.includes("instagram") ||
      surface.includes("meta")
    );
  });

  return {
    blocked: relevant.filter(
      (item) => item?.repairRequired || item?.policyOutcome === "blocked"
    ),
    reviewOnly: relevant.filter(
      (item) => item?.reviewRequired || item?.handoffRequired
    ),
    policyPosture: trust?.summary?.policyPosture || {},
  };
}

function sectionClasses(highlighted = false) {
  return [
    "relative overflow-hidden rounded-[32px] px-6 py-6 sm:px-7 sm:py-7",
    "border bg-[#fffdf9]/92 shadow-[0_18px_44px_rgba(120,102,73,0.08),inset_0_1px_0_rgba(255,255,255,0.78)]",
    highlighted ? "border-[#dbc8aa]" : "border-[#ece2d3]",
  ].join(" ");
}

function rowClasses(highlighted = false) {
  return [
    "rounded-[22px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
    highlighted
      ? "border-[#dbc8aa] bg-[#faf5eb]"
      : "border-[#efe6d7] bg-[#fffdfa]",
  ].join(" ");
}

function Section({ id, eyebrow, title, description = "", highlighted = false, children }) {
  return (
    <section id={id} className={sectionClasses(highlighted)}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(520px_circle_at_0%_0%,rgba(229,211,180,0.14),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.34),transparent_26%)]" />
      <div className="relative space-y-5">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
            {eyebrow}
          </div>
          <div className="text-[23px] font-semibold tracking-[-0.045em] text-stone-900">
            {title}
          </div>
          {description ? (
            <div className="max-w-3xl text-sm leading-6 text-stone-600">
              {description}
            </div>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, tone = "neutral" }) {
  const tones = {
    neutral: "border-[#ece2d3] bg-[#fffdfa]",
    warm: "border-[#e7d7ba] bg-[#faf3e6]",
    soft: "border-[#dde8df] bg-[#f5faf5]",
  };

  return (
    <div className={`rounded-[22px] border px-4 py-4 ${tones[tone] || tones.neutral}`}>
      <div className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{label}</div>
      <div className="mt-2 text-[28px] font-semibold tracking-[-0.04em] text-stone-900">
        {value}
      </div>
    </div>
  );
}

function SummaryLine({ label, text, highlighted = false }) {
  return (
    <div className={rowClasses(highlighted)}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
        {label}
      </div>
      <div className="mt-2 text-sm leading-6 text-stone-600">
        {text}
      </div>
    </div>
  );
}

function OutcomeRow({ item, highlighted = false }) {
  return (
    <div className={rowClasses(highlighted)}>
      <div className="text-[16px] font-semibold tracking-[-0.03em] text-stone-900">
        {item.title}
      </div>
      <div className="mt-2 text-sm leading-6 text-stone-600">
        {item.summary}
      </div>
    </div>
  );
}

function focusToSection(value = "") {
  switch (s(value).toLowerCase()) {
    case "moderation":
      return "publish-workflow";
    case "outcomes":
      return "publish-outcomes";
    case "blocked":
      return "publish-posture";
    default:
      return "";
  }
}

export default function PublishPage() {
  const [searchParams] = useSearchParams();
  const [state, setState] = useState({
    loading: true,
    error: "",
    comments: null,
    proposals: null,
    trust: null,
  });

  const focusSection = searchParams.get("focus") || "";
  const focusedId = focusToSection(focusSection);

  useEffect(() => {
    if (!focusedId) return;
    const element = document.getElementById(focusedId);
    if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [focusedId]);

  useEffect(() => {
    let alive = true;

    async function load() {
      setState((prev) => ({ ...prev, loading: true, error: "" }));

      const results = await Promise.allSettled([
        listComments({ limit: 24 }),
        Promise.allSettled([
          listProposals("draft"),
          listProposals("in_progress"),
          listProposals("pending"),
          listProposals("approved"),
          listProposals("published"),
        ]),
        getSettingsTrustView({ limit: 6 }),
      ]);

      if (!alive) return;

      const proposalResults =
        results[1].status === "fulfilled" ? results[1].value : [];

      setState({
        loading: false,
        error:
          results.every((item) => item.status === "rejected")
            ? "Publish overview could not be loaded."
            : "",
        comments: results[0].status === "fulfilled" ? results[0].value : null,
        proposals:
          results[1].status === "fulfilled"
            ? {
                draft:
                  proposalResults[0]?.status === "fulfilled"
                    ? proposalResults[0].value
                    : [],
                inProgress:
                  proposalResults[1]?.status === "fulfilled"
                    ? proposalResults[1].value
                    : [],
                pending:
                  proposalResults[2]?.status === "fulfilled"
                    ? proposalResults[2].value
                    : [],
                approved:
                  proposalResults[3]?.status === "fulfilled"
                    ? proposalResults[3].value
                    : [],
                published:
                  proposalResults[4]?.status === "fulfilled"
                    ? proposalResults[4].value
                    : [],
              }
            : null,
        trust: results[2].status === "fulfilled" ? results[2].value : null,
      });
    }

    load();

    return () => {
      alive = false;
    };
  }, []);

  const summary = useMemo(() => {
    const comments = summarizeComments(state.comments || {});
    const proposals = summarizeProposals(state.proposals || {});
    const posture = summarizePublishingPosture(state.trust || {});

    const waitingText = proposals.waiting.length
      ? `${proposals.waiting.length} draft or in-progress proposal${
          proposals.waiting.length === 1 ? "" : "s"
        } are waiting for the next publishing step.`
      : "No draft or in-progress proposal pressure is visible right now.";

    const moderationText = comments.pending
      ? `${comments.pending} comment${comments.pending === 1 ? "" : "s"} still need moderation review.`
      : "No comment moderation backlog is visible right now.";

    const approvalText = proposals.approved.length
      ? `${proposals.approved.length} approved item${
          proposals.approved.length === 1 ? "" : "s"
        } are ready for publishing or final operator judgment.`
      : "No approved publishing items are currently waiting.";

    const blockedText = posture.blocked.length
      ? posture.blocked
          .slice(0, 3)
          .map((item) => s(item?.explanation || item?.surface || "Publishing capability issue"))
          .join(" | ")
      : posture.reviewOnly.length
        ? posture.reviewOnly
            .slice(0, 3)
            .map((item) => s(item?.explanation || item?.surface || "Review-only publishing posture"))
            .join(" | ")
        : s(posture.policyPosture?.explanation) ||
          "No blocked or paused publishing posture is visible in the current summary.";

    const recentPublished = proposals.published.slice(0, 3).map((item) => ({
      id: `published-${s(item?.id)}`,
      title: pickProposalLabel(item),
      summary: "This item was already published.",
    }));
    const recentModeration = comments.items
      .filter((item) => {
        const status = s(item?.status).toLowerCase();
        return (
          status === "reviewed" ||
          status === "approved" ||
          status === "replied" ||
          status === "flagged" ||
          status === "ignored"
        );
      })
      .slice(0, 3)
      .map((item) => ({
        id: `comment-${s(item?.id)}`,
        title: pickCommentLabel(item),
        summary: `Comment moderation status is ${s(item?.status || "updated").replace(/[_-]+/g, " ")}.`,
      }));

    return {
      comments,
      proposals,
      posture,
      waitingText,
      moderationText,
      approvalText,
      blockedText,
      recentItems: [...recentPublished, ...recentModeration].slice(0, 6),
    };
  }, [state.comments, state.proposals, state.trust]);

  if (state.loading) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-[#ece2d3] bg-[#fffdf9]/90 px-6 py-6 text-sm leading-6 text-stone-500 shadow-[0_18px_44px_rgba(120,102,73,0.08)]">
          Loading publish overview...
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-12 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <section className={sectionClasses()}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(640px_circle_at_0%_0%,rgba(233,217,188,0.16),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.38),transparent_24%)]" />
          <div className="relative space-y-6">
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                Publish
              </div>
              <div className="text-[34px] font-semibold tracking-[-0.055em] text-stone-950">
                Publish Workspace
              </div>
              <div className="max-w-3xl text-[15px] leading-7 text-stone-600">
                A calm outgoing-work surface for moderation, draft pressure, approvals, blocked publishing state, and recent publishing results.
              </div>
              {state.error ? (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {state.error}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-4">
              <SummaryMetric label="Waiting drafts" value={summary.proposals.waiting.length} />
              <SummaryMetric label="Needs moderation" value={summary.comments.pending} tone="warm" />
              <SummaryMetric label="Needs approval" value={summary.proposals.approved.length} />
              <SummaryMetric label="Recently published" value={summary.proposals.published.length} tone="soft" />
            </div>

            <div className={rowClasses()}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">
                What this surface is for
              </div>
              <div className="mt-2 text-sm leading-6 text-stone-600">
                Start here to see what is waiting, what is blocked, what still needs human review, and what the system already completed safely before you go deeper into proposal or moderation detail.
              </div>
            </div>
          </div>
        </section>

        <Section
          id="publish-workflow"
          eyebrow="Outgoing Workflow"
          title="What is waiting now"
          description="This section keeps draft pressure, moderation pressure, and approval pressure in one scan line so outgoing work feels like one flow."
          highlighted={focusSection === "moderation"}
        >
          <div className="space-y-3">
            <SummaryLine label="Draft work" text={summary.waitingText} />
            <SummaryLine
              label="Moderation"
              text={summary.moderationText}
              highlighted={focusSection === "moderation"}
            />
            <SummaryLine label="Approvals" text={summary.approvalText} />
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              to="/proposals"
              className="inline-flex items-center rounded-full border border-[#dfcfb2] bg-[#efe0c0] px-4 py-2 text-sm font-medium text-stone-900 transition hover:border-[#d4bf99] hover:bg-[#ead7b2]"
            >
              Open proposal details
            </Link>
            <Link
              to="/comments"
              className="inline-flex items-center rounded-full border border-[#e8decf] bg-[#fffaf4] px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-[#d9c8ac] hover:bg-white hover:text-stone-950"
            >
              Open moderation details
            </Link>
          </div>
        </Section>

        <Section
          id="publish-posture"
          eyebrow="Blocked Or Paused"
          title="Publishing posture"
          description="Blocked and review-only publishing posture stays compact here so it informs the workflow without becoming a separate control panel."
          highlighted={focusSection === "blocked"}
        >
          <SummaryLine
            label="Current state"
            text={summary.blockedText}
            highlighted={focusSection === "blocked"}
          />
        </Section>

        <Section
          id="publish-outcomes"
          eyebrow="Recent Outcomes"
          title="What recently went out"
          description="Recent published items and moderation completions are grouped together as one outcome feed."
          highlighted={focusSection === "outcomes"}
        >
          <div className="space-y-3">
            {summary.recentItems.length ? (
              summary.recentItems.map((item) => (
                <OutcomeRow
                  key={item.id}
                  item={item}
                  highlighted={focusSection === "outcomes"}
                />
              ))
            ) : (
              <SummaryLine
                label="No recent outcomes"
                text="Recent publishing and moderation outcomes will appear here when the system has visible completed work."
                highlighted={focusSection === "outcomes"}
              />
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
