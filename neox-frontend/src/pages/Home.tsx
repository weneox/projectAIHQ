import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

type SlideId = "inside-1" | "inside-2" | "inside-2b" | "inside-3";
type Slide = {
  id: SlideId;
  bgDesktop: string;
  bgMobile: string;

  // Desktop text (old style)
  eyebrow: string;
  title: string;
  desc: string;
  bullets: string[];

  // Mobile title (top overlay) + panel content (bottom)
  mobileTitle: string;
  mobileDesc: string;
  mobileBullets: string[];
};

const HERO_SEEN_KEY = "neox_home_hero_seen_v1";
type Pt = { left: number; top: number };

export default function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const { i18n } = useTranslation();
  const lang = (i18n.language || "az").split("-")[0];

  // -----------------------------
  // Return target from Lift (state.scrollTo)
  // -----------------------------
  const stateScrollTo = (location.state as any)?.scrollTo as string | undefined;
  const hashId = location.hash ? location.hash.replace("#", "") : "";
  const targetId = stateScrollTo || hashId;
  const isReturningToInside = Boolean(targetId && targetId.startsWith("inside-"));

  // -----------------------------
  // Flash-killer overlay (returning)
  // -----------------------------
  const [coverOn, setCoverOn] = useState<boolean>(() => isReturningToInside);
  const [coverBlocking, setCoverBlocking] = useState<boolean>(() => isReturningToInside);

  const revealCover = () => {
    requestAnimationFrame(() => {
      setCoverOn(false);
      window.setTimeout(() => setCoverBlocking(false), 520);
    });
  };

  // -----------------------------
  // Media
  // -----------------------------
  const HERO_VIDEO =
    "https://res.cloudinary.com/dppoomunj/video/upload/v1771058949/12900818_3840_2160_25fps_1_pdgc3k.mp4";

  // Desktop HERO sabit şəkil
  const HERO_DESKTOP_STATIC =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771405890/Screenshot_2026-02-18_130731_rr5wtq.webp";

  const HERO_MOBILE_IMAGE =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771297258/ChatGPT_Image_Feb_17_2026_06_58_33_AM_hy9n6s.webp";

  // Door images
  const DOOR_CLOSED_DESKTOP =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771419983/ChatGPT_Image_Feb_18_2026_03_53_00_PM_eoduet.webp";
  const DOOR_OPEN_DESKTOP =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771419981/ChatGPT_Image_Feb_18_2026_03_53_08_PM_gdxgat.webp";
  const DOOR_MOBILE_ONLY =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771290454/ChatGPT_Image_Feb_17_2026_05_06_28_AM_hlgkff.jpg";

  // Inside images
  const INSIDE1_DESKTOP_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771412644/ChatGPT_Image_Feb_18_2026_02_58_49_PM_e970nb.webp";
  const INSIDE1_MOBILE_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771412642/ChatGPT_Image_Feb_18_2026_02_58_52_PM_qlhpxx.jpg";

  const INSIDE2_DESKTOP_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771338834/ChatGPT_Image_Feb_17_2026_06_31_39_PM_wqcght.webp";
  const INSIDE2_MOBILE_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771338819/ChatGPT_Image_Feb_17_2026_06_32_34_PM_jiqfft.webp";

  // ✅ inside-2b üçün YENİ background-lar (SƏNİN VERDİYİN)
  const INSIDE2B_MOBILE_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771481244/ChatGPT_Image_Feb_19_2026_10_06_23_AM_a9im6l.webp";
  const INSIDE2B_DESKTOP_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771481246/ChatGPT_Image_Feb_19_2026_10_03_39_AM_mvjytq.webp";

  const INSIDE3_DESKTOP_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771390165/ChatGPT_Image_Feb_18_2026_08_46_55_AM_rtprmd.webp";
  const INSIDE3_MOBILE_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771390166/ChatGPT_Image_Feb_18_2026_08_46_59_AM_silcdw.webp";

  // Contact images
  const CONTACT_DESKTOP_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771408560/ChatGPT_Image_Feb_18_2026_01_54_01_PM_cjjgru.webp";
  const CONTACT_MOBILE_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771408563/ChatGPT_Image_Feb_18_2026_01_54_05_PM_tbkvz4.webp";

  // -----------------------------
  // UX state
  // -----------------------------
  const [isTouch, setIsTouch] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  const [heroSeen, setHeroSeen] = useState(() => {
    if (isReturningToInside) return true;
    try {
      return sessionStorage.getItem(HERO_SEEN_KEY) === "1";
    } catch {
      return false;
    }
  });

  // touch detect
  useEffect(() => {
    const touch =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches || "ontouchstart" in window);
    setIsTouch(Boolean(touch));
  }, []);

  const markHeroSeen = () => {
    setHeroSeen(true);
    try {
      sessionStorage.setItem(HERO_SEEN_KEY, "1");
    } catch {}
  };

  // video ilk dəfə play olanda
  const markHeroSeenStorageOnly = () => {
    try {
      sessionStorage.setItem(HERO_SEEN_KEY, "1");
    } catch {}
  };

  const clearHeroSeen = () => {
    setHeroSeen(false);
    try {
      sessionStorage.removeItem(HERO_SEEN_KEY);
    } catch {}
  };

  // ESC close
  useEffect(() => {
    if (!contactOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContactOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contactOpen]);

  // Anti-jump scroll lock (overflow-a dəymirik)
  const lockedScrollYRef = useRef(0);
  useEffect(() => {
    if (!contactOpen) return;

    const y = window.scrollY;
    lockedScrollYRef.current = y;

    requestAnimationFrame(() => window.scrollTo(0, y));
    window.setTimeout(() => window.scrollTo(0, y), 0);

    const preventWheel = (e: WheelEvent) => {
      e.preventDefault();
      window.scrollTo(0, lockedScrollYRef.current);
    };
    const preventTouch = (e: TouchEvent) => {
      e.preventDefault();
      window.scrollTo(0, lockedScrollYRef.current);
    };
    const preventKeys = (e: KeyboardEvent) => {
      const keys = ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "];
      if (keys.includes(e.key)) {
        e.preventDefault();
        window.scrollTo(0, lockedScrollYRef.current);
      }
    };

    window.addEventListener("wheel", preventWheel, { passive: false });
    window.addEventListener("touchmove", preventTouch, { passive: false });
    window.addEventListener("keydown", preventKeys);

    return () => {
      window.removeEventListener("wheel", preventWheel as any);
      window.removeEventListener("touchmove", preventTouch as any);
      window.removeEventListener("keydown", preventKeys as any);
    };
  }, [contactOpen]);

  // -----------------------------
  // Jump to inside w/o flash + clear state.scrollTo
  // -----------------------------
  const clearedRef = useRef(false);

  useLayoutEffect(() => {
    const stateScrollToNow = (location.state as any)?.scrollTo as string | undefined;
    const hashNow = location.hash ? location.hash.replace("#", "") : "";
    const tid = stateScrollToNow || hashNow;
    const returning = Boolean(tid && tid.startsWith("inside-"));

    if (returning) {
      setCoverOn(true);
      setCoverBlocking(true);
      setHeroSeen(true);
    }

    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";

    if (tid) {
      const el = document.getElementById(tid);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        window.scrollTo({ top, left: 0, behavior: "auto" });
      } else {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      }
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    document.documentElement.style.scrollBehavior = prev || "";

    if (returning) {
      if (stateScrollToNow && !clearedRef.current) {
        clearedRef.current = true;
        navigate(location.pathname + location.search + location.hash, { replace: true, state: null });
      }
      revealCover();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // -----------------------------
  // Slides (inside-2b bg UPDATED)
  // -----------------------------
  const officeSlides: Slide[] = useMemo(
    () => [
      {
        id: "inside-1",
        bgDesktop: INSIDE1_DESKTOP_BG,
        bgMobile: INSIDE1_MOBILE_BG,
        eyebrow: "Neox",
        title: "İçəri xoş gəldin.",
        desc: "Biz rəqəmsal həlləri sürətli icra, stabil sistem və ölçülən nəticə ilə qururuq.",
        bullets: ["24/7 chatbot inteqrasiyası", "Vebsayt və mobil tətbiq hazırlanması", "Biznes proseslərinin avtomatlaşdırılması"],
        mobileTitle: "Ofisimizə xoş gəldiniz",
        mobileDesc:
          "Biz 24/7 chatbot qurulumu, vebsayt və mobil tətbiqlərin hazırlanması, SMM avtomatlaşdırması və biznes proseslərinin avtomatlaşdırılması kimi xidmətlər görürük.",
        mobileBullets: ["24/7 chatbot (WhatsApp/IG/Website)", "Vebsayt + mobil tətbiq", "SMM və proses avtomatlaşdırması"],
      },
      {
        id: "inside-2",
        bgDesktop: INSIDE2_DESKTOP_BG,
        bgMobile: INSIDE2_MOBILE_BG,
        eyebrow: "Xidmətlər",
        title: "Hər işi sistemləşdiririk.",
        desc: "Gələn sorğuların cavablanması, lead toplama, yönləndirmə və ölçmə — hamısı bir axında işləyir.",
        bullets: ["Kanal inteqrasiyaları", "Satış və dəstək ssenariləri", "Analitika və ölçmə"],
        mobileTitle: "Xidmətlər və axın",
        mobileDesc:
          "Müştəri mesajı gəlir → bot cavablayır → lazım olsa operatora ötürür → lead CRM-ə düşür → nəticə ölçülür.",
        mobileBullets: ["Ssenari + FAQ qurulumu", "Lead toplama və yönləndirmə", "Analitika və optimizasiya"],
      },
      {
        id: "inside-2b",
        // ✅ BURADA əvvəlkini sildik, yenisini qoyduq
        bgDesktop: INSIDE2B_DESKTOP_BG,
        bgMobile: INSIDE2B_MOBILE_BG,
        eyebrow: "Avtomatlaşdırma paketləri",
        title: "3–4 blokla izah edək.",
        desc: "Bu hissədə xidmətləri ayrı-ayrı bloklarda göstəririk ki, hər şey aydın olsun.",
        bullets: ["24/7 Chatbot", "SMM avtomatlaşdırması", "Veb/Mobil hazırlıq"],
        mobileTitle: "Avtomatlaşdırma paketləri",
        mobileDesc:
          "Aşağıdakı bloklar ayrı-ayrıdır: hər biri fərqli iş görür və birlikdə biznesi sürətləndirir.",
        mobileBullets: ["24/7 chatbot", "SMM avtomatlaşdırması", "Biznes prosesləri"],
      },
      {
        id: "inside-3",
        bgDesktop: INSIDE3_DESKTOP_BG,
        bgMobile: INSIDE3_MOBILE_BG,
        eyebrow: "Nəzarət paneli",
        title: "Hər şey görünür və idarə olunur.",
        desc: "Sorğu sayı, cavab sürəti, conversion və satış yönləndirməsi — hamısı paneldə izlənir.",
        bullets: ["Realtime dashboard", "A/B ssenari testləri", "Təhlükəsizlik və stabillik"],
        mobileTitle: "Nəzarət paneli",
        mobileDesc:
          "Nə işləyir, nə işləmir — dərhal görürük. Hesabatlar və dashboard ilə optimizasiya edirik.",
        mobileBullets: ["Realtime göstəricilər", "Ssenari testləri", "Stabil infrastruktur"],
      },
    ],
    [
      INSIDE1_DESKTOP_BG,
      INSIDE1_MOBILE_BG,
      INSIDE2_DESKTOP_BG,
      INSIDE2_MOBILE_BG,
      INSIDE2B_DESKTOP_BG,
      INSIDE2B_MOBILE_BG,
      INSIDE3_DESKTOP_BG,
      INSIDE3_MOBILE_BG,
    ]
  );

  // -----------------------------
  // Hero intro controls (same logic)
  // -----------------------------
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  const [introSkipped, setIntroSkipped] = useState(() => isReturningToInside || heroSeen);
  const [revealCount, setRevealCount] = useState(0);
  const [videoEnded, setVideoEnded] = useState(false);

  const heroLines = useMemo(
    () => [
      { k: "l1", t: "Rəqəmsal həllər və avtomatlaşdırma" },
      { k: "l2", t: "24/7 Chatbot • Vebsayt • Mobil tətbiq" },
      { k: "l3", t: "SMM avtomatlaşdırması • Proses optimizasiyası" },
      { k: "l4", t: "Ölçülən nəticə • Stabil sistem • Davamlı dəstək" },
    ],
    []
  );

  const stopRevealTimer = () => {
    if (revealTimerRef.current) {
      window.clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const startReveal = () => {
    stopRevealTimer();
    setRevealCount(0);
    let i = 0;
    revealTimerRef.current = window.setInterval(() => {
      i += 1;
      setRevealCount(i);
      if (i >= heroLines.length) stopRevealTimer();
    }, 260);
  };

  const freezeToEnd = (v: HTMLVideoElement) => {
    try {
      v.pause();
      if (Number.isFinite(v.duration) && v.duration > 0) {
        v.currentTime = Math.max(0, v.duration - 0.02);
      }
    } catch {}
  };

  useEffect(() => {
    if (!introSkipped) {
      stopRevealTimer();
      setRevealCount(0);
      return;
    }
    startReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introSkipped, location.key]);

  useEffect(() => {
    if (!isTouch) return;
    stopRevealTimer();
    setIntroSkipped(true);
    setVideoEnded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTouch]);

  useEffect(() => {
    if (isTouch) return;
    if (isReturningToInside) return;

    if (heroSeen) {
      setIntroSkipped(true);
      setVideoEnded(true);
      return;
    }

    setIntroSkipped(false);
    setVideoEnded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroSeen, isTouch, isReturningToInside]);

  const skipIntro = () => {
    if (isTouch) return;
    const v = videoRef.current;
    if (v) freezeToEnd(v);
    setVideoEnded(true);
    setIntroSkipped(true);
    markHeroSeen();
  };

  const replayIntro = () => {
    if (isTouch) return;

    clearHeroSeen();

    const v = videoRef.current;
    stopRevealTimer();

    setRevealCount(0);
    setIntroSkipped(false);
    setVideoEnded(false);

    if (!v) return;
    try {
      v.currentTime = 0;
      v.play().catch(() => {});
    } catch {}
  };

  useEffect(() => () => stopRevealTimer(), []);

  // -----------------------------
  // UI atoms
  // -----------------------------
  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300" />
      {children}
    </span>
  );

  const Glass = ({ className, children }: { className?: string; children: React.ReactNode }) => (
    <div
      className={cn(
        "rounded-3xl border border-white/12 bg-white/[0.07] shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );

  const SectionFades = ({ topFrom = "black", bottomTo = "black" }: { topFrom?: string; bottomTo?: string }) => (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{ background: `linear-gradient(to bottom, ${topFrom}, transparent)` }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
        style={{ background: `linear-gradient(to top, ${bottomTo}, transparent)` }}
      />
    </>
  );

  // desktop portal buttons (unchanged)
  const PortalButton = ({
    label,
    onClick,
    side,
  }: {
    label: string;
    onClick: () => void;
    side: "left" | "right";
  }) => {
    const pos = side === "left" ? "left-[22%]" : "left-[78%]";
    const translateX = side === "left" ? "-52%" : "-48%";
    const enterArrow = "⤵";

    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("group absolute z-30 select-none", pos)}
        style={{ top: "28%", transform: `translate(${translateX}, -50%)` }}
        aria-label={label}
      >
        <span
          className={cn(
            "relative inline-flex items-center gap-3",
            "rounded-[999px] px-5 py-2.5",
            "border border-white/14 bg-black/40",
            "backdrop-blur-xl",
            "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.65)]",
            "transition-all duration-200",
            "group-hover:bg-black/52 group-hover:border-white/20",
            "active:scale-[0.99]"
          )}
        >
          <span className="relative grid h-5 w-5 place-items-center">
            <span className="absolute h-5 w-5 rounded-full border border-white/15 opacity-70" />
            <span className="absolute h-2 w-2 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.95)]" />
          </span>

          <span className="text-xs font-semibold tracking-wide text-white/90">{label}</span>

          <span
            className={cn(
              "text-white/65 text-sm font-semibold",
              "group-hover:text-white/90 transition",
              "translate-y-[1px]"
            )}
            aria-hidden
          >
            {enterArrow}
          </span>

          <span className="pointer-events-none absolute inset-0 rounded-[999px] ring-1 ring-white/5" />
        </span>
      </button>
    );
  };

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // -----------------------------
  // ✅ MOBILE ONLY: loop line (safe, no overlap)
  // -----------------------------
  const MobileLoopLine = () => {
    const items = ["24/7 chatbot", "vebsayt", "avtomatlaşdırma"];
    return (
      <span className="inline-flex items-center gap-2 text-[11px] text-white/60">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.65)]" />
        <span className="relative inline-block h-[14px] w-[150px] overflow-hidden align-middle">
          {items.map((t, i) => (
            <span
              key={t}
              className="absolute left-0 top-0 whitespace-nowrap mobileLoop"
              style={{ animationDelay: `${i * 1.4}s` }}
            >
              {t}
            </span>
          ))}
        </span>
      </span>
    );
  };

  // -----------------------------
  // ✅ MOBILE: bottom info panel
  // -----------------------------
  const MobileInfoPanel = ({
    eyebrow,
    desc,
    bullets,
    showNav,
  }: {
    eyebrow: string;
    desc: string;
    bullets: string[];
    showNav?: boolean;
  }) => {
    return (
      <div className="absolute inset-x-0 bottom-0 pb-6">
        <div className="mx-auto w-[min(1160px,92vw)]">
          <div
            className={cn(
              "rounded-3xl border border-white/12",
              "bg-[#0b0f18]/92",
              "shadow-[0_28px_120px_rgba(0,0,0,0.70)]",
              "backdrop-blur-xl"
            )}
          >
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <Pill>{eyebrow}</Pill>
                <MobileLoopLine />
              </div>

              <p className="mt-3 text-sm leading-relaxed text-white/75">{desc}</p>

              <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.05] p-4">
                <div className="text-sm font-semibold text-white/90">Bu mərhələdə nə edirik?</div>
                <ul className="mt-3 space-y-2 text-sm text-white/75">
                  {bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {showNav ? (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => scrollToId("inside-2")}
                    className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10"
                  >
                    Xidmətlər →
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/${lang}/lift`)}
                    className="rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-semibold text-white/90 hover:bg-white/10"
                  >
                    Lift →
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // -----------------------------
  // ✅ inside-2b blocks (Desktop + Mobile)
  // -----------------------------
  const MiniBlock = ({ title, desc }: { title: string; desc: string }) => (
    <div className="rounded-2xl border border-white/12 bg-white/[0.06] p-4">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-1 text-sm text-white/70">{desc}</div>
    </div>
  );

  // -----------------------------
  // ✅ HAND ANCHOR (contact hologram)
  // -----------------------------
  const handAnchorRef = useRef<HTMLDivElement | null>(null);
  const [panelPos, setPanelPos] = useState<Pt | null>(null);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const computePanelPos = () => {
    const a = handAnchorRef.current;
    if (!a) return;

    const r = a.getBoundingClientRect();
    const panelW = Math.min(520, window.innerWidth * 0.92);
    const panelH = 420;

    const CORNER_NUDGE_X = 10;
    const CORNER_NUDGE_Y = 8;

    let left = r.left + r.width / 2 - panelW + CORNER_NUDGE_X;
    let top = r.top + r.height / 2 - panelH + CORNER_NUDGE_Y;

    left = clamp(left, 10, window.innerWidth - panelW - 10);
    top = clamp(top, 10, window.innerHeight - panelH - 10);

    setPanelPos({ left, top });
  };

  useLayoutEffect(() => {
    if (!contactOpen) return;
    computePanelPos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactOpen, isTouch]);

  useEffect(() => {
    if (!contactOpen) return;

    const onResize = () => computePanelPos();
    const onScroll = () => computePanelPos();

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactOpen]);

  // -----------------------------
  // Intro dock — only in HERO
  // -----------------------------
  const [dockOpen, setDockOpen] = useState(false);
  const canSkip = !isTouch && !heroSeen && !videoEnded && !introSkipped;
  const canReplay = !isTouch;
  const onDockEnter = () => !isTouch && setDockOpen(true);
  const onDockLeave = () => !isTouch && setDockOpen(false);

  // Hand anchor placement
  const HAND_ANCHOR_STYLE: React.CSSProperties = isTouch ? { left: "60%", top: "62%" } : { left: "58%", top: "62%" };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <style>{`
        /* MOBILE loop text: safe (no overlap with other text) */
        @keyframes mobLoop {
          0%   { transform: translate3d(0,110%,0); opacity: 0; filter: blur(4px); }
          18%  { transform: translate3d(0,0%,0);   opacity: 1; filter: blur(0); }
          70%  { transform: translate3d(0,0%,0);   opacity: 1; filter: blur(0); }
          100% { transform: translate3d(0,-110%,0); opacity: 0; filter: blur(4px); }
        }
        .mobileLoop{
          animation: mobLoop 4.2s ease-in-out infinite;
          will-change: transform, opacity, filter;
          color: rgba(255,255,255,0.72);
          font-size: 11px;
          line-height: 14px;
        }
      `}</style>

      {/* returning overlay */}
      <div
        className={cn(
          "fixed inset-0 z-[2147483647] bg-black transition-opacity duration-500 ease-out",
          coverOn ? "opacity-100" : "opacity-0",
          coverBlocking ? "pointer-events-auto" : "pointer-events-none"
        )}
        aria-hidden
      />

      {/* HERO */}
      <section id="top" className="relative h-[100svh] w-full overflow-hidden">
        {!isTouch && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 z-[2147483000] pointer-events-auto"
            onMouseEnter={onDockEnter}
            onMouseLeave={onDockLeave}
          >
            <div
              className={cn(
                "relative flex items-stretch",
                "rounded-2xl border border-white/12 bg-black/30 backdrop-blur-md",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_20px_60px_rgba(0,0,0,0.65)]"
              )}
            >
              <button
                type="button"
                onClick={() => setDockOpen((s) => !s)}
                className={cn(
                  "group flex w-12 flex-col items-center justify-center gap-2 rounded-2xl px-2 py-3 hover:bg-white/5 transition"
                )}
                aria-label="Intro panel"
              >
                <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.9)]" />
                <span className="text-[10px] font-semibold tracking-wide text-white/70 rotate-[-90deg] whitespace-nowrap">
                  INTRO
                </span>
              </button>

              <div
                className={cn(
                  "overflow-hidden transition-[width,opacity] duration-300",
                  dockOpen ? "w-[240px] opacity-100" : "w-0 opacity-0"
                )}
                aria-hidden={!dockOpen}
              >
                <div className="w-[240px] p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-white/85">Intro idarəsi</div>
                    <div className="text-[10px] text-white/45">Panel</div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={!canSkip}
                      onClick={skipIntro}
                      className={cn(
                        "rounded-xl px-3 py-2 text-left text-xs font-semibold transition",
                        canSkip
                          ? "border border-sky-300/20 bg-[#061427]/55 hover:bg-[#071a33]/65"
                          : "border border-white/10 bg-white/5 text-white/35 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sky-100">Keç</span>
                        <span className="text-white/45">⏭</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/55">Videonu sona keçir</div>
                    </button>

                    <button
                      type="button"
                      disabled={!canReplay}
                      onClick={replayIntro}
                      className={cn(
                        "rounded-xl px-3 py-2 text-left text-xs font-semibold transition",
                        "border border-emerald-300/20 bg-[#071a14]/45 hover:bg-[#082019]/55"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-100">Yenidən</span>
                        <span className="text-white/45">↻</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-white/55">Videonu yenidən oynat</div>
                    </button>
                  </div>

                  <div className="mt-2 text-[10px] text-white/45">Aşağı scroll-da görünməyəcək.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {isTouch ? (
          <div className="absolute inset-0 bg-center bg-cover bg-no-repeat" style={{ backgroundImage: `url(${HERO_MOBILE_IMAGE})` }} />
        ) : (
          <>
            {heroSeen ? (
              <div className="absolute inset-0 bg-center bg-cover bg-no-repeat" style={{ backgroundImage: `url(${HERO_DESKTOP_STATIC})` }} />
            ) : (
              <video
                ref={videoRef}
                className="absolute inset-0 h-full w-full object-cover"
                autoPlay
                muted
                playsInline
                preload="metadata"
                loop={false}
                onPlay={() => {
                  markHeroSeenStorageOnly();
                }}
                onEnded={(e) => {
                  const v = e.currentTarget;
                  v.pause();
                  if (Number.isFinite(v.duration) && v.duration > 0) v.currentTime = Math.max(0, v.duration - 0.02);
                  setVideoEnded(true);
                  setIntroSkipped(true);
                  markHeroSeen();
                }}
              >
                <source src={HERO_VIDEO} type="video/mp4" />
              </video>
            )}
          </>
        )}

        <SectionFades topFrom="rgba(0,0,0,0.55)" bottomTo="#05070d" />

        <div className="relative mx-auto flex h-full w-[min(1160px,92vw)] items-center pt-20">
          {introSkipped && (
            <div className="max-w-3xl">
              <div className="space-y-3">
                {heroLines.map((x, idx) => {
                  const visible = idx < revealCount;
                  return (
                    <div
                      key={x.k}
                      className={cn("transition-all duration-500", visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2")}
                    >
                      {idx === 2 ? (
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-6xl">
                          Biz{" "}
                          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">Neox</span>{" "}
                          olaraq ideyanı məhsula çeviririk.
                        </h1>
                      ) : (
                        <div className="text-sm text-white/70 sm:text-base">
                          <span className="text-sky-200/90">{x.t}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div
                className={cn(
                  "mt-7 transition-all duration-500",
                  revealCount >= heroLines.length ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                )}
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => scrollToId("door")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black hover:bg-white/90"
                  >
                    Qapını aç <span aria-hidden>→</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => scrollToId("contact")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-6 py-3 text-sm font-semibold text-white/90 hover:bg-white/10"
                  >
                    Əlaqə
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* DOOR */}
      <section id="door" className={cn("relative w-full overflow-hidden bg-black", "h-[100dvh] sm:h-[100svh]")}>
        <div className="group absolute inset-0" aria-label="door">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${isTouch ? DOOR_MOBILE_ONLY : DOOR_CLOSED_DESKTOP})`,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              backgroundSize: "cover",
            }}
          />

          {!isTouch && (
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100"
              style={{
                transition: `opacity 220ms ease-out`,
                willChange: "opacity",
                backgroundImage: `url(${DOOR_OPEN_DESKTOP})`,
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                backgroundSize: "cover",
              }}
            />
          )}

          <SectionFades topFrom="#05070d" bottomTo="black" />
        </div>
      </section>

      {/* INSIDE SLIDES */}
      {officeSlides.map((s) => {
        const bg = isTouch ? s.bgMobile : s.bgDesktop;

        const isInside1 = s.id === "inside-1";
        const isInside2b = s.id === "inside-2b";

        return (
          <section key={s.id} id={s.id} className="relative h-[100svh] w-full overflow-hidden bg-black">
            <div
              className="absolute inset-0 bg-no-repeat"
              style={{
                backgroundImage: `url(${bg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35), rgba(0,0,0,0.65))" }}
            />
            <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_160px_rgba(0,0,0,0.75)]" />
            <SectionFades topFrom="black" bottomTo="black" />

            {isInside1 && !isTouch && (
              <>
                <PortalButton side="left" label="Xidmətləri gör" onClick={() => scrollToId("inside-2")} />
                <PortalButton side="right" label="Liftə keç" onClick={() => navigate(`/${lang}/lift`)} />
              </>
            )}

            {!isTouch && (
              <div className="relative mx-auto flex h-full w-[min(1160px,92vw)] items-end pb-14 sm:pb-16">
                <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-12">
                  <div className="lg:col-span-7">
                    <Pill>{s.eyebrow}</Pill>
                    <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-5xl">{s.title}</h2>
                    <p className="mt-3 max-w-2xl text-white/75">{s.desc}</p>
                  </div>

                  <div className="lg:col-span-5">
                    <Glass className="p-5 sm:p-6">
                      {isInside2b ? (
                        <>
                          <div className="text-sm font-semibold text-white/90">Paketlər və bloklar</div>
                          <div className="mt-3 grid gap-3">
                            <MiniBlock
                              title="1) 24/7 Chatbot"
                              desc="WhatsApp/Instagram/sayt üzərindən sorğuları avtomatik cavablayır, lazım olsa operatora ötürür."
                            />
                            <MiniBlock
                              title="2) Vebsayt və mobil tətbiq"
                              desc="UI/UX, frontend/backend, performans və stabil release prosesləri ilə hazırlanır."
                            />
                            <MiniBlock
                              title="3) SMM avtomatlaşdırması"
                              desc="Kontent planlama, mesaj cavabları, lead toplama və hesabat axınları avtomatik qurulur."
                            />
                            <MiniBlock
                              title="4) Biznes prosesləri"
                              desc="Daxili iş axınları, bildirişlər, inteqrasiya və hesabatlar sistemləşdirilir."
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-sm font-semibold text-white/90">Bu mərhələdə nə edirik?</div>
                          <ul className="mt-3 space-y-2 text-sm text-white/75">
                            {s.bullets.map((b) => (
                              <li key={b} className="flex gap-2">
                                <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300" />
                                <span>{b}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </Glass>
                  </div>
                </div>
              </div>
            )}

            {isTouch && (
              <>
                <div className="absolute inset-x-0 top-0 pt-8">
                  <div className="mx-auto w-[min(1160px,92vw)]">
                    <h2 className="text-2xl font-semibold tracking-tight text-white/95">{s.mobileTitle}</h2>
                  </div>
                </div>

                <MobileInfoPanel
                  eyebrow={s.eyebrow}
                  desc={isInside2b ? "Bu bölmədə xidmətləri ayrı-ayrı bloklarda göstəririk ki, seçim və planlama asan olsun." : s.mobileDesc}
                  bullets={
                    isInside2b
                      ? [
                          "24/7 chatbot (cavab + yönləndirmə)",
                          "Vebsayt və mobil tətbiq hazırlanması",
                          "SMM avtomatlaşdırması",
                          "Biznes proseslərinin avtomatlaşdırılması",
                        ]
                      : s.mobileBullets
                  }
                  showNav={isInside1}
                />
              </>
            )}
          </section>
        );
      })}

      {/* CONTACT */}
      <section id="contact" className="relative h-[100svh] w-full overflow-hidden bg-black">
        <div
          className="absolute inset-0 bg-center bg-cover bg-no-repeat"
          style={{ backgroundImage: `url(${isTouch ? CONTACT_MOBILE_BG : CONTACT_DESKTOP_BG})` }}
        />

        <SectionFades topFrom="#05070d" bottomTo="black" />

        <div
          ref={handAnchorRef}
          className="absolute z-10"
          style={{
            ...HAND_ANCHOR_STYLE,
            width: 28,
            height: 28,
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        <div className="absolute inset-0">
          <div className="mx-auto h-full w-[min(1160px,92vw)]">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className={cn(
                "group absolute left-4 sm:left-8 bottom-24 sm:bottom-28",
                "inline-flex items-center gap-3",
                "rounded-[999px] px-5 py-3",
                "border border-white/16",
                "bg-gradient-to-r from-white/14 via-white/8 to-white/12",
                "backdrop-blur-xl",
                "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_60px_rgba(0,0,0,0.75)]",
                "transition-all duration-200",
                "hover:border-white/25 hover:bg-white/12",
                "active:scale-[0.99]"
              )}
            >
              <span className="relative grid h-6 w-6 place-items-center">
                <span className="absolute h-6 w-6 rounded-full border border-sky-300/25 opacity-70" />
                <span className="absolute h-2.5 w-2.5 rounded-full bg-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.95)]" />
              </span>

              <span className="text-sm font-semibold tracking-wide text-white/92">Yaz / Bizə zəng et</span>
              <span className={cn("text-white/70 text-sm font-semibold", "group-hover:text-white/90 transition")} aria-hidden>
                →
              </span>

              <span className="pointer-events-none absolute inset-0 rounded-[999px] ring-1 ring-white/5" />
            </button>
          </div>
        </div>

        {contactOpen &&
          createPortal(
            <div className="fixed inset-0 z-[999999]" style={{ background: "transparent" }}>
              <style>{`
                @keyframes holoFloat { 0%,100%{ transform: translate3d(0,0,0);} 50%{ transform: translate3d(0,-10px,0);} }
                @keyframes holoIn { 
                  0%{ opacity:0; transform: translate3d(16px,18px,0) scale(.975); filter: blur(3px);} 
                  100%{ opacity:1; transform: translate3d(0,0,0) scale(1); filter: blur(0);} 
                }
                @keyframes scanLine { 0%{ transform: translateY(-30%); opacity:0;} 18%{ opacity:.55;} 55%{ opacity:.22;} 100%{ transform: translateY(130%); opacity:0;} }
                @keyframes beamPulse { 0%,100%{ opacity:.32; filter: blur(0px);} 50%{ opacity:.55; filter: blur(1px);} }
              `}</style>

              <div className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0)" }} onMouseDown={() => setContactOpen(false)} aria-hidden />

              <div
                className="fixed pointer-events-none"
                style={{
                  left: panelPos ? panelPos.left : "50%",
                  top: panelPos ? panelPos.top : "50%",
                  transform: panelPos ? "none" : "translate(-50%,-50%)",
                  padding: 12,
                }}
              >
                {panelPos && (
                  <div
                    className="pointer-events-none absolute"
                    style={{
                      right: 22,
                      bottom: 18,
                      width: 220,
                      height: 140,
                      transformOrigin: "100% 100%",
                      transform: "skewX(-18deg) rotate(-8deg)",
                      background:
                        "radial-gradient(closest-side, rgba(56,189,248,0.35), rgba(56,189,248,0.16), rgba(56,189,248,0) 70%)",
                      mixBlendMode: "screen",
                      animation: "beamPulse 2.2s ease-in-out infinite",
                    }}
                  />
                )}

                <div
                  className={cn(
                    "relative w-[min(520px,92vw)] rounded-[28px] pointer-events-auto",
                    "border border-white/16 bg-black/25 backdrop-blur-2xl",
                    "shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_25px_90px_rgba(0,0,0,0.75)]"
                  )}
                  style={{
                    transformOrigin: "100% 100%",
                    animation: "holoIn 420ms ease-out both, holoFloat 3.2s ease-in-out 520ms infinite",
                    willChange: "transform, opacity",
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="pointer-events-none absolute -inset-[2px] rounded-[30px] bg-gradient-to-r from-sky-400/25 via-cyan-200/10 to-violet-400/20 blur-[10px]" />

                  <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[28px]">
                    <div
                      className="absolute left-0 right-0 h-20"
                      style={{
                        background: "linear-gradient(to bottom, transparent, rgba(56,189,248,0.22), transparent)",
                        animation: "scanLine 2.4s ease-in-out infinite",
                      }}
                    />
                    <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:22px_22px]" />
                  </div>

                  <div className="relative p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs text-white/70">
                          <span className="h-1.5 w-1.5 rounded-full bg-sky-300 shadow-[0_0_14px_rgba(56,189,248,0.9)]" />
                          Contact
                        </span>

                        <div className="mt-3 text-xl sm:text-2xl font-semibold tracking-tight text-white/95">Bizimlə əlaqə</div>
                        <div className="mt-1 text-sm text-white/70">Yazın və ya birbaşa zəng edin.</div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setContactOpen(false)}
                        className="rounded-2xl border border-white/14 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10"
                        aria-label="Bağla"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3">
                      <a
                        href="tel:+994518005577"
                        className={cn(
                          "group flex items-center justify-between gap-3",
                          "rounded-2xl border border-white/14 bg-white/[0.06] px-4 py-3",
                          "hover:bg-white/[0.09] transition"
                        )}
                      >
                        <div>
                          <div className="text-xs text-white/55">Telefon</div>
                          <div className="text-sm sm:text-base font-semibold text-white/90">+994 51 800 55 77</div>
                        </div>
                        <span className="text-white/60 group-hover:text-white/85 transition">Zəng et →</span>
                      </a>

                      <a
                        href="mailto:info@weneox.com"
                        className={cn(
                          "group flex items-center justify-between gap-3",
                          "rounded-2xl border border-white/14 bg-white/[0.06] px-4 py-3",
                          "hover:bg-white/[0.09] transition"
                        )}
                      >
                        <div>
                          <div className="text-xs text-white/55">Email</div>
                          <div className="text-sm sm:text-base font-semibold text-white/90">info@weneox.com</div>
                        </div>
                        <span className="text-white/60 group-hover:text-white/85 transition">Yaz →</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          setContactOpen(false);
                          scrollToId("contact");
                        }}
                        className={cn(
                          "mt-2 w-full rounded-2xl bg-white px-5 py-3",
                          "text-sm font-semibold text-black",
                          "hover:bg-white/90 active:scale-[0.99] transition"
                        )}
                      >
                        Contact səhifəsinə keç →
                      </button>

                      <div className="text-[11px] text-white/45">* Panel sabitdir, arxa fon qara olmur.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </section>
    </div>
  );
}
