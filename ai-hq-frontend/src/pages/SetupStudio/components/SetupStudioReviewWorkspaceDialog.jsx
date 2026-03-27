import FocusDialog from "../../../components/ui/FocusDialog.jsx";

import SetupStudioRefineModal from "./SetupStudioRefineModal.jsx";

function s(v, d = "") {
  return String(v ?? d).trim();
}

function obj(v, d = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : d;
}

export function SetupStudioReviewSyncBanner({
  reviewSyncState = {},
  onReloadReviewDraft,
}) {
  const state = obj(reviewSyncState);
  const level = s(state.level);
  const message = s(state.message);

  if (!message || level === "idle" || level === "ready") return null;

  const showRecoveryAction =
    typeof onReloadReviewDraft === "function" &&
    (level === "conflict" || level === "stale" || level === "mismatch");

  const tone =
    level === "conflict" || level === "stale"
      ? "border-amber-200 bg-amber-50/90 text-amber-900"
      : "border-slate-200 bg-slate-50/90 text-slate-700";

  return (
    <div className={`rounded-[24px] border px-4 py-3 text-sm ${tone}`}>
      <div className="font-medium">
        {level === "conflict"
          ? "Review conflict detected"
          : level === "stale"
            ? "Review is stale"
            : level === "mismatch"
              ? "Review/source mismatch"
              : "Review protection is limited"}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <div className="leading-6">{message}</div>
        {showRecoveryAction ? (
          <button
            type="button"
            onClick={onReloadReviewDraft}
            className="inline-flex h-9 items-center justify-center rounded-full border border-current/20 bg-white/60 px-3 text-xs font-medium transition hover:bg-white/80"
          >
            Reload draft
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function SetupStudioReviewWorkspaceDialog({
  open,
  savingBusiness,
  businessForm,
  discoveryProfileRows,
  manualSections,
  currentReview,
  reviewSources,
  reviewSyncState,
  onSetBusinessField,
  onSetManualSection,
  onSaveBusiness,
  onReloadReviewDraft,
  onClose,
}) {
  if (!open) return null;

  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title="Review workspace"
      backdropClassName="bg-[rgba(15,23,42,.18)] backdrop-blur-[14px]"
      panelClassName="w-full max-w-[1180px]"
    >
      <div>
        <div className="mb-3">
          <SetupStudioReviewSyncBanner
            reviewSyncState={reviewSyncState}
            onReloadReviewDraft={onReloadReviewDraft}
          />
        </div>
        <SetupStudioRefineModal
          savingBusiness={savingBusiness}
          businessForm={businessForm}
          discoveryProfileRows={discoveryProfileRows}
          manualSections={manualSections}
          onSetBusinessField={onSetBusinessField}
          onSetManualSection={onSetManualSection}
          onSaveBusiness={onSaveBusiness}
          onClose={onClose}
          currentReview={currentReview}
          reviewSources={reviewSources}
          reviewSyncState={reviewSyncState}
        />
      </div>
    </FocusDialog>
  );
}
