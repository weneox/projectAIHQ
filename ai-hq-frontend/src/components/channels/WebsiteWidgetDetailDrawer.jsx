import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Globe2,
  Package,
  RefreshCw,
  Save,
  Settings2,
  ShieldAlert,
  X,
} from "lucide-react";

import {
  checkWebsiteDomainVerification,
  createWebsiteDomainVerificationChallenge,
  createWebsiteWidgetGtmInstallHandoff,
  createWebsiteWidgetInstallHandoff,
  createWebsiteWidgetTestMessage,
  createWebsiteWidgetWordpressInstallHandoff,
  getWebsiteDomainVerificationStatus,
  getWebsiteWidgetStatus,
  saveWebsiteWidgetConfig,
} from "../../api/channelConnect.js";
import {
  buildWorkspaceScopedQueryKey,
  useWorkspaceTenantKey,
} from "../../hooks/useWorkspaceTenantKey.js";
import { s } from "../../lib/appUi.js";
import { cx } from "../../lib/cx.js";
import { emitLaunchSliceRefresh } from "../../lib/launchSliceRefresh.js";
import Button from "../ui/Button.jsx";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";
import Input, { Textarea } from "../ui/Input.jsx";
import { InlineNotice } from "../ui/AppShellPrimitives.jsx";
import ChannelIcon from "./ChannelIcon.jsx";

const ACCENT_OPTIONS = [
  { label: "Blue", value: "#2e60ff", preview: "#2e60ff" },
  { label: "Navy", value: "#0f172a", preview: "#0f172a" },
  { label: "Cyan", value: "#0ea5e9", preview: "#0ea5e9" },
  { label: "Green", value: "#16a34a", preview: "#16a34a" },
];

function scheduleAsyncState(callback) {
  if (typeof queueMicrotask === "function") {
    queueMicrotask(callback);
    return;
  }

  Promise.resolve().then(callback);
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function listToText(value) {
  return arr(value)
    .map((item) => s(item))
    .filter(Boolean)
    .join("\n");
}

function parseList(value = "") {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => s(item))
    .filter(Boolean);
}

function firstText(...values) {
  for (const value of values) {
    const next = s(value);
    if (next) return next;
  }

  return "";
}

function formatTimestamp(value) {
  const raw = s(value);
  if (!raw) return "Not available";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString();
}

function buildFormState(payload = {}) {
  const widget = obj(payload.widget);

  return {
    enabled: widget.enabled === true,
    title: s(widget.title),
    subtitle: s(widget.subtitle),
    accentColor: s(widget.accentColor),
    allowedOrigins: listToText(widget.allowedOrigins),
    allowedDomains: listToText(widget.allowedDomains),
    initialPrompts: listToText(widget.initialPrompts),
  };
}

function verificationStateLabel(state = "") {
  const normalized = s(state).toLowerCase();

  if (normalized === "verified") return "Verified";
  if (normalized === "pending") return "Pending";
  if (normalized === "failed") return "Failed";

  return "Unverified";
}

function compactValue(value, max = 30) {
  const text = s(value, "Not set");
  if (text.length <= max) return text;
  return `${text.slice(0, 17)}…${text.slice(-8)}`;
}

function toneTextClass(tone = "neutral") {
  if (tone === "success") return "text-success";
  if (tone === "warning") return "text-warning";
  if (tone === "danger") return "text-danger";
  if (tone === "brand" || tone === "info") return "text-brand";

  return "text-text-muted";
}

function dotClass(tone = "neutral") {
  if (tone === "success") return "bg-success";
  if (tone === "warning") return "bg-warning";
  if (tone === "danger") return "bg-danger";
  if (tone === "brand" || tone === "info") return "bg-brand";

  return "bg-[rgb(var(--color-text-soft))]";
}

function normalizedTone(tone = "neutral") {
  if (tone === "success") return "success";
  if (tone === "warning" || tone === "warn") return "warning";
  if (tone === "danger") return "danger";
  if (tone === "brand" || tone === "info") return "brand";

  return "neutral";
}

function buildPosture({
  widget = {},
  install = {},
  launchReadiness = {},
  handoffs = {},
  verificationSurface = {},
  readiness = {},
}) {
  const developerHandoff = obj(handoffs.developer);

  const productionReady =
    launchReadiness.productionLaunchAllowed === true ||
    install.productionInstallReady === true;

  const productionBlocked =
    launchReadiness.productionBlocked === true ||
    install.productionBlocked === true;

  const testingOnly =
    launchReadiness.testingOnly === true || developerHandoff.testingOnly === true;

  const verificationState = s(
    verificationSurface.state || launchReadiness.domainVerificationState
  ).toLowerCase();

  if (widget.enabled !== true) {
    return {
      tone: "warning",
      title: "Widget is off",
      summary: "Turn it on when you are ready.",
      next: "Change settings",
      icon: ShieldAlert,
    };
  }

  if (!s(widget.publicWidgetId)) {
    return {
      tone: "warning",
      title: "Save settings",
      summary: "Save settings once to create the public widget ID.",
      next: "Save settings",
      icon: ShieldAlert,
    };
  }

  if (productionBlocked) {
    return {
      tone: verificationState === "failed" ? "danger" : "warning",
      title: "Verify domain",
      summary: firstText(
        developerHandoff.blockingMessage,
        launchReadiness.message,
        verificationSurface.message,
        "Verify the domain before public install."
      ),
      next: "Verify domain",
      icon: ShieldAlert,
    };
  }

  if (productionReady || s(readiness.status).toLowerCase() === "ready") {
    return {
      tone: "success",
      title: "Ready to install",
      summary: "The widget is configured. Copy the snippet when you need it.",
      next: "Copy snippet",
      icon: CheckCircle2,
    };
  }

  if (testingOnly) {
    return {
      tone: "warning",
      title: "Testing mode",
      summary: firstText(
        developerHandoff.message,
        launchReadiness.message,
        "Install packages are available for local or test usage only."
      ),
      next: "Verify domain",
      icon: ShieldAlert,
    };
  }

  return {
    tone: "warning",
    title: "Setup needs review",
    summary: firstText(
      launchReadiness.message,
      readiness.message,
      "Finish the remaining website setup."
    ),
    next: "Review setup",
    icon: ShieldAlert,
  };
}

const WEBSITE_ACCESS_OPTIONS = [
  {
    id: "cmsAdmin",
    label: "Website admin panel",
    description: "WordPress, Shopify, Wix, Webflow, Squarespace, Framer, or similar.",
  },
  {
    id: "googleTagManager",
    label: "Google Tag Manager",
    description: "Someone can publish tags through GTM.",
  },
  {
    id: "cloudflare",
    label: "Cloudflare or DNS",
    description: "The domain can be managed through Cloudflare or DNS.",
  },
  {
    id: "developer",
    label: "Developer or freelancer",
    description: "A technical person can install it for me.",
  },
  {
    id: "unknown",
    label: "I do not know",
    description: "Guide me through the safest option.",
  },
];

