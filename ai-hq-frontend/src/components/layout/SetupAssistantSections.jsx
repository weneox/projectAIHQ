import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Globe2,
  Link2,
  Phone,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
} from "lucide-react";
import Button from "../ui/Button.jsx";

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

const DAYS = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];

const PRICING_MODES = [
  ["fixed_price", "Fixed"],
  ["starting_from", "Starting from"],
  ["variable_by_service", "By service"],
  ["quote_required", "Quote required"],
  ["operator_only", "Operator only"],
  ["promotional", "Promotion"],
];

const HANDOFF_TRIGGERS = [
  "Human request",
  "Complaint",
  "Urgent case",
  "Exact quote request",
  "Refund or billing issue",
  "Unavailable service",
];

function SectionPill({ section, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(section.key)}
      className={[
        "rounded-full border px-3 py-2 text-[12px] font-semibold tracking-[-0.02em] transition",
        active
          ? "border-[rgba(38,76,165,0.24)] bg-[rgba(242,246,255,0.98)] text-[rgba(38,76,165,0.98)]"
          : "border-line bg-white text-text-subtle hover:text-text",
      ].join(" ")}
    >
      {section.label}
    </button>
  );
}

function BlockerCard({ blocker, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(blocker.key)}
      className="rounded-[18px] border border-line bg-white p-4 text-left shadow-[0_16px_32px_-24px_rgba(15,23,42,0.24)] transition hover:border-[rgba(38,76,165,0.18)]"
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            blocker.severity === "high"
              ? "bg-[rgba(245,158,11,0.12)] text-[rgba(180,83,9,0.96)]"
              : "bg-[rgba(38,76,165,0.08)] text-[rgba(38,76,165,0.96)]",
          ].join(" ")}
        >
          {blocker.severity === "high" ? (
            <AlertTriangle className="h-4 w-4" strokeWidth={2} />
          ) : (
            <Sparkles className="h-4 w-4" strokeWidth={2} />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text">{blocker.title}</div>
          <div className="mt-1 text-[12px] leading-5 text-text-subtle">
            {blocker.reason}
          </div>
          {blocker.metric ? (
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(38,76,165,0.92)]">
              {blocker.metric}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function FieldLabel({ icon: Icon, children }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
      <Icon className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-[14px] border border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none transition placeholder:text-text-subtle focus:border-[rgba(38,76,165,0.28)]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={[
        "w-full rounded-[14px] border border-line bg-white px-3 py-2.5 text-[14px] text-text outline-none transition placeholder:text-text-subtle focus:border-[rgba(38,76,165,0.28)]",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Toggle({ checked, label, onChange }) {
  return (
    <label className="inline-flex items-center gap-2 text-[13px] font-medium text-text">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

function appendUniqueServices(current = [], incoming = []) {
  const next = [...arr(current)];
  const seen = new Set(
    next.map(
      (item) => `${s(item?.key).toLowerCase()}|${s(item?.title).toLowerCase()}`
    )
  );

  for (const item of arr(incoming)) {
    const dedupeKey = `${s(item?.key).toLowerCase()}|${s(item?.title).toLowerCase()}`;
    if (!s(item?.title) || seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    next.push(item);
  }

  return next;
}

export default function SetupAssistantSections({
  assistant,
  draft,
  activeSection = "profile",
  onActiveSectionChange,
  onDraftChange,
  onSaveSection,
  onParseNote,
  saving = false,
}) {
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicesNote, setServicesNote] = useState("");
  const [hoursNote, setHoursNote] = useState("");
  const [pricingNote, setPricingNote] = useState("");

  const assistantData = obj(assistant.assistant);
  const servicesCatalog = obj(assistantData.servicesCatalog);
  const blockers = arr(assistantData.confirmationBlockers);
  const sections = arr(assistantData.sections);

  const searchResults = useMemo(() => {
    const items = arr(servicesCatalog.items);
    const needle = s(serviceSearch).toLowerCase();
    if (!needle) return items.slice(0, 8);
    return items
      .filter((item) =>
        [s(item.title), s(item.summary), s(item.category), ...arr(item.aliases)]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
      .slice(0, 8);
  }, [serviceSearch, servicesCatalog.items]);

  const section = sections.find((item) => item.key === activeSection) || sections[0];

  function updateDraft(next) {
    onDraftChange((current) => ({
      ...current,
      ...next,
    }));
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[18px] border border-line bg-[linear-gradient(180deg,rgba(250,252,255,0.98),rgba(246,248,252,0.98))] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-subtle">
              Setup Assistant v2
            </div>
            <div className="mt-2 text-[18px] font-semibold tracking-[-0.04em] text-text">
              {assistant.title || "Structured setup"}
            </div>
            <div className="mt-2 text-[13px] leading-6 text-text-subtle">
              {assistant.summary || assistant.review?.message}
            </div>
          </div>
          <div className="rounded-full bg-[rgba(38,76,165,0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[rgba(38,76,165,0.96)]">
            Draft only
          </div>
        </div>

        {arr(assistantData.sourceInsights).length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {arr(assistantData.sourceInsights)
              .slice(0, 3)
              .map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 text-[12px] text-text-subtle"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
                  <span>{item}</span>
                </div>
              ))}
          </div>
        ) : null}
      </div>

      {blockers.length ? (
        <div className="grid gap-3">
          {blockers.slice(0, 3).map((blocker) => (
            <BlockerCard
              key={blocker.key}
              blocker={blocker}
              onOpen={onActiveSectionChange}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[18px] border border-[rgba(34,197,94,0.18)] bg-[rgba(240,253,244,0.9)] p-4 text-[13px] text-[rgba(21,128,61,0.92)]">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
            <span>Core setup blockers are covered.</span>
          </div>
          <div className="mt-1 leading-6">
            The draft is structured enough for a later review step, but nothing has been approved or published.
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {sections.map((item) => (
          <SectionPill
            key={item.key}
            section={item}
            active={item.key === activeSection}
            onClick={onActiveSectionChange}
          />
        ))}
      </div>

      <div className="rounded-[20px] border border-line bg-white p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="text-[16px] font-semibold tracking-[-0.03em] text-text">
              {section?.title || "Section"}
            </div>
            <div className="mt-1 text-[13px] leading-6 text-text-subtle">
              {section?.summary}
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => onSaveSection(activeSection)}
            isLoading={saving}
            leftIcon={<Save className="h-4 w-4" />}
          >
            Save section
          </Button>
        </div>

        {activeSection === "profile" ? (
          <div className="grid gap-4">
            <div>
              <FieldLabel icon={Globe2}>Website</FieldLabel>
              <TextInput
                value={s(draft.businessProfile?.websiteUrl)}
                placeholder="https://yourbusiness.com"
                onChange={(event) =>
                  updateDraft({
                    businessProfile: {
                      ...obj(draft.businessProfile),
                      websiteUrl: event.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <FieldLabel icon={Sparkles}>Business name</FieldLabel>
              <TextInput
                value={s(draft.businessProfile?.companyName)}
                placeholder="Business name"
                onChange={(event) =>
                  updateDraft({
                    businessProfile: {
                      ...obj(draft.businessProfile),
                      companyName: event.target.value,
                    },
                  })
                }
              />
            </div>
            <div>
              <FieldLabel icon={Tag}>Short description</FieldLabel>
              <TextArea
                rows={4}
                value={s(draft.businessProfile?.description)}
                placeholder="What the business does, in a concise trustworthy way"
                onChange={(event) =>
                  updateDraft({
                    businessProfile: {
                      ...obj(draft.businessProfile),
                      description: event.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        ) : null}

        {activeSection === "services" ? (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-text-subtle" />
                <TextInput
                  className="pl-9"
                  value={serviceSearch}
                  placeholder="Search the starter catalog"
                  onChange={(event) => setServiceSearch(event.target.value)}
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  updateDraft({
                    services: [
                      ...arr(draft.services),
                      {
                        key: `custom-${Date.now()}`,
                        title: "",
                        summary: "",
                        category: "general",
                      },
                    ],
                  })
                }
              >
                Add custom
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {arr(servicesCatalog.suggestedServices)
                .slice(0, 6)
                .map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      updateDraft({
                        services: appendUniqueServices(draft.services, [item]),
                      })
                    }
                    className="rounded-full border border-line bg-[rgba(242,246,255,0.92)] px-3 py-2 text-[12px] font-semibold text-[rgba(38,76,165,0.98)]"
                  >
                    {item.title}
                  </button>
                ))}
            </div>

            <div className="grid gap-2">
              {searchResults.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    updateDraft({
                      services: appendUniqueServices(draft.services, [item]),
                    })
                  }
                  className="rounded-[14px] border border-line bg-surface-muted px-3 py-3 text-left"
                >
                  <div className="text-[13px] font-semibold text-text">{item.title}</div>
                  <div className="mt-1 text-[12px] text-text-subtle">{item.summary}</div>
                </button>
              ))}
            </div>

            {arr(draft.services).map((item, index) => (
              <div key={item.key || index} className="rounded-[16px] border border-line bg-surface-muted p-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput
                    value={s(item.title)}
                    placeholder="Service title"
                    onChange={(event) =>
                      updateDraft({
                        services: arr(draft.services).map((row, rowIndex) =>
                          rowIndex === index ? { ...row, title: event.target.value } : row
                        ),
                      })
                    }
                  />
                  <TextInput
                    value={s(item.category)}
                    placeholder="Category"
                    onChange={(event) =>
                      updateDraft({
                        services: arr(draft.services).map((row, rowIndex) =>
                          rowIndex === index ? { ...row, category: event.target.value } : row
                        ),
                      })
                    }
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px]">
                  <TextArea
                    rows={2}
                    value={s(item.summary)}
                    placeholder="What this service covers"
                    onChange={(event) =>
                      updateDraft({
                        services: arr(draft.services).map((row, rowIndex) =>
                          rowIndex === index ? { ...row, summary: event.target.value } : row
                        ),
                      })
                    }
                  />
                  <TextInput
                    value={s(item.priceLabel)}
                    placeholder="Price label"
                    onChange={(event) =>
                      updateDraft({
                        services: arr(draft.services).map((row, rowIndex) =>
                          rowIndex === index ? { ...row, priceLabel: event.target.value } : row
                        ),
                      })
                    }
                  />
                </div>
              </div>
            ))}

            <div className="rounded-[16px] border border-line bg-surface-muted p-3">
              <FieldLabel icon={Sparkles}>Parse rough services note</FieldLabel>
              <TextArea
                rows={3}
                value={servicesNote}
                placeholder="Paste a rough services list and convert it into structured items"
                onChange={(event) => setServicesNote(event.target.value)}
              />
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onParseNote("services", servicesNote)}
                  isLoading={saving}
                >
                  Parse into services
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "hours" ? (
          <div className="space-y-3">
            {DAYS.map(([key, label], index) => {
              const item = arr(draft.hours)[index] || { day: key };
              return (
                <div key={key} className="rounded-[16px] border border-line bg-surface-muted p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-[14px] font-semibold text-text">{label}</div>
                    <div className="flex flex-wrap gap-3">
                      <Toggle
                        checked={item.enabled === true}
                        label="Open"
                        onChange={(event) =>
                          updateDraft({
                            hours: arr(draft.hours).map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, enabled: event.target.checked, closed: !event.target.checked }
                                : row
                            ),
                          })
                        }
                      />
                      <Toggle
                        checked={item.allDay === true}
                        label="24h"
                        onChange={(event) =>
                          updateDraft({
                            hours: arr(draft.hours).map((row, rowIndex) =>
                              rowIndex === index ? { ...row, allDay: event.target.checked } : row
                            ),
                          })
                        }
                      />
                      <Toggle
                        checked={item.appointmentOnly === true}
                        label="Appointment only"
                        onChange={(event) =>
                          updateDraft({
                            hours: arr(draft.hours).map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, appointmentOnly: event.target.checked }
                                : row
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextInput
                      value={s(item.openTime)}
                      placeholder="Open time"
                      onChange={(event) =>
                        updateDraft({
                          hours: arr(draft.hours).map((row, rowIndex) =>
                            rowIndex === index ? { ...row, openTime: event.target.value } : row
                          ),
                        })
                      }
                    />
                    <TextInput
                      value={s(item.closeTime)}
                      placeholder="Close time"
                      onChange={(event) =>
                        updateDraft({
                          hours: arr(draft.hours).map((row, rowIndex) =>
                            rowIndex === index ? { ...row, closeTime: event.target.value } : row
                          ),
                        })
                      }
                    />
                  </div>
                </div>
              );
            })}

            <div className="rounded-[16px] border border-line bg-surface-muted p-3">
              <FieldLabel icon={Clock3}>Parse rough hours</FieldLabel>
              <TextArea
                rows={3}
                value={hoursNote}
                placeholder="Mon-Fri 09:00-18:00; Sat 10:00-14:00; Sun closed"
                onChange={(event) => setHoursNote(event.target.value)}
              />
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onParseNote("hours", hoursNote)}
                  isLoading={saving}
                >
                  Parse schedule
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "pricing" ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRICING_MODES.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    updateDraft({
                      pricingPosture: {
                        ...obj(draft.pricingPosture),
                        pricingMode: key,
                      },
                    })
                  }
                  className={[
                    "rounded-full border px-3 py-2 text-[12px] font-semibold",
                    s(draft.pricingPosture?.pricingMode) === key
                      ? "border-[rgba(38,76,165,0.24)] bg-[rgba(242,246,255,0.98)] text-[rgba(38,76,165,0.98)]"
                      : "border-line bg-white text-text-subtle",
                  ].join(" ")}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <TextInput
                value={s(draft.pricingPosture?.currency, "AZN")}
                placeholder="Currency"
                onChange={(event) =>
                  updateDraft({
                    pricingPosture: {
                      ...obj(draft.pricingPosture),
                      currency: event.target.value,
                    },
                  })
                }
              />
              <TextInput
                value={s(draft.pricingPosture?.startingAt)}
                placeholder="Starting at"
                onChange={(event) =>
                  updateDraft({
                    pricingPosture: {
                      ...obj(draft.pricingPosture),
                      startingAt: event.target.value,
                    },
                  })
                }
              />
              <TextInput
                value={s(draft.pricingPosture?.minPrice)}
                placeholder="Min price"
                onChange={(event) =>
                  updateDraft({
                    pricingPosture: {
                      ...obj(draft.pricingPosture),
                      minPrice: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div>
              <FieldLabel icon={ShieldCheck}>Public reply summary</FieldLabel>
              <TextArea
                rows={3}
                value={s(draft.pricingPosture?.publicSummary)}
                placeholder="What AI is allowed to say publicly about pricing"
                onChange={(event) =>
                  updateDraft({
                    pricingPosture: {
                      ...obj(draft.pricingPosture),
                      publicSummary: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <Toggle
                checked={draft.pricingPosture?.allowPublicPriceReplies === true}
                label="Allow public price replies"
                onChange={(event) =>
                  updateDraft({
                    pricingPosture: {
                      ...obj(draft.pricingPosture),
                      allowPublicPriceReplies: event.target.checked,
                    },
                  })
                }
              />
              <Toggle
                checked={draft.pricingPosture?.requiresOperatorForExactQuote === true}
                label="Operator for exact quote"
                onChange={(event) =>
                  updateDraft({
                    pricingPosture: {
                      ...obj(draft.pricingPosture),
                      requiresOperatorForExactQuote: event.target.checked,
                    },
                  })
                }
              />
            </div>

            <div className="rounded-[16px] border border-line bg-surface-muted p-3">
              <FieldLabel icon={Tag}>Parse rough pricing note</FieldLabel>
              <TextArea
                rows={3}
                value={pricingNote}
                placeholder="Starts from 50 AZN. Exact quotes depend on treatment."
                onChange={(event) => setPricingNote(event.target.value)}
              />
              <div className="mt-3">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => onParseNote("pricing", pricingNote)}
                  isLoading={saving}
                >
                  Parse pricing policy
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {activeSection === "contacts" ? (
          <div className="space-y-3">
            {arr(draft.contacts).map((item, index) => (
              <div key={`${item.type}-${index}`} className="grid gap-3 sm:grid-cols-3">
                <TextInput
                  value={s(item.label)}
                  placeholder="Label"
                  onChange={(event) =>
                    updateDraft({
                      contacts: arr(draft.contacts).map((row, rowIndex) =>
                        rowIndex === index ? { ...row, label: event.target.value } : row
                      ),
                    })
                  }
                />
                <TextInput
                  value={s(item.type)}
                  placeholder="Type"
                  onChange={(event) =>
                    updateDraft({
                      contacts: arr(draft.contacts).map((row, rowIndex) =>
                        rowIndex === index ? { ...row, type: event.target.value } : row
                      ),
                    })
                  }
                />
                <TextInput
                  value={s(item.value)}
                  placeholder="Contact value"
                  onChange={(event) =>
                    updateDraft({
                      contacts: arr(draft.contacts).map((row, rowIndex) =>
                        rowIndex === index ? { ...row, value: event.target.value } : row
                      ),
                    })
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              leftIcon={<Phone className="h-4 w-4" />}
              onClick={() =>
                updateDraft({
                  contacts: [
                    ...arr(draft.contacts),
                    { type: "phone", label: "Primary", value: "", visibility: "public" },
                  ],
                })
              }
            >
              Add contact
            </Button>
          </div>
        ) : null}

        {activeSection === "handoff" ? (
          <div className="space-y-4">
            <div>
              <FieldLabel icon={Link2}>Escalation summary</FieldLabel>
              <TextArea
                rows={4}
                value={s(draft.handoffRules?.summary)}
                placeholder="When should AI stop and bring in a human?"
                onChange={(event) =>
                  updateDraft({
                    handoffRules: {
                      ...obj(draft.handoffRules),
                      summary: event.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {HANDOFF_TRIGGERS.map((trigger) => {
                const selected = arr(draft.handoffRules?.triggers).includes(trigger);
                return (
                  <button
                    key={trigger}
                    type="button"
                    onClick={() =>
                      updateDraft({
                        handoffRules: {
                          ...obj(draft.handoffRules),
                          triggers: selected
                            ? arr(draft.handoffRules?.triggers).filter((item) => item !== trigger)
                            : [...arr(draft.handoffRules?.triggers), trigger],
                        },
                      })
                    }
                    className={[
                      "rounded-full border px-3 py-2 text-[12px] font-semibold",
                      selected
                        ? "border-[rgba(38,76,165,0.24)] bg-[rgba(242,246,255,0.98)] text-[rgba(38,76,165,0.98)]"
                        : "border-line bg-white text-text-subtle",
                    ].join(" ")}
                  >
                    {trigger}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
