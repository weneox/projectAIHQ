import {
  MessageCircle,
  RefreshCw,
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

import { fmtRelative, statusTone, priorityTone } from "../features/comments/comment-utils.js";
import { useCommentsData } from "../hooks/useCommentsData.js";

import CommentStatCard from "../components/comments/CommentStatCard.jsx";
import CommentRow from "../components/comments/CommentRow.jsx";
import CommentMiniInfo from "../components/comments/CommentMiniInfo.jsx";

export default function Comments() {
  const {
    statusFilter,
    setStatusFilter,
    setSelectedId,
    search,
    setSearch,
    loading,
    refreshing,
    error,
    replyDraft,
    setReplyDraft,
    actionLoading,
    loadComments,
    filtered,
    selected,
    stats,
    handleReview,
    handleReplySave,
    handleIgnore,
  } = useCommentsData();

  return (
    <div className="min-h-screen px-6 pb-6 pt-6 md:px-8">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[30px] font-semibold tracking-[-0.05em] text-white">
            Comments
          </div>
          <div className="mt-2 text-sm text-white/46">
            Sosial media comment axını üçün moderation, AI reply və operator review paneli.
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadComments({ silent: true })}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-white/72 transition hover:border-white/16 hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <CommentStatCard label="Total Comments" value={stats.total} icon={MessageCircle} />
        <CommentStatCard label="Pending Review" value={stats.pending} icon={Clock3} tone="amber" />
        <CommentStatCard label="Replied / Reviewed" value={stats.replied} icon={CheckCircle2} tone="emerald" />
        <CommentStatCard label="Flagged / Ignored" value={stats.flagged} icon={ShieldAlert} tone="cyan" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/8 pb-4">
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">
                Comment Stream
              </div>
              <div className="mt-1 text-sm text-white/46">
                Post altı rəylər, sentiment və cavab axını.
              </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-[340px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/34" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Author, text, post..."
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.03] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/28 focus:border-white/16"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {["all", "pending", "manual_review", "reviewed", "replied", "flagged", "ignored"].map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`rounded-full border px-3.5 py-2 text-[12px] font-medium transition ${
                      statusFilter === status
                        ? "border-white/10 bg-white/[0.04] text-white/78"
                        : "border-white/10 bg-white/[0.02] text-white/44 hover:border-white/16 hover:bg-white/[0.04] hover:text-white/70"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div className="hidden xl:grid xl:grid-cols-[1.1fr_1fr_0.7fr_0.7fr_0.7fr] xl:gap-3 xl:px-2 xl:text-[11px] xl:uppercase xl:tracking-[0.18em] xl:text-white/28">
              <div>Author</div>
              <div>Comment</div>
              <div>Status</div>
              <div>Sentiment</div>
              <div className="text-right">Priority</div>
            </div>

            {loading ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
                <div className="text-sm font-medium text-white/64">Loading comments...</div>
              </div>
            ) : error ? (
              <div className="rounded-[22px] border border-dashed border-rose-400/20 bg-rose-400/[0.04] px-4 py-10 text-center">
                <div className="text-sm font-medium text-rose-100">Failed to load comments</div>
                <div className="mt-2 text-sm leading-6 text-rose-100/70">{error}</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/20 px-4 py-10 text-center">
                <div className="text-sm font-medium text-white/64">No comments</div>
                <div className="mt-2 text-sm leading-6 text-white/40">
                  Hələ comment yoxdur və ya filter nəticə qaytarmadı.
                </div>
              </div>
            ) : (
              filtered.map((item) => (
                <CommentRow
                  key={item.id}
                  item={item}
                  selected={selected?.id === item.id}
                  onSelect={(row) => setSelectedId(row.id)}
                />
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <MessageCircle className="h-4 w-4 text-white/72" />
              </div>
              <div>
                <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">
                  Comment Detail
                </div>
                <div className="mt-1 text-sm text-white/46">
                  Seçilmiş comment üçün moderation paneli.
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/8 bg-black/20 p-4">
              {!selected ? (
                <div className="px-2 py-8 text-center">
                  <div className="text-sm font-medium text-white/64">No comment selected</div>
                  <div className="mt-2 text-sm leading-6 text-white/40">
                    Sol tərəfdən bir comment seç.
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="truncate text-[18px] font-semibold tracking-[-0.03em] text-white">
                        {selected.author}
                      </div>
                      <div className="mt-1 text-sm text-white/44">{selected.postTitle}</div>
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

                  <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">
                      Original Comment
                    </div>
                    <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/78">
                      {selected.text || "—"}
                    </div>
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

                  <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                    <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/32">
                      <Bot className="h-3.5 w-3.5" />
                      Suggested Reply
                    </div>

                    <textarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      rows={5}
                      placeholder="Reply draft..."
                      className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/28 focus:border-white/16"
                    />
                  </div>

                  {!!selected.moderationNote && (
                    <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-3">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-white/32">
                        Moderation Note
                      </div>
                      <div className="mt-2 text-sm leading-6 text-white/76">
                        {selected.moderationNote}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleReplySave}
                      disabled={actionLoading === "reply"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.08] px-4 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Send className="h-4 w-4" />
                      {actionLoading === "reply" ? "Saving..." : "Save Reply"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview("manual_review")}
                      disabled={actionLoading === "review:manual_review"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/78 transition hover:border-white/16 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldAlert className="h-4 w-4" />
                      {actionLoading === "review:manual_review" ? "Saving..." : "Manual Review"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleReview("reviewed")}
                      disabled={actionLoading === "review:reviewed"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.08] px-4 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {actionLoading === "review:reviewed" ? "Saving..." : "Mark Reviewed"}
                    </button>

                    <button
                      type="button"
                      onClick={handleIgnore}
                      disabled={actionLoading === "ignore"}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/[0.08] px-4 text-sm font-medium text-rose-100 transition hover:bg-rose-400/[0.12] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Ban className="h-4 w-4" />
                      {actionLoading === "ignore" ? "Saving..." : "Ignore"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_22px_60px_rgba(0,0,0,0.22)] backdrop-blur-xl">
            <div className="text-[16px] font-semibold tracking-[-0.03em] text-white">
              System Note
            </div>

            <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.02] px-4 py-4 text-sm leading-6 text-white/62">
              Bu səhifə indi real backend-dən `/api/comments` oxuyur və action endpoint-lərinə bağlıdır:
              review, reply, ignore. Növbəti addım Meta reply executor və live websocket item-level sync olacaq.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}