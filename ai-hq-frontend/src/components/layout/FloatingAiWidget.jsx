import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link2, X } from "lucide-react";
import Button from "../ui/Button.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import {
  sendSetupAssistantMessage,
  startSetupAssistantSession,
  updateCurrentSetupAssistantDraft,
} from "../../api/setup.js";
import SetupAssistantSections from "./SetupAssistantSections.jsx";

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

function buildHoursDraft(value = []) {
  const existing = arr(value);
  const order = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  return order.map((day, index) => ({
    day,
    enabled: existing[index]?.enabled === true,
    closed: existing[index]?.closed !== false,
    openTime: s(existing[index]?.openTime),
    closeTime: s(existing[index]?.closeTime),
    allDay: existing[index]?.allDay === true,
    appointmentOnly: existing[index]?.appointmentOnly === true,
    notes: s(existing[index]?.notes),
  }));
}

function buildDefaultAssistant() {
  return {
    mode: "shortcut",
    title: "AI setup lives on Home",
    summary:
      "Use Home to connect the launch channel, continue the structured setup draft, and keep truth/runtime fail-closed.",
    primaryAction: {
      label: "Open Home",
      path: "/home?assistant=setup",
    },
    secondaryAction: {
      label: "Open channels",
      path: "/channels?channel=telegram",
    },
    review: {},
    websitePrefill: {
      supported: true,
      status: "awaiting_input",
      websiteUrl: "",
    },
    session: {},
    draft: {
      businessProfile: {},
      services: [],
      contacts: [],
      hours: buildHoursDraft([]),
      pricingPosture: {},
      handoffRules: {},
      sourceMetadata: {},
      assistantState: {},
      progress: {},
      version: 0,
    },
    assistant: {
      confirmationBlockers: [],
      sections: [],
      servicesCatalog: {
        items: [],
        packs: [],
        suggestedServices: [],
      },
      sourceInsights: [],
    },
  };
}

function normalizeAssistantState(input = null) {
  const source = input || buildDefaultAssistant();
  const draft = obj(source.draft);
  const assistant = obj(source.assistant);

  return {
    mode: s(source.mode, "shortcut"),
    title: s(source.title, "Setup"),
    summary: s(source.summary),
    statusLabel: s(source.statusLabel),
    primaryAction: obj(source.primaryAction),
    secondaryAction: source.secondaryAction ? obj(source.secondaryAction) : null,
    review: obj(source.review),
    websitePrefill: obj(source.websitePrefill),
    session: obj(source.session),
    draft: {
      businessProfile: obj(draft.businessProfile),
      services: arr(draft.services),
      contacts: arr(draft.contacts),
      hours: buildHoursDraft(draft.hours),
      pricingPosture: obj(draft.pricingPosture),
      handoffRules: obj(draft.handoffRules),
      sourceMetadata: obj(draft.sourceMetadata),
      assistantState: obj(draft.assistantState),
      progress: obj(draft.progress),
      version: Number(draft.version || 0),
      updatedAt: draft.updatedAt || null,
    },
    assistant: {
      nextQuestion: obj(assistant.nextQuestion),
      confirmationBlockers: arr(assistant.confirmationBlockers),
      sections: arr(assistant.sections),
      servicesCatalog: obj(assistant.servicesCatalog),
      sourceInsights: arr(assistant.sourceInsights),
    },
  };
}

function buildAssistantFromApi(base = {}, response = {}) {
  return normalizeAssistantState({
    ...base,
    session: obj(response.session),
    review: obj(response.setup?.review),
    websitePrefill: obj(response.setup?.websitePrefill),
    draft: obj(response.setup?.draft),
    assistant: obj(response.setup?.assistant),
  });
}

function buildSectionPatch(section = "", draft = {}) {
  const safeDraft = obj(draft);
  const patch = {
    assistantState: {
      activeSection: section,
      lastUpdatedSection: section,
    },
  };

  if (section === "profile") patch.businessProfile = obj(safeDraft.businessProfile);
  if (section === "services") patch.services = arr(safeDraft.services);
  if (section === "hours") patch.hours = arr(safeDraft.hours);
  if (section === "pricing") patch.pricingPosture = obj(safeDraft.pricingPosture);
  if (section === "contacts") patch.contacts = arr(safeDraft.contacts);
  if (section === "handoff") patch.handoffRules = obj(safeDraft.handoffRules);

  return { draft: patch };
}

