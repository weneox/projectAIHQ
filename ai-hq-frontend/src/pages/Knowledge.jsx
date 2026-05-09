import { useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Globe2,
  HelpCircle,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Upload,
} from "lucide-react";

import Button from "../components/ui/Button.jsx";
import Card from "../components/ui/Card.jsx";
import AppTag from "../components/ui/AppTag.jsx";
import AppModal, {
  AppModalBody,
  AppModalCloseButton,
  AppModalFooter,
  AppModalHeader,
} from "../components/ui/AppModal.jsx";
import {
  PageCanvas,
  PageHeader,
} from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const KNOWLEDGE_SOURCES = [
  {
    id: "website",
    title: "Website knowledge",
    type: "Website",
    status: "connected",
    icon: Globe2,
    description: "Public website pages that the assistant can use for general answers.",
    owner: "System",
    updated: "May 9, 2026",
    chunks: 66,
    action: "Manage",
    note: "Synced website content is available for public-facing answers.",
    includes: ["Homepage copy", "Service pages", "Public positioning"],
    boundaries: ["Do not invent unpublished offers", "Escalate unclear pricing questions"],
    preview:
      "The business helps customers automate conversations, capture leads, and route operational work through AI-assisted systems.",
  },
  {
    id: "business-faq",
    title: "Business FAQ",
    type: "FAQ",
    status: "needs review",
    icon: HelpCircle,
    description: "Common customer questions and approved short answers.",
    owner: "Operator",
    updated: "May 8, 2026",
    chunks: 42,
    action: "Review",
    note: "Some answers should be reviewed before the assistant relies on them.",
    includes: ["Project questions", "Setup questions", "Delivery process"],
    boundaries: ["Do not guarantee timelines", "Route custom requests to an operator"],
    preview:
      "Customers can ask about services, process, consultation, and general automation possibilities. Final scope should be confirmed by an operator.",
  },
  {
    id: "policies",
    title: "Policies",
    type: "Policy",
    status: "empty",
    icon: ShieldCheck,
    description: "Rules for refunds, cancellation, sensitive requests, and customer data.",
    owner: "Not assigned",
    updated: "Not configured",
    chunks: 0,
    action: "Add source",
    note: "Policy knowledge has not been added yet.",
    includes: ["Refund policy", "Data handling", "Cancellation rules"],
    boundaries: ["Do not answer policy questions until configured"],
    preview:
      "No approved policy source is configured yet. The assistant should hand off policy-related questions to an operator.",
  },
  {
    id: "services",
    title: "Service docs",
    type: "Document",
    status: "connected",
    icon: FileText,
    description: "Detailed service notes for automation, websites, and AI assistant work.",
    owner: "Emil",
    updated: "May 9, 2026",
    chunks: 84,
    action: "Manage",
    note: "Service documents are indexed and available.",
    includes: ["AI automation", "Website builds", "CRM routing", "Workflow systems"],
    boundaries: ["Avoid unsupported technical promises", "Confirm integrations before quoting"],
    preview:
      "Services include AI assistants, premium websites, CRM routing, customer follow-up, lead qualification, and internal workflow automation.",
  },
  {
    id: "uploads",
    title: "Uploaded files",
    type: "Files",
    status: "empty",
    icon: Upload,
    description: "PDFs, documents, briefs, and files uploaded for assistant knowledge.",
    owner: "Not assigned",
    updated: "Not configured",
    chunks: 0,
    action: "Upload",
    note: "No uploaded files are active yet.",
    includes: ["PDF documents", "Project briefs", "Internal references"],
    boundaries: ["Only use reviewed files", "Ignore outdated drafts"],
    preview:
      "No uploaded source is active yet. Upload reviewed files before allowing the assistant to answer from documents.",
  },
  {
    id: "custom-notes",
    title: "Custom notes",
    type: "Notes",
    status: "needs review",
    icon: BookOpen,
    description: "Manual notes for tone, answer style, objections, and handoff behavior.",
    owner: "Operator",
    updated: "May 7, 2026",
    chunks: 19,
    action: "Edit",
    note: "Custom notes exist, but review is recommended.",
    includes: ["Tone rules", "Sales notes", "Handoff rules"],
    boundaries: ["Keep claims conservative", "Escalate uncertain requests"],
    preview:
      "Assistant tone should be clear, direct, premium, and operational. If the answer is uncertain, collect context and hand off.",
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

  if (safe === "connected") return "success";
  if (safe === "needs review") return "warning";
  if (safe === "empty") return "neutral";

  return "neutral";
}

function statusLabel(status = "") {
  const safe = lower(status);

  if (safe === "needs review") return "Needs review";
  return titleize(safe);
}

function actionIconElement(source = {}, className = "h-4 w-4") {
  const safe = lower(source.action);

  if (safe.includes("add")) {
    return <Plus className={className} strokeWidth={2.1} />;
  }

  if (safe.includes("upload")) {
    return <Upload className={className} strokeWidth={2.1} />;
  }

  if (safe.includes("edit")) {
    return <Pencil className={className} strokeWidth={2.1} />;
  }

  return <ArrowRight className={className} strokeWidth={2.1} />;
}

function SourceCard({ source, selected = false, onOpen }) {
  const Icon = source.icon || Database;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.();
        }
      }}
      className={cx(
        "group cursor-pointer rounded-md border bg-white p-5 transition-[background-color,border-color,box-shadow] duration-base ease-premium",
        selected
          ? "border-brand shadow-[inset_3px_0_0_rgb(var(--color-brand)),0_18px_34px_-30px_rgba(37,99,235,0.62)]"
          : "border-line-soft hover:border-line hover:bg-surface-subtle hover:shadow-[0_14px_30px_-28px_rgba(15,23,42,0.45)]"
      )}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_150px] xl:items-center">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center text-text">
              <Icon className="h-9 w-9" strokeWidth={1.85} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-[18px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
                  {source.title}
                </h3>

                <AppTag tone={statusTone(source.status)} dot>
                  {statusLabel(source.status)}
                </AppTag>
              </div>

              <p className="mt-1.5 max-w-[780px] text-[13.5px] font-medium leading-6 text-text-muted">
                {source.description}
              </p>

              <div className="mt-4 border-t border-line-soft pt-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="text-[12.5px] font-semibold text-text-muted">
                    {source.type}
                  </div>

                  <div className="text-[12.5px] font-medium text-text-muted">
                    {source.chunks} indexed chunks
                  </div>

                  <div className="text-[12.5px] font-medium text-text-muted">
                    Owner: {source.owner}
                  </div>

                  <div className="min-w-0 truncate text-[12.5px] font-medium text-text-muted">
                    Updated: {source.updated}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-start xl:justify-end">
          <Button
            type="button"
            size="md"
            variant={lower(source.status) === "connected" ? "secondary" : "primary"}
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
            rightIcon={actionIconElement(source)}
          >
            {source.action}
          </Button>
        </div>
      </div>
    </article>
  );
}