function mergeInstallPlanWithAccessHints(installPlan = {}, accessHints = {}) {
  const plan = obj(installPlan);
  const selected = obj(accessHints);

  if (!Object.keys(plan).length) return plan;

  const methods = arr(plan.allMethods);
  if (!methods.length) return plan;

  function bonus(method = {}) {
    const id = s(method.id).toLowerCase();
    let score = Number(method.score || 0);

    if (selected.cmsAdmin && ["wordpress_plugin", "shopify_app", "platform_admin_embed"].includes(id)) {
      score += 120;
    }

    if (selected.googleTagManager && id === "google_tag_manager") {
      score += 140;
    }

    if (selected.cloudflare && id === "cloudflare_auto_injection") {
      score += 140;
    }

    if (selected.developer && id === "developer_invite") {
      score += 140;
    }

    if (selected.unknown && id === "managed_support") {
      score += 160;
    }

    if (id === "manual_snippet") {
      score -= 200;
    }

    return score;
  }

  const ranked = methods
    .map((method) => ({
      ...method,
      score: bonus(method),
    }))
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

  return {
    ...plan,
    recommendedMethod: ranked[0] || plan.recommendedMethod,
    fallbackMethods: ranked.slice(1, 5),
    allMethods: ranked,
    accessHints: selected,
  };
}

function platformTone(platformId = "") {
  const id = s(platformId).toLowerCase();

  if (!id || id === "custom_or_unknown") return "warning";
  return "success";
}

function platformConfidenceLabel(confidence = "") {
  const value = s(confidence).toLowerCase();

  if (value === "high") return "High confidence";
  if (value === "medium") return "Medium confidence";
  if (value === "low") return "Low confidence";

  return "Needs confirmation";
}

function platformInstallMeaning(platformId = "") {
  const id = s(platformId).toLowerCase();

  if (id === "wordpress") {
    return "AIHQ can guide this through the WordPress package path instead of asking the business user to edit theme code.";
  }

  if (id === "shopify") {
    return "AIHQ should guide this through a Shopify/app-embed style path when that installer is enabled.";
  }

  if (["wix", "webflow", "squarespace", "framer", "tilda"].includes(id)) {
    return "AIHQ should guide this through the website builder admin panel rather than manual source-code editing.";
  }

  if (id === "custom_or_unknown") {
    return "AIHQ should prefer developer handoff, managed support, GTM, or Cloudflare before manual code install.";
  }

  return "AIHQ will use this signal to recommend the safest available install path.";
}

