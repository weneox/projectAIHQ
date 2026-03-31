import {
  MessageCircle,
  ShieldAlert,
  CheckCircle2,
  Clock3,
  Search,
  Filter,
  Bot,
  UserRound,
  Ban,
  Send,
} from "lucide-react";

import AdminPageShell from "../components/admin/AdminPageShell.jsx";
import CommentMiniInfo from "../components/comments/CommentMiniInfo.jsx";
import CommentRow from "../components/comments/CommentRow.jsx";
import CommentStatCard from "../components/comments/CommentStatCard.jsx";
import { fmtRelative, priorityTone, statusTone } from "../features/comments/comment-utils.js";
import { useCommentsData } from "../hooks/useCommentsData.js";

export default function Comments() {
  const {
    statusFilter,
    setStatusFilter,
    setSelectedId,
    search,
    setSearch,
    replyDraft,
    setReplyDraft,
    surface,
    actionLoading,
    filtered,
    selected,
    stats,
    handleReview,
    handleReplySave,
    handleIgnore,
  } = useCommentsData();

  return (
    <AdminPageShell
      eyebrow="Operator moderation"
      title="Comments"
      description="Social comment moderation, AI reply review, and operator intervention."
      surface={surface}
      refreshLabel="Refresh comments"
      unavailableMessage="Comments moderation is temporarily unavailable."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <CommentStatCard label="Total Comments" value={stats.total} icon={MessageCircle} />
        <CommentStatCard label="Pending Review" value={stats.pending} icon={Clock3} tone="amber" />
        <CommentStatCard label="Replied / Reviewed" value={stats.replied} icon={CheckCircle2} tone="emerald" />
        <CommentStatCard label="Flagged / Ignored" value={stats.flagged} icon={ShieldAlert} tone="cyan" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="premium-panel p-5">
          <div className="flex flex-col gap-4 border-b premium-divider pb-4">
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-slate-950">Comment Stream</div>
              <div className="mt-1 text-sm text-slate-500">Post comments, sentiment, and reply workflow.</div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Author, text, post..."
                  className="premium-input h-11 w-full rounded-2xl pl-10 pr-4 text-sm outline-none focus:border-sky-300/90"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {["all", "pending", "manual_review", "reviewed", "replied", "flagged", "ignored"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`premium-pill ${
                      statusFilter === status
                        ? "is-active"
                        : "hover:text-slate-900"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="hidden xl:grid xl:grid-cols-[1.1fr_1fr_0.7fr_0.7fr_0.7fr] xl:gap-3 xl:px-2 xl:text-[11px] xl:uppercase xl:tracking-[0.18em] xl:text-slate-400">
              <div>Author</div>
              <div>Comment</div>
              <div>Status</div>
              <div>Sentiment</div>
              <div className="text-right">Priority</div>
            </div>

            {surface.loading ? (
              <div className="premium-empty px-4 py-10 text-center">
                <div className="text-sm font-medium text-slate-700">Loading comments...</div>
              </div>
            ) : surface.unavailable ? (
              <div className="premium-empty border-rose-200 bg-rose-50/90 px-4 py-10 text-center">
                <div className="text-sm font-medium text-rose-700">Failed to load comments</div>
                <div className="mt-2 text-sm leading-6 text-rose-600">{surface.error}</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="premium-empty px-4 py-10 text-center">
                <div className="text-sm font-medium text-slate-700">No comments</div>
                <div className="mt-2 text-sm leading-6 text-slate-500">No comments matched the current filters.</div>
              </div>
            ) : (
              filtered.map((item) => (
                <CommentRow key={item.id} item={item} selected={selected?.id === item.id} onSelect={(row) => setSelectedId(row.id)} />
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="premium-panel p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/72 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_10px_24px_-18px_rgba(15,23,42,0.18)]">
                <MessageCircle className="h-4 w-4 text-slate-600" />
              </div>
              <div>
                <div className="text-[16px] font-semibold tracking-[-0.03em] text-slate-950">Comment Detail</div>
                <div className="mt-1 text-sm text-slate-500">Selected comment moderation panel.</div>
              </div>
            </div>

            <div className="premium-panel-subtle mt-5 p-4">
              {!selected ? (
                <div className="px-2 py-8 text-center">
                  <div className="text-sm font-medium text-slate-700">No comment selected</div>
                  <div className="mt-2 text-sm leading-6 text-slate-500">Select a comment from the stream.</div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-[18px] font-semibold tracking-[-0.03em] text-slate-950">{selected.author}</div>
                      <div className="mt-1 text-sm text-slate-500">{selected.postTitle}</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(selected.status)}`}>
                        {selected.status}
                      </span>
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${priorityTone(selected.priority)}`}>
                        {selected.priority}
                      </span>
                    </div>
                  </div>

                  <div className="premium-panel-subtle mt-5 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Original Comment</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.text || "—"}</div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <CommentMiniInfo label="Platform" value={selected.platform} icon={Filter} />
                    <CommentMiniInfo label="Sentiment" value={selected.sentiment} icon={ShieldAlert} />
                    <CommentMiniInfo label="Assigned to" value={selected.assignedTo} icon={UserRound} />
                    <CommentMiniInfo label="Created" value={fmtRelative(selected.createdAt)} icon={Clock3} />
                    <CommentMiniInfo label="Category" value={selected.category} icon={Bot} />
                    <CommentMiniInfo label="Lead Intent" value={selected.shouldCreateLead ? "Yes" : "No"} icon={CheckCircle2} />
                    <CommentMiniInfo label="Moderated by" value={selected.moderationActor || "—"} icon={UserRound} />
                    <CommentMiniInfo label="Moderation update" value={fmtRelative(selected.moderationUpdatedAt)} icon={Clock3} />
                  </div>

                  <div className="premium-panel-subtle mt-4 px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-slate-400">
                      <Bot className="h-3.5 w-3.5" />
                      Suggested Reply
                    </div>

                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={5}
                      placeholder="Reply draft..."
                      className="premium-textarea w-full resize-none rounded-2xl px-4 py-3 text-sm leading-6 outline-none focus:border-sky-300/90"
                    />
                  </div>

                  {!!selected.moderationNote && (
                    <div className="premium-panel-subtle mt-4 px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Moderation Note</div>
                      <div className="mt-2 text-sm leading-6 text-slate-700">{selected.moderationNote}</div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleReplySave}
                      disabled={actionLoading === "reply"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {actionLoading === "reply" ? "Saving..." : "Save Reply"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview("manual_review")}
                      disabled={actionLoading === "review:manual_review"}
                      className="premium-panel-subtle inline-flex h-11 items-center justify-center gap-2 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {actionLoading === "review:manual_review" ? "Saving..." : "Manual Review"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview("reviewed")}
                      disabled={actionLoading === "review:reviewed"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {actionLoading === "review:reviewed" ? "Saving..." : "Mark Reviewed"}
                    </button>

                    <button
                      type="button"
                      onClick={handleIgnore}
                      disabled={actionLoading === "ignore"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Ban className="h-4 w-4" />
                      {actionLoading === "ignore" ? "Saving..." : "Ignore"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="premium-panel p-5">
            <div className="text-[16px] font-semibold tracking-[-0.03em] text-slate-950">System Note</div>
            <div className="premium-panel-subtle mt-4 px-4 py-4 text-sm leading-6 text-slate-600">
              This page reads from the real comments backend and drives review, reply, and ignore actions.
            </div>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