function useWidgetStyles() {
  return useMemo(
    () => `
      .ai-widget-root { position: fixed; right: 18px; bottom: 18px; z-index: 92; }
      .ai-widget-launcher { position: relative; width: 60px; height: 60px; border: 0; border-radius: 999px; padding: 0; cursor: pointer; background: transparent; }
      .ai-widget-launcher-shell { position: absolute; inset: 0; border-radius: 999px; background: linear-gradient(180deg, #ffffff 0%, #f2f5fb 100%); border: 1px solid rgba(206,214,228,.95); box-shadow: 0 18px 38px rgba(15,23,42,.16), 0 8px 18px rgba(15,23,42,.08); }
      .ai-widget-shadow { position: absolute; left: 50%; bottom: -4px; transform: translateX(-50%); width: 44px; height: 12px; border-radius: 999px; background: radial-gradient(ellipse at center, rgba(15,23,42,.16), rgba(15,23,42,.04) 60%, transparent 80%); filter: blur(6px); }
      .ai-widget-badge { position: absolute; right: 4px; top: 4px; width: 10px; height: 10px; border-radius: 999px; background: #3f6df2; border: 2px solid #fff; }
      .ai-widget-glyph { position: absolute; inset: 0; display: grid; place-items: center; z-index: 2; }
      .ai-widget-panel { position: absolute; right: 0; bottom: calc(100% + 12px); width: min(calc(100vw - 24px), 460px); max-height: min(82vh, 820px); overflow: auto; border-radius: 24px; border: 1px solid rgba(210,218,231,.92); background: linear-gradient(180deg, rgba(255,255,255,.99), rgba(246,248,252,.99)); box-shadow: 0 30px 70px -28px rgba(15,23,42,.32); }
    `,
    []
  );
}

function LauncherGlyph() {
  return (
    <div className="ai-widget-glyph" aria-hidden="true">
      <div className="relative flex h-[28px] w-[28px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#4f7cf5_0%,#3157d5_100%)] shadow-[0_10px_20px_rgba(49,87,213,0.22)]">
        <div className="flex items-center gap-[3px]">
          <span className="h-[4px] w-[4px] rounded-full bg-white" />
          <span className="h-[4px] w-[4px] rounded-full bg-white" />
          <span className="h-[4px] w-[4px] rounded-full bg-white" />
        </div>
      </div>
    </div>
  );
}