function WebsiteChatPreviewCard({
  widget = {},
  installPlan = {},
  onSettings,
  onInstall,
}) {
  const safeWidget = obj(widget);
  const plan = obj(installPlan);
  const method = obj(plan.recommendedMethod);
  const readiness = obj(plan.currentReadiness);
  const prompts = arr(safeWidget.initialPrompts).slice(0, 4);
  const title = s(safeWidget.title, "Website chat");
  const subtitle = s(
    safeWidget.subtitle,
    "Ask a question or leave a message for the team."
  );
  const accentColor = s(safeWidget.accentColor, "#0f172a");
  const widgetEnabled = safeWidget.enabled === true;
  const hasWidgetId = Boolean(s(safeWidget.publicWidgetId));
  const readinessStatus = s(readiness.status || plan.status, "not_configured");
  const canPreview = widgetEnabled && hasWidgetId;

  return (
    <SectionCard
      eyebrow="Preview before install"
      title="See how Website Chat will feel"
      description="Preview the customer-facing chat before asking anyone to install it on the website."
      tone={canPreview ? "neutral" : "warning"}
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Preview status
            </div>
            <div className="mt-1 text-[14px] font-semibold text-text">
              {canPreview ? "Preview ready" : "Save settings first"}
            </div>
            <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
              {canPreview
                ? "This is a safe in-app preview. Public launch still requires domain verification and runtime readiness."
                : "Save website chat settings once so AIHQ can issue the public widget ID and preview the final shell."}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge tone={widgetEnabled ? "success" : "warning"} size="sm">
              {widgetEnabled ? "Widget enabled" : "Widget off"}
            </Badge>
            <Badge tone={hasWidgetId ? "success" : "warning"} size="sm">
              {hasWidgetId ? "Widget ID ready" : "Save settings"}
            </Badge>
            <Badge tone="neutral" size="sm">
              {s(method.label, "Install path selected")}
            </Badge>
            <Badge tone="neutral" size="sm">
              {readinessStatus}
            </Badge>
          </div>

          <InlineNotice
            tone="info"
            compact
            description="Preview is safe and private. Public launch still requires domain verification, approved truth, runtime readiness, and manual-first approval."
          />

          <div className="grid gap-2 sm:grid-cols-3">
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={onSettings}
              leftIcon={<Settings2 className="h-4 w-4" strokeWidth={2.1} />}
            >
              Edit appearance
            </Button>

            <Button
              type="button"
              fullWidth
              onClick={onInstall}
              leftIcon={<Package className="h-4 w-4" strokeWidth={2.1} />}
            >
              Continue install
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-line-soft bg-white shadow-[0_18px_54px_-42px_rgba(15,23,42,0.45)]">
          <div className="border-b border-slate-200/80 px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[16px] font-semibold tracking-[var(--tracking-tight-md)] text-slate-950">
                  {title}
                </div>
                <div className="mt-1 line-clamp-2 text-[12.5px] font-medium leading-5 text-slate-500">
                  {subtitle}
                </div>
              </div>
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                Manual first
              </span>
            </div>

            <div
              className="mt-3 h-1.5 rounded-full"
              style={{
                backgroundColor: accentColor,
                opacity: 0.88,
              }}
            />
          </div>

          <div className="min-h-[260px] bg-slate-50 px-4 py-4">
            <div className="mr-auto max-w-[86%] rounded-[20px] bg-white px-4 py-3 text-[13px] leading-6 text-slate-800 shadow-sm ring-1 ring-slate-200">
              Salam! Sizə necə kömək edə bilərik?
            </div>

            <div className="ml-auto mt-3 max-w-[82%] rounded-[20px] bg-slate-950 px-4 py-3 text-[13px] leading-6 text-white shadow-sm">
              Qiymətlər və xidmətlər barədə məlumat almaq istəyirəm.
            </div>

            <div className="mr-auto mt-3 max-w-[86%] rounded-[20px] bg-sky-50 px-4 py-3 text-[13px] leading-6 text-slate-800 shadow-sm ring-1 ring-sky-100">
              Təşəkkürlər. Operator mesajınızı görə bilər və manual cavab verə bilər.
            </div>

            {prompts.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {prompts.map((prompt) => (
                  <span
                    key={prompt}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[11.5px] font-semibold text-slate-600"
                  >
                    {prompt}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t border-slate-200/80 bg-white px-4 py-3">
            <div className="flex items-center justify-between rounded-[18px] border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-400">
              <span>Write your message</span>
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[11px] font-semibold text-white">
                Send
              </span>
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
function PlatformDetectionCard({ installPlan = {} }) {
  const plan = obj(installPlan);
  const detected = obj(plan.detected);
  const website = obj(detected.website);
  const primaryPlatform = obj(detected.primaryPlatform);
  const technologies = arr(detected.technologies).slice(0, 6);
  const platformId = s(primaryPlatform.id, "custom_or_unknown");
  const platformLabel = s(primaryPlatform.label, "Custom or unknown website");
  const confidence = platformConfidenceLabel(primaryPlatform.confidence);
  const tone = platformTone(platformId);
  const websiteLabel = s(website.href || website.input || website.origin || website.hostname);

  if (!Object.keys(detected).length && !websiteLabel) {
    return null;
  }

  return (
    <SectionCard
      eyebrow="Website detection"
      title={platformLabel}
      description={platformInstallMeaning(platformId)}
      tone={tone}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Website
            </div>
            <div className="mt-1 truncate text-[14px] font-semibold text-text" title={websiteLabel}>
              {websiteLabel || "Not set"}
            </div>
          </div>

          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Confidence
            </div>
            <div className="mt-1 text-[14px] font-semibold text-text">
              {confidence}
            </div>
          </div>

          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Install strategy
            </div>
            <div className="mt-1 text-[14px] font-semibold text-text">
              No-code first
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {technologies.length ? (
            technologies.map((item) => (
              <Badge key={s(item.id || item.label)} tone="neutral" size="sm">
                {s(item.label, item.id)}
              </Badge>
            ))
          ) : (
            <Badge tone="warning" size="sm">
              Platform not confirmed
            </Badge>
          )}

          {detected.hasGoogleTagManager === true ? (
            <Badge tone="brand" size="sm">
              GTM signal
            </Badge>
          ) : null}

          {detected.hasCloudflare === true ? (
            <Badge tone="brand" size="sm">
              Cloudflare signal
            </Badge>
          ) : null}
        </div>

        <InlineNotice
          tone={platformId === "custom_or_unknown" ? "info" : "success"}
          compact
          description={
            platformId === "custom_or_unknown"
              ? "If access is unclear, use guided install help or developer handoff."
              : "Detected signals only guide setup. Domain verification still controls public launch."
          }
        />
      </div>
    </SectionCard>
  );
}
function AccessHelperCard({ value = {}, onChange }) {
  const selected = obj(value);

  function toggle(id) {
    const next = {
      ...selected,
      [id]: !selected[id],
    };

    if (id === "unknown" && !selected[id]) {
      for (const option of WEBSITE_ACCESS_OPTIONS) {
        next[option.id] = option.id === "unknown";
      }
    } else if (id !== "unknown" && next[id]) {
      next.unknown = false;
    }

    onChange?.(next);
  }

  return (
    <SectionCard
      eyebrow="Install access"
      title="How can this website be updated?"
      description="Choose what access you have. AIHQ will recommend the easiest safe install path. You do not need to edit code yourself."
    >
      <div className="grid gap-2">
        {WEBSITE_ACCESS_OPTIONS.map((option) => {
          const active = selected[option.id] === true;

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggle(option.id)}
              className={cx(
                "grid grid-cols-[22px_minmax(0,1fr)] gap-3 rounded-[16px] border px-4 py-3 text-left transition-[background-color,border-color,box-shadow] duration-base ease-premium",
                active
                  ? "border-[rgba(var(--color-brand),0.34)] bg-brand-soft text-text shadow-[var(--shadow-inset-top)]"
                  : "border-line-soft bg-surface text-text hover:bg-surface-subtle"
              )}
            >
              <span
                className={cx(
                  "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-[7px] border",
                  active
                    ? "border-[rgba(var(--color-brand),0.45)] bg-brand text-white"
                    : "border-line bg-surface"
                )}
              >
                {active ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : null}
              </span>

              <span className="min-w-0">
                <span className="block text-[14px] font-semibold tracking-[var(--tracking-tight-sm)]">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] font-medium leading-5 text-text-muted">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}
function installMethodDisplay(method = {}) {
  const id = s(method.id).toLowerCase();

  if (id === "wordpress_plugin") {
    return {
      title: "Recommended: WordPress install",
      actionLabel: "Prepare WordPress package",
      description:
        "Best path for WordPress sites. No theme-code editing for the business user.",
      packageType: "wordpress",
    };
  }

  if (id === "google_tag_manager") {
    return {
      title: "Recommended: Google Tag Manager",
      actionLabel: "Prepare GTM package",
      description:
        "Best path when the business already uses GTM or can publish through a tag manager.",
      packageType: "gtm",
    };
  }

  if (id === "cloudflare_auto_injection") {
    return {
      title: "Recommended: Cloudflare install",
      actionLabel: "Prepare install package",
      description:
        "Best future no-code path for Cloudflare-managed domains. Use a safe handoff package until automatic install is enabled.",
      packageType: "developer",
    };
  }

  if (id === "developer_invite") {
    return {
      title: "Recommended: developer handoff",
      actionLabel: "Prepare developer package",
      description:
        "Best path when the site is managed by a freelancer, agency, or technical person.",
      packageType: "developer",
    };
  }

  if (id === "managed_support") {
    return {
      title: "Recommended: guided install help",
      actionLabel: "Prepare install package",
      description:
        "Best path when the business does not know who manages the website.",
      packageType: "developer",
    };
  }

  if (id === "manual_snippet") {
    return {
      title: "Fallback: manual install",
      actionLabel: "Prepare developer package",
      description:
        "Only use this when a technical person can safely edit the website.",
      packageType: "developer",
    };
  }

  return {
    title: method.label ? `Recommended: ${method.label}` : "Recommended install path",
    actionLabel: "Prepare install package",
    description:
      method.summary || "Choose the safest available website chat install path.",
    packageType: "developer",
  };
}

function methodEffortLabel(method = {}) {
  const effort = s(method.userEffort).toLowerCase();

  if (effort === "low") return "Low effort";
  if (effort === "medium") return "Guided setup";
  if (effort === "high") return "Technical setup";

  return "Guided setup";
}

function methodAccessLabels(method = {}) {
  const labels = [];

  if (method.noCode === true) labels.push("No-code path");
  if (method.requiresCmsAdmin === true) labels.push("Website admin");
  if (method.requiresTagManagerAccess === true) labels.push("GTM access");
  if (method.requiresCloudflareAccess === true) labels.push("Cloudflare access");
  if (method.requiresDeveloper === true) labels.push("Developer handoff");
  if (method.requiresCodeAccess === true) labels.push("Code access");

  return labels.length ? labels : ["Safe install"];
}

function InstallPlanRecommendationCard({
  installPlan = {},
  disabled = false,
  busy = false,
  testMessageResult = null,
  testMessageBusy = false,
  testMessageError = "",
  onSendTestMessage,
  onOpenInbox,
  onPrepareDeveloper,
  onPrepareGtm,
  onPrepareWordpress,
  onVerify,
  onSettings,
}) {
  const plan = obj(installPlan);
  const method = obj(plan.recommendedMethod);
  const methodView = installMethodDisplay(method);
  const fallbackMethods = arr(plan.fallbackMethods).slice(0, 3);
  const securityRequirements = arr(plan.securityRequirements).slice(0, 5);
  const currentReadiness = obj(plan.currentReadiness);
  const status = s(currentReadiness.status || plan.status, "pending");
  const readinessMessage = firstText(
    currentReadiness.message,
    plan.nextAction?.message,
    method.summary,
    methodView.description
  );
  const needsVerification =
    s(currentReadiness.reasonCode).toLowerCase().includes("verification") ||
    s(status).toLowerCase().includes("blocked");

  function handlePrimaryAction() {
    if (methodView.packageType === "wordpress") {
      onPrepareWordpress?.();
      return;
    }

    if (methodView.packageType === "gtm") {
      onPrepareGtm?.();
      return;
    }

    onPrepareDeveloper?.();
  }

  if (!Object.keys(plan).length && !Object.keys(method).length) {
    return null;
  }

  return (
    <SectionCard
      eyebrow="Recommended install"
      title={methodView.title}
      description={readinessMessage}
      tone={needsVerification ? "warning" : "neutral"}
    >
      <div className="space-y-4">

        <div className="rounded-[18px] border border-line-soft bg-surface-subtle px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
                Inbox test
              </div>
              <div className="mt-1 text-[14px] font-semibold text-text">
                Prove Website Chat in Inbox
              </div>
              <div className="mt-1 text-[12.5px] font-medium leading-5 text-text-muted">
                Create a setup-test visitor message before installing the widget on a real website.
              </div>
            </div>

            <Badge tone={testMessageResult ? "success" : "neutral"} size="sm">
              {testMessageResult ? "Created" : "Setup test"}
            </Badge>
          </div>

          {testMessageError ? (
            <div className="mt-3">
              <InlineNotice tone="danger" compact description={testMessageError} />
            </div>
          ) : null}

          {testMessageResult ? (
            <div className="mt-3">
              <InlineNotice
                tone="success"
                compact
                description="Test message was created in Inbox. Open it and confirm manual reply flow."
              />
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              fullWidth
              disabled={disabled || testMessageBusy}
              onClick={onSendTestMessage}
              leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
            >
              {testMessageBusy ? "Sending..." : testMessageResult ? "Send again" : "Send test"}
            </Button>

            <Button
              type="button"
              variant="secondary"
              fullWidth
              disabled={!testMessageResult?.inbox?.threadId}
              onClick={() => onOpenInbox?.(testMessageResult?.inbox?.threadId)}
              leftIcon={<Globe2 className="h-4 w-4" strokeWidth={2.1} />}
            >
              Open Inbox
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Effort
            </div>
            <div className="mt-1 text-[14px] font-semibold text-text">
              {methodEffortLabel(method)}
            </div>
          </div>

          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Code required
            </div>
            <div className="mt-1 text-[14px] font-semibold text-text">
              {method.requiresCodeAccess === true ? "Only for developer" : "No"}
            </div>
          </div>

          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Security
            </div>
            <div className="mt-1 text-[14px] font-semibold text-text">
              {s(method.securityLevel, "high") === "high" ? "Guarded" : "Review"}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {methodAccessLabels(method).map((label) => (
            <Badge key={label} tone="neutral" size="sm">
              {label}
            </Badge>
          ))}
        </div>

        {fallbackMethods.length ? (
          <div className="rounded-[16px] border border-line-soft bg-surface-subtle px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Other safe options
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {fallbackMethods.map((item) => (
                <Badge key={s(item.id || item.label)} tone="neutral" size="sm">
                  {s(item.label, item.id)}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {securityRequirements.length ? (
          <div className="rounded-[16px] border border-line-soft bg-surface px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
              Security stays on
            </div>
            <div className="mt-2 grid gap-2">
              {securityRequirements.map((item) => (
                <div
                  key={s(item.id || item.label)}
                  className="flex items-start gap-2 text-[12.5px] font-medium leading-5 text-text-muted"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.2} />
                  <span>{s(item.label)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            fullWidth
            loading={busy}
            disabled={disabled || busy}
            onClick={handlePrimaryAction}
            leftIcon={<Package className="h-4 w-4" strokeWidth={2.1} />}
          >
            {methodView.actionLabel}
          </Button>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={needsVerification ? onVerify : onSettings}
            leftIcon={
              needsVerification ? (
                <ShieldAlert className="h-4 w-4" strokeWidth={2.1} />
              ) : (
                <Settings2 className="h-4 w-4" strokeWidth={2.1} />
              )
            }
          >
            {needsVerification ? "Verify domain" : "Edit settings"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
function StatusBadge({ tone = "neutral", children }) {
  const safeTone = normalizedTone(tone);

  return (
    <Badge tone={safeTone} size="sm">
      <span className={cx("h-1.5 w-1.5 rounded-full", dotClass(safeTone))} />
      {children}
    </Badge>
  );
}

function Feedback({ success, error, info }) {
  if (error) return <InlineNotice tone="danger" description={error} compact />;
  if (success) return <InlineNotice tone="success" description={success} compact />;
  if (info) return <InlineNotice tone="info" description={info} compact />;

  return null;
}

function FieldLabel({ children }) {
  return (
    <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
      {children}
    </label>
  );
}

function LedgerLine({ label, value, tone = "neutral" }) {
  return (
    <div className="grid grid-cols-[128px_minmax(0,1fr)] items-center gap-4 border-b border-line-soft py-3 last:border-b-0">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
        {label}
      </div>

      <div
        title={s(value)}
        className={cx(
          "min-w-0 truncate text-[13.5px] font-semibold tracking-[var(--tracking-tight-sm)]",
          toneTextClass(tone)
        )}
      >
        {value || "Not set"}
      </div>
    </div>
  );
}

function UtilityButton({
  icon,
  title,
  description,
  disabled = false,
  onClick,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        "group grid w-full grid-cols-[36px_minmax(0,1fr)] items-center gap-3 border-b border-line-soft py-4 text-left last:border-b-0",
        "transition-[background-color,opacity] duration-base ease-premium hover:bg-surface-subtle/70",
        disabled && "cursor-not-allowed opacity-45 hover:bg-transparent"
      )}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] border border-line-soft bg-surface text-text-muted shadow-[var(--shadow-inset-top)] transition-colors duration-base ease-premium group-hover:text-text">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
          {title}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] font-medium text-text-muted">
          {description}
        </span>
      </span>
    </button>
  );
}

function SectionCard({
  eyebrow,
  title,
  description,
  children,
  tone = "neutral",
}) {
  return (
    <Card padded="md" tone={tone}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow ? (
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-subtle">
              {eyebrow}
            </div>
          ) : null}

          {title ? (
            <div className="mt-1 text-[18px] font-semibold leading-6 tracking-[var(--tracking-tight-lg)] text-text">
              {title}
            </div>
          ) : null}

          {description ? (
            <div className="mt-2 text-[13.5px] font-medium leading-6 text-text-muted">
              {description}
            </div>
          ) : null}
        </div>
      </div>

      {children ? (
        <div className={title || description || eyebrow ? "mt-4" : ""}>
          {children}
        </div>
      ) : null}
    </Card>
  );
}

function PanelTab({ active = false, icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex h-9 items-center gap-2 rounded-[11px] px-3 text-[12.5px] font-semibold",
        "transition-[background-color,color,box-shadow] duration-base ease-premium",
        active
          ? "bg-surface text-text shadow-[var(--shadow-inset-top),0_12px_28px_-26px_rgba(15,23,42,0.22)]"
          : "text-text-muted hover:bg-surface-subtle hover:text-text"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function CodeBox({ value = "", empty = "Nothing to show yet." }) {
  const safe = s(value);

  return (
    <pre className="max-h-[280px] overflow-auto rounded-[16px] border border-line-soft bg-[#0F172A] px-4 py-4 text-[12px] font-medium leading-6 text-white/88 [scrollbar-width:thin]">
      {safe || empty}
    </pre>
  );
}

function AccentOption({ option, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(option.value)}
      className={cx(
        "flex h-10 items-center justify-between gap-3 rounded-[12px] border px-3 text-[12.5px] font-semibold transition-[background-color,border-color] duration-base ease-premium",
        selected
          ? "border-[rgba(var(--color-brand),0.24)] bg-brand-soft text-brand"
          : "border-line-soft bg-surface text-text-muted hover:bg-surface-subtle hover:text-text"
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className="h-3.5 w-3.5 rounded-full border border-white shadow-[0_0_0_1px_rgba(15,23,42,0.08)]"
          style={{ backgroundColor: option.preview }}
        />
        {option.label}
      </span>

      {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2.4} /> : null}
    </button>
  );
}

export default function WebsiteWidgetDetailDrawer({
  channel,
  open = false,
  onClose,
}) {
  const queryClient = useQueryClient();
  const workspace = useWorkspaceTenantKey({ enabled: open });

  const [activePanel, setActivePanel] = useState("overview");
  const [draftForm, setDraftForm] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [verificationInput, setVerificationInput] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationOverride, setVerificationOverride] = useState(null);
  const [handoffMessage, setHandoffMessage] = useState("");
  const [handoffPackage, setHandoffPackage] = useState(null);
  const [testMessageResult, setTestMessageResult] = useState(null);
  const [testMessageBusy, setTestMessageBusy] = useState(false);
  const [testMessageError, setTestMessageError] = useState("");
  const [websiteAccessHints, setWebsiteAccessHints] = useState({});

  const websiteStatusQueryKey = buildWorkspaceScopedQueryKey(
    ["website-widget-status"],
    workspace.tenantKey
  );

  const statusQuery = useQuery({
    queryKey: websiteStatusQueryKey,
    queryFn: getWebsiteWidgetStatus,
    enabled: open && workspace.ready,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!open) return undefined;

    let alive = true;

    scheduleAsyncState(() => {
      if (!alive) return;

      setActivePanel("overview");
      setStatusMessage("");
      setCopyFeedback("");
      setVerificationMessage("");
      setHandoffMessage("");
    });

    return () => {
      alive = false;
    };
  }, [open, channel?.id]);

  const handoffMutation = useMutation({
    mutationFn: createWebsiteWidgetInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("Developer package prepared.");
      setCopyFeedback("");
      setActivePanel("install");
    },
  });

  const gtmHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetGtmInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("GTM package prepared.");
      setCopyFeedback("");
      setActivePanel("install");
    },
  });

  const wordpressHandoffMutation = useMutation({
    mutationFn: createWebsiteWidgetWordpressInstallHandoff,
    onSuccess(nextPayload) {
      setHandoffPackage(obj(nextPayload));
      setHandoffMessage("WordPress package prepared.");
      setCopyFeedback("");
      setActivePanel("install");
    },
  });

  const saveMutation = useMutation({
    mutationFn: saveWebsiteWidgetConfig,
    async onSuccess(payload) {
      setDraftForm(buildFormState(payload));
      setWebsiteAccessHints(obj(obj(payload).widget).installAccessHints);
      setStatusMessage("Widget settings saved.");
      setCopyFeedback("");
      setVerificationInput("");
      setVerificationMessage("");
      setVerificationOverride(null);
      setHandoffMessage("");
      setHandoffPackage(null);
      setTestMessageResult(null);
      setActivePanel("overview");

      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });

      emitLaunchSliceRefresh({
        tenantKey: workspace.tenantKey,
        reason: "website-widget-saved",
      });
    },
  });

  const refreshVerificationMutation = useMutation({
    mutationFn: getWebsiteDomainVerificationStatus,
    async onSuccess(nextPayload) {
      setVerificationOverride(obj(nextPayload));
      setVerificationInput(
        s(nextPayload.domain || nextPayload.candidateDomain || verificationInput)
      );
      setVerificationMessage("Verification status refreshed.");
      setHandoffMessage("");
      setHandoffPackage(null);
      setTestMessageResult(null);
      setActivePanel("verify");

      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });
    },
  });

  const createChallengeMutation = useMutation({
    mutationFn: createWebsiteDomainVerificationChallenge,
    async onSuccess(nextPayload) {
      setVerificationOverride(obj(nextPayload));
      setVerificationInput(
        s(nextPayload.domain || nextPayload.candidateDomain || verificationInput)
      );
      setVerificationMessage("TXT challenge created.");
      setHandoffMessage("");
      setHandoffPackage(null);
      setTestMessageResult(null);
      setActivePanel("verify");

      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });
    },
  });

  const checkVerificationMutation = useMutation({
    mutationFn: checkWebsiteDomainVerification,
    async onSuccess(nextPayload) {
      setVerificationOverride(obj(nextPayload));
      setVerificationInput(
        s(nextPayload.domain || nextPayload.candidateDomain || verificationInput)
      );
      setVerificationMessage(
        s(nextPayload.state).toLowerCase() === "verified"
          ? "Domain verified."
          : "Verification checked."
      );
      setHandoffMessage("");
      setHandoffPackage(null);
      setTestMessageResult(null);
      setActivePanel("verify");

      handoffMutation.reset();
      gtmHandoffMutation.reset();
      wordpressHandoffMutation.reset();

      await queryClient.invalidateQueries({
        queryKey: websiteStatusQueryKey,
      });
    },
  });

  const payload = statusQuery.data || {};
  const widget = obj(payload.widget);
  const install = obj(payload.install);
  const serverWebsiteAccessHints = obj(widget.installAccessHints);
  const selectedWebsiteAccessHints = Object.keys(obj(websiteAccessHints)).length
    ? obj(websiteAccessHints)
    : serverWebsiteAccessHints;
  const installPlan = obj(payload.installPlan);
  const effectiveInstallPlan = mergeInstallPlanWithAccessHints(installPlan, selectedWebsiteAccessHints);
  const readiness = obj(payload.readiness);
  const launchReadiness = obj(payload.launchReadiness);
  const launchHandoffs = obj(launchReadiness.handoffs);
  const launchDeveloperHandoff = obj(launchHandoffs.developer);
  const launchGtmHandoff = obj(launchHandoffs.gtm);
  const launchWordpressHandoff = obj(launchHandoffs.wordpress);
  const serverVerification = obj(payload.domainVerification);
  const verificationSurface = Object.keys(obj(verificationOverride)).length
    ? obj(verificationOverride)
    : serverVerification;
  const handoffSurface = obj(handoffPackage);
  const handoffSurfaceLaunchReadiness = obj(handoffSurface.launchReadiness);
  const verificationChallenge = obj(verificationSurface.challenge);
  const verificationCandidateDomains = arr(verificationSurface.candidateDomains);
  const verificationReadiness = obj(verificationSurface.readiness);
  const handoffReadiness = obj(handoffSurface.readiness);
  const permissions = obj(payload.permissions);
  const blockers =
    arr(launchReadiness.blockers).length > 0
      ? arr(launchReadiness.blockers)
      : arr(readiness.blockers);

  const saveAllowed = permissions.saveAllowed !== false;
  const form = draftForm || buildFormState(payload);

  const suggestedVerificationDomain = s(
    verificationSurface.domain || verificationSurface.candidateDomain
  );

  const verificationInputValue =
    verificationInput === "" ? suggestedVerificationDomain : verificationInput;

  const verificationTargetDomain = s(
    verificationInputValue ||
      verificationSurface.domain ||
      verificationSurface.candidateDomain
  );

  const productionInstallReady =
    launchReadiness.productionLaunchAllowed === true ||
    install.productionInstallReady === true;

  const productionInstallBlocked =
    launchReadiness.productionBlocked === true ||
    install.productionBlocked === true ||
    (verificationReadiness.enforcementActive === true &&
      verificationReadiness.productionInstallReady !== true);

  const installBlockMessage = firstText(
    launchDeveloperHandoff.blockingMessage,
    install.blockMessage,
    productionInstallBlocked ? launchReadiness.message : "",
    productionInstallBlocked ? verificationSurface.message : ""
  );

  const developerHandoffReady =
    saveAllowed &&
    (launchDeveloperHandoff.ready === true ||
      install.developerHandoffReady === true);

  const gtmHandoffReady =
    saveAllowed &&
    (launchGtmHandoff.ready === true || install.gtmHandoffReady === true);

  const wordpressHandoffReady =
    saveAllowed &&
    (launchWordpressHandoff.ready === true ||
      install.wordpressHandoffReady === true);

  const installHandoffMessage = firstText(
    launchDeveloperHandoff.message,
    install.handoffMessage,
    productionInstallBlocked ? launchReadiness.message : "",
    productionInstallBlocked ? verificationSurface.message : "",
    "Install package is unavailable right now."
  );

  const handoffTestingOnly =
    handoffSurface.testingOnly === true ||
    handoffReadiness.testingOnly === true ||
    handoffSurfaceLaunchReadiness.testingOnly === true;

  const handoffWarning = firstText(
    handoffReadiness.warning,
    handoffSurface.warning,
    handoffReadiness.blockingMessage,
    handoffSurface.blockingMessage,
    handoffTestingOnly
      ? "Testing only. Public launch still needs verified DNS TXT."
      : ""
  );

  const verificationError = s(
    createChallengeMutation.error?.message ||
      checkVerificationMutation.error?.message ||
      refreshVerificationMutation.error?.message
  );

  const handoffError = s(
    handoffMutation.error?.message ||
      gtmHandoffMutation.error?.message ||
      wordpressHandoffMutation.error?.message
  );

  const actionError = s(saveMutation.error?.message || statusQuery.error?.message);

  const verificationBusy =
    createChallengeMutation.isPending ||
    checkVerificationMutation.isPending ||
    refreshVerificationMutation.isPending;

  const handoffBusy =
    handoffMutation.isPending ||
    gtmHandoffMutation.isPending ||
    wordpressHandoffMutation.isPending;

  const posture = buildPosture({
    widget,
    install,
    launchReadiness,
    handoffs: launchHandoffs,
    verificationSurface,
    readiness,
  });

  const PostureIcon = posture.icon;
  const verified = s(verificationSurface.state).toLowerCase() === "verified";

  const installState = productionInstallReady
    ? "Ready"
    : launchReadiness.testingOnly === true
      ? "Testing"
      : productionInstallBlocked
        ? "Blocked"
        : "Pending";

  const installTone = productionInstallReady
    ? "success"
    : productionInstallBlocked || launchReadiness.testingOnly === true
      ? "warning"
      : "neutral";

  const snippetAvailable = Boolean(s(install.embedSnippet));
  const packageAvailable = Boolean(s(handoffSurface.packageText));
  const activeTone = normalizedTone(posture.tone);

  function updateForm(updater) {
    setDraftForm((current) => {
      const nextCurrent = current || buildFormState(statusQuery.data || {});
      return typeof updater === "function" ? updater(nextCurrent) : updater;
    });
  }

  function resetVerificationFeedback() {
    setVerificationMessage("");
    createChallengeMutation.reset();
    checkVerificationMutation.reset();
    refreshVerificationMutation.reset();
  }

  function resetHandoffFeedback() {
    setHandoffMessage("");
    setHandoffPackage(null);
    handoffMutation.reset();
    gtmHandoffMutation.reset();
    wordpressHandoffMutation.reset();
  }

  async function copyTextValue(value, successMessage) {
    const text = s(value);
    if (!text) return;

    try {
      if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyFeedback(successMessage);
        setStatusMessage("");
        return;
      }
    } catch {
      // Clipboard can fail in restricted browser contexts.
    }

    setCopyFeedback("Copy is unavailable in this browser context.");
    setStatusMessage("");
  }

  function handleCopySnippet() {
    return copyTextValue(s(install.embedSnippet), "Snippet copied.");
  }

  function handleCopyHandoffPackage() {
    return copyTextValue(
      handoffSurface.packageText,
      s(handoffSurface.packageType) === "gtm"
        ? "GTM package copied."
        : s(handoffSurface.packageType) === "wordpress"
          ? "WordPress package copied."
          : "Developer package copied."
    );
  }

  function handleSave() {
    if (!saveAllowed) return;

    setStatusMessage("");
    setCopyFeedback("");

    saveMutation.mutate({
      enabled: form.enabled,
      title: form.title,
      subtitle: form.subtitle,
      accentColor: form.accentColor,
      allowedOrigins: parseList(form.allowedOrigins),
      allowedDomains: parseList(form.allowedDomains),
      initialPrompts: parseList(form.initialPrompts),
      installAccessHints: selectedWebsiteAccessHints,
    });
  }

  function handleCreateChallenge() {
    resetVerificationFeedback();
    createChallengeMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handleVerifyNow() {
    resetVerificationFeedback();
    checkVerificationMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handleRefreshVerification() {
    resetVerificationFeedback();
    refreshVerificationMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handlePrepareDeveloperInstall() {
    resetHandoffFeedback();
    setCopyFeedback("");
    handoffMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handlePrepareGtmInstall() {
    resetHandoffFeedback();
    setCopyFeedback("");
    gtmHandoffMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handlePrepareWordpressInstall() {
    resetHandoffFeedback();
    setCopyFeedback("");
    wordpressHandoffMutation.mutate(
      verificationTargetDomain ? { domain: verificationTargetDomain } : {}
    );
  }

  function handleRefresh() {
    setDraftForm(null);
    setStatusMessage("");
    setCopyFeedback("");
    setVerificationInput("");
    setVerificationMessage("");
    setVerificationOverride(null);
    resetVerificationFeedback();
    resetHandoffFeedback();
    statusQuery.refetch();
  }

  function handleClose() {
    setDraftForm(null);
    setStatusMessage("");
    setCopyFeedback("");
    setVerificationInput("");
    setVerificationMessage("");
    setVerificationOverride(null);
    resetVerificationFeedback();
    resetHandoffFeedback();
    onClose?.();
  }

  async function handleSendWebsiteTestMessage() {
    setTestMessageBusy(true);
    setTestMessageError("");
    setHandoffMessage("");

    try {
      const payload = await createWebsiteWidgetTestMessage({
        text: "Salam, bu Website Chat test mesajıdır. Zəhmət olmasa operator/manual reply flow-u yoxlayın.",
      });

      setTestMessageResult(payload);
      setHandoffMessage("Website Chat test message was created in Inbox.");
    } catch (error) {
      const message = s(
        error?.details?.message || error?.message,
        "Could not create Website Chat test message."
      );

      setTestMessageError(message);
    } finally {
      setTestMessageBusy(false);
    }
  }

  function handleOpenWebsiteInbox(threadId = "") {
    const params = new URLSearchParams();

    params.set("channel", "website");
    if (s(threadId)) {
      params.set("threadId", s(threadId));
    }

    window.location.assign(`/inbox?${params.toString()}`);
  }
  function renderFooterActions() {
    if (activePanel === "settings") {
      return (
        <>
          <Button
            type="button"
            fullWidth
            loading={saveMutation.isPending}
            disabled={!saveAllowed || saveMutation.isPending}
            onClick={handleSave}
            leftIcon={<Save className="h-4 w-4" strokeWidth={2.1} />}
          >
            {saveMutation.isPending ? "Saving" : "Save changes"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => setActivePanel("overview")}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={statusQuery.isFetching}
            onClick={handleRefresh}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        </>
      );
    }

    if (activePanel === "verify") {
      return (
        <>
          <Button
            type="button"
            fullWidth
            loading={checkVerificationMutation.isPending}
            disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
            onClick={handleVerifyNow}
          >
            Verify
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={createChallengeMutation.isPending}
            disabled={!saveAllowed || statusQuery.isLoading || verificationBusy}
            onClick={handleCreateChallenge}
          >
            Create TXT
          </Button>

          <Button
            type="button"
            variant="secondary"
            loading={refreshVerificationMutation.isPending}
            disabled={statusQuery.isLoading || verificationBusy}
            onClick={handleRefreshVerification}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        </>
      );
    }

    if (activePanel === "install") {
      return (
        <>
          {packageAvailable ? (
            <Button
              type="button"
              fullWidth
              onClick={handleCopyHandoffPackage}
              leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
            >
              Copy package
            </Button>
          ) : (
            <Button
              type="button"
              fullWidth
              disabled={!snippetAvailable}
              onClick={handleCopySnippet}
              leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
            >
              Copy snippet
            </Button>
          )}

          <Button
            type="button"
            variant="secondary"
            loading={handoffMutation.isPending}
            disabled={!developerHandoffReady || statusQuery.isLoading || handoffBusy}
            onClick={handlePrepareDeveloperInstall}
            leftIcon={<Package className="h-4 w-4" strokeWidth={2.1} />}
          >
            Package
          </Button>

          <Button
            type="button"
            variant="secondary"
            disabled={statusQuery.isFetching}
            onClick={handleRefresh}
            leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
          >
            Refresh
          </Button>
        </>
      );
    }

    return (
      <>
        <Button
          type="button"
          fullWidth
          disabled={!snippetAvailable}
          onClick={handleCopySnippet}
          leftIcon={<Copy className="h-4 w-4" strokeWidth={2.1} />}
        >
          Copy snippet
        </Button>

        <Button
          type="button"
          variant="secondary"
          onClick={() => setActivePanel("settings")}
          leftIcon={<Settings2 className="h-4 w-4" strokeWidth={2.1} />}
        >
          Settings
        </Button>

        <Button
          type="button"
          variant="secondary"
          disabled={statusQuery.isFetching}
          onClick={handleRefresh}
          leftIcon={<RefreshCw className="h-4 w-4" strokeWidth={2.1} />}
        >
          Refresh
        </Button>
      </>
    );
  }

  function renderOverviewPanel() {
    return (
      <>
        <SectionCard
          eyebrow="Summary"
          title={posture.title}
          description={posture.summary}
          tone={activeTone}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <LedgerLine
              label="Widget"
              value={widget.enabled === true ? "Enabled" : "Off"}
              tone={widget.enabled === true ? "success" : "warning"}
            />
            <LedgerLine
              label="Install"
              value={installState}
              tone={installTone}
            />
            <LedgerLine
              label="Domain"
              value={verificationStateLabel(verificationSurface.state)}
              tone={verified ? "success" : "warning"}
            />
            <LedgerLine
              label="Widget ID"
              value={compactValue(widget.publicWidgetId)}
              tone={s(widget.publicWidgetId) ? "success" : "warning"}
            />
          </div>
        </SectionCard>

        {blockers.length ? (
          <SectionCard eyebrow="Blockers" title="Needs attention" tone="warning">
            <div className="space-y-3">
              {blockers.map((blocker, index) => (
                <InlineNotice
                  key={`${s(blocker?.reasonCode) || "blocker"}-${index}`}
                  tone="warning"
                  title={s(blocker?.title, "Setup blocker")}
                  description={s(
                    blocker?.subtitle ||
                      blocker?.message ||
                      blocker?.description,
                    "Review this before treating website chat as launch-ready."
                  )}
                  compact
                />
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          eyebrow="Install"
          title="Website snippet"
          description={
            snippetAvailable
              ? "Copy this script into the customer website when you are ready."
              : "Verify domain before copying the production snippet."
          }
        >
          <CodeBox value={install.embedSnippet} empty="Production snippet is locked until domain verification is complete." />
        </SectionCard>
      </>
    );
  }

  function renderSettingsPanel() {
    return (
      <>
        <SectionCard
          eyebrow="Settings"
          title="Widget behavior"
          description="Control how the website chat widget appears and which domains can load it."
        >
          <div className="space-y-4">
            <label className="flex items-center justify-between gap-4 rounded-[16px] border border-line-soft bg-surface px-4 py-3">
              <span>
                <span className="block text-[14px] font-semibold tracking-[var(--tracking-tight-sm)] text-text">
                  Enable widget
                </span>
                <span className="mt-1 block text-[12.5px] font-medium leading-5 text-text-muted">
                  When off, the public widget should not be treated as active.
                </span>
              </span>

              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    enabled: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-[rgb(var(--color-brand))]"
              />
            </label>

            <div>
              <FieldLabel>Title</FieldLabel>
              <Input
                value={form.title}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="How can we help?"
                appearance="quiet"
              />
            </div>

            <div>
              <FieldLabel>Subtitle</FieldLabel>
              <Input
                value={form.subtitle}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    subtitle: event.target.value,
                  }))
                }
                placeholder="Ask anything about the business."
                appearance="quiet"
              />
            </div>

            <div>
              <FieldLabel>Accent color</FieldLabel>
              <div className="grid gap-2 sm:grid-cols-3">
                {ACCENT_OPTIONS.map((option) => (
                  <AccentOption
                    key={option.value}
                    option={option}
                    selected={s(form.accentColor) === option.value}
                    onSelect={(nextValue) =>
                      updateForm((current) => ({
                        ...current,
                        accentColor: nextValue,
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel>Allowed origins</FieldLabel>
              <Textarea
                value={form.allowedOrigins}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    allowedOrigins: event.target.value,
                  }))
                }
                placeholder="https://example.com"
                rows={3}
                appearance="quiet"
              />
            </div>

            <div>
              <FieldLabel>Allowed domains</FieldLabel>
              <Textarea
                value={form.allowedDomains}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    allowedDomains: event.target.value,
                  }))
                }
                placeholder="example.com"
                rows={3}
                appearance="quiet"
              />
            </div>

            <div>
              <FieldLabel>Initial prompts</FieldLabel>
              <Textarea
                value={form.initialPrompts}
                onChange={(event) =>
                  updateForm((current) => ({
                    ...current,
                    initialPrompts: event.target.value,
                  }))
                }
                placeholder="Pricing&#10;Book an appointment&#10;Talk to support"
                rows={4}
                appearance="quiet"
              />
            </div>
          </div>
        </SectionCard>
      </>
    );
  }

  function renderVerifyPanel() {
    return (
      <>
        <SectionCard
          eyebrow="Verification"
          title="Domain ownership"
          description="Create or check a DNS TXT challenge before allowing production install."
          tone={verified ? "success" : "warning"}
        >
          <div className="space-y-4">
            <div>
              <FieldLabel>Domain</FieldLabel>
              <Input
                value={verificationInputValue}
                onChange={(event) => setVerificationInput(event.target.value)}
                placeholder="example.com"
                appearance="quiet"
              />
            </div>

            {verificationCandidateDomains.length ? (
              <div>
                <FieldLabel>Detected domains</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {verificationCandidateDomains.map((domain) => (
                    <button
                      key={domain}
                      type="button"
                      onClick={() => setVerificationInput(domain)}
                      className="rounded-[10px] border border-line-soft bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-text-muted transition-colors duration-base ease-premium hover:bg-surface-subtle hover:text-text"
                    >
                      {domain}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <LedgerLine
                label="State"
                value={verificationStateLabel(verificationSurface.state)}
                tone={verified ? "success" : "warning"}
              />
              <LedgerLine
                label="Checked"
                value={formatTimestamp(verificationSurface.checkedAt)}
              />
            </div>

            <InlineNotice
              tone={verified ? "success" : "warning"}
              title={verified ? "Domain verified" : "Verification required"}
              description={firstText(
                verificationSurface.message,
                verificationReadiness.message,
                verified
                  ? "Production install can use this domain."
                  : "Create a TXT challenge and add it to your DNS records."
              )}
              compact
            />
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="DNS TXT"
          title="TXT challenge"
          description="Add this TXT record to the domain DNS zone, then verify."
        >
          <div className="space-y-3">
            <LedgerLine
              label="Name"
              value={s(
                verificationChallenge.name ||
                  verificationSurface.recordName ||
                  verificationSurface.txtName,
                "Not created"
              )}
            />
            <LedgerLine
              label="Value"
              value={s(
                verificationChallenge.value ||
                  verificationSurface.recordValue ||
                  verificationSurface.txtValue,
                "Not created"
              )}
            />
          </div>
        </SectionCard>
      </>
    );
  }

  function renderInstallPanel() {
    return (
      <>
        <SectionCard
          eyebrow="Install"
          title="Install package"
          description={
            packageAvailable
              ? "Copy the prepared package and send it to the developer."
              : installHandoffMessage
          }
          tone={installTone}
        >
          {installBlockMessage ? (
            <InlineNotice
              tone="warning"
              title="Install blocked"
              description={installBlockMessage}
              compact
              className="mb-4"
            />
          ) : null}

          {handoffWarning ? (
            <InlineNotice
              tone="warning"
              description={handoffWarning}
              compact
              className="mb-4"
            />
          ) : null}

          <CodeBox
            value={handoffSurface.packageText || install.embedSnippet}
            empty="Prepare a package or copy the snippet from overview."
          />
        </SectionCard>

        <SectionCard
          eyebrow="Utilities"
          title="Prepare package"
          description="Create an install handoff for different website setups."
        >
          <UtilityButton
            icon={<Package className="h-4 w-4" strokeWidth={2.1} />}
            title="Developer package"
            description="Plain HTML/JS install instructions"
            disabled={!developerHandoffReady || handoffBusy}
            onClick={handlePrepareDeveloperInstall}
          />

          <UtilityButton
            icon={<Code2 className="h-4 w-4" strokeWidth={2.1} />}
            title="Google Tag Manager"
            description="GTM-oriented install package"
            disabled={!gtmHandoffReady || handoffBusy}
            onClick={handlePrepareGtmInstall}
          />

          <UtilityButton
            icon={<Globe2 className="h-4 w-4" strokeWidth={2.1} />}
            title="WordPress"
            description="WordPress-oriented install package"
            disabled={!wordpressHandoffReady || handoffBusy}
            onClick={handlePrepareWordpressInstall}
          />
        </SectionCard>
      </>
    );
  }

  let mainContent = renderOverviewPanel();
  if (activePanel === "settings") mainContent = renderSettingsPanel();
  if (activePanel === "verify") mainContent = renderVerifyPanel();
  if (activePanel === "install") mainContent = renderInstallPanel();

  return (
    <aside
      aria-hidden={!open}
      className="flex h-full min-h-0 w-full flex-col overflow-visible border-l border-line-soft bg-surface shadow-panel"
    >
      <header className="relative z-40 shrink-0 overflow-visible border-b border-line-soft bg-surface py-5 pl-6 pr-24 shadow-[inset_0_-1px_0_rgba(15,23,42,0.025)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_64px] items-start gap-x-4 gap-y-2 overflow-visible">
          <div className="row-span-2 shrink-0 pt-0.5">
            <ChannelIcon channel={channel} size="lg" />
          </div>

          <div className="min-w-0 self-center">
            <div className="truncate text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {channel?.name || "Website chat"}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close website details"
            onClick={handleClose}
            className="absolute right-7 top-5 z-50 inline-flex h-11 w-11 items-center justify-center rounded-[16px] border border-line-soft bg-surface text-text shadow-[0_14px_34px_-24px_rgba(15,23,42,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] transition-[background-color,border-color,box-shadow,color] duration-base ease-premium hover:border-line hover:bg-surface-subtle hover:text-text"
          >
            <X className="h-4.5 w-4.5" strokeWidth={2.25} />
          </button>

          <div className="min-w-0 self-start">
            <StatusBadge tone={activeTone}>
              {posture.title || "Website chat"}
            </StatusBadge>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-line-soft bg-surface px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <PanelTab
            active={activePanel === "overview"}
            icon={<PostureIcon className="h-4 w-4" strokeWidth={2.1} />}
            label="Overview"
            onClick={() => setActivePanel("overview")}
          />
          <PanelTab
            active={activePanel === "settings"}
            icon={<Settings2 className="h-4 w-4" strokeWidth={2.1} />}
            label="Settings"
            onClick={() => setActivePanel("settings")}
          />
          <PanelTab
            active={activePanel === "verify"}
            icon={<ShieldAlert className="h-4 w-4" strokeWidth={2.1} />}
            label="Verify"
            onClick={() => setActivePanel("verify")}
          />
          <PanelTab
            active={activePanel === "install"}
            icon={<Code2 className="h-4 w-4" strokeWidth={2.1} />}
            label="Install"
            onClick={() => setActivePanel("install")}
          />
        </div>
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-surface-muted px-6 py-6">
        <div className="space-y-4">
          <Feedback
            success={statusMessage || verificationMessage || handoffMessage}
            error={actionError || verificationError || handoffError}
            info={copyFeedback}
          />

          {statusQuery.isLoading ? (
            <SectionCard
              eyebrow="Loading"
              title="Loading website widget"
              description="Checking current website chat status."
            />
          ) : null}          {activePanel === "overview" && !statusQuery.isLoading ? (
            <AccessHelperCard
              value={selectedWebsiteAccessHints}
              onChange={setWebsiteAccessHints}
            />
          ) : null}


          {activePanel === "overview" && !statusQuery.isLoading ? (
            <InstallPlanRecommendationCard
              installPlan={effectiveInstallPlan}
              testMessageResult={testMessageResult}
              testMessageBusy={testMessageBusy}
              testMessageError={testMessageError}
              onSendTestMessage={handleSendWebsiteTestMessage}
              onOpenInbox={handleOpenWebsiteInbox}
              disabled={!saveAllowed || statusQuery.isLoading || handoffBusy}
              busy={handoffBusy}
              onPrepareDeveloper={handlePrepareDeveloperInstall}
              onPrepareGtm={handlePrepareGtmInstall}
              onPrepareWordpress={handlePrepareWordpressInstall}
              onVerify={() => setActivePanel("verify")}
              onSettings={() => setActivePanel("settings")}
            />
          ) : null}
          {mainContent}
        </div>
      </div>

      <footer className="shrink-0 border-t border-line-soft bg-surface px-6 py-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] [&>button]:min-w-0 sm:[&>button:first-child]:!w-full sm:[&>button]:!w-auto">
          {renderFooterActions()}
        </div>
      </footer>
    </aside>
  );
}
