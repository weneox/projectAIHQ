import { fmtTime } from "../lib/time.js";
import Card from "./ui/Card.jsx";
import Button from "./ui/Button.jsx";
import { Tabs } from "./ui/Tabs.jsx";
import Badge from "./ui/Badge.jsx";

function tone(type) {
  if (type?.includes("approved")) return "success";
  if (type?.includes("rejected")) return "danger";
  if (type?.includes("proposal")) return "warn";
  if (type?.includes("system")) return "info";
  return "neutral";
}

function labelOf(type) {
  const last = String(type || "").split(".").pop();
  return last || "event";
}

export default function Inbox({
  items,
  unreadCount,
  onOpenItem,
  onMarkAllRead,
  filter,
  setFilter,
}) {
  const filters = [
    { value: "all", label: "All" },
    { value: "proposal", label: "Proposal" },
    { value: "execution", label: "Execution" },
    { value: "system", label: "System" },
  ];

  const show = (items || []).slice(0, 14);

  return (
    <Card variant="panel" padded={false} className="min-h-0 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold tracking-tight">
              Activity Feed
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Realtime system & approval events
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge tone={unreadCount ? "warn" : "neutral"}>
              {unreadCount} unread
            </Badge>

            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkAllRead}
              disabled={!unreadCount}
            >
              Mark all
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Tabs value={filter} onChange={setFilter} items={filters} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {show.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            <div className="font-medium">No activity yet</div>
            <div className="mt-1 text-xs opacity-80">
              Events will appear here in realtime.
            </div>
          </div>
        ) : (
          show.map((it) => {
            const unread = !it.read;
            return (
              <button
                key={it.id}
                onClick={() => onOpenItem(it)}
                className={[
                  "w-full text-left px-3 py-3 rounded-xl transition",
                  "border border-transparent hover:border-slate-200 dark:hover:border-slate-800",
                  "hover:bg-slate-50/70 dark:hover:bg-slate-900/50",
                  unread ? "bg-indigo-50/40 dark:bg-indigo-500/10" : "",
                ].join(" ")}
              >
                <div className="flex justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {it.title}
                    </div>
                    <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                      {it.subtitle}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge tone={tone(it.type)}>
                      {labelOf(it.type)}
                    </Badge>
                    <div className="mt-1 text-[11px] text-slate-500">
                      {fmtTime(it.ts)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}