import { ArrowRight, Globe2, PenSquare } from "lucide-react";
import React from "react";

import Button from "../../../components/ui/Button.jsx";
import Input, { Textarea } from "../../../components/ui/Input.jsx";
import { InlineCallout, PageSection, SurfaceBlock } from "../../../components/ui/PageSection.jsx";
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

function ResumeCard({
  hasStoredReview,
  hasApprovedTruth,
  onResumeReview,
  onOpenWorkspace,
}) {
  if (!hasStoredReview && !hasApprovedTruth) return null;

  return (
    <SurfaceBlock className="p-5">
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
            <Button type="button" variant="surface" size="pill" onClick={onResumeReview}>
              Continue draft
            </Button>
          ) : null}
          {hasApprovedTruth && typeof onOpenWorkspace === "function" ? (
            <Button type="button" variant="surface" size="pill" onClick={onOpenWorkspace}>
              Enter workspace
            </Button>
          ) : null}
        </div>
      </div>
    </SurfaceBlock>
  );
}

function WorkspacePreviewCard({ onOpenWorkspacePreview }) {
  if (typeof onOpenWorkspacePreview !== "function") return null;

  return (
    <SurfaceBlock tone="info" className="p-5">
      <TinyChip tone="info">Temporary QA</TinyChip>
      <div className="mt-3 text-base font-semibold tracking-[-0.03em] text-slate-950">
        Open workspace preview
      </div>
      <div className="mt-1 text-sm leading-6 text-slate-500">
        Temporary shortcut for manual visual review during this cleanup pass.
      </div>
      <div className="mt-4">
        <Button type="button" variant="surface" size="pill" onClick={onOpenWorkspacePreview}>
          Open workspace
        </Button>
      </div>
    </SurfaceBlock>
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
  onOpenWorkspacePreview,
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
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <TinyLabel>Step 1 of 4</TinyLabel>
            <TinyChip>Website or description</TinyChip>
          </div>

          <PageSection divider={false}>
            <div className="space-y-5">
              <label className="block">
                <div className="product-field-label mb-2 flex items-center gap-2 text-slate-700">
                <Globe2 className="h-4 w-4 text-slate-400" />
                Website
                </div>
                <Input
                  value={websiteValue}
                  onChange={(event) => handleWebsiteChange(event.target.value)}
                  placeholder="yourbusiness.com"
                  autoComplete="off"
                  spellCheck={false}
                  appearance="product"
                />
              </label>

              <label className="block">
                <div className="product-field-label mb-2 flex items-center gap-2 text-slate-700">
                  <PenSquare className="h-4 w-4 text-slate-400" />
                  Short business description
                </div>
                <Textarea
                  rows={6}
                  value={descriptionValue}
                  onChange={(event) => handleDescriptionChange(event.target.value)}
                  placeholder="Example: Dental clinic in Baku offering implants, whitening, and family checkups in Azerbaijani and English."
                  appearance="product"
                />
              </label>
            </div>
          </PageSection>

          <PageSection>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <InlineCallout
                title="Keep it simple"
                body="One website or a few clear lines is enough to get started."
                className="max-w-[420px]"
              />

              <Button
                type="button"
                variant="brand"
                size="hero"
                disabled={!canContinue || importingWebsite}
                onClick={onContinueFlow}
                rightIcon={!importingWebsite ? <ArrowRight className="h-4 w-4" /> : undefined}
              >
                {importingWebsite ? "Building draft..." : "Build draft"}
              </Button>
            </div>
          </PageSection>
        </div>

        <div className="space-y-4">
          <WorkspacePreviewCard onOpenWorkspacePreview={onOpenWorkspacePreview} />

          <ResumeCard
            hasStoredReview={hasStoredReview}
            hasApprovedTruth={hasApprovedTruth}
            onResumeReview={onResumeReview}
            onOpenWorkspace={onOpenWorkspace}
          />

          <SurfaceBlock className="p-5">
            <div className="text-sm font-semibold text-slate-950">
              What happens next
            </div>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-500">
              <div>1. We prepare a draft from what you entered.</div>
              <div>2. You review the draft.</div>
              <div>3. You confirm it and continue into your workspace.</div>
            </div>
          </SurfaceBlock>

          <InlineCallout
            title="You can keep setup short"
            body="Add more sources, services, FAQs, and policies after this first setup."
            className="py-2"
          />
        </div>
      </div>
    </SetupStudioStageShell>
  );
}
