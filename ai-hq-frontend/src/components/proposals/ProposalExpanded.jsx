import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Clock3,
  Copy,
  ScanSearch,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { getApiBase } from "../../api/client.js";
import { fetchLatestDraft } from "../../features/proposals/proposal.api.js";
import { DetailSection, MetaRow } from "./ProposalSections.jsx";
import { GlassButton, ToneBadge, SurfacePill } from "./proposal-ui.jsx";
import { cn } from "./proposal-utils.js";
import {
  asDisplay,
  executionFromProposal,
  executionRetryLabel,
  executionStatusTone,
  firstNonEmpty,
  getAssetUrlsFromEverywhere,
  isAssetReadyStatus,
  normalizeDraft,
  packAssetSpecs,
  packCaption,
  packCompliance,
  packCta,
  packDesign,
  packHashtags,
  packHook,
  packImagePrompt,
  packKeyPoints,
  packLanguage,
  packMusic,
  packPlatform,
  packPostTime,
  packReelScript,
  packShotDuration,
  packStoryboard,
  packType,
  pickDraftCandidate,
  pickPayloadObj,
  pretty,
  publishConfirmationLabel,
  rawStatusOf,
  relTime,
  shortId,
  stageOf,
  stageLabel,
  stageTone,
  summaryOf,
  titleFrom,
} from "../../features/proposals/proposal.selectors.js";

function readString(v) {
  return typeof v === "string" ? v : "";
}

function panelTone(stage) {
  if (stage === "approved") {
    return {
      glow:
        "bg-[radial-gradient(760px_circle_at_0%_0%,rgba(16,185,129,0.10),transparent_28%),radial-gradient(620px_circle_at_100%_0%,rgba(20,184,166,0.08),transparent_32%)]",
      rail: "bg-emerald-300/75",
    };
  }

  if (stage === "published") {
    return {
      glow:
        "bg-[radial-gradient(760px_circle_at_0%_0%,rgba(245,158,11,0.10),transparent_28%),radial-gradient(620px_circle_at_100%_0%,rgba(251,191,36,0.08),transparent_32%)]",
      rail: "bg-amber-300/75",
    };
  }

  if (stage === "rejected") {
    return {
      glow:
        "bg-[radial-gradient(760px_circle_at_0%_0%,rgba(244,63,94,0.10),transparent_28%),radial-gradient(620px_circle_at_100%_0%,rgba(251,113,133,0.08),transparent_32%)]",
      rail: "bg-rose-300/75",
    };
  }

  return {
    glow:
      "bg-[radial-gradient(760px_circle_at_0%_0%,rgba(34,211,238,0.09),transparent_28%),radial-gradient(620px_circle_at_100%_0%,rgba(99,102,241,0.09),transparent_32%)]",
    rail: "bg-cyan-300/75",
  };
}

function normalizeAnalysis(pack) {
  if (!pack || typeof pack !== "object") return null;
  const a = pack.analysis || pack.qa || null;
  return a && typeof a === "object" ? a : null;
}

function verdictTone(verdict) {
  const v = String(verdict || "").trim().toLowerCase();

  if (v === "publish_ready") return "success";
  if (v === "strong_with_minor_improvements") return "neutral";
  if (v === "needs_targeted_fixes") return "warning";
  if (v === "needs_major_revision") return "danger";
  return "neutral";
}

function verdictLabel(verdict) {
  const v = String(verdict || "").trim().toLowerCase();

  if (v === "publish_ready") return "Publish ready";
  if (v === "strong_with_minor_improvements") return "Strong";
  if (v === "needs_targeted_fixes") return "Fixes needed";
  if (v === "needs_major_revision") return "Major revision";
  return "No analysis";
}

function scoreDisplay(score) {
  return typeof score === "number" ? `${score}/10` : "—";
}

