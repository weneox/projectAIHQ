import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Ban,
  Bot,
  Facebook,
  Globe,
  Instagram,
  MessageCircle,
  PencilLine,
  Search,
  Send,
  ShieldAlert,
} from "lucide-react";

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import Input, { Textarea } from "../components/ui/Input.jsx";
import CommentRow from "../components/comments/CommentRow.jsx";
import {
  PageCanvas,
  PageHeader,
  SaveFeedback,
} from "../components/ui/AppShellPrimitives.jsx";
import {
  fmtRelative,
  labelizeToken,
} from "../features/comments/comment-utils.js";
import { useCommentsData } from "../hooks/useCommentsData.js";
import { cx } from "../lib/cx.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "manual_review", label: "Manual review" },
  { id: "reviewed", label: "Reviewed" },
  { id: "replied", label: "Replied" },
  { id: "flagged", label: "Flagged" },
  { id: "ignored", label: "Ignored" },
];

function PlatformGlyph({ platform, className }) {
  const value = String(platform || "").toLowerCase();

  if (value.includes("instagram")) {
    return <Instagram className={className} />;
  }
  if (value.includes("facebook")) {
    return <Facebook className={className} />;
  }

  return <Globe className={className} />;
}

function InlineState({ tone = "neutral", children, action = null }) {
  const toneClass =
    tone === "danger"
      ? "border-danger bg-danger-soft text-danger"
      : "border-line-soft bg-surface-subtle text-text-muted";

  return (
    <div
      className={cx(
        "flex flex-wrap items-center justify-between gap-3 border px-4 py-3",
        toneClass
      )}
    >
      <div className="min-w-0 text-[13px] font-medium leading-6">{children}</div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function FilterLink({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "text-[13px] font-medium tracking-[-0.01em] transition duration-200 ease-premium",
        active ? "text-text" : "text-text-subtle hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

function ComposerModeButton({ active, children, onClick, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-2 text-[12px] font-semibold tracking-[-0.01em] transition duration-200 ease-premium",
        active ? "text-text" : "text-text-subtle hover:text-text"
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{children}</span>
    </button>
  );
}

function PostTile({ post, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(post.id)}
      className="group w-full text-left"
    >
      <div
        className={cx(
          "relative aspect-square overflow-hidden bg-surface-subtle transition-[transform,box-shadow,outline] duration-200 ease-premium",
          selected
            ? "outline outline-2 outline-[rgba(var(--color-brand),0.34)]"
            : "hover:scale-[0.995]"
        )}
      >
        {post.coverUrl ? (
          <img
            src={post.coverUrl}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(239,242,247,0.92)_0%,rgba(228,233,240,0.96)_100%)]" />
        )}

        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.18)_100%)]" />

        <div className="absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/86 text-text shadow-[0_8px_20px_-14px_rgba(15,23,42,0.18)]">
          <PlatformGlyph platform={post.platform} className="h-4 w-4" />
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <div className="truncate text-[13px] font-semibold tracking-[-0.02em] text-white">
            {post.title}
          </div>
          <div className="mt-1 text-[12px] font-medium text-white/82">
            {post.totalComments} comments
          </div>
        </div>
      </div>
    </button>
  );
}

