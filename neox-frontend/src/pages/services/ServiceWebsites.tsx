"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/** ===========================
 *  ✅ Parallax hook (background yavaş hərəkət edir)
 * =========================== */
function useParallaxY(targetRef: React.RefObject<HTMLElement>, strength = 70) {
  const [y, setY] = useState(0);

  useEffect(() => {
    let raf = 0;

    const update = () => {
      raf = 0;
      const el = targetRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;

      // progress: section viewport-a girəndən çıxana qədər 0..1
      const start = vh; // rect.top = vh -> yeni görünür
      const end = -rect.height; // rect.top = -height -> tam çıxır
      const p = clamp01((start - rect.top) / (start - end));

      // -strength .. +strength
      setY((p * 2 - 1) * strength);
    };

    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetRef, strength]);

  return y;
}

/** ===========================
 *  ASSETS
 * =========================== */
const HERO_BG_VIDEO =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1770678248/neox/media/asset_1770678235050_bcbf2f1916183.mp4";

const V1 =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1771035162/264826_small_a88std.mp4";
const V2 =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1771035155/13247539_1920_1080_25fps_uf09p4.mp4";
const V3 =
  "https://res.cloudinary.com/dppoomunj/video/upload/v1771035260/264837_small_j8mzd1.mp4";

const I1 =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771035267/geralt-technology-3402365_1280_dulxna.jpg";
const I2 =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771035333/mohammad_usman-artificial-8264664_1920_cfyprg.jpg";
const I3 =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771035458/alexandra_koch-ai-7977960_1920_ygptmh.jpg";

const CONTACT_BG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771038435/Untitled_design_4_zpcqjf.png";

/** ===========================
 *  Play video only when in view
 * =========================== */
function usePlayWhenInView<T extends HTMLVideoElement>(opts?: {
  rootMargin?: string;
  threshold?: number | number[];
}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        const visible = !!e?.isIntersecting && (e.intersectionRatio ?? 0) > 0;
        setInView(visible);

        if (!visible) {
          try {
            el.pause();
          } catch {}
          return;
        }
        el.play().catch(() => {});
      },
      {
        root: null,
        rootMargin: opts?.rootMargin ?? "-15% 0px -25% 0px",
        threshold: opts?.threshold ?? [0.15, 0.25, 0.35, 0.5],
      }
    );

    io.observe(el);

    const onVis = () => {
      if (document.hidden) {
        try {
          el.pause();
        } catch {}
      } else {
        if (inView) el.play().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [inView, opts?.rootMargin, opts?.threshold]);

  return { ref };
}

/** ===========================
 *  Reveal timing
 * =========================== */
function useRevealOnView(durationMs = 4500, io?: IntersectionObserverInit) {
  const ref = useRef<HTMLElement | null>(null);
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let t: any = null;

    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e?.isIntersecting) return;

        setReveal(true);
        if (t) clearTimeout(t);
        t = setTimeout(() => setReveal(false), durationMs);
      },
      {
        root: io?.root ?? null,
        rootMargin: io?.rootMargin ?? "-10% 0px -35% 0px",
        threshold: io?.threshold ?? [0.15, 0.25, 0.35],
      }
    );

    obs.observe(el);
    return () => {
      if (t) clearTimeout(t);
      obs.disconnect();
    };
  }, [durationMs, io?.root, io?.rootMargin, JSON.stringify(io?.threshold)]);

  return { ref, reveal };
}

/** ===========================
 *  BG layers
 * =========================== */
function BgImage({
  src,
  reveal,
  overlay = true,
  objectPosition = "center",
  opacityBase = 1,
  opacityReveal = 1,
}: {
  src: string;
  reveal?: boolean;
  overlay?: boolean;
  objectPosition?: string;
  opacityBase?: number;
  opacityReveal?: number;
}) {
  return (
    <div className="absolute inset-0 -z-10 pointer-events-none">
      <img
        src={src}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-[opacity] duration-[900ms] ease-out"
        style={{
          objectPosition,
          opacity: reveal ? opacityReveal : opacityBase,
        }}
      />
      {overlay ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/22 to-black/70" />
          <div className="absolute inset-0 bg-[radial-gradient(950px_520px_at_18%_25%,rgba(167,139,250,.12),transparent_62%),radial-gradient(900px_520px_at_75%_30%,rgba(119,242,227,.10),transparent_62%)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.6)_1px,transparent_0)] [background-size:22px_22px]" />
        </>
      ) : null}
    </div>
  );
}

