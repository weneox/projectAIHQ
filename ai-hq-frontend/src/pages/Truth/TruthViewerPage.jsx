import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

import { getCanonicalTruthSnapshot } from "../../api/truth.js";
import Button from "../../components/ui/Button.jsx";
import Card from "../../components/ui/Card.jsx";
import {
  InlineNotice,
  LoadingSurface,
  PageCanvas,
} from "../../components/ui/AppShellPrimitives.jsx";
import { cx } from "../../lib/cx.js";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function arr(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function obj(value, fallback = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : fallback;
}

function titleize(value = "") {
  return s(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatWhen(value = "") {
  const raw = s(value);
  if (!raw) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function normalizeFieldValue(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return s(item);
        return s(item?.title || item?.name || item?.label || item?.value || item?.description);
      })
      .filter(Boolean)
      .join(", ");
  }

  if (value && typeof value === "object") {
    return s(
      value.text ||
        value.value ||
        value.label ||
        value.name ||
        value.title ||
        value.description ||
        JSON.stringify(value)
    );
  }

  return s(value);
}

function normalizeField(field = {}) {
  const source = obj(field);
  const key = s(source.key || source.field || source.name || source.label);
  const label = s(source.label || source.title || source.key || source.field || source.name);
  const value = normalizeFieldValue(
    source.value ??
      source.valueText ??
      source.value_text ??
      source.text ??
      source.content ??
      source.summary
  );

  const provenance = s(
    source.provenance ||
      source.sourceLabel ||
      source.source_label ||
      source.sourceType ||
      source.source_type ||
      source.source ||
      ""
  );

  return {
    key: key || label || value,
    label: label || titleize(key) || "Business fact",
    value,
    provenance,
  };
}

function fieldsFromPayload(payload = {}) {
  const root = obj(
    payload?.data ||
      payload?.snapshot ||
      payload?.truth ||
      payload?.canonicalTruth ||
      payload
  );

  const directFields = arr(root.fields || root.approvedFields || root.approved_fields)
    .map(normalizeField)
    .filter((field) => s(field.value));

  if (directFields.length) return directFields;

  const candidates = [
    ["companyName", "Business name"],
    ["description", "Summary"],
    ["summary", "Summary"],
    ["primaryPhone", "Phone"],
    ["phone", "Phone"],
    ["primaryEmail", "Email"],
    ["email", "Email"],
    ["primaryAddress", "Address"],
    ["address", "Address"],
    ["websiteUrl", "Website"],
    ["website", "Website"],
    ["services", "Services"],
    ["products", "Products"],
    ["pricingHints", "Pricing"],
    ["pricing", "Pricing"],
    ["hours", "Hours"],
    ["faqQuestions", "FAQ"],
    ["tone", "Tone"],
    ["mainLanguage", "Language"],
  ];

  return candidates
    .map(([key, label]) => ({
      key,
      label,
      value: normalizeFieldValue(root[key]),
      provenance: "",
    }))
    .filter((field) => s(field.value));
}

function approvalFromPayload(payload = {}) {
  const root = obj(
    payload?.data ||
      payload?.snapshot ||
      payload?.truth ||
      payload?.canonicalTruth ||
      payload
  );

  const approval = obj(root.approval || root.approved || root.versionApproval);

  return {
    version: s(approval.version || approval.versionId || root.version || root.versionId),
    approvedAt: s(approval.approvedAt || approval.approved_at || root.approvedAt || root.updatedAt),
    approvedBy: s(approval.approvedBy || approval.approved_by || root.approvedBy),
  };
}

function groupFields(fields = []) {
  const groups = {
    identity: {
      title: "Identity",
      rows: [],
    },
    contact: {
      title: "Contact",
      rows: [],
    },
    offering: {
      title: "Offering",
      rows: [],
    },
    behavior: {
      title: "AI behavior",
      rows: [],
    },
    other: {
      title: "Other facts",
      rows: [],
    },
  };

  for (const field of fields) {
    const key = s(field.key).toLowerCase();

    if (
      key.includes("company") ||
      key.includes("business") ||
      key.includes("description") ||
      key.includes("summary") ||
      key.includes("language")
    ) {
      groups.identity.rows.push(field);
      continue;
    }

    if (
      key.includes("phone") ||
      key.includes("email") ||
      key.includes("address") ||
      key.includes("website") ||
      key.includes("social")
    ) {
      groups.contact.rows.push(field);
      continue;
    }

    if (
      key.includes("service") ||
      key.includes("product") ||
      key.includes("pricing") ||
      key.includes("price") ||
      key.includes("hour") ||
      key.includes("faq")
    ) {
      groups.offering.rows.push(field);
      continue;
    }

    if (
      key.includes("tone") ||
      key.includes("greeting") ||
      key.includes("handoff") ||
      key.includes("booking") ||
      key.includes("after")
    ) {
      groups.behavior.rows.push(field);
      continue;
    }

    groups.other.rows.push(field);
  }

  return Object.values(groups).filter((group) => group.rows.length);
}

function EmptyState() {
  return (
    <div className="flex min-h-[420px] items-center justify-center px-6 py-12 text-center">
      <div className="max-w-[560px]">
        <div className="mx-auto h-1.5 w-14 rounded-full bg-line-strong" />
        <h2 className="mt-6 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
          No approved business info yet
        </h2>
        <p className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
          Approved business facts will appear here when the business profile is reviewed.
        </p>
      </div>
    </div>
  );
}

function FieldRow({ field, last = false }) {
  return (
    <div
      className={cx(
        "grid gap-2 py-3 md:grid-cols-[180px_minmax(0,1fr)]",
        !last && "border-b border-line-soft"
      )}
    >
      <div className="text-[12px] font-semibold text-text-muted">
        {field.label}
      </div>

      <div className="min-w-0">
        <div className="whitespace-pre-wrap text-[13.5px] font-medium leading-6 text-text">
          {field.value}
        </div>

        {field.provenance ? (
          <div className="mt-1 text-[11.5px] font-medium text-text-subtle">
            {field.provenance}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FieldGroup({ group }) {
  return (
    <section className="border-t border-line-soft px-5 py-4">
      <div className="mb-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
        {group.title}
      </div>

      <div>
        {group.rows.map((field, index) => (
          <FieldRow
            key={`${group.title}-${field.key}-${index}`}
            field={field}
            last={index === group.rows.length - 1}
          />
        ))}
      </div>
    </section>
  );
}

export default function TruthViewerPage() {
  const [state, setState] = useState({
    loading: true,
    refreshing: false,
    error: "",
    payload: null,
  });

  const load = useCallback(async ({ refreshing = false } = {}) => {
    setState((current) => ({
      ...current,
      loading: !refreshing,
      refreshing,
      error: "",
    }));

    try {
      const payload = await getCanonicalTruthSnapshot();

      setState({
        loading: false,
        refreshing: false,
        error: "",
        payload,
      });
    } catch (error) {
      setState({
        loading: false,
        refreshing: false,
        error:
          s(error?.payload?.reason || error?.payload?.error || error?.message) ||
          "Business Info could not be loaded.",
        payload: null,
      });
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  const model = useMemo(() => {
    const fields = fieldsFromPayload(state.payload);
    const approval = approvalFromPayload(state.payload);

    return {
      fields,
      groups: groupFields(fields),
      approval,
    };
  }, [state.payload]);

  if (state.loading) {
    return (
      <PageCanvas className="max-w-[1180px] py-3">
        <LoadingSurface title="Loading Business Info" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas className="max-w-[1180px] space-y-4 py-3">
      {state.error ? (
        <InlineNotice
          tone="danger"
          title="Business Info unavailable"
          description={state.error}
          compact
        />
      ) : null}

      <Card padded={false} clip className="shadow-[0_28px_80px_-64px_rgba(15,23,42,0.55)]">
        <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="text-[12px] font-semibold text-brand">
              Business Info
            </div>
            <h1 className="mt-1 text-[20px] font-semibold tracking-[var(--tracking-tight-lg)] text-text">
              Approved business profile
            </h1>
            <p className="mt-2 max-w-[720px] text-[13.5px] font-medium leading-6 text-text-muted">
              These are the facts AI is allowed to use when replying to customers.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {model.approval.version || model.approval.approvedAt ? (
              <span className="inline-flex h-9 items-center gap-2 rounded-full bg-success-soft px-3 text-[12px] font-semibold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Approved{model.approval.approvedAt ? ` ${formatWhen(model.approval.approvedAt)}` : ""}
              </span>
            ) : (
              <span className="inline-flex h-9 items-center gap-2 rounded-full bg-surface-subtle px-3 text-[12px] font-semibold text-text-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-[rgb(var(--color-text-soft))]" />
                No approved profile yet
              </span>
            )}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={state.refreshing}
              onClick={() => load({ refreshing: true })}
              leftIcon={!state.refreshing ? <RefreshCw className="h-4 w-4" strokeWidth={2.1} /> : undefined}
            >
              Refresh
            </Button>
          </div>
        </div>

        {model.groups.length ? (
          <div>
            {model.groups.map((group) => (
              <FieldGroup key={group.title} group={group} />
            ))}
          </div>
        ) : (
          <div className="border-t border-line-soft">
            <EmptyState />
          </div>
        )}
      </Card>
    </PageCanvas>
  );
}