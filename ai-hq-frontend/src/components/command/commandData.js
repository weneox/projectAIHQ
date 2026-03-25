import {
  BellRing,
  Bot,
  BriefcaseBusiness,
  Clapperboard,
  FileText,
  Globe,
  Image,
  Layers3,
  Megaphone,
  MessageSquareText,
  Radar,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

export const commandMetrics = [
  {
    eyebrow: "agent mesh",
    value: "12",
    label: "autonomous agents",
    detail: "active across orchestration, debate, media, render and push",
  },
  {
    eyebrow: "execution rail",
    value: "18",
    label: "live executions",
    detail: "multi-route runtime chains with notification and publish hooks",
  },
  {
    eyebrow: "content stack",
    value: "46",
    label: "content events",
    detail: "draft, revise, publish, visual and trend research cycles",
  },
  {
    eyebrow: "reliability",
    value: "94.8%",
    label: "system confidence",
    detail: "cross-layer signal trust over command decisions",
  },
];

export const backendDomains = [
  {
    key: "agents",
    title: "Agent Mesh",
    subtitle: "routes/api/agents.js",
    description:
      "Autonomous specialist fleet coordinating operational reasoning and execution.",
    icon: Bot,
    status: "active",
    tone: "cyan",
    x: 0.12,
    y: 0.24,
    z: 0.08,
    size: 1.08,
  },
  {
    key: "executions",
    title: "Execution Engine",
    subtitle: "routes/api/executions.js",
    description:
      "Runtime command dispatch, live execution routing and system motion.",
    icon: Workflow,
    status: "running",
    tone: "indigo",
    x: 0.56,
    y: 0.2,
    z: -0.12,
    size: 1.24,
  },
  {
    key: "proposals",
    title: "Proposal Layer",
    subtitle: "routes/api/proposals.js",
    description:
      "Board-level proposal generation, framing, refinement and premium narrative assembly.",
    icon: BriefcaseBusiness,
    status: "stable",
    tone: "violet",
    x: 0.84,
    y: 0.3,
    z: 0.12,
    size: 1.04,
  },
  {
    key: "threads",
    title: "Threads",
    subtitle: "routes/api/threads.js",
    description:
      "Conversation state, operator context and cross-agent communication lines.",
    icon: MessageSquareText,
    status: "live",
    tone: "sky",
    x: 0.26,
    y: 0.56,
    z: 0.04,
    size: 0.98,
  },
  {
    key: "notifications",
    title: "Notifications",
    subtitle: "db/helpers/notifications.js",
    description:
      "Realtime system alerting, user update fanout and signal delivery surfaces.",
    icon: BellRing,
    status: "watching",
    tone: "emerald",
    x: 0.62,
    y: 0.56,
    z: -0.08,
    size: 0.96,
  },
  {
    key: "push",
    title: "Push Broadcast",
    subtitle: "services/pushBroadcast.js",
    description:
      "Outbound propagation for system state, action events and executive prompts.",
    icon: Megaphone,
    status: "armed",
    tone: "cyan",
    x: 0.9,
    y: 0.5,
    z: 0.14,
    size: 0.92,
  },
  {
    key: "render",
    title: "Render Studio",
    subtitle: "render/renderSlides.js",
    description:
      "Slide render, premium delivery surface and command-grade presentation output.",
    icon: Clapperboard,
    status: "queued",
    tone: "amber",
    x: 0.8,
    y: 0.74,
    z: -0.08,
    size: 0.94,
  },
  {
    key: "media",
    title: "Media Fabric",
    subtitle: "routes/api/media/video.js",
    description:
      "Runway video, media route orchestration and multimodal generation operations.",
    icon: Image,
    status: "processing",
    tone: "pink",
    x: 0.48,
    y: 0.78,
    z: 0.04,
    size: 0.94,
  },
  {
    key: "debate",
    title: "Debate Kernel",
    subtitle: "kernel/debate/core.js",
    description:
      "Structured reasoning loops, draft normalization and adversarial refinement.",
    icon: ShieldCheck,
    status: "thinking",
    tone: "violet",
    x: 0.1,
    y: 0.76,
    z: -0.12,
    size: 1.02,
  },
  {
    key: "content",
    title: "Content Pipeline",
    subtitle: "routes/api/content.js",
    description:
      "Draft, revise, publish and trend research prompt bundles in one command chain.",
    icon: FileText,
    status: "composing",
    tone: "sky",
    x: 0.26,
    y: 0.12,
    z: -0.04,
    size: 0.98,
  },
];

export const liveFeed = [
  {
    domain: "executions",
    title: "Execution graph rebased on debate output",
    meta: "runtime orchestration",
    time: "now",
  },
  {
    domain: "media",
    title: "Runway video task acknowledged and staged",
    meta: "media service",
    time: "2m",
  },
  {
    domain: "proposals",
    title: "Premium proposal narrative bundle regenerated",
    meta: "proposal layer",
    time: "6m",
  },
  {
    domain: "notifications",
    title: "Notification fanout synced with push broadcast",
    meta: "alert fabric",
    time: "11m",
  },
];

export const operatorDirectives = [
  "Orchestrate a board-grade proposal from the content and debate kernels.",
  "Promote high-confidence executions to the live command rail.",
  "Surface threads needing operator intervention before push broadcast.",
  "Render a premium executive deck from the current execution graph.",
];

export const microSignals = [
  { t: "00", confidence: 24, executions: 14 },
  { t: "04", confidence: 33, executions: 18 },
  { t: "08", confidence: 48, executions: 26 },
  { t: "10", confidence: 52, executions: 31 },
  { t: "12", confidence: 60, executions: 34 },
  { t: "14", confidence: 68, executions: 39 },
  { t: "16", confidence: 72, executions: 42 },
  { t: "18", confidence: 78, executions: 48 },
  { t: "20", confidence: 84, executions: 53 },
  { t: "24", confidence: 76, executions: 44 },
];

export const commandChips = [
  { label: "multi-agent", icon: Bot },
  { label: "debate kernel", icon: ShieldCheck },
  { label: "render studio", icon: Sparkles },
  { label: "global threads", icon: Globe },
  { label: "signal radar", icon: Radar },
  { label: "stack fusion", icon: Layers3 },
];