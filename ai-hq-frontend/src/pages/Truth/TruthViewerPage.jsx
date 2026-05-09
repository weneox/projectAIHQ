import { useMemo, useState } from "react";
import {
  Bot,
  Briefcase,
  Building2,
  CheckCircle2,
  DollarSign,
  LockKeyhole,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
} from "lucide-react";

import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import AppTag from "../../components/ui/AppTag.jsx";
import AppModal, {
  AppModalBody,
  AppModalCloseButton,
  AppModalFooter,
  AppModalHeader,
} from "../../components/ui/AppModal.jsx";
import {
  PageCanvas,
  PageHeader,
} from "../../components/ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";

const BUSINESS_SECTIONS = [
  {
    id: "company",
    title: "Company identity",
    description: "Basic public information the assistant can safely use.",
    status: "ready",
    icon: Building2,
    fields: [
      {
        key: "companyName",
        label: "Company name",
        value: "Neosentic",
      },
      {
        key: "positioning",
        label: "Positioning",
        value: "AI automation and conversion-focused website systems for service businesses.",
        wide: true,
      },
      {
        key: "shortIntro",
        label: "Short introduction",
        value:
          "We help businesses automate customer conversations, lead capture, follow-up, and operational workflows with AI-assisted systems.",
        type: "textarea",
        wide: true,
      },
    ],
  },
  {
    id: "services",
    title: "Services",
    description: "What the business offers and what should be presented to customers.",
    status: "ready",
    icon: Briefcase,
    fields: [
      {
        key: "mainService",
        label: "Main service",
        value: "AI-powered business automation",
      },
      {
        key: "secondaryService",
        label: "Secondary service",
        value: "Premium websites and landing pages",
      },
      {
        key: "serviceDetails",
        label: "Service details",
        value:
          "Website chat assistants, CRM routing, lead qualification, customer follow-up, workflow automation, and internal operations dashboards.",
        type: "textarea",
        wide: true,
      },
    ],
  },
  {
    id: "pricing",
    title: "Pricing & offer",
    description: "How pricing should be explained before a human takes over.",
    status: "review",
    icon: DollarSign,
    fields: [
      {
        key: "pricingModel",
        label: "Pricing model",
        value: "Project-based setup with optional monthly support.",
      },
      {
        key: "startingPoint",
        label: "Starting point",
        value: "Depends on scope, integrations, and automation complexity.",
      },
      {
        key: "pricingBoundary",
        label: "Assistant pricing boundary",
        value:
          "The assistant should not promise a fixed final price. It can explain that pricing depends on scope and offer to arrange a consultation.",
        type: "textarea",
        wide: true,
      },
    ],
  },
  {
    id: "policies",
    title: "Policies",
    description: "Customer-facing rules, limits, and promises.",
    status: "review",
    icon: ShieldCheck,
    fields: [
      {
        key: "responsePolicy",
        label: "Response policy",
        value: "Customers should receive a clear reply and be routed to a human when needed.",
        wide: true,
      },
      {
        key: "refundPolicy",
        label: "Refund / cancellation policy",
        value: "Not configured yet.",
      },
      {
        key: "dataPolicy",
        label: "Data handling note",
        value:
          "Customer information should only be used to provide service, support, and follow-up. Sensitive requests should be escalated to an operator.",
        type: "textarea",
        wide: true,
      },
    ],
  },
  {
    id: "contact",
    title: "Contact & handoff",
    description: "Where the assistant should send serious customer intent.",
    status: "ready",
    icon: Phone,
    fields: [
      {
        key: "supportEmail",
        label: "Support email",
        value: "support@neosentic.com",
      },
      {
        key: "salesOwner",
        label: "Sales owner",
        value: "Emil",
      },
      {
        key: "handoffRule",
        label: "Handoff rule",
        value:
          "When a customer asks about pricing, project scope, legal terms, or custom integration, the assistant should collect context and hand off to an operator.",
        type: "textarea",
        wide: true,
      },
    ],
  },
  {
    id: "assistant",
    title: "Assistant boundaries",
    description: "What the assistant can say and where it must stop.",
    status: "review",
    icon: Bot,
    fields: [
      {
        key: "canAnswer",
        label: "Can answer",
        value: "Services, general process, lead qualification, consultation booking, and basic project explanation.",
        type: "textarea",
        wide: true,
      },
      {
        key: "mustNotAnswer",
        label: "Must not answer",
        value:
          "Final legal terms, guaranteed pricing, sensitive credentials, private customer data, or unsupported technical promises.",
        type: "textarea",
        wide: true,
      },
      {
        key: "fallback",
        label: "Fallback behavior",
        value: "If unsure, the assistant should say it will ask an operator and continue with a safe handoff.",
        type: "textarea",
        wide: true,
      },
    ],
  },
];

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function lower(value, fallback = "") {
  return s(value, fallback).toLowerCase();
}

