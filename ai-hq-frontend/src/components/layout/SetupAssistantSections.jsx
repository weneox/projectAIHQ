import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Plus,
  SendHorizontal,
  Trash2,
} from "lucide-react";

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

const SECTION_KEYS = [
  "profile",
  "services",
  "hours",
  "pricing",
  "contacts",
  "handoff",
];

const DAY_ORDER = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DAY_LABELS = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
};

const SECTION_COPY = {
  profile: {
    title: "Business profile",
    description:
      "Set the core identity first so everything else anchors on real business truth.",
    quickLabel: "Paste one rough business note",
    quickPlaceholder:
      "e.g. Neox.az - AI automation for local businesses - https://neox.az",
  },
  services: {
    title: "Services",
    description:
      "Keep the service menu real and compact. AI should only talk about what the business truly offers.",
    quickLabel: "Paste a rough services note",
    quickPlaceholder:
      "e.g. AI chatbot setup, automation consulting, WhatsApp integration",
  },
  hours: {
    title: "Business hours",
    description:
      "Structured hours prevent wrong promises in replies. Add a real weekly schedule.",
    quickLabel: "Paste rough opening hours",
    quickPlaceholder:
      "e.g. Mon-Fri 09:00-18:00, Sat 10:00-14:00, Sun closed",
  },
  pricing: {
    title: "Pricing posture",
    description:
      "Tell the system what it can say publicly about pricing and when it must escalate.",
    quickLabel: "Paste a rough pricing note",
    quickPlaceholder:
      "e.g. Starts from 50 AZN. Exact quotes depend on service scope.",
  },
  contacts: {
    title: "Customer contact routes",
    description:
      "Give AI the safest public handoff lanes for customers.",
    quickLabel: "Paste rough contact details",
    quickPlaceholder:
      "e.g. +994..., WhatsApp wa.me/..., hello@company.com",
  },
  handoff: {
    title: "Operator escalation",
    description:
      "Define when AI should stop and hand the conversation to a human.",
    quickLabel: "Paste rough escalation rules",
    quickPlaceholder:
      "e.g. Complaints, payment disputes, custom quotes, urgent requests",
  },
};

function normalizeSectionStatus(status = "") {
  const value = s(status).toLowerCase();
  if (value === "ready") return "ready";
  if (value === "needs_review") return "needs_review";
  return "missing";
}

function normalizeSectionKey(value = "") {
  const safe = s(value).toLowerCase();
  if (["company", "description", "website"].includes(safe)) return "profile";
  if (SECTION_KEYS.includes(safe)) return safe;
  return "profile";
}

function buildSectionItems(assistant = {}) {
  const source = arr(assistant?.assistant?.sections);

  if (!source.length) {
    return SECTION_KEYS.map((key) => ({
      key,
      label: SECTION_COPY[key].title,
      title: SECTION_COPY[key].title,
      status: "missing",
      summary: "",
      metric: "",
    }));
  }

  return source
    .map((item) => {
      const key = normalizeSectionKey(item?.key);
      return {
        key,
        label: s(item?.label || SECTION_COPY[key]?.title),
        title: s(item?.title || item?.label || SECTION_COPY[key]?.title),
        status: normalizeSectionStatus(item?.status),
        summary: s(item?.summary),
        metric: s(item?.metric),
      };
    })
    .filter((item, index, list) => list.findIndex((x) => x.key === item.key) === index);
}

function buildRecommendedSection(assistant = {}) {
  const nextQuestion = obj(assistant?.assistant?.nextQuestion);
  const sections = buildSectionItems(assistant);
  const nextKey = normalizeSectionKey(nextQuestion?.key);

  if (SECTION_KEYS.includes(nextKey)) {
    return nextKey;
  }

  const firstIncomplete = sections.find((item) => item.status !== "ready");
  return firstIncomplete?.key || "profile";
}

function buildProfileForm(assistant = {}) {
  const profile = obj(assistant?.draft?.businessProfile);
  return {
    companyName: s(profile.companyName),
    description: s(profile.description),
    websiteUrl: s(profile.websiteUrl),
  };
}