/** ✅ Parallax BG Image (PROSES üçün) */
function ParallaxBgImage({
  src,
  targetRef,
  reveal,
  overlay = true,
  objectPosition = "center",
  opacityBase = 1,
  opacityReveal = 1,
  strength = 70,
}: {
  src: string;
  targetRef: React.RefObject<HTMLElement>;
  reveal?: boolean;
  overlay?: boolean;
  objectPosition?: string;
  opacityBase?: number;
  opacityReveal?: number;
  strength?: number;
}) {
  const y = useParallaxY(targetRef, strength);

  return (
    <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
      <img
        src={src}
        alt=""
        loading="lazy"
        className="absolute inset-0 w-full object-cover transition-[opacity,transform] duration-[900ms] ease-out"
        style={{
          height: "115%",
          objectPosition,
          opacity: reveal ? opacityReveal : opacityBase,
          transform: `translate3d(0, ${y}px, 0)`,
          willChange: "transform",
        }}
      />
      {overlay ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/22 to-black/70" />
          <div className="absolute inset-0 bg-[radial-gradient(950px_520px_at_18%_25%,rgba(167,139,250,.12),transparent_62%),radial-gradient(900px_520px_at_75%_30%,rgba(119,242,227,.10),transparent_62%)]" />
          <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.6)_1px,transparent_0)] [background-size:22px_22px]" />
        </>
      ) : null}
    </div>
  );
}

function BgVideo({ src, reveal }: { src: string; reveal?: boolean }) {
  const reduceMotion = useReducedMotion();
  const { ref } = usePlayWhenInView<HTMLVideoElement>({
    rootMargin: "-10% 0px -30% 0px",
    threshold: [0.2, 0.35, 0.5],
  });

  return (
    <div className="absolute inset-0 -z-10 pointer-events-none">
      <video
        ref={ref}
        className="absolute inset-0 h-full w-full object-cover scale-[1.02] transition-[opacity] duration-[900ms] ease-out"
        style={{ opacity: reveal ? 0.92 : 0.84 }}
        src={src}
        muted
        playsInline
        preload="metadata"
        autoPlay={!reduceMotion}
        loop={false}
        onEnded={() => {
          try {
            ref.current?.pause();
          } catch {}
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-black/26 to-black/70" />
      <div className="absolute inset-0 bg-[radial-gradient(950px_520px_at_18%_25%,rgba(167,139,250,.12),transparent_62%),radial-gradient(900px_520px_at_75%_30%,rgba(119,242,227,.10),transparent_62%)]" />
      <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,.6)_1px,transparent_0)] [background-size:22px_22px]" />
    </div>
  );
}

/** ===========================
 *  UI atoms
 * =========================== */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/18 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#77F2E3] to-[#A78BFA]" />
      {children}
    </span>
  );
}

function Btn({
  href,
  variant = "primary",
  children,
}: {
  href: string;
  variant?: "primary" | "ghost";
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={cn(
        "group relative inline-flex items-center justify-between gap-4",
        "rounded-xl px-4 py-2.5 text-[13px] font-extrabold",
        "min-w-[160px] sm:min-w-[168px]",
        "transition will-change-transform focus:outline-none focus:ring-4 focus:ring-white/[0.14]",
        "active:translate-y-0",
        variant === "primary"
          ? cn(
              "text-[#061821]",
              "bg-[linear-gradient(180deg,rgba(120,235,255,.96),rgba(45,186,255,.92))]",
              "shadow-[0_0_40px_rgba(120,235,255,.22),0_18px_70px_rgba(0,0,0,.35)]",
              "hover:-translate-y-0.5 hover:shadow-[0_0_70px_rgba(120,235,255,.40),0_22px_90px_rgba(0,0,0,.40)]"
            )
          : cn(
              "text-white",
              "border border-white/22 bg-white/[0.06] backdrop-blur-md",
              "shadow-[0_16px_70px_rgba(0,0,0,.35)]",
              "hover:-translate-y-0.5 hover:bg-white/[0.10]"
            )
      )}
    >
      <span
        className={cn(
          "relative",
          "after:absolute after:left-0 after:-bottom-1 after:h-px after:w-0 after:transition-all after:duration-200",
          variant === "primary"
            ? "after:bg-black/40 group-hover:after:w-full"
            : "after:bg-white/70 group-hover:after:w-full"
        )}
      >
        {children}
      </span>

      <span className="opacity-90 transition group-hover:translate-x-0.5 group-hover:opacity-100">
        →
      </span>

      <span
        className={cn(
          "pointer-events-none absolute -inset-[10px] -z-10 rounded-[18px] opacity-0 blur-xl transition-opacity",
          "group-hover:opacity-100",
          variant === "primary"
            ? "bg-[radial-gradient(60%_70%_at_30%_40%,rgba(120,235,255,.55),transparent_70%)]"
            : "bg-[radial-gradient(60%_70%_at_30%_40%,rgba(120,235,255,.28),transparent_70%)]"
        )}
      />
    </a>
  );
}