function buildExecutionStatusNote(execution, publishConfirmation) {
  const status = String(execution?.status || "").trim().toLowerCase();
  if (!status) return "";
  if (status === "queued" || status === "pending") {
    return "Latest execution is queued. Publish has not been confirmed.";
  }
  if (status === "running" || status === "in_progress") {
    return "Latest execution is in progress. Publish has not been confirmed.";
  }
  if (status === "retrying" || status === "retryable") {
    return "Latest execution is in retry flow. Publish has not been confirmed.";
  }
  if (status === "failed" || status === "error") {
    return "Latest execution failed. This record is not published.";
  }
  if (status === "skipped") {
    return "Latest execution was skipped. This record is not published.";
  }
  if (
    (status === "completed" || status === "success") &&
    publishConfirmation !== "confirmed"
  ) {
    return "Latest execution completed without a publish confirmation on this record.";
  }
  return "";
}

export default function ProposalExpanded({
  item,
  onClose,
  onApprove,
  onReject,
  onPublish,
  onAnalyze,
  onRequestChanges,
  busy,
}) {
  const apiBase = useMemo(() => getApiBase(), []);
  const [tab, setTab] = useState("design");
  const [feedback, setFeedback] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [fetchedDraftRaw, setFetchedDraftRaw] = useState(null);
  const [fetchingDraft, setFetchingDraft] = useState(false);
  const [showInputs, setShowInputs] = useState(true);

  const resolvedDraft = useMemo(() => {
    const primary = pickDraftCandidate(item);
    const normalizedPrimary = normalizeDraft(primary);

    if (normalizedPrimary?.id) return normalizedPrimary;

    const normalizedFetched = normalizeDraft(fetchedDraftRaw);
    if (normalizedFetched?.id) return normalizedFetched;

    return normalizedPrimary || normalizedFetched || null;
  }, [item, fetchedDraftRaw]);

  const pack = resolvedDraft?.pack || null;
  const analysis = useMemo(() => normalizeAnalysis(pack), [pack]);

  useEffect(() => {
    setFeedback("");
    setRejectReason("");
    setFetchedDraftRaw(null);
    setTab("design");
    setShowInputs(true);
  }, [item?.id]);

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!item?.id) return;

      const candidate = pickDraftCandidate(item);
      const normalized = normalizeDraft(candidate);

      if (normalized?.pack && normalized?.id) return;
      if (!apiBase) return;

      setFetchingDraft(true);

      try {
        const next = await fetchLatestDraft(apiBase, item.id);
        if (!alive) return;
        setFetchedDraftRaw(next);
      } catch {
      } finally {
        if (alive) setFetchingDraft(false);
      }
    }

    run();

    return () => {
      alive = false;
    };
  }, [apiBase, item?.id]);

  const title = titleFrom(item);
  const summary = summaryOf(item);
  const stage = stageOf(item);
  const tone = panelTone(stage);
  const exactProposalStatus = stageLabel(item);
  const execution = executionFromProposal(item);
  const executionRetry = executionRetryLabel(execution);
  const publishConfirmation = publishConfirmationLabel(item, execution);
  const executionStatusNote = buildExecutionStatusNote(execution, publishConfirmation);

  const proposalStatus = String(item?.status || "draft").toLowerCase();
  const isRejected = proposalStatus === "rejected";
  const isPublished = proposalStatus === "published";
  const isApproved = proposalStatus === "approved";
  const isDraftStage = !isRejected && !isPublished && !isApproved;

  const draftStatusLc = String(resolvedDraft?.status || "").toLowerCase();
  const isRegenerating =
    draftStatusLc.includes("regenerat") ||
    draftStatusLc.includes("changes") ||
    draftStatusLc.includes("revise");

  const isDraftReady =
    Boolean(pack) &&
    (draftStatusLc.includes("ready") ||
      draftStatusLc === "" ||
      draftStatusLc.includes("draft"));

  const assetUrls = getAssetUrlsFromEverywhere(item, resolvedDraft, pack);
  const hasPublishableAsset = assetUrls.length > 0;

  const isAssetReady =
    isAssetReadyStatus(resolvedDraft?.status) ||
    isAssetReadyStatus(proposalStatus) ||
    (isApproved && hasPublishableAsset);

  const canPublish =
    Boolean(resolvedDraft?.id) &&
    hasPublishableAsset &&
    isAssetReady &&
    !isPublished &&
    !isRejected;

  const canAnalyze =
    Boolean(resolvedDraft?.id) &&
    !isRejected &&
    (isApproved || isPublished || isAssetReady);

  const effectiveBusy = Boolean(busy || fetchingDraft);

  const agent = item?.agent_key || item?.agentKey || item?.agent || "—";
  const created = relTime(item?.created_at || item?.createdAt);
  const payloadObj = pickPayloadObj(item);

  const lang =
    packLanguage(pack) ||
    readString(payloadObj?.language) ||
    readString(payloadObj?.lang) ||
    "";

  const platform = packPlatform(pack);
  const postType = packType(pack);
  const postTime = packPostTime(pack);
  const cta = packCta(pack);
  const hook = packHook(pack);
  const hashtags = packHashtags(pack);
  const design = packDesign(pack);
  const script = packReelScript(pack);
  const imgPrompt = packImagePrompt(pack);
  const storyboard = packStoryboard(pack);
  const specs = packAssetSpecs(pack);
  const keyPoints = packKeyPoints(pack);
  const compliance = packCompliance(pack);
  const duration = packShotDuration(pack);
  const captionText = firstNonEmpty(
    packCaption(pack),
    pack?.headline,
    pack?.copy,
    pack?.summary
  );

  const copy = async (t) => {
    try {
      await navigator.clipboard.writeText(String(t || ""));
    } catch {}
  };

  const copyJson = async (obj) => {
    try {
      await navigator.clipboard.writeText(pretty(obj));
    } catch {}
  };

  const doApprove = async () => {
    if (!resolvedDraft?.id || !onApprove) return;
    await onApprove(item, resolvedDraft);
  };

  const doReject = async () => {
    if (!resolvedDraft?.id || !onReject || !String(rejectReason || "").trim())
      return;
    await onReject(item, resolvedDraft, String(rejectReason || "").trim());
    setRejectReason("");
  };

  const doAnalyze = async () => {
    if (!resolvedDraft?.id || !onAnalyze || !canAnalyze) return;
    await onAnalyze(item, resolvedDraft);
  };

  const doPublish = async () => {
    if (!resolvedDraft?.id || !onPublish || !canPublish) return;
    await onPublish(item, resolvedDraft);
  };

  const doRequestChanges = async () => {
    if (!resolvedDraft?.id || !onRequestChanges) return;
    const fb = String(feedback || "").trim();
    if (!fb) return;
    await onRequestChanges(item, resolvedDraft, fb);
    setFeedback("");
  };

  const tabs = [
    { value: "design", label: "Design" },
    { value: "script", label: "Script" },
    { value: "storyboard", label: "Storyboard" },
    { value: "specs", label: "Specs" },
    { value: "raw", label: "Raw" },
  ];

  return (
    <motion.div
      layoutId={`proposal-card-${item?.id}`}
      className="relative overflow-hidden rounded-[34px] border border-white/[0.09] bg-[linear-gradient(180deg,rgba(8,14,24,0.94),rgba(5,9,18,0.86))] shadow-[0_28px_90px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl"
    >
      <div className={cn("pointer-events-none absolute inset-0", tone.glow)} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />

      <div className="relative border-b border-white/[0.07] px-5 py-5 md:px-6 md:py-6">
        <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
          <div className="min-w-0 max-w-[980px]">
            <div className="flex flex-wrap items-center gap-2">
              <ToneBadge tone={stageTone(stage, rawStatusOf(item))}>
                {stage === "draft" ? "Queue" : stage}
              </ToneBadge>

              {exactProposalStatus ? (
                <ToneBadge tone={stageTone(stage, rawStatusOf(item))}>
                  {exactProposalStatus}
                </ToneBadge>
              ) : null}

              {execution?.status ? (
                <ToneBadge tone={executionStatusTone(execution.status)}>
                  execution {execution.status}
                </ToneBadge>
              ) : null}

              {executionRetry ? <ToneBadge tone="warn">{executionRetry}</ToneBadge> : null}

              {publishConfirmation ? (
                <ToneBadge
                  tone={publishConfirmation === "confirmed" ? "success" : "warn"}
                >
                  publish {publishConfirmation}
                </ToneBadge>
              ) : null}

              {postType ? <ToneBadge tone="neutral">{postType}</ToneBadge> : null}

              <ToneBadge
                tone={
                  String(resolvedDraft?.status || "").includes("ready")
                    ? "success"
                    : "neutral"
                }
              >
                {resolvedDraft?.status || (fetchingDraft ? "loading…" : "no draft")}
                {typeof resolvedDraft?.version === "number"
                  ? ` · v${resolvedDraft.version}`
                  : ""}
              </ToneBadge>

              {isAssetReady ? <ToneBadge tone="success">asset ready</ToneBadge> : null}

              {analysis ? (
                <ToneBadge tone={verdictTone(analysis?.verdict)}>
                  Analyze · {scoreDisplay(analysis?.score)}
                </ToneBadge>
              ) : null}

              <SurfacePill className="text-white/48">
                PR-{shortId(item?.id).toUpperCase()}
              </SurfacePill>
            </div>

            <h2 className="mt-4 max-w-[980px] text-[28px] font-semibold leading-[0.98] tracking-[-0.06em] text-white md:text-[38px]">
              {title}
            </h2>

            {summary ? (
              <p className="mt-3 max-w-[900px] text-[14px] leading-7 text-white/46">
                {summary}
              </p>
            ) : null}

            {executionStatusNote ? (
              <div className="mt-4 max-w-[900px] rounded-[18px] border border-amber-300/14 bg-amber-300/[0.07] px-4 py-3 text-[13px] leading-6 text-amber-50/88">
                {executionStatusNote}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-white/40">
              <span className="font-medium text-white/60">{agent}</span>
              {created ? (
                <>
                  <span>·</span>
                  <span>{created}</span>
                </>
              ) : null}
              <span>·</span>
              <span>{apiBase || "VITE_API_BASE missing"}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 2xl:max-w-[520px] 2xl:justify-end">
            <GlassButton size="lg" onClick={() => copy(String(item?.id || ""))}>
              <Copy className="h-4 w-4" />
              Copy ID
            </GlassButton>

            <GlassButton size="lg" onClick={() => copy(captionText)} disabled={!captionText}>
              <Copy className="h-4 w-4" />
              Copy caption
            </GlassButton>

            <GlassButton size="lg" onClick={() => copyJson(pack || resolvedDraft?.raw || item)}>
              <Copy className="h-4 w-4" />
              Copy JSON
            </GlassButton>

            <GlassButton
              size="lg"
              variant="primary"
              onClick={doApprove}
              disabled={
                effectiveBusy ||
                !resolvedDraft?.id ||
                !isDraftStage ||
                !isDraftReady ||
                isRejected ||
                isPublished
              }
            >
              <Check className="h-4 w-4" />
              Approve
            </GlassButton>

            <GlassButton
              size="lg"
              variant="danger"
              onClick={doReject}
              disabled={
                effectiveBusy ||
                !resolvedDraft?.id ||
                !isDraftStage ||
                isRejected ||
                isPublished ||
                !String(rejectReason || "").trim()
              }
            >
              <X className="h-4 w-4" />
              Reject
            </GlassButton>

            <GlassButton
              size="lg"
              onClick={doAnalyze}
              disabled={effectiveBusy || !canAnalyze}
              className="bg-white/[0.06]"
              title={
                effectiveBusy
                  ? "Busy"
                  : !resolvedDraft?.id
                    ? "Content ID missing"
                    : isRejected
                      ? "Rejected"
                      : !canAnalyze
                        ? "Approved və ya asset.ready olmalıdır"
                        : ""
              }
            >
              <ScanSearch className="h-4 w-4" />
              Analyze
            </GlassButton>

            <GlassButton
              size="lg"
              variant="primary"
              onClick={doPublish}
              disabled={effectiveBusy || !canPublish}
              className="bg-cyan-300/14"
              title={
                effectiveBusy
                  ? "Busy"
                  : !resolvedDraft?.id
                    ? "Content ID missing"
                    : isRejected
                      ? "Rejected"
                      : isPublished
                        ? "Already published"
                        : !hasPublishableAsset
                          ? "Asset URL missing"
                          : !isAssetReady
                            ? "Asset not ready yet"
                            : ""
              }
            >
              <Send className="h-4 w-4" />
              Publish
            </GlassButton>

            <GlassButton size="lg" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </GlassButton>
          </div>
        </div>
      </div>

      <div className="relative px-5 py-5 md:px-6 md:py-6">
        {!pack ? (
          <DetailSection
            title="Draft Studio"
            right={<div className="text-[11px] text-white/34">{fetchingDraft ? "Loading…" : ""}</div>}
          >
            <div className="text-[13px] text-white/48">
              {fetchingDraft ? "Draft axtarıram… /api/content?proposalId=..." : "Draft görünmür."}
            </div>
          </DetailSection>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.12fr)_340px]">
            <div className="min-w-0 space-y-5">
              <DetailSection
                title="Caption"
                right={
                  <div className="flex items-center gap-2 text-[11px] text-white/34">
                    <Clock3 className="h-3.5 w-3.5" />
                    Continuous review
                  </div>
                }
              >
                <div className="whitespace-pre-wrap break-words text-[14px] leading-[1.9] text-white/84">
                  {captionText || "—"}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ToneBadge tone="neutral">{platform}</ToneBadge>
                  <ToneBadge tone="neutral">{lang || "—"}</ToneBadge>
                  <ToneBadge tone="neutral">{postType || "—"}</ToneBadge>
                  {postTime ? <ToneBadge tone="neutral">Time: {postTime}</ToneBadge> : null}
                  {cta ? <ToneBadge tone="neutral">CTA: {cta}</ToneBadge> : null}
                  {duration ? <ToneBadge tone="neutral">Dur: {duration}</ToneBadge> : null}
                  {hasPublishableAsset ? <ToneBadge tone="success">Asset linked</ToneBadge> : null}
                  {hook ? <ToneBadge tone="neutral">Hook: {hook}</ToneBadge> : null}
                </div>

                {keyPoints ? (
                  <div className="mt-4 rounded-[20px] border border-white/[0.06] bg-black/10 p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">
                      Key points
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-6 text-white/74">
                      {asDisplay(keyPoints) || "—"}
                    </pre>
                  </div>
                ) : null}
              </DetailSection>

              {analysis ? (
                <DetailSection
                  title="Analyze report"
                  right={
                    <div className="flex items-center gap-2">
                      <ToneBadge tone={verdictTone(analysis?.verdict)}>
                        {verdictLabel(analysis?.verdict)}
                      </ToneBadge>
                      <ToneBadge tone="neutral">{scoreDisplay(analysis?.score)}</ToneBadge>
                    </div>
                  }
                >
                  <div className="text-[13px] leading-7 text-white/76">
                    {readString(analysis?.summary) || "—"}
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">
                        Strengths
                      </div>
                      <div className="mt-3 space-y-2">
                        {Array.isArray(analysis?.strengths) && analysis.strengths.length ? (
                          analysis.strengths.map((x, i) => (
                            <div key={`${x}_${i}`} className="text-[12px] leading-6 text-white/72">
                              • {x}
                            </div>
                          ))
                        ) : (
                          <div className="text-[12px] text-white/34">No strengths listed</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">
                        Issues
                      </div>
                      <div className="mt-3 space-y-3">
                        {Array.isArray(analysis?.issues) && analysis.issues.length ? (
                          analysis.issues.map((it, i) => (
                            <div key={`${it?.code || "issue"}_${i}`} className="rounded-[14px] bg-black/10 p-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <ToneBadge tone="neutral">{it?.code || "issue"}</ToneBadge>
                                <ToneBadge tone="neutral">{it?.severity || "—"}</ToneBadge>
                                <ToneBadge tone="neutral">{it?.area || "—"}</ToneBadge>
                              </div>
                              <div className="mt-2 text-[12px] leading-6 text-white/72">
                                {it?.message || "—"}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-[12px] text-white/34">No issues listed</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">
                      Recommended fixes
                    </div>

                    <div className="mt-3 space-y-3">
                      {Array.isArray(analysis?.recommendedFixes) &&
                      analysis.recommendedFixes.length ? (
                        analysis.recommendedFixes.map((it, i) => (
                          <div key={`${it?.target || "fix"}_${i}`} className="rounded-[14px] bg-black/10 p-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <ToneBadge tone="neutral">{it?.priority || "—"}</ToneBadge>
                              <ToneBadge tone="neutral">{it?.target || "—"}</ToneBadge>
                            </div>
                            <div className="mt-2 text-[12px] leading-6 text-white/72">
                              {it?.instruction || "—"}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-[12px] text-white/34">No fixes listed</div>
                      )}
                    </div>
                  </div>

                  {analysis?.dimensionScores ? (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-[11px] font-semibold text-white/42">
                        Dimension scores
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-6 text-white/68">
                        {pretty(analysis.dimensionScores)}
                      </pre>
                    </details>
                  ) : null}
                </DetailSection>
              ) : null}

              <div className="rounded-[24px] border border-white/[0.06] bg-white/[0.025] p-2">
                <div className="flex flex-wrap items-center gap-2">
                  {tabs.map((t) => {
                    const active = tab === t.value;

                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTab(t.value)}
                        className={cn(
                          "rounded-full border px-3.5 py-2 text-[12px] font-medium transition",
                          active
                            ? "border-white/[0.12] bg-white/[0.09] text-white"
                            : "border-white/[0.06] bg-white/[0.03] text-white/56 hover:bg-white/[0.05] hover:text-white/82"
                        )}
                      >
                        {t.label}
                      </button>
                    );
                  })}

                  {isRegenerating ? (
                    <span className="ml-2 text-[11px] text-white/34">Regenerating…</span>
                  ) : null}
                </div>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
                  transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                >
                  <DetailSection title={tab}>
                    {tab === "design" ? (
                      <>
                        <div className="whitespace-pre-wrap break-words text-[13px] leading-7 text-white/76">
                          {design || "—"}
                        </div>

                        {imgPrompt ? (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-[11px] font-semibold text-white/42">
                              Image prompt
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-6 text-white/68">
                              {imgPrompt}
                            </pre>
                          </details>
                        ) : null}

                        {compliance ? (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-[11px] font-semibold text-white/42">
                              Compliance / Notes
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-6 text-white/68">
                              {compliance}
                            </pre>
                          </details>
                        ) : null}

                        {hasPublishableAsset ? (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-[11px] font-semibold text-white/42">
                              Asset URLs
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words text-[12px] leading-6 text-white/68">
                              {assetUrls.join("\n")}
                            </pre>
                          </details>
                        ) : null}
                      </>
                    ) : tab === "script" ? (
                      <>
                        <pre className="whitespace-pre-wrap break-words text-[13px] leading-7 text-white/76">
                          {script || "—"}
                        </pre>

                        {packMusic(pack) ? (
                          <div className="mt-3 text-[12px] text-white/48">
                            <b>Music/SFX:</b> {packMusic(pack)}
                          </div>
                        ) : null}
                      </>
                    ) : tab === "storyboard" ? (
                      <pre className="whitespace-pre-wrap break-words text-[13px] leading-7 text-white/76">
                        {asDisplay(storyboard) || "—"}
                      </pre>
                    ) : tab === "specs" ? (
                      <pre className="whitespace-pre-wrap break-words text-[13px] leading-7 text-white/76">
                        {asDisplay(specs) || "—"}
                      </pre>
                    ) : (
                      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-6 text-white/66">
                        {pretty({
                          proposal: item,
                          draft: resolvedDraft,
                          fetchedDraftRaw,
                          assetUrls,
                          analysis,
                          canPublish,
                          canAnalyze,
                          isAssetReady,
                        })}
                      </pre>
                    )}
                  </DetailSection>
                </motion.div>
              </AnimatePresence>

              {showInputs ? (
                <DetailSection
                  title="Feedback loop"
                  right={<div className="text-[11px] text-white/34">Loop</div>}
                >
                  <div className="text-[12px] leading-6 text-white/44">
                    Request changes → revise → new draft → approve / reject / analyze / publish.
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                        Change request
                      </div>

                      <textarea
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        rows={5}
                        className="mt-2 w-full rounded-[20px] border border-white/[0.08] bg-white/[0.04] p-3 text-[13px] text-white outline-none placeholder:text-white/24 transition focus:border-cyan-300/20 focus:bg-white/[0.055]"
                        placeholder='Məs: "Caption daha qısa. 8 hashtag. CTA WhatsApp. Dizaynda 3 kadr..."'
                        disabled={effectiveBusy || isRegenerating || isRejected || isPublished}
                      />

                      <div className="mt-3">
                        <GlassButton
                          size="lg"
                          onClick={doRequestChanges}
                          disabled={
                            effectiveBusy ||
                            !resolvedDraft?.id ||
                            !showInputs ||
                            !String(feedback || "").trim() ||
                            isRejected ||
                            isPublished
                          }
                        >
                          <Send className="h-4 w-4" />
                          Request changes
                        </GlassButton>
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">
                        Reject reason
                      </div>

                      <input
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="mt-2 h-12 w-full rounded-[20px] border border-white/[0.08] bg-white/[0.04] px-3 text-[13px] text-white outline-none placeholder:text-white/24 transition focus:border-rose-300/20 focus:bg-white/[0.055]"
                        placeholder='Məs: "Brand uyğun deyil"...'
                        disabled={effectiveBusy || isRegenerating}
                      />

                      {resolvedDraft?.lastFeedback ? (
                        <div className="mt-3 text-[12px] leading-6 text-white/42">
                          <b>Last feedback:</b> {String(resolvedDraft.lastFeedback).slice(0, 140)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </DetailSection>
              ) : null}

              <button
                type="button"
                onClick={() => setShowInputs((v) => !v)}
                className="text-[12px] font-medium text-white/42 transition hover:text-white/72"
              >
                {showInputs ? "Hide inputs" : "Show inputs"}
              </button>
            </div>

            <div className="min-w-0 space-y-5">
              <DetailSection title="Overview">
                <div className="space-y-3 text-[13px] text-white/70">
                  <MetaRow k="Platform" v={platform} />
                  <MetaRow k="Language" v={lang || "—"} />
                  <MetaRow k="Format" v={postType || "—"} />
                  <MetaRow k="Post time" v={postTime || "—"} />
                  <MetaRow k="CTA" v={cta || "—"} />
                  <MetaRow k="Content ID" v={resolvedDraft?.id || "—"} />
                  <MetaRow
                    k="Updated"
                    v={resolvedDraft?.updatedAt ? relTime(resolvedDraft.updatedAt) : "—"}
                  />
                  <MetaRow k="Proposal status" v={exactProposalStatus || "—"} />
                  <MetaRow k="Draft status" v={resolvedDraft?.status || "—"} />
                  <MetaRow k="Execution status" v={execution?.status || "â€”"} />
                  <MetaRow k="Retry lineage" v={executionRetry || "â€”"} />
                  <MetaRow k="Publish confirmation" v={publishConfirmation || "â€”"} />
                  <MetaRow
                    k="Assets"
                    v={hasPublishableAsset ? `${assetUrls.length} linked` : "—"}
                  />
                  <MetaRow k="Publish ready" v={canPublish ? "yes" : "no"} />
                  <MetaRow k="Analyze score" v={scoreDisplay(analysis?.score)} />
                  <MetaRow
                    k="Analyze verdict"
                    v={analysis ? verdictLabel(analysis?.verdict) : "—"}
                  />
                </div>

                <div className="mt-5">
                  <span className={cn("block h-[4px] w-14 rounded-full", tone.rail)} />
                </div>
              </DetailSection>

              <DetailSection
                title="Hashtags"
                right={
                  <div className="flex items-center gap-1 text-[11px] text-white/34">
                    <Sparkles className="h-3.5 w-3.5" />
                    {hashtags.length}
                  </div>
                }
              >
                <div className="flex flex-wrap gap-2">
                  {hashtags.length ? (
                    hashtags.slice(0, 36).map((tag, i) => (
                      <span
                        key={`${tag}_${i}`}
                        className="rounded-full border border-white/[0.06] bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/68"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <div className="text-[12px] text-white/30">No hashtags</div>
                  )}
                </div>
              </DetailSection>

              {hook ? (
                <DetailSection title="Hook / Angle">
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-7 text-white/76">
                    {hook}
                  </div>
                </DetailSection>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