function buildServiceRows(assistant = {}) {
  const items = arr(assistant?.draft?.services)
    .map((item) => ({
      id: crypto.randomUUID(),
      title: s(item?.title),
      summary: s(item?.summary),
      priceLabel: s(item?.priceLabel),
    }))
    .filter((item) => item.title || item.summary || item.priceLabel);

  return items.length
    ? items
    : [{ id: crypto.randomUUID(), title: "", summary: "", priceLabel: "" }];
}

function buildContactRows(assistant = {}) {
  const items = arr(assistant?.draft?.contacts)
    .map((item) => ({
      id: crypto.randomUUID(),
      type: s(item?.type || "phone").toLowerCase() || "phone",
      label: s(item?.label),
      value: s(item?.value),
      preferred: item?.preferred === true,
    }))
    .filter((item) => item.label || item.value);

  return items.length
    ? items
    : [
        {
          id: crypto.randomUUID(),
          type: "phone",
          label: "Primary",
          value: "",
          preferred: true,
        },
      ];
}

function buildHoursRows(assistant = {}) {
  const existing = arr(assistant?.draft?.hours);

  return DAY_ORDER.map((day, index) => ({
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

function buildPricingForm(assistant = {}) {
  const pricing = obj(assistant?.draft?.pricingPosture);

  return {
    pricingMode: s(pricing.pricingMode || "quote_required"),
    currency: s(pricing.currency || "AZN"),
    publicSummary: s(pricing.publicSummary),
    startingAt:
      pricing.startingAt == null ? "" : String(pricing.startingAt),
  };
}

function buildHandoffForm(assistant = {}) {
  const handoff = obj(assistant?.draft?.handoffRules);

  return {
    enabled:
      handoff.enabled === true ||
      Boolean(s(handoff.summary) || arr(handoff.triggers).length),
    summary: s(handoff.summary),
    triggersText: arr(handoff.triggers).join("\n"),
    escalationTarget: s(handoff.escalationTarget || "operator"),
  };
}

function serializeServiceRows(rows = []) {
  return rows
    .map((item) => ({
      title: s(item.title),
      summary: s(item.summary),
      priceLabel: s(item.priceLabel),
      category: "general",
    }))
    .filter((item) => item.title || item.summary || item.priceLabel);
}

function serializeContactRows(rows = []) {
  return rows
    .map((item) => ({
      type: s(item.type || "phone").toLowerCase() || "phone",
      label: s(item.label),
      value: s(item.value),
      preferred: item.preferred === true,
      visibility: "public",
    }))
    .filter((item) => item.label || item.value);
}

function serializeHoursRows(rows = []) {
  return rows.map((item) => ({
    day: s(item.day).toLowerCase(),
    enabled: item.enabled === true,
    closed:
      item.enabled === true
        ? item.closed === true
        : item.appointmentOnly !== true && item.allDay !== true,
    openTime: s(item.openTime),
    closeTime: s(item.closeTime),
    allDay: item.allDay === true,
    appointmentOnly: item.appointmentOnly === true,
    notes: s(item.notes),
  }));
}

function splitLines(value = "") {
  return String(value || "")
    .split(/\n|,|;/)
    .map((item) => s(item))
    .filter(Boolean);
}

function buildStatusText(status = "") {
  const safe = normalizeSectionStatus(status);
  if (safe === "ready") return "Ready";
  if (safe === "needs_review") return "Needs review";
  return "Missing";
}

function FieldLabel({ children }) {
  return (
    <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.46)]">
      {children}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-[14px] border border-[rgba(226,231,239,0.98)] bg-white px-4 text-[14px] text-[#0f172a] outline-none transition",
        "placeholder:text-[#94a3b8]",
        "focus:border-[rgba(70,115,242,0.42)] focus:shadow-[0_0_0_4px_rgba(70,115,242,0.10)]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function SelectInput(props) {
  return (
    <div className="relative">
      <select
        {...props}
        className={[
          "h-11 w-full appearance-none rounded-[14px] border border-[rgba(226,231,239,0.98)] bg-white px-4 pr-10 text-[14px] text-[#0f172a] outline-none transition",
          "focus:border-[rgba(70,115,242,0.42)] focus:shadow-[0_0_0_4px_rgba(70,115,242,0.10)]",
          props.className || "",
        ].join(" ")}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
    </div>
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-[16px] border border-[rgba(226,231,239,0.98)] bg-white px-4 py-3 text-[14px] leading-7 text-[#0f172a] outline-none transition",
        "placeholder:text-[#94a3b8]",
        "focus:border-[rgba(70,115,242,0.42)] focus:shadow-[0_0_0_4px_rgba(70,115,242,0.10)]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function SectionRail({ items, activeKey, onChange }) {
  return (
    <div className="overflow-x-auto border-b border-[rgba(232,235,241,0.98)] px-4">
      <div className="flex min-w-max gap-5">
        {items.map((item) => {
          const active = item.key === activeKey;
          const status = normalizeSectionStatus(item.status);

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={[
                "relative flex h-12 items-center gap-2 border-b-2 text-[12px] font-semibold tracking-[-0.01em] transition",
                active
                  ? "border-[#3f6ff2] text-[#16338c]"
                  : "border-transparent text-[#64748b] hover:text-[#0f172a]",
              ].join(" ")}
            >
              <span
                className={[
                  "h-1.5 w-1.5 rounded-full",
                  status === "ready"
                    ? "bg-emerald-500"
                    : status === "needs_review"
                    ? "bg-amber-500"
                    : "bg-slate-300",
                ].join(" ")}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  tone = "primary",
  onClick,
  disabled = false,
  leftIcon = null,
  className = "",
}) {
  const toneClass =
    tone === "secondary"
      ? "border-[rgba(226,231,239,0.98)] bg-white text-[#0f172a] hover:border-[rgba(206,216,238,0.98)]"
      : tone === "soft"
      ? "border-[rgba(70,115,242,0.18)] bg-[rgba(70,115,242,0.08)] text-[#2445aa] hover:bg-[rgba(70,115,242,0.12)]"
      : "border-[rgba(86,118,226,0.36)] bg-[linear-gradient(180deg,#4a75f6_0%,#355cd6_100%)] text-white shadow-[0_18px_28px_-20px_rgba(53,92,214,0.52)] hover:-translate-y-[1px]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border px-4 text-[13px] font-semibold tracking-[-0.02em] transition",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        toneClass,
        className,
      ].join(" ")}
    >
      {leftIcon}
      <span>{children}</span>
    </button>
  );
}

function InlineToggle({ checked, onChange, label }) {
  return (
    <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#475467]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-[rgba(206,216,238,0.98)] text-[#3f6ff2] focus:ring-[#3f6ff2]"
      />
      <span>{label}</span>
    </label>
  );
}

export default function SetupAssistantSections({
  assistant,
  saving = false,
  finalizing = false,
  onPatchDraft,
  onParseMessage,
  onFinalize,
}) {
  const bodyRef = useRef(null);
  const sessionIdRef = useRef("");
  const [activeSection, setActiveSection] = useState(
    buildRecommendedSection(assistant)
  );
  const [localError, setLocalError] = useState("");
  const [quickOpen, setQuickOpen] = useState({});
  const [quickNotes, setQuickNotes] = useState({
    profile: "",
    services: "",
    hours: "",
    pricing: "",
    contacts: "",
    handoff: "",
  });

  const sections = useMemo(() => buildSectionItems(assistant), [assistant]);
  const recommendedSection = useMemo(
    () => buildRecommendedSection(assistant),
    [assistant]
  );
  const completion = obj(assistant?.assistant?.completion);
  const canFinalize = completion.ready === true;
  const sourceInsights = arr(assistant?.assistant?.sourceInsights);
  const readyCount = sections.filter(
    (item) => normalizeSectionStatus(item.status) === "ready"
  ).length;

  const [profileForm, setProfileForm] = useState(() => buildProfileForm(assistant));
  const [serviceRows, setServiceRows] = useState(() => buildServiceRows(assistant));
  const [hoursRows, setHoursRows] = useState(() => buildHoursRows(assistant));
  const [pricingForm, setPricingForm] = useState(() => buildPricingForm(assistant));
  const [contactRows, setContactRows] = useState(() => buildContactRows(assistant));
  const [handoffForm, setHandoffForm] = useState(() => buildHandoffForm(assistant));

  useEffect(() => {
    setProfileForm(buildProfileForm(assistant));
    setServiceRows(buildServiceRows(assistant));
    setHoursRows(buildHoursRows(assistant));
    setPricingForm(buildPricingForm(assistant));
    setContactRows(buildContactRows(assistant));
    setHandoffForm(buildHandoffForm(assistant));
  }, [assistant?.session?.id, assistant?.draft?.version, assistant?.draft?.updatedAt]);

  useEffect(() => {
    const currentSessionId = s(assistant?.session?.id);

    if (!sessionIdRef.current || sessionIdRef.current !== currentSessionId) {
      sessionIdRef.current = currentSessionId;
      setActiveSection(recommendedSection);
      return;
    }

    const currentMeta = sections.find((item) => item.key === activeSection);
    if (!currentMeta) {
      setActiveSection(recommendedSection);
      return;
    }

    if (
      normalizeSectionStatus(currentMeta.status) === "ready" &&
      recommendedSection !== activeSection
    ) {
      setActiveSection(recommendedSection);
    }
  }, [assistant?.session?.id, activeSection, recommendedSection, sections]);

  useEffect(() => {
    if (!bodyRef.current) return;
    bodyRef.current.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeSection]);

  const busy = saving || finalizing;
  const currentMeta =
    sections.find((item) => item.key === activeSection) ||
    sections[0] || {
      key: activeSection,
      label: SECTION_COPY[activeSection]?.title || "Section",
      title: SECTION_COPY[activeSection]?.title || "Section",
      status: "missing",
      summary: "",
      metric: "",
    };

  const currentCopy = SECTION_COPY[activeSection] || SECTION_COPY.profile;
  const currentQuickNote = s(quickNotes[activeSection]);
  const sourceHint =
    activeSection === "profile" || activeSection === "services"
      ? s(sourceInsights[0])
      : "";

  function setQuickNote(section, value) {
    setQuickNotes((current) => ({
      ...current,
      [section]: value,
    }));
  }

  function toggleQuick(section) {
    setQuickOpen((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  async function handleQuickApply() {
    if (!currentQuickNote || busy) return;

    setLocalError("");
    try {
      await onParseMessage?.({
        step: activeSection,
        text: currentQuickNote,
      });
      setQuickNote(activeSection, "");
      setQuickOpen((current) => ({
        ...current,
        [activeSection]: false,
      }));
    } catch (error) {
      setLocalError(
        s(error?.message, "The quick note could not be processed.")
      );
    }
  }

  async function saveCurrentSection() {
    if (busy) return;

    setLocalError("");

    try {
      if (activeSection === "profile") {
        await onPatchDraft?.({
          businessProfile: {
            companyName: s(profileForm.companyName),
            description: s(profileForm.description),
            websiteUrl: s(profileForm.websiteUrl),
          },
          assistantState: {
            activeSection: "profile",
            lastUpdatedSection: "profile",
          },
        });
        return;
      }

      if (activeSection === "services") {
        await onPatchDraft?.({
          services: serializeServiceRows(serviceRows),
          assistantState: {
            activeSection: "services",
            lastUpdatedSection: "services",
          },
        });
        return;
      }

      if (activeSection === "hours") {
        await onPatchDraft?.({
          hours: serializeHoursRows(hoursRows),
          assistantState: {
            activeSection: "hours",
            lastUpdatedSection: "hours",
          },
        });
        return;
      }

      if (activeSection === "pricing") {
        await onPatchDraft?.({
          pricingPosture: {
            pricingMode: s(pricingForm.pricingMode),
            currency: s(pricingForm.currency || "AZN"),
            publicSummary: s(pricingForm.publicSummary),
            startingAt:
              s(pricingForm.startingAt) === ""
                ? null
                : Number(pricingForm.startingAt),
          },
          assistantState: {
            activeSection: "pricing",
            lastUpdatedSection: "pricing",
          },
        });
        return;
      }

      if (activeSection === "contacts") {
        await onPatchDraft?.({
          contacts: serializeContactRows(contactRows),
          assistantState: {
            activeSection: "contacts",
            lastUpdatedSection: "contacts",
          },
        });
        return;
      }

      if (activeSection === "handoff") {
        await onPatchDraft?.({
          handoffRules: {
            enabled: handoffForm.enabled === true,
            summary: s(handoffForm.summary),
            triggers: splitLines(handoffForm.triggersText),
            escalationTarget: s(handoffForm.escalationTarget || "operator"),
          },
          assistantState: {
            activeSection: "handoff",
            lastUpdatedSection: "handoff",
          },
        });
      }
    } catch (error) {
      setLocalError(
        s(error?.message, "This section could not be saved.")
      );
    }
  }

  async function handleFinalize() {
    if (!canFinalize || busy) return;

    setLocalError("");
    try {
      await onFinalize?.();
    } catch (error) {
      setLocalError(
        s(error?.message, "Setup could not be finalized.")
      );
    }
  }

  function renderProfileEditor() {
    return (
      <div className="space-y-4">
        <div>
          <FieldLabel>Business name</FieldLabel>
          <TextInput
            value={profileForm.companyName}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                companyName: event.target.value,
              }))
            }
            placeholder="e.g. Neox Company"
          />
        </div>

        <div>
          <FieldLabel>Website</FieldLabel>
          <TextInput
            value={profileForm.websiteUrl}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                websiteUrl: event.target.value,
              }))
            }
            placeholder="e.g. https://neox.az"
          />
        </div>

        <div>
          <FieldLabel>Short description</FieldLabel>
          <TextArea
            rows={4}
            value={profileForm.description}
            onChange={(event) =>
              setProfileForm((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            placeholder="Describe what the business mainly does."
          />
        </div>
      </div>
    );
  }

  function renderServicesEditor() {
    return (
      <div className="space-y-3">
        {serviceRows.map((row, index) => (
          <div
            key={row.id}
            className="rounded-[18px] border border-[rgba(232,235,241,0.98)] bg-[rgba(249,250,252,0.96)] p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold tracking-[-0.01em] text-[#334155]">
                Service {index + 1}
              </div>

              {serviceRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setServiceRows((current) =>
                      current.filter((item) => item.id !== row.id)
                    )
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[rgba(232,235,241,0.98)] bg-white text-[#64748b] transition hover:text-[#0f172a]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-3">
              <TextInput
                value={row.title}
                onChange={(event) =>
                  setServiceRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? { ...item, title: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Service title"
              />

              <TextArea
                rows={3}
                value={row.summary}
                onChange={(event) =>
                  setServiceRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? { ...item, summary: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Short service summary"
              />

              <TextInput
                value={row.priceLabel}
                onChange={(event) =>
                  setServiceRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? { ...item, priceLabel: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Optional price label"
              />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setServiceRows((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                title: "",
                summary: "",
                priceLabel: "",
              },
            ])
          }
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#2445aa] transition hover:text-[#16338c]"
        >
          <Plus className="h-4 w-4" />
          <span>Add service</span>
        </button>
      </div>
    );
  }

  function renderHoursEditor() {
    return (
      <div className="space-y-2.5">
        {hoursRows.map((row) => (
          <div
            key={row.day}
            className="rounded-[18px] border border-[rgba(232,235,241,0.98)] bg-[rgba(249,250,252,0.96)] px-3 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] font-semibold tracking-[-0.02em] text-[#0f172a]">
                {DAY_LABELS[row.day]}
              </div>

              <InlineToggle
                checked={row.enabled}
                onChange={(checked) =>
                  setHoursRows((current) =>
                    current.map((item) =>
                      item.day === row.day
                        ? {
                            ...item,
                            enabled: checked,
                            closed: checked ? item.closed : true,
                          }
                        : item
                    )
                  )
                }
                label="Open"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <InlineToggle
                checked={row.allDay}
                onChange={(checked) =>
                  setHoursRows((current) =>
                    current.map((item) =>
                      item.day === row.day
                        ? {
                            ...item,
                            allDay: checked,
                            enabled: checked ? true : item.enabled,
                            closed: checked ? false : item.closed,
                            appointmentOnly: checked ? false : item.appointmentOnly,
                          }
                        : item
                    )
                  )
                }
                label="24/7"
              />

              <InlineToggle
                checked={row.appointmentOnly}
                onChange={(checked) =>
                  setHoursRows((current) =>
                    current.map((item) =>
                      item.day === row.day
                        ? {
                            ...item,
                            appointmentOnly: checked,
                            enabled: checked ? false : item.enabled,
                            allDay: checked ? false : item.allDay,
                            closed: checked ? false : item.closed,
                          }
                        : item
                    )
                  )
                }
                label="Appointment only"
              />

              <InlineToggle
                checked={row.closed}
                onChange={(checked) =>
                  setHoursRows((current) =>
                    current.map((item) =>
                      item.day === row.day
                        ? {
                            ...item,
                            closed: checked,
                            enabled: checked ? false : item.enabled,
                            allDay: checked ? false : item.allDay,
                            appointmentOnly: checked ? false : item.appointmentOnly,
                          }
                        : item
                    )
                  )
                }
                label="Closed"
              />
            </div>

            {!row.closed && !row.allDay && !row.appointmentOnly ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <TextInput
                  type="time"
                  value={row.openTime}
                  onChange={(event) =>
                    setHoursRows((current) =>
                      current.map((item) =>
                        item.day === row.day
                          ? {
                              ...item,
                              openTime: event.target.value,
                              enabled: true,
                              closed: false,
                            }
                          : item
                      )
                    )
                  }
                />

                <TextInput
                  type="time"
                  value={row.closeTime}
                  onChange={(event) =>
                    setHoursRows((current) =>
                      current.map((item) =>
                        item.day === row.day
                          ? {
                              ...item,
                              closeTime: event.target.value,
                              enabled: true,
                              closed: false,
                            }
                          : item
                      )
                    )
                  }
                />
              </div>
            ) : null}

            <div className="mt-3">
              <TextInput
                value={row.notes}
                onChange={(event) =>
                  setHoursRows((current) =>
                    current.map((item) =>
                      item.day === row.day
                        ? { ...item, notes: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Optional note"
              />
            </div>
          </div>
        ))}
      </div>
    );
  }

  function renderPricingEditor() {
    return (
      <div className="space-y-4">
        <div>
          <FieldLabel>Pricing mode</FieldLabel>
          <SelectInput
            value={pricingForm.pricingMode}
            onChange={(event) =>
              setPricingForm((current) => ({
                ...current,
                pricingMode: event.target.value,
              }))
            }
          >
            <option value="quote_required">Quote required</option>
            <option value="operator_only">Operator only</option>
            <option value="fixed_price">Fixed public price</option>
            <option value="variable_by_service">Variable by service</option>
          </SelectInput>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Currency</FieldLabel>
            <TextInput
              value={pricingForm.currency}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  currency: event.target.value,
                }))
              }
              placeholder="AZN"
            />
          </div>

          <div>
            <FieldLabel>Starting from</FieldLabel>
            <TextInput
              type="number"
              value={pricingForm.startingAt}
              onChange={(event) =>
                setPricingForm((current) => ({
                  ...current,
                  startingAt: event.target.value,
                }))
              }
              placeholder="50"
            />
          </div>
        </div>

        <div>
          <FieldLabel>Public pricing summary</FieldLabel>
          <TextArea
            rows={4}
            value={pricingForm.publicSummary}
            onChange={(event) =>
              setPricingForm((current) => ({
                ...current,
                publicSummary: event.target.value,
              }))
            }
            placeholder="What is safe for AI to say publicly about pricing?"
          />
        </div>
      </div>
    );
  }

  function renderContactsEditor() {
    return (
      <div className="space-y-3">
        {contactRows.map((row, index) => (
          <div
            key={row.id}
            className="rounded-[18px] border border-[rgba(232,235,241,0.98)] bg-[rgba(249,250,252,0.96)] p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold tracking-[-0.01em] text-[#334155]">
                Contact {index + 1}
              </div>

              {contactRows.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setContactRows((current) =>
                      current.filter((item) => item.id !== row.id)
                    )
                  }
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[rgba(232,235,241,0.98)] bg-white text-[#64748b] transition hover:text-[#0f172a]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 grid grid-cols-[120px_minmax(0,1fr)] gap-3">
              <SelectInput
                value={row.type}
                onChange={(event) =>
                  setContactRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? { ...item, type: event.target.value }
                        : item
                    )
                  )
                }
              >
                <option value="phone">Phone</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="telegram">Telegram</option>
                <option value="link">Link</option>
                <option value="primary">Primary</option>
              </SelectInput>

              <TextInput
                value={row.value}
                onChange={(event) =>
                  setContactRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? { ...item, value: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Contact value"
              />
            </div>

            <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-3">
              <TextInput
                value={row.label}
                onChange={(event) =>
                  setContactRows((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? { ...item, label: event.target.value }
                        : item
                    )
                  )
                }
                placeholder="Label"
              />

              <label className="inline-flex items-center gap-2 text-[12px] font-medium text-[#475467]">
                <input
                  type="checkbox"
                  checked={row.preferred}
                  onChange={(event) =>
                    setContactRows((current) =>
                      current.map((item) =>
                        item.id === row.id
                          ? { ...item, preferred: event.target.checked }
                          : item
                      )
                    )
                  }
                  className="h-4 w-4 rounded border-[rgba(206,216,238,0.98)] text-[#3f6ff2] focus:ring-[#3f6ff2]"
                />
                <span>Primary</span>
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            setContactRows((current) => [
              ...current,
              {
                id: crypto.randomUUID(),
                type: "phone",
                label: "",
                value: "",
                preferred: false,
              },
            ])
          }
          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#2445aa] transition hover:text-[#16338c]"
        >
          <Plus className="h-4 w-4" />
          <span>Add contact</span>
        </button>
      </div>
    );
  }

  function renderHandoffEditor() {
    return (
      <div className="space-y-4">
        <InlineToggle
          checked={handoffForm.enabled}
          onChange={(checked) =>
            setHandoffForm((current) => ({
              ...current,
              enabled: checked,
            }))
          }
          label="Enable escalation rules"
        />

        <div>
          <FieldLabel>Escalation summary</FieldLabel>
          <TextArea
            rows={4}
            value={handoffForm.summary}
            onChange={(event) =>
              setHandoffForm((current) => ({
                ...current,
                summary: event.target.value,
              }))
            }
            placeholder="Describe when AI should escalate."
          />
        </div>

        <div>
          <FieldLabel>Triggers</FieldLabel>
          <TextArea
            rows={5}
            value={handoffForm.triggersText}
            onChange={(event) =>
              setHandoffForm((current) => ({
                ...current,
                triggersText: event.target.value,
              }))
            }
            placeholder="One trigger per line"
          />
        </div>

        <div>
          <FieldLabel>Escalation target</FieldLabel>
          <TextInput
            value={handoffForm.escalationTarget}
            onChange={(event) =>
              setHandoffForm((current) => ({
                ...current,
                escalationTarget: event.target.value,
              }))
            }
            placeholder="operator"
          />
        </div>
      </div>
    );
  }

  function renderEditor() {
    switch (activeSection) {
      case "profile":
        return renderProfileEditor();
      case "services":
        return renderServicesEditor();
      case "hours":
        return renderHoursEditor();
      case "pricing":
        return renderPricingEditor();
      case "contacts":
        return renderContactsEditor();
      case "handoff":
        return renderHandoffEditor();
      default:
        return renderProfileEditor();
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-[rgba(232,235,241,0.98)] px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(15,23,42,0.42)]">
              Setup draft
            </div>
            <div className="mt-1 text-[17px] font-semibold tracking-[-0.04em] text-[#0f172a]">
              {currentCopy.title}
            </div>
          </div>

          <div className="text-right">
            <div className="text-[12px] font-semibold text-[#0f172a]">
              {readyCount}/{sections.length} ready
            </div>
            <div className="mt-0.5 text-[11px] text-[#64748b]">
              {buildStatusText(currentMeta.status)}
            </div>
          </div>
        </div>

        <div className="mt-2 text-[13px] leading-6 text-[#64748b]">
          {currentMeta.summary || currentCopy.description}
        </div>

        {sourceHint ? (
          <div className="mt-2 text-[12px] leading-5 text-[#8a94a6]">
            {sourceHint}
          </div>
        ) : null}
      </div>

      <SectionRail
        items={sections}
        activeKey={activeSection}
        onChange={setActiveSection}
      />

      <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="rounded-[22px] border border-[rgba(226,231,239,0.98)] bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(249,250,252,0.99))] shadow-[0_18px_34px_-28px_rgba(15,23,42,0.14)]">
          <div className="border-b border-[rgba(232,235,241,0.98)] px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[14px] font-semibold tracking-[-0.02em] text-[#0f172a]">
                {currentMeta.title || currentCopy.title}
              </div>

              <button
                type="button"
                onClick={() => toggleQuick(activeSection)}
                className="text-[12px] font-semibold text-[#2445aa] transition hover:text-[#16338c]"
              >
                {quickOpen[activeSection] ? "Hide quick note" : "Use quick note"}
              </button>
            </div>

            {currentMeta.metric ? (
              <div className="mt-1 text-[12px] text-[#8a94a6]">
                {currentMeta.metric}
              </div>
            ) : null}
          </div>

          <div className="px-4 py-4">
            {renderEditor()}

            {quickOpen[activeSection] ? (
              <div className="mt-5 border-t border-[rgba(232,235,241,0.98)] pt-4">
                <div className="mb-2 text-[12px] font-semibold text-[#334155]">
                  {currentCopy.quickLabel}
                </div>

                <TextArea
                  rows={4}
                  value={currentQuickNote}
                  onChange={(event) =>
                    setQuickNote(activeSection, event.target.value)
                  }
                  placeholder={currentCopy.quickPlaceholder}
                />

                <div className="mt-3 flex justify-end">
                  <ActionButton
                    tone="soft"
                    onClick={handleQuickApply}
                    disabled={!currentQuickNote || busy}
                    leftIcon={<SendHorizontal className="h-4 w-4" />}
                  >
                    Apply quick note
                  </ActionButton>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="border-t border-[rgba(232,235,241,0.98)] bg-[rgba(255,255,255,0.96)] px-4 py-3">
        {localError ? (
          <div className="mb-3 rounded-[14px] border border-[rgba(220,38,38,0.14)] bg-[rgba(254,242,242,0.9)] px-3 py-2.5 text-[12px] leading-5 text-[#b42318]">
            {localError}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] leading-5 text-[#64748b]">
            {canFinalize
              ? s(
                  completion.message,
                  "The draft is complete enough to finalize."
                )
              : "Save this section and move forward."}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ActionButton
              tone="secondary"
              onClick={saveCurrentSection}
              disabled={busy}
              leftIcon={
                saving ? null : <Check className="h-4 w-4" />
              }
            >
              {saving ? "Saving..." : "Save section"}
            </ActionButton>

            {canFinalize ? (
              <ActionButton
                onClick={handleFinalize}
                disabled={busy}
              >
                {finalizing ? "Finishing..." : "Finish setup"}
              </ActionButton>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}