function GlassCard({
  children,
  className,
  glow = true,
}: {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[28px] border border-white/16 bg-white/[0.06] backdrop-blur-md",
        "shadow-[0_28px_110px_rgba(0,0,0,.55)]",
        "transition will-change-transform hover:-translate-y-1",
        className
      )}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[28px] [mask:linear-gradient(#000,transparent_58%)]">
        <div className="absolute inset-0 opacity-80 [background:linear-gradient(135deg,rgba(120,235,255,.55),rgba(167,139,250,.20),transparent_70%)]" />
      </div>

      {glow ? (
        <div className="pointer-events-none absolute -inset-10 opacity-0 blur-2xl transition-opacity group-hover:opacity-100">
          <div className="h-full w-full bg-[radial-gradient(60%_55%_at_20%_20%,rgba(120,235,255,.35),transparent_60%),radial-gradient(60%_55%_at_80%_10%,rgba(167,139,250,.25),transparent_60%)]" />
        </div>
      ) : null}

      {children}
    </div>
  );
}

function StatBullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm text-white/75">
      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#77F2E3]" />
      <span>{children}</span>
    </div>
  );
}

function TextField({
  label,
  placeholder,
  required,
  type = "text",
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-xs font-extrabold text-white/70">
        {label} {required ? <span className="text-white/40">*</span> : null}
      </div>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-12 w-full rounded-2xl border border-white/20",
          "bg-white/[0.03] backdrop-blur-[1.5px]",
          "px-4 text-sm text-white placeholder:text-white/35 outline-none transition",
          "focus:border-white/40 focus:ring-4 focus:ring-white/[0.12]"
        )}
      />
    </label>
  );
}

function TextAreaField({
  label,
  placeholder,
  required,
  value,
  onChange,
  max = 500,
}: {
  label: string;
  placeholder: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  max?: number;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between gap-3 text-xs font-extrabold text-white/70">
        <span>
          {label} {required ? <span className="text-white/40">*</span> : null}
        </span>
        <span className="font-semibold text-white/40">
          {Math.min(value.length, max)}/{max}
        </span>
      </div>
      <textarea
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, max))}
        placeholder={placeholder}
        className={cn(
          "min-h-[180px] w-full resize-none rounded-2xl border border-white/20",
          "bg-white/[0.03] backdrop-blur-[1.5px]",
          "px-4 py-3 text-sm text-white placeholder:text-white/35 outline-none transition leading-relaxed",
          "focus:border-white/40 focus:ring-4 focus:ring-white/[0.12]"
        )}
      />
    </label>
  );
}

/** ===========================
 *  LEFT RAIL
 * =========================== */
