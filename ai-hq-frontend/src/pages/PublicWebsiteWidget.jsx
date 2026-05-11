import { CircleAlert, MessageCircle } from "lucide-react";

function s(value, fallback = "") {
  return String(value ?? fallback).trim() || fallback;
}

function getHostLabel() {
  if (typeof window === "undefined") return "Website";

  try {
    const params = new URLSearchParams(window.location.search);
    return s(params.get("brand") || params.get("workspace") || params.get("tenant"), "Website");
  } catch {
    return "Website";
  }
}

export default function PublicWebsiteWidget() {
  const hostLabel = getHostLabel();

  return (
    <main className="min-h-screen bg-transparent p-3 font-sans text-slate-950 antialiased">
      <section className="mx-auto flex min-h-[420px] w-full max-w-[380px] flex-col overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-[0_28px_80px_-52px_rgba(15,23,42,0.85)]">
        <header className="border-b border-slate-200/80 bg-[linear-gradient(180deg,#FFFFFF_0%,#F7F9FC_100%)] px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
              <MessageCircle className="h-5 w-5" strokeWidth={2.05} />
            </div>

            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold tracking-[-0.02em] text-slate-950">
                {hostLabel} chat
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Setup required
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-6 py-10 text-center">
          <div className="max-w-[280px]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
              <CircleAlert className="h-6 w-6" strokeWidth={2.05} />
            </div>

            <h1 className="mt-5 text-[18px] font-semibold tracking-[-0.025em] text-slate-950">
              Website chat is not live yet
            </h1>

            <p className="mt-2 text-[13px] font-medium leading-6 text-slate-600">
              This widget route is installed, but the live chat surface is guarded until the website channel is configured and delivery-ready.
            </p>
          </div>
        </div>

        <footer className="border-t border-slate-200/80 bg-slate-50 px-5 py-3">
          <div className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            Powered by AIHQ
          </div>
        </footer>
      </section>
    </main>
  );
}
