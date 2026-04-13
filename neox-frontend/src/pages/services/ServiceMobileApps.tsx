// src/pages/services/ServiceMobileApps.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

export default function ServiceMobileApps() {
  // -----------------------------
  // Media
  // -----------------------------
  const HERO_VIDEO =
    "https://res.cloudinary.com/dppoomunj/video/upload/v1771058949/12900818_3840_2160_25fps_1_pdgc3k.mp4";

  const DOOR_CLOSED =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771058715/Untitled_design_10_vpcjzr.png";

  const DOOR_OPEN =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771058715/ChatGPT_Image_Feb_14_2026_12_44_54_PM_rzjvnh.png";

  // ✅ ONLY changed: "İçəri xoş gəldin." slide background
  const OFFICE_1 =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771129077/Untitled_design_21_hmauwn.png";

  const OFFICE_2 =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771060737/Untitled_design_12_g9js4n.png";
  const OFFICE_3 =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771060731/A_futuristic_command_center_office_in_Neox_blue_glowing_neon_blue_light_strips_dark_premium_environment_multiple_robots_collaborating_with_holographic_interfaces_large_glowing__NEOX__logo_on_the_back_wall_cine_vidmsi.jpg";

  const CONTACT_BG =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771061033/Untitled_design_14_p541vv.png";

  // -----------------------------
  // UX state
  // -----------------------------
  const [isTouch, setIsTouch] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);

  // Contact form modal
  const [contactOpen, setContactOpen] = useState(false);

  // ✅ Refresh edəndə həmişə yuxarıdan açılsın
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

  useEffect(() => {
    const touch =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(hover: none) and (pointer: coarse)")?.matches ||
        "ontouchstart" in window);
    setIsTouch(Boolean(touch));
  }, []);

  // ESC close for modal
  useEffect(() => {
    if (!contactOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContactOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contactOpen]);

  const DOOR_FADE_MS = 220;

  const officeSlides = useMemo(
    () => [
      {
        id: "inside-1",
        bg: OFFICE_1,
        eyebrow: "Neox Office",
        title: "İçəri xoş gəldin.",
        desc: "Robotlar rutin işləri avtomatlaşdırır, komanda isə fokuslanır: UX, performans və monetizasiya.",
        bullets: [
          "Robot ops & support",
          "Premium UI systems",
          "Analytics-first qərarlar",
        ],
      },
      {
        id: "inside-2",
        bg: OFFICE_2,
        eyebrow: "Delivery",
        title: "Sürətli, təmiz, ölçülə bilən.",
        desc: "Prototip → MVP → Release → Iteration. Hər sprintdə demo, hər addımda ölçmə.",
        bullets: [
          "CI/CD & monitoring",
          "Crash-free fokus",
          "Paywall & funnel optimizasiya",
        ],
      },
      {
        id: "inside-3",
        bg: OFFICE_3,
        eyebrow: "Command Center",
        title: "Nəzarət paneli: hər şey görünür.",
        desc: "Performans, retention, conversion — hamısı real vaxtda izlənir. Robotlar isə arxa planda işi görür.",
        bullets: ["Realtime dashboards", "A/B tests", "Security-first infra"],
      },
    ],
    [OFFICE_1, OFFICE_2, OFFICE_3]
  );

  // -----------------------------
  // Hero intro controls (Skip + Replay + reveal words)
  // -----------------------------
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const revealTimerRef = useRef<number | null>(null);

  const [introSkipped, setIntroSkipped] = useState(false); // “words stage”
  const [revealCount, setRevealCount] = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);

  const heroLines = useMemo(
    () => [
      { k: "l1", t: "Premium Mobile App Delivery" },
      { k: "l2", t: "Strategiya → Launch" },
      { k: "l3", t: "Neox standartında məhsul" },
      { k: "l4", t: "UX • iOS/Android • Backend • Growth" },
    ],
    []
  );

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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
    } catch {
      // ignore
    }
  };

  // Skip: video dərhal sona getsin + sözlər yavaş-yavaş açılsın
  const skipIntro = () => {
    const v = videoRef.current;
    if (!v) return;

    freezeToEnd(v);
    setVideoEnded(true);
    setIntroSkipped(true);
    startReveal();
  };

  // Replay: video yenidən başlasın (sözlər gizlənsin)
  const replayIntro = () => {
    const v = videoRef.current;

    stopRevealTimer();
    setRevealCount(0);
    setIntroSkipped(false);
    setVideoEnded(false);

    if (!v) return;
    try {
      v.currentTime = 0;
      v.play().catch(() => {});
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    return () => stopRevealTimer();
  }, []);

  // -----------------------------
  // UI atoms
  // -----------------------------
  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur">
      <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300" />
      {children}
    </span>
  );

  const Glass = ({
    className,
    children,
  }: {
    className?: string;
    children: React.ReactNode;
  }) => (
    <div
      className={cn(
        "rounded-3xl border border-white/12 bg-white/[0.07] shadow-[0_20px_70px_rgba(0,0,0,0.55)] backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );

  // -----------------------------
  // ✅ Left slide-out “Intro dock”
  // (Header arxasına düşməməsi üçün FIXED + ultra yüksək z-index)
  // -----------------------------
  const [dockOpen, setDockOpen] = useState(false);
  const canSkip = !videoEnded && !introSkipped;
  const canReplay = videoEnded || introSkipped;

  // Touch cihazlarda hover yoxdur -> toggle
  const onDockEnter = () => !isTouch && setDockOpen(true);
  const onDockLeave = () => !isTouch && setDockOpen(false);
  const onDockToggle = () => isTouch && setDockOpen((s) => !s);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      {/* Top progress glow */}
      <div className="pointer-events-none fixed left-0 top-0 z-[9999] h-[2px] w-full bg-white/10">
        <div className="h-full w-full bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400 opacity-70" />
      </div>

      {/* ✅ Intro dock (always clickable, never behind header) */}
      <div
        className="fixed left-3 top-1/2 -translate-y-1/2 z-[2147483647] pointer-events-auto"
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
          {/* handle */}
          <button
            type="button"
            onClick={onDockToggle}
            className={cn(
              "group flex w-12 flex-col items-center justify-center gap-2",
              "rounded-2xl px-2 py-3",
              "hover:bg-white/5 transition"
            )}
            aria-label="Intro panel"
          >
            <span className="h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_14px_rgba(56,189,248,0.9)]" />
            <span className="text-[10px] font-semibold tracking-wide text-white/70 rotate-[-90deg] whitespace-nowrap">
              INTRO
            </span>
          </button>

          {/* slide-out */}
          <div
            className={cn(
              "overflow-hidden transition-[width,opacity] duration-300",
              dockOpen ? "w-[240px] opacity-100" : "w-0 opacity-0"
            )}
            aria-hidden={!dockOpen}
          >
            <div className="w-[240px] p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-white/85">
                  Intro controls
                </div>
                <div className="text-[10px] text-white/45">
                  {isTouch ? "Tap" : "Hover"} panel
                </div>
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
                    <span className="text-sky-100">Skip</span>
                    <span className="text-white/45">⏭</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/55">
                    Video sona keçsin + sözlər açılsın
                  </div>
                </button>

                <button
                  type="button"
                  disabled={!canReplay}
                  onClick={replayIntro}
                  className={cn(
                    "rounded-xl px-3 py-2 text-left text-xs font-semibold transition",
                    canReplay
                      ? "border border-emerald-300/20 bg-[#071a14]/45 hover:bg-[#082019]/55"
                      : "border border-white/10 bg-white/5 text-white/35 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-100">Replay</span>
                    <span className="text-white/45">↻</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-white/55">
                    Videonu yenidən oynat
                  </div>
                </button>

                <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                  <div className="text-[11px] text-white/55">
                    Status:{" "}
                    <span className="text-white/75">
                      {videoEnded
                        ? "ended"
                        : introSkipped
                        ? "skipped"
                        : "playing"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2 text-[10px] text-white/45">
                Panel dizaynı “tab” kimidir — header üstündə qalır, klik itmir.
              </div>
            </div>
          </div>

          {/* small accent line */}
          <div className="pointer-events-none absolute inset-y-2 right-2 w-[2px] rounded-full bg-gradient-to-b from-violet-400 via-sky-300 to-emerald-300 opacity-70" />
        </div>
      </div>

      {/* HERO */}
      <section id="top" className="relative h-[100svh] w-full overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          preload="metadata"
          onLoadedData={() => setVideoReady(true)}
          onCanPlay={() => setVideoReady(true)}
          onEnded={(e) => {
            const v = e.currentTarget;
            freezeToEnd(v);
            setVideoEnded(true);

            // ✅ Video bitəndə sözlər avtomatik gəlsin
            setIntroSkipped(true);
            startReveal();
          }}
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/45 to-[#05070d]" />
        <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_170px_rgba(0,0,0,0.75)]" />

        {/* Hero content:
            İlk açılışda: heç bir söz yoxdur (video-only).
            Skip basandan sonra və ya video bitəndən sonra: sözlər bir-bir gəlir + CTA.
        */}
        <div className="relative mx-auto flex h-full w-[min(1160px,92vw)] items-center pt-20">
          {introSkipped && (
            <div
              className={cn(
                "max-w-3xl transition-opacity duration-500",
                videoReady ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDelay: "80ms" }}
            >
              <div className="space-y-3">
                {heroLines.map((x, idx) => {
                  const visible = idx < revealCount;
                  return (
                    <div
                      key={x.k}
                      className={cn(
                        "transition-all duration-500",
                        visible
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-2"
                      )}
                    >
                      {idx === 2 ? (
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-6xl">
                          İdeyanı{" "}
                          <span className="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-300 bg-clip-text text-transparent">
                            Neox
                          </span>{" "}
                          standartında məhsula çevirək.
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
                  revealCount >= heroLines.length
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-2"
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
                    Brief göndər
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Aşağı düyməsi də yalnız introSkipped olanda görünsün */}
        {introSkipped && (
          <button
            type="button"
            onClick={() => scrollToId("door")}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white/70 backdrop-blur hover:bg-white/10"
          >
            Aşağı ↓
          </button>
        )}
      </section>

      {/* DOOR */}
      <section
        id="door"
        className="relative h-[100svh] w-full overflow-hidden bg-black"
      >
        <div
          className="group absolute inset-0"
          onClick={() => isTouch && setDoorOpen((s) => !s)}
          role={isTouch ? "button" : undefined}
          aria-label="door"
        >
          <img
            src={DOOR_CLOSED}
            alt="Door closed"
            className="absolute inset-0 h-full w-full object-contain object-center select-none"
            draggable={false}
          />

          <img
            src={DOOR_OPEN}
            alt="Door open"
            draggable={false}
            className={cn(
              "absolute inset-0 h-full w-full object-contain object-center select-none opacity-0",
              !isTouch
                ? "group-hover:opacity-100"
                : doorOpen
                ? "opacity-100"
                : "opacity-0"
            )}
            style={{
              transition: `opacity ${DOOR_FADE_MS}ms ease-out`,
              willChange: "opacity",
            }}
          />

          <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_150px_rgba(0,0,0,0.8)]" />

          <div className="absolute right-6 top-24">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-3 py-2 text-right backdrop-blur">
              <div className="text-[11px] text-white/40">
                {!isTouch ? "Hover" : "Tap"} → enter
              </div>
              <div className="mt-0.5 text-xs font-semibold text-white/55">
                Keçid
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INSIDE SLIDES */}
      {officeSlides.map((s) => (
        <section
          key={s.id}
          id={s.id}
          className="relative h-[100svh] w-full overflow-hidden bg-black"
        >
          <div
            className="absolute inset-0 bg-center bg-cover bg-no-repeat"
            style={{ backgroundImage: `url(${s.bg})` }}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/20 to-black/65" />
          <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_160px_rgba(0,0,0,0.75)]" />

          <div className="relative mx-auto flex h-full w-[min(1160px,92vw)] items-end pb-14 sm:pb-16">
            <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <Pill>{s.eyebrow}</Pill>
                <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-5xl">
                  {s.title}
                </h2>
                <p className="mt-3 max-w-2xl text-white/75">{s.desc}</p>
              </div>

              <div className="lg:col-span-5">
                <Glass className="p-5 sm:p-6">
                  <div className="text-sm font-semibold text-white/90">
                    Bu mərhələdə nə edirik?
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-white/75">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </Glass>
              </div>
            </div>
          </div>
        </section>
      ))}

      {/* SERVICES */}
      <section id="services" className="relative bg-[#05070d] py-16 sm:py-20">
        <div className="mx-auto w-[min(1160px,92vw)]">
          <Pill>Services</Pill>

          <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">
            Full-stack delivery: bir komandada.
          </h2>

          <p className="mt-3 max-w-2xl text-white/70">
            Sən yalnız qərar verirsən — biz dizaynı, development-i və launch-u
            sprintlərlə icra edirik.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                t: "Product Strategy",
                d: "Workshop, positioning, roadmap, MVP scope, KPI.",
                b: ["JTBD & persona", "Roadmap", "Monetization plan"],
              },
              {
                t: "UX/UI Design",
                d: "Premium UI kit, micro-interactions, onboarding, paywall.",
                b: ["Figma prototype", "Design system", "Handoff"],
              },
              {
                t: "Mobile Development",
                d: "iOS/Android — native və ya cross-platform.",
                b: ["iOS / Android", "Flutter / RN", "Testing"],
              },
              {
                t: "Backend & Cloud",
                d: "API, auth, payments, storage, push, admin.",
                b: ["Scalable arch", "Security-first", "Observability"],
              },
              {
                t: "Analytics & Growth",
                d: "Funnels, events, retention, A/B tests, ASO.",
                b: ["Tracking plan", "Experiments", "Iteration"],
              },
              {
                t: "Launch",
                d: "Store assets, release process, monitoring, iteration.",
                b: ["Release checklist", "Crash monitoring", "Performance tuning"],
              },
            ].map((x) => (
              <Glass key={x.t} className="p-6">
                <div className="text-base font-semibold">{x.t}</div>
                <p className="mt-2 text-sm text-white/70">{x.d}</p>
                <ul className="mt-4 space-y-2 text-sm text-white/75">
                  {x.b.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-r from-violet-400 via-sky-300 to-emerald-300" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </Glass>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT (✅ yalnız 1 form: transparent modal) */}
      <section
        id="contact"
        className="relative h-[100svh] w-full overflow-hidden bg-black"
      >
        <div
          className="absolute inset-0 bg-center bg-cover bg-no-repeat"
          style={{ backgroundImage: `url(${CONTACT_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/35 to-black/15" />
        <div className="pointer-events-none absolute inset-0 [box-shadow:inset_0_0_170px_rgba(0,0,0,0.8)]" />

        {/* ✅ Phone button (soldakı telefonun üstündə) */}
        <div className="absolute inset-0">
          <div className="mx-auto h-full w-[min(1160px,92vw)]">
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className={cn(
                "absolute",
                "left-4 sm:left-8",
                "bottom-24 sm:bottom-28",
                "rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white",
                "backdrop-blur-md hover:bg-white/15 active:scale-[0.99] transition"
              )}
              aria-label="Zəng et formunu aç"
            >
              Yaz bizə zəng et →
            </button>

            <div className="absolute left-4 sm:left-8 bottom-16 text-xs text-white/65">
              Düyməyə bas — form açılacaq.
            </div>
          </div>
        </div>

        {/* ✅ Transparent form modal */}
        {contactOpen && (
          <div
            className="fixed inset-0 z-[9999]"
            role="dialog"
            aria-modal="true"
            aria-label="Contact form"
          >
            {/* Click outside to close (no dark overlay, fully transparent) */}
            <button
              type="button"
              className="absolute inset-0 cursor-default"
              onClick={() => setContactOpen(false)}
              aria-label="Close"
            />

            <div className="relative mx-auto flex h-full w-[min(1160px,92vw)] items-center justify-center">
              <div className="relative w-full max-w-[720px] px-4">
                <div className="rounded-3xl border border-white/15 bg-transparent p-5 sm:p-7">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Pill>Brief</Pill>
                      <div className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">
                        Yaz bizə zəng et
                      </div>
                      <div className="mt-1 text-sm text-white/70">
                        Form tam şəffafdır — arxa fon görünəcək.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setContactOpen(false)}
                      className="rounded-2xl border border-white/15 bg-transparent px-3 py-2 text-sm text-white/80 hover:bg-white/5"
                      aria-label="Bağla"
                    >
                      ✕
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      alert(
                        "Göndərildi (demo). İstəsən formu API/CRM-ə bağlayaq."
                      );
                      (e.target as HTMLFormElement).reset();
                      setContactOpen(false);
                    }}
                    className="mt-5 space-y-4"
                  >
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <input
                        required
                        name="name"
                        placeholder="Ad Soyad"
                        className="w-full rounded-xl border border-white/25 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/55 focus:border-white/45"
                      />
                      <input
                        required
                        type="email"
                        name="email"
                        placeholder="Email"
                        className="w-full rounded-xl border border-white/25 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/55 focus:border-white/45"
                      />
                    </div>

                    <input
                      name="company"
                      placeholder="Şirkət (opsional)"
                      className="w-full rounded-xl border border-white/25 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/55 focus:border-white/45"
                    />

                    <textarea
                      required
                      name="message"
                      rows={5}
                      placeholder="Nə qururuq? Deadline? Büdcə aralığı?"
                      className="w-full rounded-xl border border-white/25 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/55 focus:border-white/45"
                    />

                    <button
                      type="submit"
                      className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-white/90"
                    >
                      Göndər →
                    </button>

                    <div className="text-xs text-white/60">
                      Bu demo submit-dir. İstəsən, göndərişi Telegram/Email/CRM-ə
                      bağlayırıq.
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
