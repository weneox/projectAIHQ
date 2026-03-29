import {
  Activity,
  AudioLines,
  FileStack,
  MessageCircleMore,
  Send,
  Siren,
  Users,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import FocusDialog from "../ui/FocusDialog.jsx";

const OPERATIONS_ITEMS = [
  {
    label: "Incidents",
    to: "/incidents",
    icon: Siren,
    description: "Production incident history and operational triage.",
  },
  {
    label: "Leads",
    to: "/leads",
    icon: Users,
    description: "Operational follow-up and lead management workspace.",
  },
  {
    label: "Comments",
    to: "/comments",
    icon: MessageCircleMore,
    description: "Moderation, reply review, and operator intervention.",
  },
  {
    label: "Proposals",
    to: "/proposals",
    icon: FileStack,
    description: "Operational proposal review and publishing flow.",
  },
  {
    label: "Executions",
    to: "/executions",
    icon: Activity,
    description: "Durable runtime inspection and manual retry controls.",
  },
  {
    label: "Voice",
    to: "/voice",
    icon: AudioLines,
    description: "Live voice sessions, calls, and operator controls.",
  },
];

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function OperationsLink({ item, onNavigate }) {
  const Icon = item.icon;

  return (
    <NavLink to={item.to} onClick={onNavigate}>
      {({ isActive }) => (
        <div
          className={cn(
            "rounded-[24px] border px-4 py-4 transition",
            isActive
              ? "border-cyan-300/24 bg-cyan-300/[0.08]"
              : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                isActive
                  ? "border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                  : "border-white/10 bg-white/[0.04] text-white/72"
              )}
            >
              <Icon className="h-4.5 w-4.5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-white">{item.label}</div>
                {isActive ? (
                  <span className="inline-flex items-center rounded-full border border-cyan-300/20 bg-cyan-300 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-900">
                    Open
                  </span>
                ) : null}
              </div>
              <div className="mt-2 text-sm leading-6 text-white/48">
                {item.description}
              </div>
            </div>
          </div>
        </div>
      )}
    </NavLink>
  );
}

export default function OperationsPanel({ open = false, onClose, onNavigate }) {
  return (
    <FocusDialog
      open={open}
      onClose={onClose}
      title="Operations"
      backdropClassName="bg-black/55 backdrop-blur-[6px]"
      panelClassName="w-full max-w-[760px]"
    >
      <div className="overflow-hidden rounded-[30px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(4,8,16,0.96),rgba(3,7,14,0.94))] shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
        <div className="border-b border-white/[0.08] px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
              <Send className="h-4.5 w-4.5 text-white/78" />
            </div>
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.03em] text-white">
                Operations
              </div>
              <div className="mt-1 text-sm leading-6 text-white/46">
                Secondary operator tools that support runtime triage,
                moderation, follow-up, and operational interventions.
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 px-5 py-5 md:grid-cols-2">
          {OPERATIONS_ITEMS.map((item) => (
            <OperationsLink
              key={item.to}
              item={item}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      </div>
    </FocusDialog>
  );
}