export default function FloatingAiWidget({
  hidden = false,
  open = false,
  onOpenChange,
  onNavigate,
  assistant = null,
}) {
  const styles = useWidgetStyles();
  const queryClient = useQueryClient();
  const rootRef = useRef(null);
  const [clientAssistant, setClientAssistant] = useState(
    normalizeAssistantState(assistant)
  );
  const [draftState, setDraftState] = useState(clientAssistant.draft);
  const [activeSection, setActiveSection] = useState("profile");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const nextAssistant = normalizeAssistantState(assistant);
    setClientAssistant(nextAssistant);
    setDraftState(nextAssistant.draft);
    setActiveSection(
      s(nextAssistant.draft.assistantState?.activeSection) ||
        s(nextAssistant.assistant.confirmationBlockers[0]?.key) ||
        "profile"
    );
  }, [assistant]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onOpenChange?.(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onOpenChange]);

  if (hidden) return null;

  async function ensureSession() {
    if (s(clientAssistant.session?.id)) return;
    const response = await startSetupAssistantSession();
    const nextAssistant = buildAssistantFromApi(clientAssistant, response);
    setClientAssistant(nextAssistant);
    setDraftState(nextAssistant.draft);
  }

  async function handleSaveSection(section) {
    if (clientAssistant.mode === "shortcut" || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await ensureSession();
      const response = await updateCurrentSetupAssistantDraft(
        buildSectionPatch(section, draftState)
      );
      const nextAssistant = buildAssistantFromApi(clientAssistant, response);
      setClientAssistant(nextAssistant);
      setDraftState(nextAssistant.draft);
      setActiveSection(section);
      setNotice({
        tone: "success",
        title: "Saved",
        description: "The structured draft was updated. Truth and runtime remain unchanged.",
      });
      await queryClient.invalidateQueries({ queryKey: ["product-home"] });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Could not save",
        description: s(error?.message, "The setup draft could not be updated."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleParseNote(section, note) {
    if (!s(note) || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      await ensureSession();
      const response = await sendSetupAssistantMessage({
        step: section,
        answer: note,
      });
      const nextAssistant = buildAssistantFromApi(clientAssistant, response);
      setClientAssistant(nextAssistant);
      setDraftState(nextAssistant.draft);
      setActiveSection(section);
      setNotice({
        tone: "success",
        title: "Parsed into structure",
        description: "The rough note was converted into draft structure for review.",
      });
      await queryClient.invalidateQueries({ queryKey: ["product-home"] });
    } catch (error) {
      setNotice({
        tone: "danger",
        title: "Could not parse note",
        description: s(error?.message, "The rough note could not be converted."),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <style>{styles}</style>
      <div ref={rootRef} className="ai-widget-root">
        {open ? (
          <section className="ai-widget-panel" role="dialog" aria-modal="false" aria-label="AI setup">
            <div className="border-b border-line-soft px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
                    AI setup
                  </div>
                  <div className="mt-2 text-[18px] font-semibold tracking-[-0.045em] text-text">
                    {clientAssistant.mode === "shortcut" ? "Open Home setup" : "Structured setup"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenChange?.(false)}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] border border-line bg-white text-text-subtle transition hover:text-text"
                  aria-label="Close AI setup"
                >
                  <X className="h-4 w-4" strokeWidth={1.9} />
                </button>
              </div>
            </div>

            <div className="px-5 py-4">
              {notice ? (
                <InlineNotice
                  tone={notice.tone}
                  title={notice.title}
                  description={notice.description}
                  compact
                  className="mb-4"
                />
              ) : null}

              {clientAssistant.mode === "shortcut" ? (
                <div className="space-y-4">
                  <div className="rounded-[18px] border border-line bg-white p-4 text-[14px] leading-6 text-text-subtle">
                    {clientAssistant.summary}
                  </div>
                  <div className="flex flex-col gap-2">
                    {clientAssistant.primaryAction?.path ? (
                      <Button
                        type="button"
                        size="hero"
                        onClick={() => {
                          onNavigate?.(clientAssistant.primaryAction.path);
                          onOpenChange?.(false);
                        }}
                        fullWidth
                      >
                        {clientAssistant.primaryAction.label || "Open Home"}
                      </Button>
                    ) : null}
                    {clientAssistant.secondaryAction?.path ? (
                      <Button
                        type="button"
                        size="hero"
                        variant="secondary"
                        onClick={() => {
                          onNavigate?.(clientAssistant.secondaryAction.path);
                          onOpenChange?.(false);
                        }}
                        leftIcon={<Link2 className="h-4 w-4" />}
                        fullWidth
                      >
                        {clientAssistant.secondaryAction.label}
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <SetupAssistantSections
                  assistant={clientAssistant}
                  draft={draftState}
                  activeSection={activeSection}
                  onActiveSectionChange={setActiveSection}
                  onDraftChange={setDraftState}
                  onSaveSection={handleSaveSection}
                  onParseNote={handleParseNote}
                  saving={saving}
                />
              )}
            </div>
          </section>
        ) : null}

        <button
          type="button"
          onClick={() => onOpenChange?.(!open)}
          aria-label={clientAssistant.mode === "shortcut" ? "Open setup shortcut" : "Open AI setup"}
          aria-expanded={open}
          className="ai-widget-launcher"
        >
          <span className="ai-widget-shadow" />
          <span className="ai-widget-launcher-shell" />
          <span className="ai-widget-badge" />
          <LauncherGlyph />
        </button>
      </div>
    </>
  );
}
