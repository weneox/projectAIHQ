import React from "react";

import { StageSection, TinyChip } from "../SetupStudioUi.jsx";
import {
  channelBehaviorSummary,
  extractBehaviorProfile,
  formatBehaviorList,
} from "../../logic/behaviorProfile.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function cx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function tokenizeLines(value = "") {
  return s(value)
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function titleCase(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function SegmentControl({ label, value, options = [], onChange }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = s(option.value) === s(value);
          return (
            <button
              key={`${label}-${option.value}`}
              type="button"
              onClick={() => onChange?.(option.value)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition",
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CompactInput({ label, value, placeholder, onChange }) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <input
        value={s(value)}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-[18px] border border-slate-200 bg-white/92 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function CompactTextarea({ label, value, placeholder, onChange, rows = 3 }) {
  return (
    <label className="block">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>
      <textarea
        rows={rows}
        value={s(value)}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="min-h-[96px] w-full resize-none rounded-[18px] border border-slate-200 bg-white/92 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
      />
    </label>
  );
}

function TokenPreview({ items = [], emptyLabel = "No rules set yet." }) {
  const visible = arr(items).filter(Boolean);

  if (!visible.length) {
    return <div className="text-sm text-slate-500">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {visible.map((item) => (
        <TinyChip key={item}>{titleCase(item)}</TinyChip>
      ))}
    </div>
  );
}

function ChannelCard({
  title,
  subtitle,
  channelKey,
  channelValue = {},
  onChange,
  controls = [],
}) {
  const channel = obj(channelValue);

  return (
    <div className="rounded-[24px] border border-slate-200/80 bg-[rgba(255,255,255,.78)] p-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,.3)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</div>
        </div>
        <TinyChip>{channelBehaviorSummary(channelKey, channel)}</TinyChip>
      </div>

      <div className="mt-4 grid gap-4">
        {controls.map((control) => (
          <SegmentControl
            key={`${channelKey}-${control.key}`}
            label={control.label}
            value={channel[control.key]}
            options={control.options}
            onChange={(nextValue) =>
              onChange?.({
                ...channel,
                [control.key]: nextValue,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

export default function BehaviorReviewPanel({
  value = {},
  observedValue = {},
  onChange,
}) {
  const behavior = extractBehaviorProfile(value);
  const observed = extractBehaviorProfile(observedValue);
  const channelBehavior = obj(behavior.channelBehavior);
  const observedChannelBehavior = obj(observed.channelBehavior);

  const setField = (key, nextValue) => {
    onChange?.({
      ...behavior,
      [key]: nextValue,
    });
  };

  const setListField = (key, rawText) => {
    setField(key, tokenizeLines(rawText));
  };

  const setChannel = (key, nextChannel) => {
    const nextChannelBehavior = {
      ...channelBehavior,
      [key]: obj(nextChannel),
    };

    onChange?.({
      ...behavior,
      channelBehavior: nextChannelBehavior,
    });
  };

  const channelCards = [
    {
      key: "inbox",
      title: "Inbox preview",
      subtitle:
        "Shows how direct conversations will qualify, route, and call the CTA before finalize.",
      controls: [
        {
          key: "primaryAction",
          label: "Primary action",
          options: [
            { value: "book_consultation", label: "Book consult" },
            { value: "qualify_and_capture", label: "Qualify lead" },
            { value: "answer_and_route", label: "Answer + route" },
          ],
        },
        {
          key: "qualificationDepth",
          label: "Qualification depth",
          options: [
            { value: "light", label: "Light" },
            { value: "guided", label: "Guided" },
            { value: "deep", label: "Deep" },
          ],
        },
        {
          key: "handoffBias",
          label: "Handoff bias",
          options: [
            { value: "minimal", label: "Minimal" },
            { value: "conditional", label: "Conditional" },
            { value: "direct", label: "Direct" },
          ],
        },
      ],
    },
    {
      key: "comments",
      title: "Comments preview",
      subtitle:
        "Summarizes whether public replies should qualify lightly, move people to DM, or stay more guarded.",
      controls: [
        {
          key: "primaryAction",
          label: "Primary action",
          options: [
            { value: "qualify_then_move_to_dm", label: "Move to DM" },
            { value: "answer_publicly_then_cta", label: "Answer + CTA" },
            { value: "redirect_to_inbox", label: "Redirect" },
          ],
        },
        {
          key: "qualificationDepth",
          label: "Qualification depth",
          options: [
            { value: "light", label: "Light" },
            { value: "guided", label: "Guided" },
          ],
        },
        {
          key: "reviewBias",
          label: "Review bias",
          options: [
            { value: "low", label: "Low" },
            { value: "medium", label: "Medium" },
            { value: "high", label: "High" },
          ],
        },
      ],
    },
    {
      key: "voice",
      title: "Voice preview",
      subtitle:
        "Explains how calls should book, qualify, and escalate when confidence or risk changes.",
      controls: [
        {
          key: "primaryAction",
          label: "Primary action",
          options: [
            { value: "book_or_route_call", label: "Book or route" },
            { value: "route_or_capture_callback", label: "Callback route" },
            { value: "qualify_then_transfer", label: "Transfer" },
          ],
        },
        {
          key: "qualificationDepth",
          label: "Qualification depth",
          options: [
            { value: "guided", label: "Guided" },
            { value: "direct", label: "Direct" },
          ],
        },
        {
          key: "handoffBias",
          label: "Handoff bias",
          options: [
            { value: "manual", label: "Manual" },
            { value: "conditional", label: "Conditional" },
            { value: "immediate", label: "Immediate" },
          ],
        },
      ],
    },
    {
      key: "content",
      title: "Content/media preview",
      subtitle:
        "Summarizes the publishing angle the system will lean toward across content and media suggestions.",
      controls: [
        {
          key: "contentAngle",
          label: "Content angle",
          options: [
            { value: "educational", label: "Educational" },
            { value: "authority", label: "Authority" },
            { value: "promotional", label: "Promotional" },
            { value: "conversion", label: "Conversion" },
          ],
        },
        {
          key: "ctaMode",
          label: "CTA mode",
          options: [
            { value: "soft", label: "Soft" },
            { value: "direct", label: "Direct" },
            { value: "booking", label: "Booking" },
          ],
        },
        {
          key: "visualDirection",
          label: "Visual direction",
          options: [
            { value: "clean_service", label: "Clean service" },
            { value: "warm_lifestyle", label: "Warm lifestyle" },
            { value: "proof_and_results", label: "Proof/results" },
            { value: "premium_editorial", label: "Premium editorial" },
          ],
        },
      ],
    },
  ];

  return (
    <StageSection className="mt-6">
      <div className="rounded-[30px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,.9)_0%,rgba(248,250,252,.92)_100%)] p-5 shadow-[0_24px_60px_-40px_rgba(15,23,42,.34)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Behavior profile
            </div>
            <div className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">
              Shape how the business should behave before finalize
            </div>
            <div className="mt-1 max-w-[760px] text-sm leading-6 text-slate-500">
              Keep this focused: set the niche, conversion path, guardrails, and per-channel intent the runtime should follow.
            </div>
          </div>
          {formatBehaviorList(observed.handoffTriggers) || s(observed.toneProfile) ? (
            <div className="max-w-[360px] rounded-[20px] border border-slate-200 bg-white/82 px-4 py-3 text-sm leading-6 text-slate-600">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Observed suggestion
              </div>
              <div className="mt-2">
                {[
                  s(observed.businessType || observed.niche),
                  s(observed.conversionGoal),
                  s(observed.toneProfile),
                  formatBehaviorList(observed.handoffTriggers),
                ]
                  .filter(Boolean)
                  .join(" · ") || "No behavior suggestion was provided by the review draft."}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <SegmentControl
            label="Business type"
            value={behavior.businessType}
            options={[
              { value: "clinic", label: "Clinic" },
              { value: "agency", label: "Agency" },
              { value: "restaurant", label: "Restaurant" },
              { value: "real_estate", label: "Real estate" },
            ]}
            onChange={(nextValue) => setField("businessType", nextValue)}
          />
          <SegmentControl
            label="Lead qualification"
            value={behavior.leadQualificationMode}
            options={[
              { value: "basic_contact_capture", label: "Contact capture" },
              { value: "service_booking_triage", label: "Booking triage" },
              { value: "high_intent_screen", label: "High intent" },
            ]}
            onChange={(nextValue) => setField("leadQualificationMode", nextValue)}
          />
          <CompactInput
            label="Niche"
            value={behavior.niche}
            placeholder="clinic, salon, restaurant"
            onChange={(nextValue) => setField("niche", nextValue)}
          />
          <CompactInput
            label="Sub-niche"
            value={behavior.subNiche}
            placeholder="cosmetic_dentistry, medspa, bridal_makeup"
            onChange={(nextValue) => setField("subNiche", nextValue)}
          />
          <CompactInput
            label="Conversion goal"
            value={behavior.conversionGoal}
            placeholder="book_consultation"
            onChange={(nextValue) => setField("conversionGoal", nextValue)}
          />
          <CompactInput
            label="Primary CTA"
            value={behavior.primaryCta}
            placeholder="Book your consultation"
            onChange={(nextValue) => setField("primaryCta", nextValue)}
          />
          <SegmentControl
            label="Booking flow"
            value={behavior.bookingFlowType}
            options={[
              { value: "appointment_request", label: "Appointment" },
              { value: "manual", label: "Manual" },
              { value: "callback_capture", label: "Callback" },
            ]}
            onChange={(nextValue) => setField("bookingFlowType", nextValue)}
          />
          <SegmentControl
            label="Tone profile"
            value={behavior.toneProfile}
            options={[
              { value: "professional", label: "Professional" },
              { value: "warm_reassuring", label: "Warm" },
              { value: "calm_professional_reassuring", label: "Calm" },
              { value: "warm_premium_reassuring", label: "Premium" },
            ]}
            onChange={(nextValue) => setField("toneProfile", nextValue)}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <CompactTextarea
            label="Qualification questions"
            value={arr(behavior.qualificationQuestions).join("\n")}
            placeholder="One question per line"
            onChange={(nextValue) => setListField("qualificationQuestions", nextValue)}
            rows={4}
          />
          <CompactTextarea
            label="Handoff triggers"
            value={arr(behavior.handoffTriggers).join("\n")}
            placeholder="human_request, urgent_claim"
            onChange={(nextValue) => setListField("handoffTriggers", nextValue)}
            rows={4}
          />
          <CompactTextarea
            label="Disallowed claims"
            value={arr(behavior.disallowedClaims).join("\n")}
            placeholder="instant_result_guarantees"
            onChange={(nextValue) => setListField("disallowedClaims", nextValue)}
            rows={4}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="rounded-[22px] border border-slate-200/80 bg-white/86 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Qualification preview
            </div>
            <div className="mt-3 text-sm text-slate-700">
              {s(behavior.leadQualificationMode) || "No qualification mode set"}
            </div>
            <div className="mt-3">
              <TokenPreview
                items={behavior.qualificationQuestions}
                emptyLabel="No qualification questions set."
              />
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200/80 bg-white/86 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Handoff preview
            </div>
            <div className="mt-3">
              <TokenPreview
                items={behavior.handoffTriggers}
                emptyLabel="No handoff triggers set."
              />
            </div>
          </div>
          <div className="rounded-[22px] border border-slate-200/80 bg-white/86 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Safety preview
            </div>
            <div className="mt-3">
              <TokenPreview
                items={behavior.disallowedClaims}
                emptyLabel="No disallowed claims set."
              />
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {channelCards.map((card) => (
            <ChannelCard
              key={card.key}
              title={card.title}
              subtitle={card.subtitle}
              channelKey={card.key}
              channelValue={
                card.key === "content"
                  ? {
                      ...obj(channelBehavior.content),
                      visualDirection:
                        s(channelBehavior.content?.visualDirection) ||
                        s(channelBehavior.media?.visualDirection),
                    }
                  : channelBehavior[card.key]
              }
              onChange={(nextChannel) => {
                if (card.key === "content") {
                  setChannel("content", {
                    ...obj(channelBehavior.content),
                    contentAngle: s(nextChannel.contentAngle),
                    ctaMode: s(nextChannel.ctaMode),
                    visualDirection: s(nextChannel.visualDirection),
                  });
                  setChannel("media", {
                    ...obj(channelBehavior.media),
                    visualDirection: s(nextChannel.visualDirection),
                  });
                  return;
                }

                setChannel(card.key, nextChannel);
              }}
              controls={card.controls}
            />
          ))}
        </div>

        {Object.keys(observedChannelBehavior).length ? (
          <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/80 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Review-session behavior evidence
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              {Object.entries(observedChannelBehavior).map(([key, channel]) => (
                <div
                  key={`observed-${key}`}
                  className="rounded-[18px] border border-slate-200/80 bg-white/88 px-4 py-3"
                >
                  <div className="text-sm font-medium text-slate-900">
                    {titleCase(key)}
                  </div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">
                    {channelBehaviorSummary(key, channel)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </StageSection>
  );
}