function DetailList({ title, items }) {
  return (
    <div className="rounded-md border border-line-soft bg-surface-subtle p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {title}
      </div>

      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div key={item} className="flex items-center gap-2 text-[13px] font-medium text-text">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-success" strokeWidth={2.05} />
            <span className="min-w-0">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LockedPreview({ value }) {
  return (
    <div className="rounded-md border border-line-soft bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
          Source preview
        </div>

        <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-text-subtle">
          <LockKeyhole className="h-3.5 w-3.5" strokeWidth={2.1} />
          Read-only
        </div>
      </div>

      <div className="mt-3 text-[13.5px] font-medium leading-6 text-text">
        {value}
      </div>
    </div>
  );
}

function SourceDialog({ source, open, onClose }) {
  if (!open || !source) return null;

  const Icon = source.icon || Database;

  return (
    <AppModal open={open} onClose={onClose} maxWidth="max-w-[720px]">
      <AppModalHeader>
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center text-text">
            <Icon className="h-11 w-11" strokeWidth={1.78} />
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
              Knowledge source
            </div>

            <h2 className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {source.title}
            </h2>

            <p className="mt-2 max-w-[560px] text-[13.5px] font-medium leading-6 text-text-muted">
              {source.note}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <AppTag tone={statusTone(source.status)} dot>
                {statusLabel(source.status)}
              </AppTag>
              <AppTag tone="neutral">{source.type}</AppTag>
              <AppTag tone="neutral">{source.chunks} chunks</AppTag>
            </div>
          </div>
        </div>

        <AppModalCloseButton onClick={onClose} label="Close source detail" />
      </AppModalHeader>

      <AppModalBody className="bg-surface-subtle p-5">
        <LockedPreview value={source.preview} />

        <div className="grid gap-4 md:grid-cols-2">
          <DetailList title="Included knowledge" items={source.includes} />
          <DetailList title="Answer boundaries" items={source.boundaries} />
        </div>

        <div className="grid gap-3 rounded-md border border-line-soft bg-white p-4 md:grid-cols-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Owner
            </div>
            <div className="mt-1 text-[13px] font-semibold text-text">
              {source.owner}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Updated
            </div>
            <div className="mt-1 text-[13px] font-semibold text-text">
              {source.updated}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Index
            </div>
            <div className="mt-1 text-[13px] font-semibold text-text">
              {source.chunks} chunks
            </div>
          </div>
        </div>
      </AppModalBody>

      <AppModalFooter className="bg-white">
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Close
        </Button>

        <Button
          type="button"
          size="md"
          variant={lower(source.status) === "connected" ? "secondary" : "primary"}
          rightIcon={actionIconElement(source)}
        >
          {source.action} source
        </Button>
      </AppModalFooter>
    </AppModal>
  );
}

export default function Knowledge() {
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [dialogSource, setDialogSource] = useState(null);

  const selectedSource = useMemo(() => {
    return KNOWLEDGE_SOURCES.find((source) => source.id === selectedSourceId) || null;
  }, [selectedSourceId]);

  function openSource(source) {
    setSelectedSourceId(source.id);
    setDialogSource(source);
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Knowledge library"
        description="Connect and review the sources the assistant can use for answers. Keep the page simple: source cards first, details only when opened."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              Refresh
            </Button>

            <Button
              type="button"
              size="md"
              leftIcon={<Plus className="h-4 w-4" strokeWidth={2.1} />}
            >
              Add source
            </Button>
          </div>
        }
      />

      <Card padded={false} clip>
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <div className="text-[17px] font-semibold tracking-[var(--tracking-tight-md)] text-text">
              Assistant answer sources
            </div>
            <div className="mt-1 text-[13.5px] font-medium leading-6 text-text-muted">
              Each source can be connected, reviewed, or left empty until you need it.
            </div>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <AppTag tone="success" dot>
              2 connected
            </AppTag>
            <AppTag tone="warning" dot>
              2 review
            </AppTag>
            <AppTag tone="neutral" dot>
              2 empty
            </AppTag>
          </div>
        </div>
      </Card>

      <div className="grid gap-3">
        {KNOWLEDGE_SOURCES.map((source) => (
          <SourceCard
            key={source.id}
            source={source}
            selected={selectedSource?.id === source.id}
            onOpen={() => openSource(source)}
          />
        ))}
      </div>

      <SourceDialog
        source={dialogSource}
        open={Boolean(dialogSource)}
        onClose={() => setDialogSource(null)}
      />
    </PageCanvas>
  );
}

