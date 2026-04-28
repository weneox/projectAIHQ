import React from "react";
import { ArrowRight, Bell, Bot, ChevronDown, Globe2, MessageCircle, Send, Sparkles } from "lucide-react";

const CHANNELS = [
  {
    id: "website",
    title: "Website chat",
    description: "Capture and manage conversations directly from your website.",
    icon: "website",
    status: "Connected",
  },
  {
    id: "instagram",
    title: "Instagram",
    description: "Automate replies and manage Instagram conversations in one place.",
    icon: "instagram",
    status: "Connected",
  },
  {
    id: "telegram",
    title: "Telegram",
    description: "Run Telegram messaging with fast routing and operator visibility.",
    icon: "telegram",
    status: "Connected",
  },
];

function ChannelGlyph({ type }) {
  if (type === "website") {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-white shadow-[0_12px_24px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
        <Globe2 className="h-6 w-6 text-slate-900" strokeWidth={2} />
      </div>
    );
  }

  if (type === "instagram") {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#feda75_0%,#fa7e1e_22%,#d62976_52%,#962fbf_76%,#4f5bd5_100%)] shadow-[0_12px_24px_rgba(15,23,42,0.10)]">
        <MessageCircle className="h-6 w-6 text-white" strokeWidth={2.2} />
      </div>
    );
  }

  return (
    <div className="flex h-14 w-14 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#38bdf8_0%,#0ea5e9_100%)] shadow-[0_12px_24px_rgba(15,23,42,0.10)]">
      <Send className="h-6 w-6 text-white" strokeWidth={2.2} />
    </div>
  );
}

function ChannelCard({ channel }) {
  return (
    <article
      className="
        group relative overflow-hidden rounded-[16px] border border-transparent bg-white p-6
        shadow-[0_12px_28px_rgba(15,23,42,0.06)]
        transition-all duration-200
        hover:-translate-y-[3px]
        hover:shadow-[0_26px_52px_rgba(15,23,42,0.12)]
      "
    >
      <div className="flex items-start justify-between gap-4">
        <ChannelGlyph type={channel.icon} />

        <div className="inline-flex items-center gap-2 rounded-[10px] bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-600">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          {channel.status}
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-[28px] font-semibold tracking-[-0.03em] text-slate-950">
          {channel.title}
        </h3>

        <p className="mt-3 max-w-[34ch] text-[15px] leading-7 text-slate-500">
          {channel.description}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <button
          type="button"
          className="
            inline-flex items-center gap-2 rounded-[12px] px-0 py-0 text-[14px] font-semibold
            text-slate-500 transition-colors duration-200 hover:text-slate-950
          "
        >
          Details
          <ArrowRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          className="
            inline-flex items-center gap-2 rounded-[12px] bg-[#315efb] px-4 py-3
            text-[14px] font-semibold text-white
            shadow-[0_14px_28px_rgba(49,94,251,0.28)]
            transition-all duration-200
            hover:-translate-y-[1px]
            hover:bg-[#2955f4]
            hover:shadow-[0_18px_34px_rgba(49,94,251,0.34)]
          "
        >
          Open inbox
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export default function ChannelsPage() {
  return (
    <div className="min-h-screen bg-[#f5f7fb] text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[72px] shrink-0 border-r border-slate-200/80 bg-[#f7f9fc] xl:flex xl:flex-col xl:items-center xl:justify-between xl:py-6">
          <div className="flex flex-col items-center gap-4">
            <button className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white text-[#315efb] shadow-[0_10px_22px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80">
              <Bot className="h-5 w-5" />
            </button>
            <button className="flex h-11 w-11 items-center justify-center rounded-[14px] text-slate-400 transition hover:bg-white hover:text-slate-900">
              <MessageCircle className="h-5 w-5" />
            </button>
            <button className="flex h-11 w-11 items-center justify-center rounded-[14px] text-slate-400 transition hover:bg-white hover:text-slate-900">
              <Send className="h-5 w-5" />
            </button>
          </div>

          <button className="flex h-11 w-11 items-center justify-center rounded-[14px] text-slate-400 transition hover:bg-white hover:text-slate-900">
            <Sparkles className="h-5 w-5" />
          </button>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-[#f8faff]/90 backdrop-blur">
            <div className="flex h-[72px] items-center justify-between px-6 md:px-8 xl:px-10">
              <div />

              <div className="flex items-center gap-5">
                <button className="inline-flex items-center gap-2 text-[15px] font-medium text-slate-700 transition hover:text-slate-950">
                  <Sparkles className="h-4 w-4" />
                  Ask AI
                </button>

                <button className="relative text-slate-500 transition hover:text-slate-900">
                  <Bell className="h-5 w-5" />
                </button>

                <button className="inline-flex items-center gap-2 text-[15px] font-semibold text-slate-900">
                  <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#dbe7ff] text-[#315efb]">
                    N
                  </div>
                  Neox
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>
          </header>

          <main className="px-6 py-8 md:px-8 xl:px-10 xl:py-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Channels
                </div>

                <h1 className="mt-3 text-[44px] font-semibold leading-none tracking-[-0.04em] text-slate-950">
                  Launch channels
                </h1>

                <p className="mt-4 text-[16px] text-slate-500">
                  3 available / 3 ready
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="
                    inline-flex items-center justify-center rounded-[14px] bg-white px-5 py-3.5
                    text-[15px] font-semibold text-slate-900
                    shadow-[0_10px_24px_rgba(15,23,42,0.06)]
                    ring-1 ring-slate-200/80
                    transition-all duration-200
                    hover:-translate-y-[1px]
                    hover:shadow-[0_18px_34px_rgba(15,23,42,0.10)]
                  "
                >
                  Open truth
                </button>

                <button
                  type="button"
                  className="
                    inline-flex items-center gap-2 rounded-[14px] bg-[#315efb] px-5 py-3.5
                    text-[15px] font-semibold text-white
                    shadow-[0_14px_30px_rgba(49,94,251,0.28)]
                    transition-all duration-200
                    hover:-translate-y-[1px]
                    hover:bg-[#2955f4]
                    hover:shadow-[0_20px_36px_rgba(49,94,251,0.34)]
                  "
                >
                  Open inbox
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <section className="mt-8 grid grid-cols-1 gap-5 xl:grid-cols-3">
              {CHANNELS.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}