function titleize(value = "") {
  return s(value || "unknown")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "ready") return "success";
  if (safe === "review") return "warning";
  if (safe === "blocked") return "danger";

  return "neutral";
}

function statusLabel(status = "") {
  const safe = lower(status);

  if (safe === "review") return "Needs review";
  return titleize(safe);
}

function sectionStatus(section = {}) {
  const hasMissing = section.fields.some(
    (field) => !s(field.value) || lower(field.value) === "not configured yet."
  );

  if (hasMissing) return "review";
  return section.status || "ready";
}

function getDraftFromSection(section = {}) {
  return Object.fromEntries(
    section.fields.map((field) => [field.key, s(field.value)])
  );
}

function LockedField({ field }) {
  const value = s(field.value) || "Not configured yet";

  return (
    <div className={cx("grid gap-2", field.wide ? "md:col-span-2" : "")}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-[12px] font-semibold text-text-muted">
          {field.label}
        </label>

        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-subtle">
          <LockKeyhole className="h-3.5 w-3.5" strokeWidth={2.1} />
          Locked
        </div>
      </div>

      <div
        className={cx(
          "rounded-md border border-line-soft bg-surface-subtle px-3.5 py-3 text-[13.5px] font-semibold leading-6 text-text shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]",
          field.type === "textarea" ? "min-h-[92px] whitespace-pre-line" : "min-h-11 truncate"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EditField({ field, value, onChange }) {
  return (
    <div className={cx("grid gap-2", field.wide ? "md:col-span-2" : "")}>
      <label className="text-[12px] font-semibold text-text-muted">
        {field.label}
      </label>

      {field.type === "textarea" ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={4}
          className="min-h-[112px] resize-y rounded-md border border-line bg-white px-3.5 py-3 text-[13.5px] font-semibold leading-6 text-text outline-none transition-[border-color,box-shadow] duration-base ease-premium placeholder:text-text-subtle focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 rounded-md border border-line bg-white px-3.5 text-[13.5px] font-semibold text-text outline-none transition-[border-color,box-shadow] duration-base ease-premium placeholder:text-text-subtle focus:border-brand focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)]"
        />
      )}
    </div>
  );
}

function BusinessSectionCard({ section, selected = false, onEdit }) {
  const Icon = section.icon || CheckCircle2;
  const status = sectionStatus(section);

  return (
    <Card
      padded={false}
      clip
      className={cx(
        "transition-[border-color,box-shadow] duration-base ease-premium",
        selected ? "border-brand shadow-[inset_3px_0_0_rgb(var(--color-brand))]" : ""
      )}
    >
      <div className="grid gap-5 border-b border-line-soft p-5 xl:grid-cols-[minmax(0,1fr)_126px] xl:items-center">
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center text-text">
            <Icon className="h-9 w-9" strokeWidth={1.85} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[20px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
                {section.title}
              </h2>

              <AppTag tone={statusTone(status)} dot>
                {statusLabel(status)}
              </AppTag>
            </div>

            <p className="mt-1.5 max-w-[780px] text-[13.5px] font-medium leading-6 text-text-muted">
              {section.description}
            </p>
          </div>
        </div>

        <div className="xl:text-right">
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={() => onEdit(section)}
            leftIcon={<Pencil className="h-4 w-4" strokeWidth={2.1} />}
          >
            Edit
          </Button>
        </div>
      </div>

      <div className="grid gap-4 bg-white p-5 md:grid-cols-2">
        {section.fields.map((field) => (
          <LockedField key={field.key} field={field} />
        ))}
      </div>
    </Card>
  );
}

function EditBusinessDialog({
  section,
  draft,
  open,
  onClose,
  onDraftChange,
  onSave,
}) {
  if (!open || !section) return null;

  const Icon = section.icon || CheckCircle2;
  const status = sectionStatus(section);

  return (
    <AppModal
      open={open}
      onClose={onClose}
      maxWidth="max-w-[760px]"
    >
      <AppModalHeader>
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center text-text">
            <Icon className="h-11 w-11" strokeWidth={1.78} />
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
              Edit business truth
            </div>

            <h2 className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {section.title}
            </h2>

            <p className="mt-2 max-w-[560px] text-[13.5px] font-medium leading-6 text-text-muted">
              Update the locked business information. After saving, this section returns to read-only mode.
            </p>

            <div className="mt-4">
              <AppTag tone={statusTone(status)} dot>
                {statusLabel(status)}
              </AppTag>
            </div>
          </div>
        </div>

        <AppModalCloseButton onClick={onClose} label="Close edit dialog" />
      </AppModalHeader>

      <AppModalBody className="max-h-[calc(100vh-270px)] overflow-y-auto bg-surface-subtle p-5">
        <div className="grid gap-4 md:grid-cols-2">
          {section.fields.map((field) => (
            <EditField
              key={field.key}
              field={field}
              value={draft[field.key] ?? ""}
              onChange={(value) => onDraftChange(field.key, value)}
            />
          ))}
        </div>
      </AppModalBody>

      <AppModalFooter className="bg-white">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>

        <Button
          type="button"
          size="md"
          onClick={onSave}
          leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
        >
          Save changes
        </Button>
      </AppModalFooter>
    </AppModal>
  );
}

export default function TruthViewerPage() {
  const [sections, setSections] = useState(BUSINESS_SECTIONS);
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState({});

  const editingSection = useMemo(() => {
    return sections.find((section) => section.id === editingId) || null;
  }, [editingId, sections]);

  const summary = useMemo(() => {
    const ready = sections.filter(
      (section) => sectionStatus(section) === "ready"
    ).length;
    const review = sections.filter(
      (section) => sectionStatus(section) === "review"
    ).length;

    return {
      ready,
      review,
      total: sections.length,
    };
  }, [sections]);

  function openEdit(section) {
    setEditingId(section.id);
    setDraft(getDraftFromSection(section));
  }

  function closeEdit() {
    setEditingId("");
    setDraft({});
  }

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function saveEdit() {
    if (!editingSection) return;

    setSections((current) =>
      current.map((section) => {
        if (section.id !== editingSection.id) return section;

        return {
          ...section,
          status: "ready",
          fields: section.fields.map((field) => ({
            ...field,
            value: draft[field.key] ?? field.value,
          })),
        };
      })
    );

    closeEdit();
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Business info"
        description="Locked source-of-truth inputs for what the assistant can say about your business. Edit only when the business information changes."
      />

      <Card padded={false} clip>
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <div>
            <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Approved business truth
            </div>
            <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
              These fields stay locked after setup. Use Edit to update a section, then save it back into read-only mode.
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <AppTag tone="success" dot>
              {summary.ready} ready
            </AppTag>
            <AppTag tone="warning" dot>
              {summary.review} review
            </AppTag>
            <AppTag tone="neutral">
              {summary.total} sections
            </AppTag>
          </div>
        </div>
      </Card>

      <div className="grid gap-4">
        {sections.map((section) => (
          <BusinessSectionCard
            key={section.id}
            section={section}
            selected={editingId === section.id}
            onEdit={openEdit}
          />
        ))}
      </div>

      <EditBusinessDialog
        section={editingSection}
        draft={draft}
        open={Boolean(editingSection)}
        onClose={closeEdit}
        onDraftChange={updateDraft}
        onSave={saveEdit}
      />
    </PageCanvas>
  );
}

