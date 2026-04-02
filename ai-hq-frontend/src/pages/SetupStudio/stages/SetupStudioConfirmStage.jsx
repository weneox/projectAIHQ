import React from "react";

import Button from "../../../components/ui/Button.jsx";
import Input, { Textarea } from "../../../components/ui/Input.jsx";
import { InlineCallout, PageSection, SurfaceBlock } from "../../../components/ui/PageSection.jsx";
import { getControlPlanePermissions } from "../../../lib/controlPlanePermissions.js";
import SetupStudioStageShell from "../components/SetupStudioStageShell.jsx";
import { TinyChip, TinyLabel } from "../components/SetupStudioUi.jsx";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function buildSyncMessage(reviewSyncState = {}) {
  const level = s(reviewSyncState?.level).toLowerCase();
  if (!level || level === "idle" || level === "ready") return "";

  if (level === "conflict") {
    return "This draft changed somewhere else. Reload it before you continue.";
  }

  if (level === "stale") {
    return "This draft is out of date. Reload it before you continue.";
  }

  if (level === "mismatch") {
    return "The current draft no longer matches your latest source. Reload it before you continue.";
  }

  return s(reviewSyncState?.message);
}

function buildFieldList(businessForm = {}, manualSections = {}) {
  return [
    {
      key: "companyName",
      label: "Business name",
      value: s(businessForm?.companyName),
      placeholder: "Your business name",
    },
    {
      key: "websiteUrl",
      label: "Website",
      value: s(businessForm?.websiteUrl),
      placeholder: "yourbusiness.com",
    },
    {
      key: "primaryPhone",
      label: "Phone",
      value: s(businessForm?.primaryPhone),
      placeholder: "Phone number",
    },
    {
      key: "primaryEmail",
      label: "Email",
      value: s(businessForm?.primaryEmail),
      placeholder: "hello@yourbusiness.com",
    },
    {
      key: "description",
      label: "Business summary",
      value: s(businessForm?.description),
      placeholder: "What does your business do?",
      multiline: true,
    },
    {
      key: "servicesText",
      label: "Services",
      value: s(manualSections?.servicesText),
      placeholder: "One service per line",
      multiline: true,
      section: true,
    },
  ];
}

function Field({
  label,
  value,
  placeholder,
  multiline = false,
  onChange,
}) {
  const Element = multiline ? "textarea" : "input";

  return (
    <label className="block">
      <div className="product-field-label mb-2">
        {label}
      </div>
      {Element === "textarea" ? (
        <Textarea
          rows={4}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          appearance="product"
        />
      ) : (
        <Input
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          appearance="product"
        />
      )}
    </label>
  );
}

function BlockingBanner({
  reviewSyncState,
  permissionMessage,
  onReloadReviewDraft,
}) {
  const syncMessage = buildSyncMessage(reviewSyncState);
  const message = permissionMessage || syncMessage;
  if (!message) return null;

  return (
    <InlineCallout
      title="Final confirmation is paused"
      body={message}
      tone="warn"
      action={
        syncMessage && typeof onReloadReviewDraft === "function" ? (
          <Button type="button" variant="surface" size="pill" onClick={onReloadReviewDraft}>
            Reload draft
          </Button>
        ) : null
      }
    />
  );
}

function DetailSummary({ businessForm = {}, manualSections = {} }) {
  const values = [
    s(businessForm?.companyName),
    s(businessForm?.websiteUrl),
    s(businessForm?.primaryPhone),
    s(businessForm?.primaryEmail),
    s(businessForm?.description),
    s(manualSections?.servicesText),
  ].filter(Boolean);

  return (
    <SurfaceBlock className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <TinyLabel>Step 4 of 4</TinyLabel>
        <TinyChip>{values.length} section{values.length === 1 ? "" : "s"} ready</TinyChip>
      </div>

      <div className="mt-4 text-[26px] font-semibold tracking-[-0.045em] text-slate-950 sm:text-[32px]">
        Confirm your setup
      </div>
      <p className="mt-2 max-w-[760px] text-sm leading-7 text-slate-600">
        Make any final edits here, then confirm and start using your workspace.
      </p>
    </SurfaceBlock>
  );
}

export default function SetupStudioConfirmStage({
  savingBusiness = false,
  businessForm = {},
  manualSections = {},
  currentReview = {},
  reviewSyncState = {},
  onSetBusinessField,
  onSetManualSection,
  onReloadReviewDraft,
  onBack,
  onSubmit,
}) {
  const permissionState = getControlPlanePermissions({
    viewerRole: currentReview?.viewerRole,
    permissions: currentReview?.permissions,
  });
  const finalizePermission = permissionState.setupReviewFinalize;
  const syncMessage = buildSyncMessage(reviewSyncState);
  const permissionMessage = finalizePermission?.allowed
    ? ""
    : s(finalizePermission?.message || "You do not have permission to confirm this draft.");
  const blocked = !!permissionMessage || !!syncMessage;
  const fields = buildFieldList(businessForm, manualSections);

  return (
    <SetupStudioStageShell
      eyebrow="confirm"
      title="Confirm and continue"
      body="This is the last step. Keep it short and confirm the basics you want to start with."
    >
      <div className="mx-auto max-w-[1040px] space-y-6">
        <DetailSummary businessForm={businessForm} manualSections={manualSections} />

        <BlockingBanner
          reviewSyncState={reviewSyncState}
          permissionMessage={permissionMessage}
          onReloadReviewDraft={onReloadReviewDraft}
        />

        <PageSection>
          <div className="grid gap-4 lg:grid-cols-2">
          {fields.map((field) => (
            <div
              key={field.key}
              className={field.multiline ? "lg:col-span-2" : ""}
            >
              <Field
                label={field.label}
                value={field.value}
                placeholder={field.placeholder}
                multiline={field.multiline}
                onChange={(nextValue) => {
                  if (field.section) {
                    onSetManualSection?.(field.key, nextValue);
                    return;
                  }

                  onSetBusinessField?.(field.key, nextValue);
                }}
              />
            </div>
          ))}
          </div>
        </PageSection>

        <PageSection>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <InlineCallout
              title="You can finish the rest later"
              body="Add FAQs, policies, and extra sources after setup in Settings."
              className="max-w-[420px]"
            />

            <div className="flex flex-wrap gap-3">
              {typeof onBack === "function" ? (
                <Button type="button" variant="surface" size="hero" onClick={onBack} disabled={savingBusiness}>
                Back
                </Button>
              ) : null}
              <Button
                type="button"
                variant="brand"
                size="hero"
                onClick={onSubmit}
                disabled={savingBusiness || blocked}
              >
                {savingBusiness ? "Confirming..." : "Confirm and enter workspace"}
              </Button>
            </div>
          </div>
        </PageSection>
      </div>
    </SetupStudioStageShell>
  );
}