function MediaStage({ post }) {
  return (
    <div className="overflow-hidden bg-surface-subtle">
      <div className="relative aspect-[4/5] w-full bg-[linear-gradient(180deg,rgba(243,246,250,0.94)_0%,rgba(231,236,243,0.98)_100%)]">
        {post?.coverUrl ? (
          <img
            src={post.coverUrl}
            alt={post.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/78 text-text shadow-[0_18px_34px_-20px_rgba(15,23,42,0.18)]">
                <PlatformGlyph platform={post?.platform} className="h-6 w-6" />
              </div>
              <div className="mt-4 text-[14px] font-semibold tracking-[-0.02em] text-text">
                {post?.title || "Post"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonTile() {
  return <div className="aspect-square animate-pulse bg-surface-subtle" />;
}

export default function Comments() {
  const {
    posts,
    postComments,
    statusFilter,
    setStatusFilter,
    selectedPostId,
    setSelectedPostId,
    selectedId,
    setSelectedId,
    selectedPost,
    selected,
    search,
    setSearch,
    replyDraft,
    setReplyDraft,
    surface,
    actionLoading,
    visibleCommentCount,
    loadComments,
    handleReview,
    handleReplySave,
    handleIgnore,
  } = useCommentsData();

  const [composeMode, setComposeMode] = useState("ai");

  useEffect(() => {
    if (selected?.suggestedReply) {
      setComposeMode("ai");
      return;
    }

    setComposeMode("manual");
  }, [selected?.id, selected?.suggestedReply]);

  const selectedPostCaption = useMemo(() => {
    const caption = String(selectedPost?.caption || "").trim();
    if (!caption) return "";
    return caption.length > 180 ? `${caption.slice(0, 180).trim()}...` : caption;
  }, [selectedPost?.caption]);

  function useAiDraft() {
    setComposeMode("ai");
    setReplyDraft(selected?.suggestedReply || "");
  }

  function useManualDraft() {
    setComposeMode("manual");
    if (replyDraft === selected?.suggestedReply) {
      setReplyDraft("");
    }
  }

  return (
    <PageCanvas className="space-y-4">
      <PageHeader
        eyebrow="Moderation"
        title="Comments"
        description="Posts, threads, and reply control in one view."
        actions={
          <Button
            variant="secondary"
            onClick={loadComments}
            isLoading={surface.loading}
            className="h-[40px]"
          >
            Refresh
          </Button>
        }
      />

      <Card padded={false} clip className="border-line-soft">
        <div className="px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-[-0.03em] text-text">
                Post view
              </div>
              <div className="mt-1 text-[13px] font-medium text-text-muted">
                Select a post, inspect comments, then answer manually or from the AI draft.
              </div>
            </div>

            <div className="w-full xl:max-w-[340px]">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search comment, post, or author..."
                leftIcon={<Search className="h-4 w-4" />}
                appearance="quiet"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {FILTERS.map((filter) => (
              <FilterLink
                key={filter.id}
                active={statusFilter === filter.id}
                onClick={() => setStatusFilter(filter.id)}
              >
                {filter.label}
              </FilterLink>
            ))}

            <div className="ml-auto text-[12px] font-medium text-text-subtle">
              {posts.length} posts / {visibleCommentCount} comments
            </div>
          </div>

          <SaveFeedback
            success={surface.saveSuccess}
            error={surface.saveError}
            className="mt-4"
            successTitle="Comment updated"
            errorTitle="Unable to update comment"
          />
        </div>

        {surface.unavailable ? (
          <div className="border-t border-line-soft px-5 py-4 md:px-6">
            <InlineState
              tone="danger"
              action={
                <Button
                  variant="secondary"
                  onClick={loadComments}
                  className="h-[36px]"
                >
                  Retry
                </Button>
              }
            >
              {surface.error || "Comments unavailable."}
            </InlineState>
          </div>
        ) : null}

        <div className="border-t border-line-soft px-5 py-5 md:px-6">
          {surface.loading && !posts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonTile key={index} />
              ))}
            </div>
          ) : posts.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {posts.map((post) => (
                <PostTile
                  key={post.id}
                  post={post}
                  selected={post.id === selectedPostId}
                  onClick={setSelectedPostId}
                />
              ))}
            </div>
          ) : (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="max-w-[320px] text-center">
                <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-subtle">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div className="mt-4 text-[16px] font-semibold tracking-[-0.03em] text-text">
                  No posts to review
                </div>
                <div className="mt-2 text-[13px] leading-6 text-text-muted">
                  Connected post context will appear here as comment traffic arrives.
                </div>
              </div>
            </div>
          )}
        </div>

        {selectedPost ? (
          <>
            <div className="border-t border-line-soft" />

            <div className="grid xl:grid-cols-[minmax(340px,520px)_minmax(0,1fr)]">
              <div className="border-b border-line-soft xl:border-b-0 xl:border-r">
                <MediaStage post={selectedPost} />

                <div className="px-5 py-5 md:px-6">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-subtle text-text">
                      <PlatformGlyph
                        platform={selectedPost.platform}
                        className="h-4 w-4"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-semibold tracking-[-0.03em] text-text">
                        {selectedPost.title}
                      </div>
                      <div className="mt-1 text-[12px] font-medium text-text-subtle">
                        {labelizeToken(selectedPost.platform)} /{" "}
                        {selectedPost.totalComments} comments /{" "}
                        {fmtRelative(selectedPost.latestActivityAt)}
                      </div>
                    </div>
                  </div>

                  {selectedPostCaption ? (
                    <div className="mt-4 text-[13px] leading-6 text-text-muted">
                      {selectedPostCaption}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="min-w-0">
                <div className="px-5 py-5 md:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-[15px] font-semibold tracking-[-0.03em] text-text">
                        Comments
                      </div>
                      <div className="mt-1 text-[13px] font-medium text-text-muted">
                        {postComments.length} items on this post
                      </div>
                    </div>

                    {selected ? (
                      <div className="text-[12px] font-medium text-text-subtle">
                        Selected / {fmtRelative(selected.createdAt)}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 max-h-[420px] overflow-y-auto pr-1 panel-scroll">
                    {postComments.length ? (
                      <div className="space-y-1">
                        {postComments.map((item) => (
                          <CommentRow
                            key={item.id}
                            item={item}
                            selected={item.id === selectedId}
                            onSelect={(row) => setSelectedId(row.id)}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center text-[13px] text-text-muted">
                        No comments on this post yet.
                      </div>
                    )}
                  </div>

                  <div className="mt-5 border-t border-line-soft pt-5">
                    {!selected ? (
                      <div className="text-[13px] leading-6 text-text-muted">
                        Select a comment to load its reply workflow.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-[14px] font-semibold tracking-[-0.02em] text-text">
                                {selected.author}
                              </div>
                              <div className="mt-1 text-[12px] font-medium text-text-subtle">
                                {labelizeToken(selected.status)} /{" "}
                                {labelizeToken(selected.sentiment)} /{" "}
                                {labelizeToken(selected.priority)}
                              </div>
                            </div>

                            <div className="text-[12px] font-medium text-text-subtle">
                              {fmtRelative(selected.createdAt)}
                            </div>
                          </div>

                          <div className="mt-3 whitespace-pre-wrap text-[14px] leading-7 text-text">
                            {selected.text || "-"}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 border-t border-line-soft pt-4">
                          <ComposerModeButton
                            active={composeMode === "ai"}
                            onClick={useAiDraft}
                            icon={Bot}
                          >
                            AI draft
                          </ComposerModeButton>

                          <ComposerModeButton
                            active={composeMode === "manual"}
                            onClick={useManualDraft}
                            icon={PencilLine}
                          >
                            Write manually
                          </ComposerModeButton>
                        </div>

                        <Textarea
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          rows={6}
                          placeholder={
                            composeMode === "ai"
                              ? "AI draft will appear here if available..."
                              : "Write your reply..."
                          }
                          appearance="quiet"
                        />

                        <div className="flex flex-wrap items-center gap-2.5">
                          <Button
                            onClick={handleReplySave}
                            isLoading={actionLoading === "reply"}
                            leftIcon={<Send className="h-4 w-4" />}
                            className="h-[42px]"
                          >
                            Save reply
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() => handleReview("reviewed")}
                            isLoading={actionLoading === "review:reviewed"}
                            leftIcon={<CheckCircle2 className="h-4 w-4" />}
                            className="h-[42px] px-0 text-text"
                          >
                            Reviewed
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={() => handleReview("manual_review")}
                            isLoading={actionLoading === "review:manual_review"}
                            leftIcon={<ShieldAlert className="h-4 w-4" />}
                            className="h-[42px] px-0 text-text"
                          >
                            Manual review
                          </Button>

                          <Button
                            variant="ghost"
                            onClick={handleIgnore}
                            isLoading={actionLoading === "ignore"}
                            leftIcon={<Ban className="h-4 w-4" />}
                            className="h-[42px] px-0 text-danger hover:text-danger"
                          >
                            Ignore
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </Card>
    </PageCanvas>
  );
}
