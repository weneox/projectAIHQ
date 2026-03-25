import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import ProposalCanvas from "../components/ProposalCanvas.jsx";

import {
  listProposals,
  requestDraftChanges,
  approveDraft,
  rejectDraft,
  publishDraft,
  analyzeDraft,
} from "../api/proposals.js";
import { realtimeStore } from "../lib/realtime/realtimeStore.js";

const BACKEND_STATUSES = [
  "draft",
  "in_progress",
  "approved",
  "published",
  "rejected",
  "pending",
];

const UI_TABS = ["draft", "approved", "published", "rejected"];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function normalizeList(resp) {
  if (Array.isArray(resp)) return resp;
  if (resp && Array.isArray(resp.proposals)) return resp.proposals;
  return [];
}

function parseDateMs(x) {
  const v = x ? Date.parse(x) : NaN;
  return Number.isFinite(v) ? v : 0;
}

function sortNewestFirst(a, b) {
  const am = parseDateMs(
    a?.updated_at || a?.updatedAt || a?.created_at || a?.createdAt
  );
  const bm = parseDateMs(
    b?.updated_at || b?.updatedAt || b?.created_at || b?.createdAt
  );
  return bm - am;
}

function uniqById(items) {
  const seen = new Set();
  const out = [];

  for (const it of items || []) {
    const id = String(it?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(it);
  }

  return out;
}

function mergeDraftItems(draft, inProgress, pendingMaybe) {
  return uniqById([
    ...(draft || []),
    ...(inProgress || []),
    ...(pendingMaybe || []),
  ]).sort(sortNewestFirst);
}

function safeJson(x) {
  try {
    if (!x) return null;
    if (typeof x === "string") return JSON.parse(x);
    if (typeof x === "object") return x;
    return null;
  } catch {
    return null;
  }
}

function pickContentIdFromProposal(p) {
  const direct =
    p?.latestContent?.id ||
    p?.latestDraft?.id ||
    p?.latest_draft?.id ||
    p?.draft?.id ||
    p?.contentDraft?.id ||
    p?.content_item?.id ||
    p?.contentItem?.id ||
    p?.latest_execution?.id ||
    p?.lastExecution?.id ||
    p?.latestExecution?.id ||
    p?.execution?.id ||
    p?.job?.id ||
    p?.jobs?.[0]?.id;

  if (direct) return String(direct);

  const nestedSources = [
    p?.latestContent,
    p?.latestDraft,
    p?.latest_draft,
    p?.draft,
    p?.contentDraft,
    p?.content_item,
    p?.contentItem,
    p?.latest_execution,
    p?.lastExecution,
    p?.latestExecution,
    p?.execution,
    p?.job,
    p?.jobs?.[0],
  ].filter(Boolean);

  for (const src of nestedSources) {
    const obj = safeJson(src) || src;
    if (!obj || typeof obj !== "object") continue;

    const nestedId =
      obj?.id ||
      obj?.contentItemId ||
      obj?.content_item_id ||
      obj?.content_item?.id;

    if (nestedId) return String(nestedId);
  }

  return "";
}

function SurfaceMessage({
  icon,
  tone = "neutral",
  title,
  desc,
  action,
}) {
  const toneStyles = {
    neutral:
      "bg-[linear-gradient(180deg,rgba(8,14,26,0.92),rgba(5,10,18,0.84))]",
    danger:
      "bg-[linear-gradient(180deg,rgba(58,12,20,0.34),rgba(24,8,14,0.28))]",
    info:
      "bg-[linear-gradient(180deg,rgba(8,20,34,0.92),rgba(5,10,18,0.84))]",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[30px] px-5 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-2xl md:px-6 md:py-6",
        toneStyles[tone]
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_circle_at_0%_0%,rgba(255,255,255,0.03),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_44%)]" />
      <div className="relative flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/[0.05] text-white/84 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold tracking-[-0.02em] text-white">
            {title}
          </div>
          <p className="mt-1 text-[13px] leading-6 text-white/50">{desc}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export default function ProposalsPage() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [status, setStatus] = useState("draft");
  const [search, setSearch] = useState("");
  const [proposals, setProposals] = useState([]);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const [wsStatus, setWsStatus] = useState({ state: "disconnected" });
  const statusRef = useRef("draft");

  const [stats, setStats] = useState({
    draft: 0,
    in_progress: 0,
    approved: 0,
    published: 0,
    rejected: 0,
    pending: 0,
  });

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const showToast = (msg) => {
    if (!msg) return;
    setToast(msg);
    window.setTimeout(() => setToast(""), 1400);
  };

  const refreshStats = async () => {
    try {
      const results = await Promise.allSettled(
        BACKEND_STATUSES.map(async (s) => {
          const items = await listProposals(s);
          return { status: s, items: normalizeList(items) };
        })
      );

      const next = {
        draft: 0,
        in_progress: 0,
        approved: 0,
        published: 0,
        rejected: 0,
        pending: 0,
      };

      for (const x of results) {
        if (x.status !== "fulfilled") continue;
        const { status: s, items } = x.value || {};
        if (!s) continue;
        next[s] = Array.isArray(items) ? items.length : 0;
      }

      next.draft =
        (next.draft || 0) + (next.in_progress || 0) + (next.pending || 0);

      setStats(next);
    } catch {}
  };

  const fetchByUiStatus = async (uiStatus) => {
    const s = String(uiStatus || "draft").toLowerCase();

    if (s === "draft") {
      const [a, b, c] = await Promise.all([
        listProposals("draft"),
        listProposals("in_progress"),
        listProposals("pending"),
      ]);

      return mergeDraftItems(
        normalizeList(a),
        normalizeList(b),
        normalizeList(c)
      );
    }

    const list = await listProposals(s);
    return normalizeList(list).sort(sortNewestFirst);
  };

  const refreshProposals = async (why = "", opts = {}) => {
    const desiredStatus = opts.status ?? statusRef.current;

    setErr("");

    try {
      const next = await fetchByUiStatus(desiredStatus);
      setProposals(next);

      if (why) showToast(why);
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshProposals();
    refreshStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    const unsubscribeStatus = realtimeStore.subscribeStatus((nextStatus) => {
      setWsStatus(nextStatus || { state: "idle" });
    });

    const unsubscribeEvents = realtimeStore.subscribeEvents(({ type }) => {
        const isProposalEvent =
          type === "proposal.created" || type === "proposal.updated";
        const isContentEvent = type === "content.updated";
        const isExecEvent =
          type === "execution.updated" || type === "job.updated";

        if (isProposalEvent || isContentEvent || isExecEvent) {
          refreshStats();

          const currentStatus = statusRef.current;
          refreshProposals(
            isProposalEvent && type === "proposal.created" ? "New item" : "",
            { status: currentStatus }
          );
        }
    });
    if (!realtimeStore.canUseWs()) setWsStatus({ state: "off" });

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
    };
  }, []);

  useEffect(() => {
    const s = wsStatus?.state;
    if (s === "connected") return;

    const id = setInterval(() => {
      refreshProposals();
      refreshStats();
    }, 9000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus?.state, status]);

  const onRequestChanges = async (proposalId, contentId, feedbackText) => {
    setBusy(true);
    setErr("");

    try {
      await requestDraftChanges(proposalId, contentId, feedbackText);
      await refreshProposals("Changes requested", {
        status: statusRef.current,
      });
      await refreshStats();
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onApproveDraft = async (proposalId, contentId) => {
    setBusy(true);
    setErr("");

    try {
      await approveDraft(proposalId, contentId);
      await refreshStats();

      if (statusRef.current !== "draft") {
        setStatus("draft");
      }

      await refreshProposals("Asset generation started", {
        status: "draft",
      });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onRejectDraft = async (proposalId, contentId, reasonText) => {
    setBusy(true);
    setErr("");

    try {
      await rejectDraft(proposalId, contentId, reasonText);
      await refreshStats();

      if (statusRef.current !== "rejected") {
        setStatus("rejected");
      }

      await refreshProposals("Rejected", {
        status: "rejected",
      });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onAnalyze = async (proposalId, contentId) => {
    setBusy(true);
    setErr("");

    try {
      const res = await analyzeDraft(proposalId, contentId);
      if (res?.ok === false) {
        throw new Error(
          res?.details?.replyText || res?.error || "analyze failed"
        );
      }

      await refreshStats();
      await refreshProposals("Analyze completed", {
        status: statusRef.current,
      });
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const onPublish = async (proposalId, contentId) => {
    setBusy(true);
    setErr("");

    try {
      const res = await publishDraft(proposalId, contentId);
      if (res?.ok === false) {
        throw new Error(res?.error || "publish failed");
      }

      await refreshStats();

      const currentStatus = statusRef.current;
      const currentList = await fetchByUiStatus(currentStatus);
      setProposals(currentList);

      showToast("Publish requested");

      try {
        const publishedItems = await fetchByUiStatus("published");
        const nowPublished = publishedItems.some(
          (p) => String(p?.id) === String(proposalId)
        );

        if (nowPublished) {
          setStatus("published");
          setProposals(publishedItems);
          showToast("Published");
        }
      } catch {}
    } catch (e) {
      setErr(String(e?.message || e));
    } finally {
      setBusy(false);
    }
  };

  const handleCanvasRequestChanges = async (
    item,
    resolvedDraft,
    feedbackText
  ) => {
    if (busy) return;

    const proposalId = String(item?.id || "");
    const contentId = String(resolvedDraft?.id || "");

    if (!proposalId || !contentId) {
      setErr("Request changes üçün content ID tapılmadı.");
      return;
    }

    await onRequestChanges(proposalId, contentId, feedbackText);
  };

  const handleCanvasApprove = async (item, resolvedDraft) => {
    if (busy) return;

    const proposalId = String(item?.id || "");
    const contentId = String(
      resolvedDraft?.id || pickContentIdFromProposal(item) || ""
    );

    if (!proposalId || !contentId) {
      setErr("Approve üçün content ID tapılmadı.");
      return;
    }

    await onApproveDraft(proposalId, contentId);
  };

  const handleCanvasReject = async (item, resolvedDraft, reasonText) => {
    if (busy) return;

    const proposalId = String(item?.id || "");
    const contentId = String(
      resolvedDraft?.id || pickContentIdFromProposal(item) || ""
    );

    if (!proposalId || !contentId) {
      setErr("Reject üçün content ID tapılmadı.");
      return;
    }

    await onRejectDraft(
      proposalId,
      contentId,
      reasonText || "Rejected from canvas"
    );
  };

  const handleCanvasAnalyze = async (item, resolvedDraft) => {
    if (busy) return;

    const proposalId = String(item?.id || "");
    const contentId = String(
      resolvedDraft?.id || pickContentIdFromProposal(item) || ""
    );

    if (!proposalId || !contentId) {
      setErr("Analyze üçün content ID tapılmadı.");
      return;
    }

    await onAnalyze(proposalId, contentId);
  };

  const handleCanvasPublish = async (item, resolvedDraft) => {
    if (busy) return;

    const proposalId = String(item?.id || "");
    const contentId = String(
      resolvedDraft?.id || pickContentIdFromProposal(item) || ""
    );

    if (!proposalId || !contentId) {
      setErr("Publish üçün content ID tapılmadı.");
      return;
    }

    await onPublish(proposalId, contentId);
  };

  const counts = useMemo(
    () => ({
      all:
        (stats?.draft || 0) +
        (stats?.approved || 0) +
        (stats?.published || 0) +
        (stats?.rejected || 0),
      draft: stats?.draft || 0,
      approved: stats?.approved || 0,
      published: stats?.published || 0,
      rejected: stats?.rejected || 0,
    }),
    [stats]
  );

  return (
    <div className="min-h-0 h-full min-w-0 overflow-y-auto overscroll-contain pr-1">
      <div className="mx-auto flex min-w-0 max-w-[1800px] flex-col gap-5 pb-10">
        {err ? (
          <SurfaceMessage
            tone="danger"
            icon={<AlertCircle className="h-5 w-5" />}
            title="Workflow issue"
            desc={err}
            action={
              <button
                type="button"
                onClick={async () => {
                  await refreshProposals();
                  await refreshStats();
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white/[0.06] px-4 py-2 text-[13px] font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:bg-white/[0.09]"
              >
                Retry refresh
                <ArrowUpRight className="h-4 w-4" />
              </button>
            }
          />
        ) : null}

        {loading ? (
          <SurfaceMessage
            tone="info"
            icon={<LoaderCircle className="h-5 w-5 animate-spin" />}
            title="Loading proposals"
            desc="Fetching drafts, approvals, publishing states, and latest surface context from the backend."
          />
        ) : proposals.length === 0 ? (
          <SurfaceMessage
            tone="neutral"
            icon={<Sparkles className="h-5 w-5" />}
            title="No items in this view"
            desc={
              status === "draft"
                ? "Draft intake is empty right now. New drafts, pending items, and in-progress items will appear here as soon as they enter the queue."
                : "There is nothing in this state yet. Switch the surface state or refresh when new items arrive."
            }
            action={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 text-[12px] text-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <Clock3 className="h-3.5 w-3.5" />
                  Live polling fallback active
                </div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.05] px-3 py-2 text-[12px] text-white/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Current view: {status}
                </div>
              </div>
            }
          />
        ) : (
          <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(180deg,rgba(7,12,24,0.52),rgba(4,8,16,0.28))] p-[1px] shadow-[0_30px_120px_rgba(0,0,0,0.28)]">
            <div className="rounded-[35px] bg-[linear-gradient(180deg,rgba(4,9,18,0.88),rgba(3,7,14,0.76))] p-2 md:p-3">
              <ProposalCanvas
                proposals={proposals}
                stats={stats}
                status={status}
                setStatus={(s) => {
                  const next = UI_TABS.includes(String(s)) ? String(s) : "draft";
                  setStatus(next);
                }}
                search={search}
                setSearch={setSearch}
                busy={busy}
                toast={toast}
                wsStatus={wsStatus}
                counts={counts}
                onRefresh={async () => {
                  await refreshProposals("Refreshed");
                  await refreshStats();
                }}
                onApprove={handleCanvasApprove}
                onReject={handleCanvasReject}
                onPublish={handleCanvasPublish}
                onAnalyze={handleCanvasAnalyze}
                onRequestChanges={handleCanvasRequestChanges}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