function LeftRail({
  sectionIds,
  active,
  onGo,
  progress,
}: {
  sectionIds: string[];
  active: string;
  onGo: (id: string) => void;
  progress: number;
}) {
  const [open, setOpen] = useState(false);

  const label = (id: string) =>
    id === "hero"
      ? "Giriş"
      : id === "services"
      ? "Servislər"
      : id === "packages"
      ? "Paketlər"
      : id === "process"
      ? "Proses"
      : id === "quality"
      ? "Keyfiyyət"
      : id === "reel"
      ? "Nümunə"
      : "Əlaqə";

  const icon = (id: string) =>
    id === "hero"
      ? "⌂"
      : id === "services"
      ? "⌁"
      : id === "packages"
      ? "▦"
      : id === "process"
      ? "⇢"
      : id === "quality"
      ? "✦"
      : id === "reel"
      ? "▶"
      : "✉";

  return (
    <div
      className="fixed top-1/2 z-50 hidden -translate-y-1/2 lg:block"
      style={{ left: "18px" }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[30px] border border-white/14",
          "bg-black/40 shadow-[0_30px_120px_rgba(0,0,0,.62)] backdrop-blur-xl",
          "transition-[width] duration-200",
          open ? "w-[228px]" : "w-[78px]"
        )}
      >
        <div className="pointer-events-none absolute left-0 top-0 h-full w-full">
          <div className="absolute left-0 top-0 h-full w-[2px] bg-white/10" />
          <div
            className="absolute left-0 top-0 w-[2px] bg-[linear-gradient(180deg,rgba(120,235,255,.9),rgba(167,139,250,.6))]"
            style={{ height: `${progress * 100}%` }}
          />
        </div>

        <div className="p-3">
          <div className="grid gap-2">
            {sectionIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onGo(id)}
                className={cn(
                  "relative flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-xs font-semibold transition",
                  "focus:outline-none focus:ring-4 focus:ring-white/[0.12]",
                  active === id
                    ? "bg-white text-black shadow-[0_10px_30px_rgba(0,0,0,.35)]"
                    : "text-white/80 hover:bg-white/[0.08] hover:text-white"
                )}
                aria-label={label(id)}
                title={label(id)}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-2xl border transition",
                    active === id
                      ? "border-black/10 bg-black/5 text-black"
                      : "border-white/14 bg-white/[0.06] text-white"
                  )}
                >
                  <span className="text-[14px] leading-none">{icon(id)}</span>
                </span>

                <span
                  className={cn(
                    "whitespace-nowrap transition-opacity duration-200",
                    open ? "opacity-100" : "opacity-0"
                  )}
                >
                  {label(id)}
                </span>

                {active === id ? (
                  <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-black/70" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** ===========================
 *  ✅ Process steps (sağ bloklar)
 * =========================== */
const PROCESS_STEPS = [
  {
    no: "01",
    title: "Mesaj",
    text: "Kim üçünsən və nə verirsən — bir baxışda. Başlıq, subtext, prioritet fayda.",
  },
  {
    no: "02",
    title: "Etibar",
    text: "Proof: rəqəmlər, case, müştəri feedback, iş nümunəsi. “Niyə sən?” sualına cavab.",
  },
  {
    no: "03",
    title: "Offer",
    text: "Nə alır, neçə günə, necə başlayırıq — konkret. Qarışıqlıq yox, qərar rahatlığı.",
  },
  {
    no: "04",
    title: "CTA",
    text: "WhatsApp/email/form — yol itmir. Mobil-first CTA və “next step” aydın olur.",
  },
] as const;

/** ===========================
 *  MAIN
 * =========================== */
export default function ServiceWebsites() {
  const reduceMotion = useReducedMotion();

  const sectionIds = useMemo(
    () => ["hero", "services", "packages", "process", "quality", "reel", "contact"],
    []
  );

  const [active, setActive] = useState(sectionIds[0]);

  useEffect(() => {
    const els = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0))[0];
        if (best?.target?.id) setActive(best.target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0.08, 0.15, 0.22, 0.35] }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sectionIds]);

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const h = doc.scrollHeight - doc.clientHeight;
      setProgress(h > 0 ? clamp01(doc.scrollTop / h) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const servicesReveal = useRevealOnView(4500);
  const packagesReveal = useRevealOnView(4500);
  const processReveal = useRevealOnView(4500);
  const qualityReveal = useRevealOnView(4500);
  const reelReveal = useRevealOnView(4500);
  const contactReveal = useRevealOnView(6500);

  // HERO video
  const { ref: heroRef } = usePlayWhenInView<HTMLVideoElement>({
    rootMargin: "0px 0px -30% 0px",
    threshold: [0.25, 0.35, 0.5],
  });

  const [heroReady, setHeroReady] = useState(false);
  const [heroText, setHeroText] = useState(false);

  useEffect(() => {
    if (!heroReady) return;
    if (reduceMotion) {
      setHeroText(true);
      return;
    }
    const t = setTimeout(() => setHeroText(true), 650);
    return () => clearTimeout(t);
  }, [heroReady, reduceMotion]);

  // Reel video
  const { ref: reelVideoRef } = usePlayWhenInView<HTMLVideoElement>({
    rootMargin: "-10% 0px -25% 0px",
    threshold: [0.2, 0.35, 0.5],
  });

  // Contact form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  /** ===========================
   *  ✅ PROCESS: sequential reveal + sticky left + parallax bg
   * =========================== */
  const processSectionRef = useRef<HTMLElement | null>(null);

  // “İlk düşəndə 1 blok görünsün”
  const [visibleCount, setVisibleCount] = useState(1);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const rootEl = processSectionRef.current;
    if (!rootEl) return;

    // Section görünəndə reset (yenidən girəndə yenə 1 blokdan başlasın)
    let didReset = false;

    const resetIO = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e?.isIntersecting && !didReset) {
          didReset = true;
          setVisibleCount(1);
        }
      },
      { root: null, threshold: 0.12, rootMargin: "-10% 0px -70% 0px" }
    );

    resetIO.observe(rootEl);

    // Kartlar “görünəndə” növbəti açılır
    const cardIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const idx = Number((en.target as HTMLElement).dataset["idx"] ?? "0");
          setVisibleCount((c) => Math.max(c, idx + 1));
        });
      },
      {
        root: null,
        threshold: 0.25,
        // kart ekranın ortasına yaxın olanda trigger etsin:
        rootMargin: "-20% 0px -45% 0px",
      }
    );

    stepRefs.current.forEach((el) => {
      if (el) cardIO.observe(el);
    });

    return () => {
      resetIO.disconnect();
      cardIO.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <LeftRail sectionIds={sectionIds} active={active} onGo={scrollTo} progress={progress} />

      {/* HERO */}
      <section id="hero" className="relative min-h-[100svh] overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{
            opacity: heroReady ? 1 : 0,
            scale: heroReady ? 1 : 1.04,
            filter: heroText ? "blur(10px) brightness(.66) saturate(1.05)" : "none",
          }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.0, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <video
            ref={heroRef}
            className="h-full w-full object-cover"
            src={HERO_BG_VIDEO}
            autoPlay={!reduceMotion}
            muted
            playsInline
            preload="metadata"
            loop={false}
            onLoadedData={() => setHeroReady(true)}
            onEnded={() => {
              try {
                heroRef.current?.pause();
              } catch {}
              setHeroText(true);
            }}
          />
        </motion.div>

        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/18 to-black/78" />
        <div className="absolute inset-0 bg-[radial-gradient(900px_520px_at_22%_25%,rgba(167,139,250,.10),transparent_62%),radial-gradient(900px_520px_at_70%_30%,rgba(119,242,227,.09),transparent_62%)]" />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl items-center px-4 pb-16 pt-10">
          <motion.div
            initial={{ opacity: 0, y: -16, filter: "blur(10px)" }}
            animate={
              heroText
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : { opacity: 0, y: -16, filter: "blur(10px)" }
            }
            transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: "easeOut" }}
            className="max-w-3xl"
          >
            <Pill>Premium veb sayt • sürət • UI/UX • SEO baza</Pill>

            <h1 className="mt-6 text-balance text-5xl font-black leading-[1.01] tracking-tight sm:text-6xl">
              Veb saytın{" "}
              <span className="underline decoration-white/30 decoration-4 underline-offset-8">
                müraciət gətirsin
              </span>
              .
            </h1>

            <p className="mt-5 max-w-xl text-pretty text-base text-white/80">
              Dizayn tək “gözəl” olmur — satış axını qurur. Mesajı aydın edirik, etibarı yığırıq,
              CTA-nı optimallaşdırırıq.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="#contact" variant="primary">
                Brief göndər
              </Btn>
              <Btn href="#reel" variant="ghost">
                Nümunələrə bax
              </Btn>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/14 bg-white/[0.05] p-4 backdrop-blur">
                <div className="text-xs font-extrabold text-white/65">Fokus</div>
                <div className="mt-1 text-sm font-bold">Müraciət & satış</div>
              </div>
              <div className="rounded-2xl border border-white/14 bg-white/[0.05] p-4 backdrop-blur">
                <div className="text-xs font-extrabold text-white/65">Performans</div>
                <div className="mt-1 text-sm font-bold">Sürətli yüklənmə</div>
              </div>
              <div className="rounded-2xl border border-white/14 bg-white/[0.05] p-4 backdrop-blur">
                <div className="text-xs font-extrabold text-white/65">Struktur</div>
                <div className="mt-1 text-sm font-bold">SEO baza</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SERVICES */}
      <section
        id="services"
        ref={servicesReveal.ref as any}
        className="relative isolate min-h-[100svh] overflow-hidden"
      >
        <BgImage src={I1} reveal={servicesReveal.reveal} />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-3xl">
            <Pill>Servislər</Pill>
            <h2 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
              Biz “gözəl” yox, <span className="text-white">işləyən</span> sayt yığırıq.
            </h2>
            <p className="mt-4 max-w-[62ch] text-sm text-white/75 sm:text-base">
              İstifadəçi 10 saniyədə başa düşməlidir: nə edirsiniz, kim üçünsünüz və necə əlaqə saxlayır.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <GlassCard>
              <div className="p-7">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black">Landing Page</div>
                  <span className="rounded-full border border-white/16 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/80">
                    1 səhifə
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <StatBullet>Bir offer üçün ideal: başlıq → proof → CTA.</StatBullet>
                  <StatBullet>WhatsApp / form / email axını.</StatBullet>
                  <StatBullet>Premium hiss + sürət optimizasiyası.</StatBullet>
                </div>
                <div className="mt-6">
                  <Btn href="#packages" variant="ghost">
                    Paketlərə bax
                  </Btn>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="p-7">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black">Business Website</div>
                  <span className="rounded-full border border-white/16 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/80">
                    çox bölmə
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <StatBullet>Servis, portfel, FAQ, əlaqə, “about”.</StatBullet>
                  <StatBullet>Brand hissi, tipografiya, ritm.</StatBullet>
                  <StatBullet>Struktur: satış üçün aydın naviqasiya.</StatBullet>
                </div>
                <div className="mt-6">
                  <Btn href="#contact" variant="ghost">
                    Brief göndər
                  </Btn>
                </div>
              </div>
            </GlassCard>

            <GlassCard>
              <div className="p-7">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-black">Redesign + Performance</div>
                  <span className="rounded-full border border-white/16 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/80">
                    upgrade
                  </span>
                </div>
                <div className="mt-3 space-y-2">
                  <StatBullet>Mövcud saytı premium edirik: UI/UX + copy.</StatBullet>
                  <StatBullet>Mobil ritm + sürət + texniki təmizlik.</StatBullet>
                  <StatBullet>SEO baza: semantik struktur + meta/OG.</StatBullet>
                </div>
                <div className="mt-6">
                  <Btn href="#contact" variant="ghost">
                    Yoxlama istəyirəm
                  </Btn>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* PACKAGES */}
      <section
        id="packages"
        ref={packagesReveal.ref as any}
        className="relative isolate min-h-[100svh] overflow-hidden"
      >
        <BgVideo src={V3} reveal={packagesReveal.reveal} />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-3xl">
            <Pill>Paketlər</Pill>
            <h2 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
              01 / 02 / 03 — məqsədinə uyğun seç.
            </h2>
            <p className="mt-4 max-w-[62ch] text-sm text-white/75 sm:text-base">
              Hamısında ortaq: premium dizayn hissi, sürətli yüklənmə və müraciəti “itirməyən” CTA flow.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <GlassCard className="group">
              <div className="p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[58px] font-black leading-none text-white/90">01</div>
                    <div className="mt-2 text-xl font-black">Starter Landing</div>
                    <div className="mt-1 text-sm text-white/70">1 səhifə • 1 offer • CTA flow</div>
                  </div>
                  <span className="rounded-full border border-white/16 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/80">
                    Başlanğıc
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <StatBullet>Premium hero + güclü başlıq (copy).</StatBullet>
                  <StatBullet>WhatsApp / form / email inteqrasiyası.</StatBullet>
                  <StatBullet>Basic SEO + sürət optimizasiyası.</StatBullet>
                  <StatBullet>Təqdim: 3–6 gün.</StatBullet>
                </div>

                <div className="mt-6 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-white/55">Qiymət</div>
                    <div className="mt-1 text-3xl font-black">499₼</div>
                  </div>
                  <Btn href="#contact" variant="primary">
                    Paketi seç
                  </Btn>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="group">
              <div className="p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[58px] font-black leading-none text-white/90">02</div>
                    <div className="mt-2 text-xl font-black">Business Site</div>
                    <div className="mt-1 text-sm text-white/70">
                      servis • proof • FAQ • əlaqə • satış strukturu
                    </div>
                  </div>
                  <span className="rounded-full border border-white/16 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/80">
                    Ən seçilən
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <StatBullet>5–7 səhifə: servis, portfel, FAQ, əlaqə.</StatBullet>
                  <StatBullet>Content strukturu + UX yazıları.</StatBullet>
                  <StatBullet>Basic SEO + performans optimizasiyası.</StatBullet>
                  <StatBullet>Təqdim: 7–12 gün.</StatBullet>
                </div>

                <div className="mt-6 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-white/55">Qiymət</div>
                    <div className="mt-1 text-3xl font-black">999₼</div>
                  </div>
                  <Btn href="#contact" variant="primary">
                    Paketi seç
                  </Btn>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="group">
              <div className="p-7">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[58px] font-black leading-none text-white/90">03</div>
                    <div className="mt-2 text-xl font-black">Pro + SEO Base</div>
                    <div className="mt-1 text-sm text-white/70">
                      korporativ • semantik struktur • optimizasiya
                    </div>
                  </div>
                  <span className="rounded-full border border-white/16 bg-white/[0.06] px-3 py-1 text-xs font-bold text-white/80">
                    Popular
                  </span>
                </div>

                <div className="mt-5 space-y-2">
                  <StatBullet>8–12 səhifə + blog / case study (opsional).</StatBullet>
                  <StatBullet>Semantik SEO struktur + meta/OG.</StatBullet>
                  <StatBullet>Mobil + sürət + keyfiyyət optimizasiyası.</StatBullet>
                  <StatBullet>Təqdim: 14–21 gün.</StatBullet>
                </div>

                <div className="mt-6 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs font-extrabold text-white/55">Qiymət</div>
                    <div className="mt-1 text-3xl font-black">Custom</div>
                  </div>
                  <Btn href="#contact" variant="primary">
                    Danışaq
                  </Btn>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* ✅ PROCESS — parallax bg + sequential blocks + sticky left */}
      <section
        id="process"
        ref={(node) => {
          (processReveal.ref as any).current = node;
          processSectionRef.current = node;
        }}
        className="relative isolate min-h-[100svh] overflow-hidden"
      >
        <ParallaxBgImage
          src={I2}
          targetRef={processSectionRef}
          reveal={processReveal.reveal}
          strength={75} // background yavaşlığı: 50-110 arası test et
        />

        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
            {/* ✅ Left: sticky — sağ bloklarla yanaşı gedir, sonda dayanır */}
            <div className="lg:sticky lg:top-8 lg:h-fit">
              <Pill>Proses</Pill>
              <h2 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
                Qısa, aydın, nəticəli.
              </h2>
              <p className="mt-4 max-w-[60ch] text-sm text-white/75 sm:text-base">
                Hər bölmənin məqsədi var: mesaj → etibar → offer → CTA. Panel yığını yox, conversion flow.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Btn href="#contact" variant="primary">
                  Brief göndər
                </Btn>
                <Btn href="#reel" variant="ghost">
                  Nümunə
                </Btn>
              </div>

              {/* kiçik status */}
              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/[0.05] px-3 py-1 text-xs font-bold text-white/70 backdrop-blur">
                Açılan addım: <span className="text-white">{Math.min(visibleCount, PROCESS_STEPS.length)}/{PROCESS_STEPS.length}</span>
              </div>
            </div>

            {/* ✅ Right: blocks sequential reveal */}
            <div className="grid gap-6">
              {PROCESS_STEPS.map((s, idx) => {
                const isVisible = idx < visibleCount;

                return (
                  <div
                    key={s.no}
                    ref={(el) => {
                      stepRefs.current[idx] = el;
                    }}
                    data-idx={idx}
                  >
                    <motion.div
                      initial={false}
                      animate={
                        reduceMotion
                          ? { opacity: isVisible ? 1 : 0, y: 0, filter: "blur(0px)" }
                          : {
                              opacity: isVisible ? 1 : 0,
                              y: isVisible ? 0 : 18,
                              filter: isVisible ? "blur(0px)" : "blur(10px)",
                            }
                      }
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.55, ease: "easeOut" }}
                      style={{
                        pointerEvents: isVisible ? "auto" : "none",
                      }}
                    >
                      <GlassCard glow={false}>
                        <div className="p-7">
                          <div className="text-[44px] font-black leading-none text-white/90">
                            {s.no}
                          </div>
                          <div className="mt-2 text-lg font-black">{s.title}</div>
                          <div className="mt-2 text-sm text-white/75">{s.text}</div>
                        </div>
                      </GlassCard>
                    </motion.div>

                    {/* ✅ Space remains even when hidden (so scroll can reach next) */}
                    {!isVisible ? (
                      <div className="mt-0 h-0" aria-hidden="true" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* QUALITY */}
      <section
        id="quality"
        ref={qualityReveal.ref as any}
        className="relative isolate min-h-[100svh] overflow-hidden"
      >
        <BgVideo src={V2} reveal={qualityReveal.reveal} />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-3xl">
            <Pill>Keyfiyyət</Pill>
            <h2 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
              Premium hiss — sistemdən gəlir.
            </h2>
            <p className="mt-4 max-w-[62ch] text-sm text-white/75 sm:text-base">
              Tipografiya, spacing, kontrast, mobil ritm. Az söz — çox təsir. Texniki tərəf də təmiz.
            </p>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-3">
            <GlassCard glow={false}>
              <div className="p-7">
                <div className="text-lg font-black">Mobil-first</div>
                <div className="mt-2 text-sm text-white/75">
                  Əsas ekran telefondur. Premium görünüş birinci mobilə görə qurulur.
                </div>
                <div className="mt-6 h-px w-16 bg-white/20" />
              </div>
            </GlassCard>

            <GlassCard glow={false}>
              <div className="p-7">
                <div className="text-lg font-black">Speed</div>
                <div className="mt-2 text-sm text-white/75">
                  Yüngül asset, optimizasiya, lazy-load. Video yalnız ekranda olanda oynayır.
                </div>
                <div className="mt-6 h-px w-16 bg-white/20" />
              </div>
            </GlassCard>

            <GlassCard glow={false}>
              <div className="p-7">
                <div className="text-lg font-black">SEO baza</div>
                <div className="mt-2 text-sm text-white/75">
                  Heading nizamı, semantik HTML, meta/OG, sürətli indeksləmə üçün əsaslar.
                </div>
                <div className="mt-6 h-px w-16 bg-white/20" />
              </div>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* REEL */}
      <section
        id="reel"
        ref={reelReveal.ref as any}
        className="relative isolate min-h-[100svh] overflow-hidden"
      >
        <BgImage src={I3} reveal={reelReveal.reveal} />
        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_.95fr] lg:items-center">
            <div className="max-w-xl">
              <Pill>Nümunə</Pill>
              <h2 className="mt-5 text-balance text-4xl font-black tracking-tight sm:text-5xl">
                Scroll-a uyğun: görünəndə oynayır.
              </h2>
              <p className="mt-4 text-sm text-white/75 sm:text-base">
                Ekrandan çıxanda pauza. Loop yoxdur. Premium hiss üçün sakit, kontrollu animasiya.
              </p>

              <div className="mt-8">
                <Btn href="#contact" variant="primary">
                  Mənə belə sayt lazımdır
                </Btn>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[34px] border border-white/14 bg-black/25 shadow-[0_28px_110px_rgba(0,0,0,.60)] backdrop-blur">
              <div className="relative aspect-[16/10]">
                <video
                  ref={reelVideoRef}
                  className="absolute inset-0 h-full w-full object-cover opacity-95"
                  muted
                  playsInline
                  preload="metadata"
                  autoPlay={!reduceMotion}
                  loop={false}
                  onEnded={() => {
                    try {
                      reelVideoRef.current?.pause();
                    } catch {}
                  }}
                >
                  <source src={V1} type="video/mp4" />
                </video>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/10" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section
        id="contact"
        ref={contactReveal.ref as any}
        className="relative isolate min-h-[100svh] overflow-hidden"
      >
        <BgImage src={CONTACT_BG} reveal={contactReveal.reveal} overlay={false} objectPosition="left center" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,.04)_0%,rgba(0,0,0,.06)_35%,rgba(0,0,0,.12)_65%,rgba(0,0,0,.22)_100%)]" />

        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="flex justify-end">
            <form
              className={cn(
                "w-full max-w-[660px] xl:max-w-[640px]",
                "translate-x-6 xl:translate-x-20",
                "rounded-[34px] border border-white/18",
                "bg-transparent",
                "shadow-[0_40px_140px_rgba(0,0,0,.65)]",
                "backdrop-blur-[2px]"
              )}
              onSubmit={(e) => {
                e.preventDefault();
                alert("Demo: mesaj göndərildi. İstəsən bunu real WhatsApp/Sheets/CRM-ə bağlayım.");
              }}
            >
              <div className="p-7">
                <div className="min-w-0">
                  <div className="text-xl font-black tracking-tight">Brief göndər</div>
                  <div className="mt-2 text-sm text-white/70">
                    60 saniyəlik mesaj kifayətdir: nə tip sayt lazımdır və əsas məqsəd nədir.
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <TextField label="Ad" placeholder="Ad Soyad" required value={name} onChange={setName} />
                  <TextField
                    label="Email"
                    placeholder="email@company.com"
                    required
                    type="email"
                    value={email}
                    onChange={setEmail}
                  />
                  <TextField label="Şirkət" placeholder="Şirkət adı (opsional)" value={company} onChange={setCompany} />
                  <TextField label="Telefon" placeholder="+994 ..." value={phone} onChange={setPhone} />
                </div>

                <div className="mt-4">
                  <TextAreaField
                    label="Layihə barədə"
                    required
                    value={message}
                    onChange={setMessage}
                    placeholder="Məs: Business sayt lazımdır. Məqsəd: müraciət artsın. 5 səhifə (Servis, Portfel, FAQ, About, Əlaqə). WhatsApp CTA..."
                    max={500}
                  />
                </div>

                <button
                  type="submit"
                  className={cn(
                    "mt-5 w-full rounded-2xl border border-white/20",
                    "bg-white/[0.06] backdrop-blur-md",
                    "px-5 py-3.5 text-[13px] font-extrabold text-white",
                    "shadow-[0_0_40px_rgba(120,235,255,.22),0_18px_60px_rgba(0,0,0,.35)]",
                    "transition hover:-translate-y-0.5 hover:bg-white/[0.10] hover:shadow-[0_0_70px_rgba(120,235,255,.42)]",
                    "focus:outline-none focus:ring-4 focus:ring-white/[0.18]"
                  )}
                >
                  Göndər ✈
                </button>

                <div className="mt-4 text-[11px] font-semibold text-white/45">
                  Göndərməklə, məlumatların yalnız əlaqə məqsədi ilə istifadə olunmasını qəbul edirsən.
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
