import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Heart,
  Bell,
  Menu,
  Send,
  Sparkles,
  ShoppingCart,
  Stethoscope,
  GraduationCap,
  Home as HomeIcon,
  MessageCircle,
  Users,
  TrendingUp,
  ArrowDown,
  Cpu,
  Bot,
  Zap,
  Phone,
  Mail,
  MapPin,
  Wand2,
  Layers,
  ShieldCheck,
} from "lucide-react";

/** ================== utils ================== */
function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** ================== types ================== */
type Conversation = { id: string; name: string; meta: string };
type Msg = { id: string; role: "bot" | "user"; text: string; time: string };
type ThreadMap = Record<string, Msg[]>;
type UnreadMap = Record<string, number>;
type TypingMap = Record<string, boolean>;

/** ================== demo data ================== */
const BOT_NAME = "NEOX AI";
const PEOPLE: Conversation[] = [{ id: "a", name: "Kamran Mehdiyev", meta: "#67801" }];

const EMPTY_THREADS: ThreadMap = { a: [] };
const EMPTY_UNREAD: UnreadMap = { a: 0 };
const EMPTY_TYPING: TypingMap = { a: false };

/** ================== reveal on scroll + stagger ================== */
function useReveal<T extends HTMLElement>(opts?: {
  observer?: IntersectionObserverInit;
  delayMs?: number;
  once?: boolean;
}) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const delay = opts?.delayMs ?? 0;
    const once = opts?.once ?? true;

    if (delay) el.style.setProperty("--d", `${delay}ms`);

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("is-visible");
            if (once) obs.unobserve(el);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -12% 0px", ...(opts?.observer ?? {}) }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [opts?.delayMs, opts?.once, opts?.observer]);

  return ref;
}

/** ================== visuals (LIGHT THEME) ================== */
function AuroraBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* soft aurora blobs */}
      <div className="absolute -top-20 -left-20 h-[520px] w-[520px] rounded-full blur-3xl aurora-1" />
      <div className="absolute top-10 -right-32 h-[560px] w-[560px] rounded-full blur-3xl aurora-2" />
      <div className="absolute -bottom-40 left-1/3 h-[620px] w-[620px] rounded-full blur-3xl aurora-3" />
      {/* subtle vignette */}
      <div className="absolute inset-0 vignette-lite" />
      {/* grain */}
      <div className="absolute inset-0 grain-lite" />
    </div>
  );
}

function EpoxyCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl",
        "border border-slate-200/70 bg-white/65 backdrop-blur-xl",
        "shadow-[0_18px_55px_rgba(2,6,23,0.10)]",
        "ring-1 ring-indigo-200/35 transition hover:ring-indigo-300/45 hover:border-slate-200",
        className
      )}
    >
      <div className="pointer-events-none absolute -inset-px opacity-0 transition duration-500 group-hover:opacity-100 bg-[radial-gradient(55%_45%_at_50%_0%,rgba(99,102,241,0.18),transparent_62%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-90 bg-[radial-gradient(120%_80%_at_20%_0%,rgba(56,189,248,0.10),transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.60),transparent_42%)]" />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/60 px-3 py-1 text-xs text-slate-700 backdrop-blur">
      <Icon className="h-3.5 w-3.5 text-indigo-500" />
      <span>{label}</span>
    </div>
  );
}

function SideFeature({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <EpoxyCard className="h-full p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-300/35">
          <Icon className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm leading-snug text-slate-600">{desc}</div>
        </div>
      </div>
    </EpoxyCard>
  );
}

