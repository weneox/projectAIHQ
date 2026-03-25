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
          ? "border-cyan-400/20 bg-cyan-400/[0.05]"
          : "border-white/8 bg-black/20 hover:border-white/12 hover:bg-black/26"
      }`}
    >
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_0.7fr_0.7fr_0.7fr] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 items-center justify-center rounded-full border ${channelTone(item.platform)}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="truncate text-sm font-semibold text-white">{item.author}</div>
          </div>
          <div className="mt-1 truncate text-xs text-white/42">{item.postTitle}</div>
        </div>

        <div className="truncate text-sm text-white/66">{item.text}</div>

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