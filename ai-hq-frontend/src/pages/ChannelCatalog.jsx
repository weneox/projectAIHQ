import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Globe2,
  Instagram,
  Mail,
  MessageCircle,
  Plug,
  Send,
  ShieldAlert,
  Smartphone,

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
import { PageCanvas, PageHeader } from "../components/ui/AppShellPrimitives.jsx";
import { cx } from "../lib/cx.js";

const CHANNELS = [
  {
    id: "website-chat",
    name: "Website Chat",
    type: "Website",
    status: "connected",
    health: "ready",
    icon: Globe2,
    description: "Capture website visitors and route conversations into Inbox.",
    setupNote: "Widget is already installed and ready to receive conversations.",
    connects: ["Website widget", "Inbox routing", "Lead capture"],
    requirements: ["Website domain", "Widget installation", "Workspace inbox"],
  },
  {
    id: "instagram",
    name: "Instagram",
    type: "Social",
    status: "connected",
    health: "ready",
    icon: Instagram,
    description: "Connect Instagram DMs and qualify social conversations.",
    setupNote: "Instagram permissions are active for this workspace.",
    connects: ["Instagram DMs", "Conversation history", "Lead qualification"],
    requirements: ["Instagram Business account", "Meta permission", "Connected page"],
  },
  {
    id: "facebook",
    name: "Facebook",
    type: "Social",
    status: "pending",
    health: "action required",
    icon: MessageCircle,
    description: "Receive Facebook page messages after permission review.",
    setupNote: "Continue setup to finish page permissions.",
    connects: ["Facebook page messages", "Inbox routing", "Customer handoff"],
    requirements: ["Facebook page", "Meta permission", "Page admin access"],
  },
  {
    id: "telegram",
    name: "Telegram",
    type: "Messaging",
    status: "connected",
    health: "ready",
    icon: Send,
    description: "Route Telegram conversations into your workspace inbox.",
    setupNote: "Telegram bot is connected and ready.",
    connects: ["Telegram bot", "Inbox routing", "Message automation"],
    requirements: ["Telegram bot token", "Workspace routing", "Webhook access"],
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    type: "Messaging",
    status: "not connected",
    health: "disabled",
    icon: Smartphone,
    description: "Connect WhatsApp Business for customer messaging.",
    setupNote: "Connect a WhatsApp Business account to start receiving messages.",
    connects: ["WhatsApp Business", "Customer conversations", "Inbox routing"],
    requirements: ["WhatsApp Business account", "Meta business verification", "Phone number"],
  },
  {
    id: "email",
    name: "Email",
    type: "Email",
    status: "pending",
    health: "paused",
    icon: Mail,
    description: "Send follow-up emails and operational handoff messages.",
    setupNote: "Email setup is paused until sender configuration is completed.",
    connects: ["Outbound email", "Follow-up messages", "Customer handoff"],
    requirements: ["Sender address", "Domain verification", "Email provider access"],
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

function actionLabel(channel = {}) {
  const status = lower(channel.status);

  if (status === "connected") return "Manage";
  if (status === "pending") return "Continue";

  return "Connect";
}

function actionVariant(channel = {}) {
  return lower(channel.status) === "connected" ? "secondary" : "primary";
}

function statusTone(status = "") {
  const safe = lower(status);

  if (safe === "connected") return "success";
  if (safe === "pending") return "warning";

  return "neutral";
}

function healthSignal(channel = {}) {
  const status = lower(channel.status);
  const health = lower(channel.health);

  if (status === "connected" && health === "ready") {
    return {
      icon: CheckCircle2,
      label: "Ready",
      tone: "success",
      className: "text-success",
    };
  }

  if (health === "action required") {
    return {
      icon: ShieldAlert,
      label: "Needs setup",
      tone: "warning",
      className: "text-warning",
    };
  }

  if (status === "pending") {
    return {
      icon: ShieldAlert,
      label: "Setup paused",
      tone: "warning",
      className: "text-warning",
    };
  }

  return {
    icon: Plug,
    label: "Not connected",
    tone: "neutral",
    className: "text-text-muted",
  };
}

function ChannelCard({ channel, selected = false, onOpen }) {
  const Icon = channel.icon || Plug;
  const signal = healthSignal(channel);
  const SignalIcon = signal.icon;

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
        "group cursor-pointer rounded-md border bg-white p-5 transition-[background-color,border-color,box-shadow,transform] duration-base ease-premium",
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
                  {channel.name}
                </h3>

                <AppTag tone={statusTone(channel.status)}>
                  {titleize(channel.status)}
                </AppTag>
              </div>

              <p className="mt-1.5 max-w-[680px] text-[13.5px] font-medium leading-6 text-text-muted">
                {channel.description}
              </p>

              <div className="mt-4 border-t border-line-soft pt-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <div className="flex items-center gap-2">
                    <SignalIcon
                      className={cx("h-4 w-4 shrink-0", signal.className)}
                      strokeWidth={2.1}
                    />
                    <span className={cx("text-[12.5px] font-semibold", signal.className)}>
                      {signal.label}
                    </span>
                  </div>

                  <div className="text-[12.5px] font-medium text-text-muted">
                    {channel.type}
                  </div>

                  <div className="min-w-0 truncate text-[12.5px] font-medium text-text-muted">
                    {channel.setupNote}
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
            variant={actionVariant(channel)}
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
            rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
          >
            {actionLabel(channel)}
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

function ConnectDialog({ channel, open, onClose }) {
  if (!open || !channel) return null;

  const Icon = channel.icon || Plug;
  const signal = healthSignal(channel);

  return (
    <AppModal open={open} onClose={onClose} maxWidth="max-w-[620px]">
      <AppModalHeader>
        <div className="flex min-w-0 items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center text-text">
            <Icon className="h-11 w-11" strokeWidth={1.78} />
          </div>

          <div className="min-w-0">
            <div className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brand">
              Channel setup
            </div>

            <h2 className="mt-2 text-[24px] font-semibold tracking-[var(--tracking-tight-xl)] text-text">
              {channel.name}
            </h2>

            <p className="mt-2 max-w-[440px] text-[13.5px] font-medium leading-6 text-text-muted">
              {channel.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <AppTag tone={statusTone(channel.status)}>
                {titleize(channel.status)}
              </AppTag>
              <AppTag tone={signal.tone} dot>
                {signal.label}
              </AppTag>
              <AppTag tone="neutral">{channel.type}</AppTag>
            </div>
          </div>
        </div>

        <AppModalCloseButton onClick={onClose} label="Close channel setup" />
      </AppModalHeader>

      <AppModalBody>
        <div className="rounded-md border border-line-soft bg-white p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-text-subtle">
            Setup note
          </div>
          <div className="mt-2 text-[13.5px] font-medium leading-6 text-text">
            {channel.setupNote}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailList title="This connects" items={channel.connects} />
          <DetailList title="Requirements" items={channel.requirements} />
        </div>
      </AppModalBody>

      <AppModalFooter>
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          Cancel
        </Button>

        <Button
          type="button"
          size="md"
          rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2.1} />}
        >
          {actionLabel(channel)} channel
        </Button>
      </AppModalFooter>
    </AppModal>
  );
}

export default function ChannelCatalog() {
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [dialogChannel, setDialogChannel] = useState(null);

  const selectedChannel = useMemo(() => {
    return CHANNELS.find((channel) => channel.id === selectedChannelId) || null;
  }, [selectedChannelId]);

  function openChannel(channel) {
    setSelectedChannelId(channel.id);
    setDialogChannel(channel);
  }

  return (
    <PageCanvas>
      <PageHeader
        title="Channel catalog"
        description="Connect the places where customers message you and route every conversation into the workspace."
      />

      <div className="grid gap-3">
        {CHANNELS.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            selected={selectedChannel?.id === channel.id}
            onOpen={() => openChannel(channel)}
          />
        ))}
      </div>

      <ConnectDialog
        channel={dialogChannel}
        open={Boolean(dialogChannel)}
        onClose={() => setDialogChannel(null)}
      />
    </PageCanvas>
  );
}