function StatCard({
  icon: Icon,
  title,
  value,
  trend,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  trend?: { direction: "down" | "up"; text: string };
  desc: string;
}) {
  return (
    <EpoxyCard className="h-full p-6">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/10 ring-1 ring-sky-300/35">
          <Icon className="h-5 w-5 text-sky-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="text-base font-semibold text-slate-900">{title}</div>
            {trend ? (
              <div className="inline-flex items-center gap-1 rounded-full bg-white/60 px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200/70">
                {trend.direction === "down" ? <ArrowDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                <span>{trend.text}</span>
              </div>
            ) : null}
          </div>
          <div className="mt-1 text-4xl font-semibold tracking-tight text-slate-900">{value}</div>
          <div className="mt-1 text-sm leading-snug text-slate-600">{desc}</div>
        </div>
      </div>
    </EpoxyCard>
  );
}

/**
 * ✅ Normal chat hissiyatı:
 * - Kamran (user) -> SOLDA
 * - NEOX AI (bot) -> SAĞDA
 * - Hər mesajın üstündə ad
 */
function ChatBubble({
  role,
  text,
  time,
  userName,
}: {
  role: "bot" | "user";
  text: string;
  time: string;
  userName: string;
}) {
  const isBot = role === "bot";
  const name = isBot ? BOT_NAME : userName;

  return (
    <div className={cn("flex", isBot ? "justify-end" : "justify-start")}>
      <div className="max-w-[92%] sm:max-w-[86%]">
        <div className={cn("mb-1 text-[11px] text-slate-500", isBot ? "text-right" : "text-left")}>{name}</div>

        <div
          className={cn(
            "rounded-2xl px-5 py-3.5 text-[14px] leading-relaxed ring-1 shadow-sm",
            isBot
              ? "bg-indigo-600/10 text-slate-900 ring-indigo-200/70"
              : "bg-white/70 text-slate-900 ring-slate-200/70"
          )}
        >
          {text}
        </div>

        <div className={cn("mt-1 text-[11px] text-slate-400", isBot ? "text-right" : "text-left")}>{time}</div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-end">
      <div className="flex items-center gap-2 text-slate-500">
        <div className="rounded-2xl bg-white/70 ring-1 ring-slate-200/70 px-4 py-2">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500/70 animate-[pulse_1s_ease-in-out_infinite]" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500/70 animate-[pulse_1s_ease-in-out_infinite] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500/70 animate-[pulse_1s_ease-in-out_infinite] [animation-delay:300ms]" />
          </div>
        </div>
        <span className="text-xs">{BOT_NAME} yazır…</span>
      </div>
    </div>
  );
}

/** ================== PAGE ================== */
export default function ServiceChatbot24() {
  // ✅ video çıxarıldı
  const heroImg = "https://res.cloudinary.com/dppoomunj/image/upload/v1770961679/Untitled_design_24_z6knoh.png";
  const finalImg = "https://res.cloudinary.com/dppoomunj/image/upload/v1770978952/Untitled_design_27_e1rnsb.png";

  /** reveal refs */
  const heroPillRef = useReveal<HTMLDivElement>({ delayMs: 0 });
  const heroTitleRef = useReveal<HTMLHeadingElement>({ delayMs: 120 });
  const heroTextRef = useReveal<HTMLParagraphElement>({ delayMs: 240 });
  const heroBtnsRef = useReveal<HTMLDivElement>({ delayMs: 360 });

  const howHeaderRef = useReveal<HTMLDivElement>({ delayMs: 0 });
  const howGridRef = useReveal<HTMLDivElement>({ delayMs: 120 });

  const headerRef = useReveal<HTMLDivElement>({ delayMs: 0 });

  const l1 = useReveal<HTMLDivElement>({ delayMs: 0 });
  const l2 = useReveal<HTMLDivElement>({ delayMs: 120 });
  const l3 = useReveal<HTMLDivElement>({ delayMs: 240 });
  const l4 = useReveal<HTMLDivElement>({ delayMs: 360 });

  const tabletRef = useReveal<HTMLDivElement>({ delayMs: 120 });

  const s1 = useReveal<HTMLDivElement>({ delayMs: 0 });
  const s2 = useReveal<HTMLDivElement>({ delayMs: 120 });
  const s3 = useReveal<HTMLDivElement>({ delayMs: 240 });

  const finalRef = useReveal<HTMLDivElement>({ delayMs: 0 });

  const [activeId, setActiveId] = useState<string>("a");
  const [hoverId, setHoverId] = useState<string | null>(null);

  const [threads, setThreads] = useState<ThreadMap>(EMPTY_THREADS);
  const [unread, setUnread] = useState<UnreadMap>(EMPTY_UNREAD);
  const [typing, setTyping] = useState<TypingMap>(EMPTY_TYPING);

  const [draft, setDraft] = useState<string>("");
  const chatRef = useRef<HTMLDivElement | null>(null);

  /** mobil/planşet: list toggle */
  const [showList, setShowList] = useState<boolean>(false);

  const active = useMemo(() => PEOPLE.find((p) => p.id === activeId)!, [activeId]);

  function previewLine(id: string) {
    const thread = threads[id] ?? [];
    const last = thread[thread.length - 1];
    if (!last) return "Yeni söhbət…";
    const clean = last.text.replace(/\s+/g, " ").trim();
    return clean.slice(0, 44) + (clean.length > 44 ? "…" : "");
  }

  function pushMsg(id: string, msg: Msg) {
    setThreads((m) => ({ ...m, [id]: [...(m[id] ?? []), msg] }));
  }

  /** auto-scroll */
  useEffect(() => {
    if (!chatRef.current) return;
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [activeId, (threads[activeId] ?? []).length, typing[activeId]]);

  /** clear unread */
  useEffect(() => {
    setUnread((u) => ({ ...u, [activeId]: 0 }));
  }, [activeId]);

  /** seed Q/A */
  useEffect(() => {
    const t = threads[activeId] ?? [];
    if (t.length > 0) return;

    const seedQ = "Salam! Sifarişimin statusunu bilmək istəyirəm.";
    const seedA = "Salam, Kamran! Əlbəttə 😊 Sifariş nömrənizi yazın, dərhal yoxlayım.";

    pushMsg(activeId, { id: `seed_q_${Date.now()}`, role: "user", text: seedQ, time: nowHHMM() });

    setTyping((m) => ({ ...m, [activeId]: true }));
    const timer = window.setTimeout(() => {
      setTyping((m) => ({ ...m, [activeId]: false }));
      pushMsg(activeId, { id: `seed_a_${Date.now()}`, role: "bot", text: seedA, time: nowHHMM() });
    }, 750);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /** auto Q/A loop */
  useEffect(() => {
    const userQuestions = [
      "Çatdırılma neçə günə olur?",
      "Ödəniş üsulları hansılardır?",
      "Endirim kuponu necə tətbiq edim?",
      "Qaytarma şərtləri nədir?",
      "Whatsapp-a yönləndirə bilərsiniz?",
      "Ünvanı dəyişmək istəyirəm, mümkündür?",
      "Sifarişi ləğv edə bilərəm?",
      "Məhsul stokda var?",
    ];

    const botAnswers = [
      "Aydındır. Zəhmət olmasa sifariş nömrənizi yazın, dəqiqləşdirim.",
      "Bəli, mümkündür. Yeni ünvanı yazın, sistemdə yeniləyim.",
      "Kart və nağd ödəniş mümkündür. Hansını seçirsiniz?",
      "Qaytarma 14 gün ərzində mümkündür. Qısa səbəbi də qeyd edin.",
      "Əlbəttə. Nömrənizi yazın, operatora yönləndirirəm.",
      "Sistemə baxıram — 1 dəqiqə.",
      "Kupon kodunu checkout-da ‘Promo code’ hissəsinə daxil edin.",
    ];

    let alive = true;

    const interval = window.setInterval(() => {
      if (!alive) return;

      pushMsg(activeId, {
        id: `qa_u_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        role: "user",
        text: pick(userQuestions),
        time: nowHHMM(),
      });

      setTyping((m) => ({ ...m, [activeId]: true }));
      const delay = 850 + Math.floor(Math.random() * 650);
      window.setTimeout(() => {
        if (!alive) return;
        setTyping((m) => ({ ...m, [activeId]: false }));
        pushMsg(activeId, {
          id: `qa_b_${Date.now()}_${Math.random().toString(16).slice(2)}`,
          role: "bot",
          text: pick(botAnswers),
          time: nowHHMM(),
        });
      }, delay);
    }, 5200);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, [activeId]);

  function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");

    pushMsg(activeId, { id: `u_${Date.now()}`, role: "user", text, time: nowHHMM() });

    setTyping((m) => ({ ...m, [activeId]: true }));
    window.setTimeout(() => {
      setTyping((m) => ({ ...m, [activeId]: false }));
      pushMsg(activeId, {
        id: `b_${Date.now()}`,
        role: "bot",
        text: "Aydındır. Zəhmət olmasa əlavə məlumat (sifariş nömrəsi / telefon) yazın, dərhal cavab verim.",
        time: nowHHMM(),
      });
    }, 800);
  }

  return (
    <>
      <style>{`
        /* ===== reveal ===== */
        .reveal{
          opacity:0;
          transform: translate3d(0,18px,0);
          filter: blur(10px);
          transition: opacity .75s ease, transform .75s ease, filter .75s ease;
          transition-delay: var(--d, 0ms);
          will-change: transform, opacity, filter;
        }
        .reveal.is-visible{
          opacity:1;
          transform: translate3d(0,0,0);
          filter: blur(0);
        }

        /* ===== light aurora palette ===== */
        .aurora-1{ background: radial-gradient(circle at 30% 30%, rgba(99,102,241,.35), transparent 55%); }
        .aurora-2{ background: radial-gradient(circle at 40% 40%, rgba(56,189,248,.35), transparent 55%); }
        .aurora-3{ background: radial-gradient(circle at 45% 45%, rgba(236,72,153,.18), transparent 60%); }

        .vignette-lite{
          background: radial-gradient(1200px 700px at 50% 10%, rgba(255,255,255,.70), transparent 70%),
                      radial-gradient(900px 600px at 80% 70%, rgba(255,255,255,.35), transparent 70%),
                      linear-gradient(to bottom, rgba(248,250,252,.75), rgba(238,242,255,.70));
          opacity: .95;
        }

        /* subtle grain */
        .grain-lite{
          opacity: .18;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
          mix-blend-mode: multiply;
        }

        /* ===== scrollbars ===== */
        .nice-scroll{
          scrollbar-width: thin;
          scrollbar-color: rgba(15,23,42,0.18) transparent;
        }
        .nice-scroll::-webkit-scrollbar{ width: 10px; }
        .nice-scroll::-webkit-scrollbar-track{ background: transparent; }
        .nice-scroll::-webkit-scrollbar-thumb{
          background: rgba(15,23,42,0.14);
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
        }

        /* ===== premium buttons (light) ===== */
        .btn-premium{
          position: relative;
          isolation: isolate;
          text-decoration: none !important;
          -webkit-tap-highlight-color: transparent;
          transform: translateZ(0);
        }
        .btn-premium::before{
          content:"";
          position:absolute;
          inset:-1px;
          border-radius: 14px;
          background: linear-gradient(90deg, rgba(99,102,241,.35), rgba(56,189,248,.25), rgba(236,72,153,.18));
          opacity:.0;
          transition: opacity .35s ease;
          z-index:-1;
        }
        .btn-premium::after{
          content:"";
          position:absolute;
          inset:-40% -60%;
          background: radial-gradient(closest-side, rgba(255,255,255,.70), transparent 60%);
          transform: translate3d(-30%,0,0);
          opacity: 0;
          transition: opacity .35s ease, transform .6s ease;
          z-index: 0;
          pointer-events:none;
        }
        .btn-premium:hover{
          transform: translate3d(0,-2px,0);
          box-shadow: 0 18px 55px rgba(2,6,23,.10);
        }
        .btn-premium:hover::before{ opacity:1; }
        .btn-premium:hover::after{
          opacity: 1;
          transform: translate3d(18%,0,0);
        }
        .btn-premium:active{ transform: translate3d(0,0,0); }

        .btn-ghost{
          position: relative;
          text-decoration: none !important;
          transform: translateZ(0);
        }
        .btn-ghost:hover{
          box-shadow: 0 16px 45px rgba(2,6,23,.10);
          transform: translate3d(0,-2px,0);
        }

        a, a:hover, a:focus, a:active { text-decoration: none; }

        /* ===== floating contact ===== */
        @keyframes floaty {
          0%   { transform: translate3d(0,0,0); }
          50%  { transform: translate3d(0,-10px,0); }
          100% { transform: translate3d(0,0,0); }
        }
        .floaty{
          animation: floaty 5.5s ease-in-out infinite;
          will-change: transform;
          transform: translateZ(0);
        }
        @media (prefers-reduced-motion: reduce){
          .reveal{ transition: none !important; }
          .btn-premium, .btn-ghost{ transition: none !important; }
          .floaty{ animation: none !important; }
        }
      `}</style>

      {/* HERO (light, no black) */}
      <section id="hero" className="relative isolate overflow-hidden min-h-screen pt-24 md:pt-28">
        <AuroraBackdrop />
        {/* image as soft texture */}
        <img
          src={heroImg}
          alt="AI Chatbot Hero"
          className="absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-[0.10]"
        />

        <div className="mx-auto max-w-7xl px-6 min-h-[calc(100vh-6rem)] md:min-h-[calc(100vh-7rem)] flex items-center">
          <div className="grid w-full items-center gap-10 md:gap-12 md:grid-cols-12">
            <div className="md:col-span-6">
              <div
                ref={heroPillRef}
                className="reveal inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-medium text-slate-700 backdrop-blur"
              >
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                AI Avtomatlaşdırma • 24/7 Dəstək
              </div>

              <h1
                ref={heroTitleRef}
                className="reveal mt-6 max-w-[18ch] text-4xl font-extrabold leading-[1.05] tracking-tight text-slate-900 md:text-6xl"
              >
                24/7 <span className="bg-gradient-to-r from-indigo-600 via-sky-600 to-fuchsia-600 bg-clip-text text-transparent">NEOX AI</span> ilə
                <span className="block mt-2">müştəri xidmətinizi</span>
                <span className="block mt-2">avtomatlaşdırın</span>
              </h1>

              <p ref={heroTextRef} className="reveal mt-5 max-w-xl text-base leading-relaxed text-slate-600 md:text-lg">
                Daimi dəstək, sürətli sual-cavab axını və ağıllı yönləndirmə. Operator yükü azalır, lead və satış artır.
              </p>

              <div ref={heroBtnsRef} className="reveal mt-8 flex flex-wrap items-center gap-4">
                <a
                  href="#elaqe"
                  className={cn(
                    "btn-premium inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white",
                    "shadow-[0_0_30px_rgba(99,102,241,0.20)] ring-1 ring-indigo-300/40",
                    "transition"
                  )}
                >
                  Təklif al
                </a>

                <a
                  href="#yaradici"
                  className={cn(
                    "btn-ghost inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-800",
                    "backdrop-blur transition hover:bg-white/85 hover:ring-1 hover:ring-indigo-200/60"
                  )}
                >
                  Necə işləyir?
                </a>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Pill icon={ShieldCheck} label="Təhlükəsiz ssenari" />
                <Pill icon={Layers} label="CRM / WhatsApp" />
                <Pill icon={Wand2} label="FAQ optimizasiya" />
              </div>
            </div>

            <div className="md:col-span-6">
              {/* decorative card stack */}
              <div className="relative">
                <div className="absolute -inset-6 rounded-[44px] bg-gradient-to-b from-indigo-500/10 to-sky-500/0 blur-2xl" />
                <EpoxyCard className="relative p-6 sm:p-8">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-300/35">
                        <Bot className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">NEOX AI</div>
                        <div className="text-xs text-slate-500">Sual-cavab axını • Canlı demo</div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">{nowHHMM()}</div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <div className="flex justify-start">
                      <div className="max-w-[88%] rounded-2xl bg-white/70 ring-1 ring-slate-200/70 px-4 py-3 text-sm text-slate-900">
                        <div className="text-[11px] text-slate-500 mb-1">Kamran Mehdiyev</div>
                        Salam! Bu gün endirim varmı?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[88%] rounded-2xl bg-indigo-600/10 ring-1 ring-indigo-200/70 px-4 py-3 text-sm text-slate-900">
                        <div className="text-[11px] text-slate-500 mb-1 text-right">NEOX AI</div>
                        Bəli 😊 Hansı məhsul kateqoriyasıdır? Sizə uyğun təklif deyim.
                      </div>
                    </div>
                    <div className="flex justify-start">
                      <div className="max-w-[88%] rounded-2xl bg-white/70 ring-1 ring-slate-200/70 px-4 py-3 text-sm text-slate-900">
                        <div className="text-[11px] text-slate-500 mb-1">Kamran Mehdiyev</div>
                        Çatdırılma neçə günə olur?
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="max-w-[88%] rounded-2xl bg-indigo-600/10 ring-1 ring-indigo-200/70 px-4 py-3 text-sm text-slate-900">
                        <div className="text-[11px] text-slate-500 mb-1 text-right">NEOX AI</div>
                        Bakı daxili adətən 1–2 gün. Ünvanı yazın, dəqiqləşdirim.
                      </div>
                    </div>
                  </div>
                </EpoxyCard>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/70 to-transparent" />
        <a
          href="#yaradici"
          className="btn-ghost absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-slate-200/80 bg-white/75 px-4 py-2 text-xs text-slate-700 backdrop-blur transition hover:bg-white/90"
        >
          Aşağı sürüşdür ↓
        </a>
      </section>

      {/* ✅ YARADICI SECTION (video yerine) */}
      <section id="yaradici" className="relative overflow-hidden py-16">
        <AuroraBackdrop />

        <div className="relative mx-auto max-w-7xl px-6">
          <div ref={howHeaderRef} className="reveal text-center">
            <div className="flex justify-center">
              <Pill icon={Sparkles} label="Yaradıcı axın" />
            </div>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Bot necə “premium” işləyir?
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 md:text-base">
              Video əvəzinə: vizual axın, modular ssenarilər və inteqrasiya nümunəsi — bir baxışda.
            </p>
          </div>

          <div ref={howGridRef} className="reveal mt-10 grid gap-6 md:grid-cols-3">
            <EpoxyCard className="p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-indigo-500/10 ring-1 ring-indigo-300/35">
                  <MessageCircle className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">Sual → Cavab</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Kamran sual verir (solda), NEOX AI cavablayır (sağda). Tam mesajlaşma hissiyatı.
                  </div>
                </div>
              </div>
              <div className="mt-5 rounded-2xl bg-white/60 ring-1 ring-slate-200/70 p-4 text-sm text-slate-700">
                “Sifariş statusu?” → “Sifariş nömrəsi yazın, dərhal yoxlayım.”
              </div>
            </EpoxyCard>

            <EpoxyCard className="p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-sky-500/10 ring-1 ring-sky-300/35">
                  <Cpu className="h-5 w-5 text-sky-700" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">Ssenari + FAQ</div>
                  <div className="mt-1 text-sm text-slate-600">
                    Təkrarlanan suallar avtomatik cavablanır, operatora yalnız lazım olanlar düşür.
                  </div>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-2xl bg-white/60 ring-1 ring-slate-200/70 p-3 text-slate-700">Çatdırılma</div>
                <div className="rounded-2xl bg-white/60 ring-1 ring-slate-200/70 p-3 text-slate-700">Ödəniş</div>
                <div className="rounded-2xl bg-white/60 ring-1 ring-slate-200/70 p-3 text-slate-700">Qaytarma</div>
                <div className="rounded-2xl bg-white/60 ring-1 ring-slate-200/70 p-3 text-slate-700">Endirim</div>
              </div>
            </EpoxyCard>

            <EpoxyCard className="p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-fuchsia-500/10 ring-1 ring-fuchsia-300/35">
                  <Zap className="h-5 w-5 text-fuchsia-700" />
                </div>
                <div>
                  <div className="text-base font-semibold text-slate-900">İnteqrasiya</div>
                  <div className="mt-1 text-sm text-slate-600">
                    WhatsApp/Instagram + CRM lead ötürmə. “İsti lead” dərhal yönləndirilir.
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl bg-white/60 ring-1 ring-slate-200/70 p-4 text-slate-700">
                  <span className="font-semibold text-slate-900">NEOX AI:</span> “Maraqlıdır. Telefon nömrənizi yazın — sizə zəng edək.”
                </div>
                <div className="rounded-2xl bg-indigo-600/10 ring-1 ring-indigo-200/70 p-4 text-slate-700">
                  CRM: <span className="font-semibold text-slate-900">New Lead</span> → Sales Team
                </div>
              </div>
            </EpoxyCard>
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-3 text-xs text-slate-600">
            <span className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-1">Açıq tonlu premium dizayn</span>
            <span className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-1">Sürətli cavab axını</span>
            <span className="rounded-full border border-slate-200/70 bg-white/60 px-3 py-1">Konversiya fokuslu CTA</span>
          </div>
        </div>
      </section>

      {/* DEMO + CHAT SECTION (light) */}
      <section id="faydalar" className="relative overflow-hidden py-16">
        <AuroraBackdrop />

        <div className="relative mx-auto max-w-7xl px-6">
          <div ref={headerRef} className="reveal text-center">
            <div className="flex justify-center">
              <Pill icon={Sparkles} label="Canlı demo" />
            </div>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Biznesiniz üçün <span className="text-indigo-600">AI Chatbot</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-pretty text-sm leading-relaxed text-slate-600 md:text-base">
              Kamran sual verir (solda), <span className="text-slate-900 font-semibold">NEOX AI</span> cavablayır (sağda) — tam sual-cavab formatı.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[420px_minmax(0,1fr)] items-start">
            {/* LEFT */}
            <div className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
                <div ref={l1} className="reveal">
                  <SideFeature icon={ShoppingCart} title="E-ticarət" desc="Sifariş statusu, çatdırılma, qaytarma sualları" />
                </div>
                <div ref={l2} className="reveal">
                  <SideFeature icon={Stethoscope} title="Klinika / Estetika" desc="Qəbul üçün yazılma, qiymət, həkim saatları" />
                </div>
                <div ref={l3} className="reveal">
                  <SideFeature icon={GraduationCap} title="Təhsil mərkəzi" desc="Kurs seçimi, qeydiyyat, ödəniş və cədvəl" />
                </div>
                <div ref={l4} className="reveal">
                  <SideFeature icon={HomeIcon} title="Daşınmaz əmlak" desc="Obyekt filtri, görüş təyini, lead toplama" />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-1">
                <div ref={s1} className="reveal">
                  <StatCard icon={MessageCircle} title="24/7 cavab" value="Həmişə" trend={{ direction: "up", text: "Gecə-gündüz" }} desc="Sorğular itmir, sistem daim aktivdir" />
                </div>
                <div ref={s2} className="reveal">
                  <StatCard icon={Users} title="Operator yükü" value="45%" trend={{ direction: "down", text: "Azalır" }} desc="Təkrarlanan suallar avtomatlaşır" />
                </div>
                <div ref={s3} className="reveal">
                  <StatCard icon={TrendingUp} title="Lead & satış" value="35%" trend={{ direction: "up", text: "Artır" }} desc="Maraqlı müştəri dərhal yönləndirilir" />
                </div>
              </div>
            </div>

            {/* TABLET */}
            <div ref={tabletRef} className="reveal relative">
              <div className="absolute -inset-8 rounded-[48px] bg-gradient-to-b from-indigo-500/10 to-sky-500/0 blur-2xl" />

              <div className="relative w-full">
                <div className="relative rounded-[42px] p-[10px] bg-white/60 ring-1 ring-indigo-200/45 shadow-[0_30px_110px_rgba(2,6,23,0.12)]">
                  <div className="relative rounded-[34px] border border-slate-200/70 bg-white/55 overflow-hidden">
                    <EpoxyCard className="rounded-[34px] p-5">
                      <div className="flex items-center justify-between px-1 py-1">
                        <div className="flex items-center gap-2">
                          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70">
                            <Menu className="h-5 w-5 text-slate-700" />
                          </button>
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70">
                            <Cpu className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70">
                            <Bot className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70">
                            <Zap className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div className="ml-2 hidden sm:flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-500/70" />
                            <span className="text-xs text-slate-500">Online</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-slate-600">
                          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70 hover:bg-white/90">
                            <Search className="h-5 w-5" />
                          </button>
                          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70 hover:bg-white/90">
                            <Bell className="h-5 w-5" />
                          </button>
                          <button className="grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70 hover:bg-white/90">
                            <Heart className="h-5 w-5" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 relative h-[640px] overflow-hidden rounded-[28px] border border-slate-200/70 bg-white/45">
                        {/* LEFT LIST */}
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 w-[240px] border-r border-slate-200/70 bg-white/55 transition-transform duration-300 z-20",
                            "lg:static lg:translate-x-0 lg:w-[240px]",
                            showList ? "translate-x-0" : "-translate-x-[110%] lg:translate-x-0"
                          )}
                        >
                          <div className="px-4 pt-4 flex items-center justify-between">
                            <div className="text-xs font-semibold text-slate-700">Söhbətlər</div>
                            <button
                              className="lg:hidden grid h-9 w-9 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70 hover:bg-white/90"
                              onClick={() => setShowList(false)}
                              aria-label="Close list"
                            >
                              <span className="text-slate-700 text-xs">Bağla</span>
                            </button>
                          </div>

                          <div className="px-4 mt-3">
                            <div className="rounded-2xl bg-white/70 p-2 ring-1 ring-slate-200/70">
                              <div className="flex items-center gap-2 text-sm text-slate-700">
                                <Search className="h-4 w-4" />
                                <input placeholder="Axtarış..." className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400" />
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 space-y-2 px-2 pb-4 nice-scroll overflow-y-auto h-[calc(640px-118px)]">
                            {PEOPLE.map((p) => {
                              const isActive = p.id === activeId;
                              const isHovered = hoverId === p.id;
                              const line = previewLine(p.id);

                              return (
                                <button
                                  key={p.id}
                                  onMouseEnter={() => setHoverId(p.id)}
                                  onMouseLeave={() => setHoverId(null)}
                                  onClick={() => {
                                    setActiveId(p.id);
                                    setShowList(false);
                                  }}
                                  className={cn(
                                    "w-full rounded-2xl px-3 py-3 text-left ring-1 transition",
                                    isActive
                                      ? "bg-indigo-600/10 ring-indigo-200/70"
                                      : "bg-transparent ring-transparent hover:bg-white/70 hover:ring-slate-200/70"
                                  )}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="truncate text-sm font-semibold text-slate-900">{p.name}</div>
                                      <div className="text-xs text-slate-500">{p.meta}</div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {(unread[p.id] ?? 0) > 0 ? (
                                        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-600/15 px-1 text-[11px] text-indigo-700 ring-1 ring-indigo-200/70">
                                          {unread[p.id]}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>

                                  <div className={cn("mt-2 text-xs text-slate-500", isHovered ? "text-slate-700" : "")}>{line}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {showList ? (
                          <button className="lg:hidden absolute inset-0 bg-white/40 z-10" onClick={() => setShowList(false)} aria-label="Close overlay" />
                        ) : null}

                        {/* CHAT */}
                        <div className="absolute inset-0 lg:pl-[240px] flex flex-col min-w-0">
                          <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <button
                                className="lg:hidden grid h-10 w-10 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70 hover:bg-white/90"
                                onClick={() => setShowList(true)}
                                aria-label="Open chats"
                              >
                                <Menu className="h-5 w-5 text-slate-700" />
                              </button>

                              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-600/10 ring-1 ring-indigo-200/70">
                                <MessageCircle className="h-5 w-5 text-indigo-600" />
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-slate-900">{active.name}</div>
                                <div className="text-xs text-slate-500">
                                  {active.meta} • <span className="text-slate-600">Support:</span> {BOT_NAME}
                                </div>
                              </div>
                            </div>

                            <div className="text-xs text-slate-500">{nowHHMM()}</div>
                          </div>

                          <div className="flex-1 min-h-0 overflow-hidden">
                            <div ref={chatRef} className="nice-scroll h-full overflow-y-auto px-6 py-6 space-y-5">
                              {(threads[activeId] ?? []).length === 0 ? (
                                <div className="grid place-items-center h-full">
                                  <div className="text-center">
                                    <div className="text-slate-900 font-semibold">Söhbət başlayır…</div>
                                    <div className="mt-1 text-sm text-slate-600">Bir neçə saniyəyə sual-cavab başlayacaq.</div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {(threads[activeId] ?? []).map((m) => (
                                    <ChatBubble key={m.id} role={m.role} text={m.text} time={m.time} userName={active.name} />
                                  ))}
                                  {typing[activeId] ? <TypingIndicator /> : null}
                                </>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-slate-200/70 p-4">
                            <div className="flex items-center gap-2 rounded-2xl bg-white/70 p-2 ring-1 ring-slate-200/70">
                              <input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") send();
                                }}
                                placeholder="Kamran sualını yazır..."
                                className="w-full bg-transparent px-3 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                              />
                              <button
                                onClick={send}
                                className="grid h-12 w-12 place-items-center rounded-xl bg-indigo-600/10 ring-1 ring-indigo-200/70 hover:bg-indigo-600/15"
                                aria-label="Send"
                              >
                                <Send className="h-5 w-5 text-indigo-700" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="pointer-events-none absolute inset-x-8 -bottom-7 h-16 rounded-full bg-indigo-500/10 blur-2xl" />
                    </EpoxyCard>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA mini strip */}
          <div className="mt-12 flex flex-col items-center gap-4 text-center">
            <div className="text-slate-600 text-sm">İstəsəniz demo ssenarisini sizin biznesinizə uyğunlaşdırırıq.</div>
            <a
              href="#elaqe"
              className="btn-premium inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white ring-1 ring-indigo-300/40 transition hover:bg-indigo-700"
            >
              Pulsuz konsultasiya al
            </a>
          </div>
        </div>
      </section>

      {/* FINAL (light overlay, no black) */}
      <section
        id="final"
        className="relative overflow-hidden py-16"
        style={{
          backgroundImage: `url(${finalImg})`,
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left center",
        }}
      >
        <div className="absolute inset-0">
          <AuroraBackdrop />
          <div className="absolute inset-0 bg-gradient-to-r from-white/55 via-white/70 to-white/90" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid items-center gap-10 lg:grid-cols-12">
            <div className="hidden lg:block lg:col-span-6" />

            <div ref={finalRef} className="reveal lg:col-span-6">
              <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur-xl ring-1 ring-indigo-200/35 shadow-[0_28px_110px_rgba(2,6,23,0.12)]">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.70),transparent_55%)]" />
                <div className="relative p-6 sm:p-10">
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-medium text-slate-700">
                    <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    Yekun
                  </div>

                  <h3 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
                    Hazırsınız? <span className="text-indigo-600">NEOX AI</span> ilə avtomatlaşdırın
                  </h3>

                  <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                    Sizə uyğun ssenari, dizayn və inteqrasiya ilə botu quraq. Operator yükü düşsün, cavab sürətlənsin, satış yönləndirməsi artsın.
                  </p>

                  <div className="mt-7 flex flex-wrap gap-3">
                    <a
                      href="#elaqe"
                      className="btn-premium inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white ring-1 ring-indigo-300/40 transition hover:bg-indigo-700"
                    >
                      Təklif al
                    </a>
                    <a
                      href="#yaradici"
                      className="btn-ghost inline-flex items-center justify-center rounded-xl border border-slate-200/80 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-800 transition hover:bg-white/90"
                    >
                      Necə işləyir?
                    </a>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none mt-6 h-10 rounded-full bg-indigo-500/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT (light) */}
      <section id="elaqe" className="relative overflow-hidden py-20">
        <AuroraBackdrop />

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="grid gap-10 lg:grid-cols-12 items-start">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/70 px-4 py-2 text-xs font-medium text-slate-700">
                <span className="h-2 w-2 rounded-full bg-indigo-500" />
                Əlaqə
              </div>
              <h3 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                15 dəqiqəlik <span className="text-indigo-600">pulsuz</span> zəng planlayaq
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                Qısa brif alın: hansı kanallar, hansı ssenarilər, hansı inteqrasiya — və real plan + qiymət təklifi.
              </p>

              <div className="mt-6 space-y-3 text-sm text-slate-600">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70">
                    <Phone className="h-4 w-4 text-indigo-700" />
                  </span>
                  <span>+994 XX XXX XX XX</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70">
                    <Mail className="h-4 w-4 text-indigo-700" />
                  </span>
                  <span>info@yourdomain.az</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/70 ring-1 ring-slate-200/70">
                    <MapPin className="h-4 w-4 text-indigo-700" />
                  </span>
                  <span>Bakı, Azərbaycan</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="floaty relative">
                <div className="absolute -inset-8 rounded-[44px] bg-gradient-to-b from-indigo-500/10 to-sky-500/0 blur-2xl" />
                <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 backdrop-blur-xl ring-1 ring-indigo-200/35 shadow-[0_28px_110px_rgba(2,6,23,0.12)]">
                  <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.70),transparent_55%)]" />
                  <div className="relative p-6 sm:p-8">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-slate-500">Ad</label>
                        <input
                          className="mt-2 w-full rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200/70 focus:ring-indigo-200/70"
                          placeholder="Adınız"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500">Telefon</label>
                        <input
                          className="mt-2 w-full rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200/70 focus:ring-indigo-200/70"
                          placeholder="+994..."
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-slate-500">Qısa mesaj</label>
                        <textarea
                          className="mt-2 w-full min-h-[110px] resize-none rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200/70 focus:ring-indigo-200/70"
                          placeholder="Biznesiniz + istəyiniz (kanal/inteqrasiya və s.)"
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-500">Göndərdikdən sonra 30 dəqiqə içində geri dönüş.</div>
                      <button
                        className="btn-premium inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white ring-1 ring-indigo-300/40 transition hover:bg-indigo-700"
                        type="button"
                      >
                        Göndər
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pointer-events-none mt-8 h-10 rounded-full bg-indigo-500/10 blur-2xl" />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
