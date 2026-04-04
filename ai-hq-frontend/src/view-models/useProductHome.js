import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOutboundSummary, listInboxThreads } from "../api/inbox.js";
import { getSetupOverview } from "../api/setup.js";
import { getSettingsTrustView } from "../api/trust.js";
import { getTruthReviewWorkbench } from "../api/truth.js";
import { getAppSessionContext } from "../lib/appSession.js";
import { buildWorkspaceBusinessMemory } from "./workspaceBusinessMemory.js";
import { buildWorkspaceSetupState } from "./workspaceSetupState.js";

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

function n(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function pluralize(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatWorkspaceName(session = {}) {
  return s(
    session?.bootstrap?.workspace?.companyName ||
      session?.auth?.tenant?.company_name ||
      session?.auth?.tenant?.companyName ||
      session?.tenantKey ||
      "your business"
  );
}

async function loadProductHomePayloads() {
  const session = await getAppSessionContext().catch(() => null);

  const requests = {
    session: Promise.resolve(session),
    overview: getSetupOverview(),
    trust: getSettingsTrustView({ limit: 4 }),
    workbench: getTruthReviewWorkbench({ limit: 4 }),
    inboxThreads: listInboxThreads({ limit: 10 }),
    inboxOutbound: getOutboundSummary(),
  };

  const settledEntries = await Promise.all(
    Object.entries(requests).map(async ([key, promise]) => [key, await Promise.allSettled([promise])])
  );

  const payloads = {};
  const sourceStatus = {};

  for (const [key, settledWrapper] of settledEntries) {
    const settled = settledWrapper[0];
    if (settled.status === "fulfilled") {
      payloads[key] = settled.value;
      sourceStatus[key] = { available: true };
    } else {
      payloads[key] = null;
      sourceStatus[key] = { available: false };
    }
  }

  return { payloads, sourceStatus };
}

function buildInboxState({ threadsPayload, outboundPayload, sourceStatus }) {
  const threadsAvailable = sourceStatus.inboxThreads?.available !== false;
  const outboundAvailable = sourceStatus.inboxOutbound?.available !== false;
  const threads = arr(threadsPayload?.threads);
  const unreadCount = threads.reduce(
    (sum, thread) => sum + n(thread?.unread_count),
    0
  );
  const openCount = threads.filter((thread) => {
    const status = s(thread?.status, "open").toLowerCase();
    return status !== "resolved" && status !== "closed";
  }).length;
  const handoffCount = threads.filter(
    (thread) => thread?.handoff_active || s(thread?.assigned_to)
  ).length;
  const outboundPending = Math.max(
    n(outboundPayload?.pendingCount),
    n(outboundPayload?.pending),
    n(outboundPayload?.retryingCount),
    n(outboundPayload?.failedCount)
  );

  if (!threadsAvailable && !outboundAvailable) {
    return {
      status: "unavailable",
      statusLabel: "Unavailable",
      tone: "danger",
      summary: "Conversation activity is unavailable right now.",
      detail: "Inbox and outbound activity could not be loaded.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: { unreadCount: 0, openCount: 0, handoffCount: 0, outboundPending: 0 },
    };
  }

  if (unreadCount > 0) {
    return {
      status: "attention",
      statusLabel: "Needs attention",
      tone: "warn",
      summary: `${pluralize(unreadCount, "unread message")} ${unreadCount === 1 ? "is" : "are"} waiting across ${pluralize(Math.max(openCount, 1), "open conversation")}.`,
      detail: handoffCount
        ? `${pluralize(handoffCount, "conversation")} already ${handoffCount === 1 ? "has" : "have"} operator ownership.`
        : "Open the queue to triage new activity.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: { unreadCount, openCount, handoffCount, outboundPending },
    };
  }

  if (openCount > 0 || outboundPending > 0) {
    return {
      status: "active",
      statusLabel: "Active",
      tone: "info",
      summary:
        openCount > 0
          ? `${pluralize(openCount, "conversation")} ${openCount === 1 ? "is" : "are"} currently active.`
          : `${pluralize(outboundPending, "outbound follow-up")} ${outboundPending === 1 ? "is" : "are"} still in flight.`,
      detail:
        outboundPending > 0
          ? `${pluralize(outboundPending, "outbound follow-up")} still need a delivery outcome.`
          : "Inbox activity is live, but nothing unread is waiting.",
      action: { label: "Open inbox", path: "/inbox" },
      counts: { unreadCount, openCount, handoffCount, outboundPending },
    };
  }

  return {
    status: "quiet",
    statusLabel: "Quiet",
    tone: "neutral",
    summary: "Conversation activity is quiet right now.",
    detail: "No open queue pressure is visible from the current inbox signal.",
    action: { label: "Open inbox", path: "/inbox" },
    counts: { unreadCount, openCount, handoffCount, outboundPending },
  };
}

function buildAvailabilityNote({ sourceStatus, setupState, businessMemory, inboxState }) {
  const details = [];

  if (setupState.isUnavailable) details.push("Setup progress is unavailable.");
  if (businessMemory.stats.pendingCount > 0 && sourceStatus.trust?.available === false) {
    details.push("Approved business memory is unavailable, but review work is still visible.");
  } else if (
    sourceStatus.trust?.available === false &&
    sourceStatus.workbench?.available === false
  ) {
    details.push("Business memory is unavailable.");
  }

  if (inboxState.status === "unavailable") {
    details.push("Conversation activity is unavailable.");
  }

  if (!details.length) return null;

  return {
    title: "Some live product context is limited",
    description: details.join(" "),
  };
}

function buildPrimaryAction({ setupState, businessMemory, inboxState }) {
  if (inboxState.status === "attention") {
    return {
      title: "The inbox is the next place that needs an operator.",
      detail: inboxState.summary,
      action: inboxState.action,
    };
  }

  if (inboxState.status === "active") {
    return {
      title: "Start from the live messaging queue.",
      detail: inboxState.summary,
      action: inboxState.action,
    };
  }

  if (setupState.needsReview) {
    return {
      title: "Instagram DM launch is usable, but setup review still needs follow-through.",
      detail: setupState.summary,
      action: { label: "Open channels", path: "/channels?channel=instagram" },
    };
  }

  if (setupState.isActionable) {
    return {
      title: "Finish the Instagram connection path before expanding the launch story.",
      detail: setupState.summary,
      action: { label: "Open channels", path: "/channels?channel=instagram" },
    };
  }

  if (businessMemory.stats.pendingCount > 0) {
    return {
      title: "Business memory review is pending, but the main operating path is still Instagram DMs.",
      detail: businessMemory.needsConfirmation,
      action: { label: "Open channels", path: "/channels?channel=instagram" },
    };
  }

  return {
    title: "Start from the Instagram channel control plane.",
    detail:
      "Connect Instagram first, then operate inbox as the real launch path. Other surfaces stay secondary until they are review-aligned.",
    action: { label: "Open channels", path: "/channels?channel=instagram" },
  };
}

function dedupeActions(actions = []) {
  const seen = new Set();
  return actions.filter((item) => {
    const path = s(item?.path);
    if (!path || seen.has(path)) return false;
    seen.add(path);
    return true;
  });
}

function splitEntryPoints(items = []) {
  const priority = {
    inbox: 100,
    comments: 95,
    voice: 90,
    workspace: 50,
    launch: 45,
    memory: 40,
  };

  const ordered = [...items].sort(
    (left, right) => (priority[right.id] || 0) - (priority[left.id] || 0)
  );

  return {
    featured: ordered.slice(0, 3),
    secondary: ordered.slice(3),
  };
}

export function useProductHome() {
  const state = useQuery({
    queryKey: ["product-home"],
    queryFn: loadProductHomePayloads,
    staleTime: 20_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const payloads = state.data?.payloads || {
    session: null,
    overview: null,
    trust: null,
    workbench: null,
    inboxThreads: null,
    inboxOutbound: null,
  };

  const sourceStatus = state.data?.sourceStatus || {
    session: { available: true },
    overview: { available: true },
    trust: { available: true },
    workbench: { available: true },
    inboxThreads: { available: true },
    inboxOutbound: { available: true },
  };

  const derived = useMemo(() => {
    const session = payloads.session || {};
    const bootstrap = session?.bootstrap || {};
    const setupState = buildWorkspaceSetupState({
      bootstrap,
      overview: payloads.overview,
      sourceStatus: {
        bootstrap: { available: Boolean(session?.bootstrap) },
        overview: sourceStatus.overview,
      },
    });
    const businessMemory = buildWorkspaceBusinessMemory({
      trust: payloads.trust,
      workbench: payloads.workbench,
      setupState,
    });
    const inboxState = buildInboxState({
      threadsPayload: payloads.inboxThreads,
      outboundPayload: payloads.inboxOutbound,
      sourceStatus,
    });
    const availabilityNote = buildAvailabilityNote({
      sourceStatus,
      setupState,
      businessMemory,
      inboxState,
    });
    const companyName = formatWorkspaceName(session);
    const actorName = s(session?.actorName, "operator");
    const primaryAction = buildPrimaryAction({
      setupState,
      businessMemory,
      inboxState,
    });
    const secondaryAction =
      primaryAction.action?.path === "/inbox"
        ? { label: "Open comments", path: "/comments" }
        : primaryAction.action?.path === "/comments"
          ? { label: "Open voice", path: "/voice" }
          : { label: "Open inbox", path: "/inbox" };

    const heroStats = [
      {
        id: "setup",
        label: "Sources and setup",
        status: setupState.isComplete
          ? "Ready"
          : setupState.needsReview
            ? "Pending review"
            : setupState.isActionable
              ? "In progress"
              : setupState.isUnavailable
                ? "Unavailable"
                : "Not started",
        summary: setupState.summary,
        action:
          setupState.action || {
            label: "Open setup assistant",
            path: "/home?assistant=setup",
          },
      },
      {
        id: "memory",
        label: "Business memory",
        status:
          businessMemory.stats.pendingCount > 0
            ? "Review waiting"
            : businessMemory.stats.approvedVersionId
              ? "Stable"
              : "Needs foundation",
        summary:
          businessMemory.stats.pendingCount > 0
            ? businessMemory.needsConfirmation
            : businessMemory.currentKnown,
        action: businessMemory.primaryAction,
      },
      {
        id: "inbox",
        label: "Launch activity",
        status: inboxState.statusLabel,
        summary: inboxState.summary,
        action: inboxState.action,
      },
    ];

    const entryPoints = [
      {
        id: "inbox",
        title: "Social Inbox",
        status:
          primaryAction.action?.path === "/inbox" ? "Start here" : inboxState.statusLabel,
        summary: "Handle Meta messaging, queue pressure, and operator follow-up in one place.",
        detail: inboxState.detail,
        action: inboxState.action,
      },
      {
        id: "comments",
        title: "Comments",
        status: "Phase 2",
        summary:
          "Comments stay outside the launch promise until the permission model and runtime path are hardened to the same standard as DMs.",
        detail:
          "Keep comment automation out of the Meta review story for the DM-first launch.",
        action: { label: "Open comments", path: "/comments" },
      },
      {
        id: "voice",
        title: "Voice Receptionist",
        status: "Separate surface",
        summary: "Voice remains a separate product surface and is not part of the Instagram DM-first launch promise.",
        detail:
          "Do not mix voice readiness into the Meta review story for the DM-first release.",
        action: { label: "Open voice", path: "/voice" },
      },
      {
        id: "workspace",
        title: "Workspace",
        status: "Support",
        summary: "Use the operator workspace for a cross-surface brief once the launch loops are already in view.",
        detail:
          "Workspace stays available for posture and context, but it should not compete with inbox, comments, and voice as the main operating path.",
        action: { label: "Open workspace", path: "/workspace" },
      },
      {
        id: "launch",
        title: "Channels",
        status: "Start here",
        summary:
          "Use Channels as the real connect-and-status surface for Instagram DM launch readiness.",
        detail:
          "This is where the product now tells the truth about connect, reconnect, disconnect, and phase 2 connectors.",
        action: { label: "Open channels", path: "/channels?channel=instagram" },
      },
      {
        id: "memory",
        title: "Business memory",
        status:
          businessMemory.stats.pendingCount > 0
            ? "Pending review"
            : businessMemory.stats.approvedVersionId
              ? "Stable"
              : "Unconfirmed",
        summary: "Review proposed changes before they alter approved business memory.",
        detail:
          businessMemory.stats.pendingCount > 0
            ? businessMemory.needsConfirmation
            : businessMemory.currentKnown,
        action: businessMemory.primaryAction,
      },
    ];

    const entryPointGroups = splitEntryPoints(entryPoints);

    const benefits = [
      {
        id: "focus",
        title: "A coherent DM-first launch story",
        summary:
          "The product is easier to trust when it leads with the one connector and runtime path that are actually ready for review.",
      },
      {
        id: "oversight",
        title: "Cleaner operator oversight",
        summary:
          "See Instagram messaging readiness without dressing unfinished channels up as equal launch surfaces.",
      },
      {
        id: "control",
        title: "Internal control without product inflation",
        summary:
          "Business changes stay reviewable before they affect the live DM runtime, without forcing internal architecture into the customer story.",
      },
      {
        id: "voice",
        title: "One launch promise",
        summary:
          "Keep the launch promise narrow: tenant-aware Instagram DMs first, then expand only when the next surface is equally real.",
      },
    ];

    const currentStatus = {
      title: primaryAction.title,
      summary: primaryAction.detail,
      action: primaryAction.action,
      secondaryAction,
    };

    const supportingStatus = [
      {
        id: "setup-support",
        label: "Setup",
        status: heroStats[0].status,
        summary: setupState.summary,
        action:
          setupState.action || {
            label: "Open setup assistant",
            path: "/home?assistant=setup",
          },
      },
      {
        id: "memory-support",
        label: "Business memory",
        status:
          businessMemory.stats.pendingCount > 0
            ? "Pending review"
            : businessMemory.stats.approvedVersionId
              ? "Stable"
              : "Unconfirmed",
        summary:
          businessMemory.stats.pendingCount > 0
            ? businessMemory.needsConfirmation
            : businessMemory.currentKnown,
        action: businessMemory.primaryAction,
      },
      {
        id: "inbox-support",
        label: "Inbox",
        status: inboxState.statusLabel,
        summary: inboxState.summary,
        action: inboxState.action,
      },
    ];

    const finalActions = dedupeActions([
      primaryAction.action,
      secondaryAction,
      inboxState.action,
      { label: "Open channels", path: "/channels?channel=instagram" },
      { label: "Open voice", path: "/voice" },
      { label: "Open workspace", path: "/workspace" },
    ]).slice(0, 4);

    return {
      companyName,
      actorName,
      setupState,
      businessMemory,
      inboxState,
      availabilityNote,
      heroStats,
      primaryAction,
      secondaryAction,
      entryPoints,
      entryPointGroups,
      benefits,
      currentStatus,
      supportingStatus,
      finalActions,
    };
  }, [payloads, sourceStatus]);

  return {
    loading: state.isLoading,
    isFetching: state.isFetching,
    refetch: state.refetch,
    sourceStatus,
    ...derived,
  };
}

export default useProductHome;
