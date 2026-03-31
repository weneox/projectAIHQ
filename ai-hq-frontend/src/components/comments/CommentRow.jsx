import {
  Instagram,
  Facebook,
  MessageSquareText,
  Globe,
} from "lucide-react";
import {
  channelIcon,
  channelTone,
  statusTone,
  sentimentTone,
  priorityTone,
} from "../../features/comments/comment-utils.js";

export default function CommentRow({ item, selected, onSelect }) {
  const Icon = channelIcon(item.platform, {
    Instagram,
    Facebook,
    MessageSquareText,
    Globe,
  });

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      className={`w-full rounded-[22px] border px-4 py-4 text-left transition ${
        selected
          ? "border-sky-200 bg-sky-50/90 shadow-[0_16px_34px_-26px_rgba(14,165,233,0.28)]"
          : "border-slate-200/80 bg-white/62 hover:border-slate-300 hover:bg-white/82"
      }`}
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.7fr_0.7fr_0.7fr] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${channelTone(item.platform)}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="truncate text-sm font-semibold text-slate-900">{item.author}</div>
          </div>
          <div className="mt-1 truncate text-xs text-slate-400">{item.postTitle}</div>
        </div>

        <div className="truncate text-sm text-slate-600">{item.text}</div>

        <div>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${statusTone(item.status)}`}>
            {item.status}
          </span>
        </div>

        <div>
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${sentimentTone(item.sentiment)}`}>
            {item.sentiment}
          </span>
        </div>

        <div className="text-right">
          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ${priorityTone(item.priority)}`}>
            {item.priority}
          </span>
        </div>
      </div>
    </button>
  );
}
