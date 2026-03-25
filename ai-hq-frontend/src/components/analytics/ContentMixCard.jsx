import { Bookmark, Eye, PlayCircle } from "lucide-react";
import Surface from "./Surface.jsx";

function MixBar({ label, value }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm text-white/68">
        <span>{label}</span>
        <span className="text-white/40">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,rgba(90,229,208,0.95),rgba(138,110,255,0.88))]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function ContentMixCard({ platform }) {
  return (
    <Surface className="px-5 py-5 md:px-6 md:py-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-lg font-medium tracking-[-0.03em] text-white">
            Content mix
          </div>
          <div className="mt-1 text-sm text-white/42">
            Where current performance is being generated
          </div>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/[0.04] ring-1 ring-white/10 text-white/65">
          <PlayCircle className="h-4.5 w-4.5" />
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {platform.mix.map((item) => (
          <MixBar key={item.label} label={item.label} value={item.value} />
        ))}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/8">
          <div className="flex items-center gap-2 text-sm text-white/62">
            <Eye className="h-4 w-4" />
            Avg. view depth
          </div>
          <div className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-white">
            {platform.key === "youtube" ? "61%" : platform.key === "tiktok" ? "54%" : "47%"}
          </div>
        </div>

        <div className="rounded-[22px] bg-white/[0.03] p-4 ring-1 ring-white/8">
          <div className="flex items-center gap-2 text-sm text-white/62">
            <Bookmark className="h-4 w-4" />
            Save intent
          </div>
          <div className="mt-4 text-[30px] font-semibold tracking-[-0.05em] text-white">
            {platform.key === "instagram" ? "8.9%" : platform.key === "linkedin" ? "6.7%" : "5.1%"}
          </div>
        </div>
      </div>
    </Surface>
  );
}