import { ArrowRight, Globe2, PenSquare } from "lucide-react";
import React from "react";

import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import { TinyChip, TinyLabel } from "../components/SetupStudioUi.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function buildWebsiteValue(discoveryForm = {}, businessForm = {}) {
  return s(discoveryForm?.websiteUrl || businessForm?.websiteUrl);
}

function buildDescriptionValue(discoveryForm = {}, businessForm = {}) {
  return s(discoveryForm?.note || businessForm?.description);
}

function QuietButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex h-12 items-center justify-center gap-2 rounded-full bg-slate-950 px-6 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
    </button>
  );
}

function ResumeCard({
  hasStoredReview,
  hasApprovedTruth,
  onResumeReview,
  onOpenWorkspace,
}) {
  if (!hasStoredReview && !hasApprovedTruth) return null;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {hasStoredReview ? <TinyChip>Draft in progress</TinyChip> : null}
            {hasApprovedTruth ? <TinyChip tone="success">Setup already confirmed</TinyChip> : null}
          </div>
          <div className="mt-3 text-base font-semibold tracking-[-0.03em] text-slate-950">
            Continue where you left off
          </div>
          <div className="mt-1 text-sm leading-6 text-slate-500">
            Start a new draft below, or pick up the latest setup you already have.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {hasStoredReview ? (
            <QuietButton type="button" onClick={onResumeReview}>
              Continue draft
            </QuietButton>
          ) : null}
          {hasApprovedTruth && typeof onOpenWorkspace === "function" ? (
            <QuietButton type="button" onClick={onOpenWorkspace}>
              Enter workspace
            </QuietButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WorkspacePreviewCard({ onOpenWorkspace }) {
  if (typeof onOpenWorkspace !== "function") return null;

  return (
    <div className="rounded-[28px] border border-sky-200 bg-sky-50/60 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <TinyChip tone="info">Temporary QA</TinyChip>
      </div>
      <div className="mt-3 text-base font-semibold tracking-[-0.03em] text-slate-950">
        Open workspace preview
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-500">
        Temporary shortcut for manual visual review during this cleanup pass.
      </div>
      <div className="mt-4">
        <QuietButton type="button" onClick={onOpenWorkspace}>
          Open workspace
        </QuietButton>
      </div>
    </div>
  );
}

export default function SetupStudioEntryStage({
  importingWebsite = false,
  discoveryForm = {},
  businessForm = {},
  hasStoredReview = false,
  hasApprovedTruth = false,
  onSetBusinessField,
  onSetDiscoveryField,
  onContinueFlow,
  onResumeReview,
  onOpenWorkspace,
}) {
  const websiteValue = buildWebsiteValue(discoveryForm, businessForm);
  const descriptionValue = buildDescriptionValue(discoveryForm, businessForm);
  const canContinue = !!(websiteValue || descriptionValue);

  const handleWebsiteChange = React.useCallback(
    (nextValue) => {
      onSetDiscoveryField?.("websiteUrl", nextValue);
      onSetDiscoveryField?.("sourceType", nextValue ? "website" : "");
      onSetDiscoveryField?.("sourceValue", nextValue);
      onSetBusinessField?.("websiteUrl", nextValue);
    },
    [onSetBusinessField, onSetDiscoveryField]
  );

  const handleDescriptionChange = React.useCallback(
    (nextValue) => {
      onSetDiscoveryField?.("note", nextValue);
      onSetBusinessField?.("description", nextValue);
    },
    [onSetBusinessField, onSetDiscoveryField]
  );

  return (
    <SetupStudioStageShell
      eyebrow="start"
      title="Tell us about your business"
      body="Add your website or a short description. We will prepare a draft for you to review before anything is saved."
    >
      <div className="mx-auto grid max-w-[1040px] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_24px_50px_-36px_rgba(15,23,42,.24)] sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <TinyLabel>Step 1 of 4</TinyLabel>
            <TinyChip>Website or description</TinyChip>
          </div>

          <div className="mt-6 space-y-5">
            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                <Globe2 className="h-4 w-4 text-slate-400" />
                Website
              </div>
              <input
                value={websiteValue}
                onChange={(event) => handleWebsiteChange(event.target.value)}
                placeholder="yourbusiness.com"
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-[18px] border border-slate-200 bg-slate-50/60 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
              />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-800">
                <PenSquare className="h-4 w-4 text-slate-400" />
                Short business description
              </div>
              <textarea
                rows={6}
                value={descriptionValue}
                onChange={(event) => handleDescriptionChange(event.target.value)}
                placeholder="Example: Dental clinic in Baku offering implants, whitening, and family checkups in Azerbaijani and English."
                className="min-h-[168px] w-full resize-none rounded-[22px] border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm leading-7 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm leading-6 text-slate-500">
              Keep it simple. One website or a few lines is enough to get started.
            </div>

            <PrimaryButton
              type="button"
              disabled={!canContinue || importingWebsite}
              onClick={onContinueFlow}
            >
              <span>{importingWebsite ? "Building draft..." : "Build draft"}</span>
              {!importingWebsite ? <ArrowRight className="h-4 w-4" /> : null}
            </PrimaryButton>
          </div>
        </div>

        <div className="space-y-4">
          <WorkspacePreviewCard onOpenWorkspace={onOpenWorkspace} />

          <ResumeCard
            hasStoredReview={hasStoredReview}
            hasApprovedTruth={hasApprovedTruth}
            onResumeReview={onResumeReview}
            onOpenWorkspace={onOpenWorkspace}
          />

          <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-5">
            <div className="text-sm font-semibold text-slate-950">
              What happens next
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-500">
              <div>1. We prepare a draft from what you entered.</div>
              <div>2. You review the draft.</div>
              <div>3. You confirm it and continue into your workspace.</div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-500">
            You can add more sources, services, FAQs, and policies after this first setup.
          </div>
        </div>
      </div>
    </SetupStudioStageShell>
  );
}
