// src/pages/usecases/UseCaseLogistics.tsx
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  LineChart,
  Lock,
  MessageCircle,
  PhoneCall,
  ScanSearch,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";

/** utils */
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
type Lang = "az" | "en" | "tr" | "ru" | "es";
const LANGS: Lang[] = ["az", "en", "tr", "ru", "es"];
function getLangFromPath(pathname: string): Lang {
  const seg = (pathname.split("/")[1] || "").toLowerCase() as Lang;
  return LANGS.includes(seg) ? seg : "az";
}
function withLang(path: string, lang: Lang) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${p}`;
}

/** Cloudinary: smaller/faster + preload */
function cldTransform(url: string, tr: string) {
  if (!url.includes("/upload/")) return url;
  return url.replace("/upload/", `/upload/${tr}/`);
}
function cldMain(url: string, w: number) {
  return cldTransform(url, `f_auto,q_auto,dpr_auto,w_${w}`);
}
function preloadImages(urls: string[]) {
  for (const u of urls) {
    const img = new Image();
    img.decoding = "async";
    img.src = u;
  }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(!!mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : (mq as any).addListener(on);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", on) : (mq as any).removeListener(on);
    };
  }, []);
  return reduced;
}

/**
 * Reveal (scroll):
 * - Only `.reveal` is animated on scroll
 */
function useRevealScoped(disabled: boolean, rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (disabled) return;
    const root = rootRef.current;
    if (!root) return;

    const els = Array.from(root.querySelectorAll<HTMLElement>(".reveal"));
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            el.classList.add("is-in");
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -12% 0px" }
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [disabled, rootRef]);
}

/** FULL-BLEED split section
 *  ✅ HERO: text finishes -> image fades in (preloaded + placeholder)
 */
function FullSplitSection({
  flip = false,
  hero = false,
  heroReveal,
  imageGate = true,
  imgUrl,
  imgPos = "center",
  paperUrl,
  eyebrow,
  title,
  lead,
  bullets,
  chips,
  cta1Href,
  cta1Label,
  cta2Href,
  cta2Label,
}: {
  flip?: boolean;
  hero?: boolean;
  heroReveal?: {
    showEyebrow: boolean;
    showH1: boolean;
    showLead: boolean;
    showActions: boolean;
    showMeta: boolean;
  };
  imageGate?: boolean;
  imgUrl: string;
  imgPos?: string;
  paperUrl: string;
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
  chips: Array<{ icon: any; label: string }>;
  cta1Href: string;
  cta1Label: string;
  cta2Href: string;
  cta2Label: string;
}) {
  const EyebrowCls = hero ? cx("heroReveal", heroReveal?.showEyebrow && "revealOn") : "reveal";
  const H1Cls = hero ? cx("heroReveal", heroReveal?.showH1 && "revealOn") : "reveal";
  const LeadCls = hero ? cx("heroReveal", heroReveal?.showLead && "revealOn") : "reveal";
  const ActionsCls = hero ? cx("heroReveal", heroReveal?.showActions && "revealOn") : "reveal";
  const MetaCls = hero ? cx("heroReveal", heroReveal?.showMeta && "revealOn") : "reveal";

  const [imgReady, setImgReady] = useState(false);

  const srcSet = useMemo(() => {
    const ws = [640, 900, 1200, 1600, 1920, 2400];
    return ws.map((w) => `${cldMain(imgUrl, w)} ${w}w`).join(", ");
  }, [imgUrl]);

  useEffect(() => {
    setImgReady(false);
    const i = new Image();
    i.decoding = "async";
    i.src = cldMain(imgUrl, 1600);

    if (i.complete) {
      setImgReady(true);
      return;
    }
    const on = () => setImgReady(true);
    i.addEventListener("load", on);
    i.addEventListener("error", on);
    return () => {
      i.removeEventListener("load", on);
      i.removeEventListener("error", on);
    };
  }, [imgUrl]);

  const canShow = imgReady && imageGate;

  return (
    <section
      className={cx("fs", flip && "is-flip", hero && "is-hero")}
      style={
        {
          ["--imgpos" as any]: imgPos,
          ["--paper" as any]: `url(${paperUrl})`,
        } as any
      }
    >
      <div className="fs-text">
        <div className={cx("fs-eyebrow", EyebrowCls)} style={!hero ? ({ ["--d" as any]: "0ms" } as any) : undefined}>
          <span className="fs-dot" aria-hidden="true" />
          <span>{eyebrow}</span>
        </div>

        <h1 className={cx("fs-h", H1Cls)} style={!hero ? ({ ["--d" as any]: "90ms" } as any) : undefined}>
          <span className="fs-grad">{title}</span>
        </h1>

        <p className={cx("fs-lead", LeadCls)} style={!hero ? ({ ["--d" as any]: "140ms" } as any) : undefined}>
          {lead}
        </p>

        <ul className={cx("fs-bullets", MetaCls)} style={!hero ? ({ ["--d" as any]: "190ms" } as any) : undefined}>
          {bullets.map((b, i) => (
            <li key={i}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className={cx("fs-ctaRow", ActionsCls)} style={!hero ? ({ ["--d" as any]: "240ms" } as any) : undefined}>
          <a className="fs-btn" href={cta1Href}>
            <MessageCircle size={16} />
            {cta1Label} <span aria-hidden="true">→</span>
          </a>
          <a className="fs-btn fs-btnGhost" href={cta2Href}>
            <PhoneCall size={16} />
            {cta2Label}
          </a>
        </div>

        <div className={cx("fs-chips", MetaCls)} style={!hero ? ({ ["--d" as any]: "300ms" } as any) : undefined}>
          {chips.map((c, i) => {
            const I = c.icon;
            return (
              <span className="fs-chip" key={i}>
                <I size={14} /> {c.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* ✅ placeholder always visible; real image fades in after gate */}
      <div className={cx("fs-img", canShow && "is-show")} aria-hidden="true">
        <div className="fs-imgPh" />
        <img
          className="fs-imgEl"
          src={cldMain(imgUrl, 1600)}
          srcSet={srcSet}
          sizes="(max-width: 980px) 100vw, 50vw"
          alt=""
          decoding="async"
          loading={hero ? "eager" : "lazy"}
          // @ts-ignore
          fetchpriority={hero ? "high" : "auto"}
          onLoad={() => setImgReady(true)}
        />
      </div>
    </section>
  );
}

export default memo(function UseCaseLogistics() {
  const { pathname } = useLocation();
  const lang = getLangFromPath(pathname);
  const reduced = usePrefersReducedMotion();

  const rootRef = useRef<HTMLElement | null>(null);
  useRevealScoped(reduced, rootRef);

  // ✅ HERO step reveal
  const [revealCount, setRevealCount] = useState(0);
  const revealTimerRef = useRef<number | null>(null);

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
      if (i >= 5) stopRevealTimer();
    }, 220);
  };

  useEffect(() => {
    if (reduced) {
      setRevealCount(99);
      return;
    }
    startReveal();
    return () => stopRevealTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  const showEyebrow = revealCount >= 1;
  const showH1 = revealCount >= 2;
  const showLead = revealCount >= 3;
  const showActions = revealCount >= 4;
  const showMeta = revealCount >= 5;

  const toContact = withLang("/contact", lang);
  const toServices = withLang("/services", lang);

  const PAPER =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771215237/chantelleceecee-grey-370125_1280_wib88e.png";

  // image sides (SƏNİN 4 ŞƏKİL)
  const BG_1 = "https://res.cloudinary.com/dppoomunj/image/upload/v1771225688/ajs1-city-5284656_1920_herplb.jpg";
  const BG_2 =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771225875/ralf1403-locomotive-8568473_1920_bg85jn.jpg";
  const BG_3 =
    "https://res.cloudinary.com/dppoomunj/image/upload/v1771225688/niklas9416-hamburg-6849995_1920_cbsrh1.jpg";
  const BG_4 = "https://res.cloudinary.com/dppoomunj/image/upload/v1771225688/anestiev-port-3855074_1920_wmp36r.jpg";

  // ✅ preload (hero + rest)
  useEffect(() => {
    preloadImages([cldMain(BG_1, 1600), cldMain(BG_2, 1200), cldMain(BG_3, 1200), cldMain(BG_4, 1200)]);
  }, []);

  const t = useMemo(() => {
    return {
      cta1: lang === "az" ? "Logistics-ə uyğunlaşdır" : "Adapt",
      cta2: lang === "az" ? "Xidmətlər" : "Services",
      s1: {
        eyebrow: "USE CASE • LOGISTICS",
        title: "Logistics senarisi",
        lead: "Müştəri yazır → sistem niyyəti anlayır → düzgün yönləndirir.",
        bullets: [
          "Sorğu: marşrut / qiymət / çatdırılma vaxtı.",
          "Sənəd/daşınma detalları → düzgün next-step.",
          "Hər addım ölçülür (SLA, gecikmə, no-show).",
        ],
        chips: [
          { icon: ScanSearch, label: "Sorğu" },
          { icon: ClipboardList, label: "Dispatch" },
          { icon: CalendarCheck2, label: "Booking" },
          { icon: LineChart, label: "KPI" },
        ],
      },
      s2: {
        eyebrow: "SCENARIO 01 • ROUTING",
        title: "Sürətli routing",
        lead: "2–3 sual → uyğun xətt → CTA.",
        bullets: ["Haradan–haraya → marşrut seçimi.", "Yük tipi / ölçü → qayda + qiymət aralığı.", "Həssas hal → operator."],
        chips: [
          { icon: ScanSearch, label: "Intent" },
          { icon: ClipboardList, label: "Kataloq" },
          { icon: CalendarCheck2, label: "CTA" },
          { icon: BellRing, label: "Reminder" },
        ],
      },
      s3: {
        eyebrow: "SCENARIO 02 • SAFETY",
        title: "Safe handoff",
        lead: "Qayda ilə operatora ötürmə + kontekst xülasəsi.",
        bullets: ["Summary: nə istədi + next-step.", "SLA: gecikməsiz ötürmə.", "No-show ↓: xatırlatma."],
        chips: [
          { icon: Users, label: "Operator" },
          { icon: ShieldCheck, label: "Safety" },
          { icon: Siren, label: "Escalation" },
          { icon: BellRing, label: "No-show" },
        ],
      },
      s4: {
        eyebrow: "SCENARIO 03 • PRIVACY + KPI",
        title: "Məxfilik + ölçüm",
        lead: "Minimal data + audit + dashboard.",
        bullets: ["Minimal data + log/audit.", "KPI: response, booking, handoff.", "Optim: A/B test."],
        chips: [
          { icon: Lock, label: "Privacy" },
          { icon: LineChart, label: "Dashboard" },
          { icon: ShieldCheck, label: "Compliance" },
          { icon: ArrowRight, label: "Optimize" },
        ],
      },
    };
  }, [lang]);

  return (
    <main ref={rootRef as any} className="fsRoot">
      <style>{`
        html, body { background:#000 !important; }
        .fsRoot{ background:#000; }

        /* REVEAL (scroll) */
        .reveal{
          opacity: 0;
          transform: translate3d(0,12px,0);
          transition: opacity .58s ease, transform .58s ease;
          transition-delay: var(--d, 0ms);
          will-change: opacity, transform;
        }
        .reveal.is-in{ opacity: 1; transform: translate3d(0,0,0); }

        /* HERO REVEAL */
        .heroReveal{
          opacity: 0;
          transform: translate3d(0,10px,0);
          transition: opacity .55s ease, transform .55s ease;
          will-change: opacity, transform;
        }
        .heroReveal.revealOn{ opacity: 1; transform: translate3d(0,0,0); }

        @media (prefers-reduced-motion: reduce){
          .reveal, .heroReveal{
            opacity:1 !important;
            transform:none !important;
            transition:none !important;
          }
          .fs-imgEl, .fs-imgPh{ transition:none !important; }
        }

        /* SECTION */
        .fs{
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          position: relative;
          overflow: hidden;
          isolation: isolate;
          background: #000;
          min-height: calc(100vh - var(--hdrh, 0px));
          min-height: calc(100svh - var(--hdrh, 0px));
        }

        /* swap */
        .fs.is-flip .fs-text{ order: 2; }
        .fs.is-flip .fs-img{ order: 1; }

        /* TEXT SIDE */
        .fs-text{
          position: relative;
          padding: calc(var(--hdrh,72px) + 44px) clamp(18px, 6vw, 88px) 56px;
          color: #0b0f14;
          z-index: 2;
          overflow:hidden;

          background-image:
            linear-gradient(180deg, rgba(255,255,255,.74), rgba(255,255,255,.92)),
            url(${PAPER});
          background-size: auto, cover;
          background-position: center, center;
          background-repeat: no-repeat;
        }
        .fs-text > *{ max-width: 72ch; }

        /* IMAGE SIDE (gate + placeholder) */
        .fs-img{
          position: relative;
          overflow:hidden;
          background:#05070a;
          min-height: calc(100vh - var(--hdrh, 0px));
          min-height: calc(100svh - var(--hdrh, 0px));
        }
        .fs-imgPh{
          position:absolute; inset:0;
          background:
            radial-gradient(900px 560px at 18% 18%, rgba(0,200,255,.12), transparent 62%),
            radial-gradient(900px 560px at 88% 18%, rgba(40,90,255,.10), transparent 62%),
            linear-gradient(180deg, rgba(255,255,255,.04), rgba(0,0,0,.40));
        }
        .fs-imgEl{
          position:absolute; inset:0;
          width:100%; height:100%;
          object-fit: cover;
          object-position: var(--imgpos, center);
          opacity: 0;
          transition: opacity .42s ease;
          will-change: opacity;
        }
        .fs-img.is-show .fs-imgEl{ opacity: 1; }
        .fs-img.is-show .fs-imgPh{ opacity: 0; transition: opacity .55s ease; }

        /* FIX seam */
        .fs-img{ margin-left: -1px; }
        .fs.is-flip .fs-img{ margin-left: 0; margin-right: -1px; }

        /* diagonal wedge on IMAGE side */
        .fs-img::after{
          content:"";
          position:absolute;
          top:0; bottom:0;
          left: -120px;
          width: 260px;
          background:
            linear-gradient(180deg, rgba(255,255,255,.72), rgba(255,255,255,.88)),
            url(${PAPER});
          background-size: auto, cover;
          background-repeat:no-repeat;
          background-position:center;
          transform: skewX(-11deg);
          transform-origin: top;
          z-index: 3;
          pointer-events:none;
          box-shadow: -18px 0 80px rgba(0,0,0,.12);
        }
        .fs.is-flip .fs-img::after{
          left: auto;
          right: -120px;
          transform: skewX(11deg);
          box-shadow: 18px 0 80px rgba(0,0,0,.12);
        }

        /* subtle tint */
        .fs-img::before{
          content:"";
          position:absolute; inset:0;
          background:
            radial-gradient(900px 560px at 18% 18%, rgba(0,200,255,.18), transparent 62%),
            radial-gradient(900px 560px at 88% 18%, rgba(40,90,255,.16), transparent 62%),
            linear-gradient(180deg, rgba(0,0,0,.06), rgba(0,0,0,.30));
          pointer-events:none;
          z-index: 2;
        }

        /* responsive */
        @media (max-width: 980px){
          .fs{ grid-template-columns: 1fr; }
          .fs-text{
            order: 0 !important;
            padding: calc(var(--hdrh,72px) + 22px) 18px 22px;
          }
          .fs-img{
            order: 1 !important;
            min-height: 46svh !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
          }
          .fs-img::after{ display:none; }
        }

        /* Typography palette */
        .fs-grad{
          background: linear-gradient(
            90deg,
            #0b0f14 0%,
            #0b0f14 68%,
            rgba(0,170,255,1) 100%
          );
          -webkit-background-clip:text;
          background-clip:text;
          color:transparent;
        }
        .fs-eyebrow{
          display:inline-flex;
          gap: 10px;
          align-items:center;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.14);
          background: transparent;
          font-size: 12px;
          letter-spacing: .14em;
          text-transform: uppercase;
          color: rgba(0,0,0,.62);
          font-weight: 850;
          width: fit-content;
        }
        .fs-dot{
          width: 8px; height: 8px; border-radius: 999px;
          background: rgba(0,170,255,1);
          box-shadow: 0 0 0 4px rgba(0,170,255,.12);
        }
        .fs-h{
          margin: 14px 0 0;
          font-size: clamp(44px, 5.2vw, 82px);
          line-height: 1.02;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
        .fs-lead{
          margin-top: 10px;
          color: rgba(0,0,0,.62);
          font-size: 18px;
          line-height: 1.7;
          font-weight: 650;
          text-shadow: 0 1px 0 rgba(255,255,255,.35);
        }
        .fs-bullets{
          margin: 14px 0 0;
          padding: 0;
          list-style:none;
          display:flex;
          flex-direction: column;
          gap: 10px;
        }
        .fs-bullets li{
          display:flex;
          gap: 10px;
          align-items:flex-start;
          color: rgba(0,0,0,.78);
          line-height: 1.6;
          font-weight: 650;
        }
        .fs-bullets svg{
          margin-top: 2px;
          color: rgba(0,170,255,1);
          flex: 0 0 auto;
        }
        .fs-ctaRow{
          margin-top: 16px;
          display:flex;
          gap: 10px;
          align-items:center;
          flex-wrap: wrap;
        }
        .fs-btn{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap: 10px;
          height: 46px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.16);
          background: transparent;
          color: rgba(0,0,0,.88);
          font-weight: 950;
          cursor:pointer;
          transition: transform .14s ease, border-color .14s ease;
          white-space: nowrap;
          text-decoration: none;
        }
        .fs-btn:hover{
          transform: translate3d(0,-1px,0);
          border-color: rgba(0,0,0,.26);
          background: transparent;
        }
        @media (hover:none){ .fs-btn:hover{ transform:none; } }
        .fs-chips{
          margin-top: 14px;
          display:flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items:center;
        }
        .fs-chip{
          display:inline-flex; align-items:center; gap: 8px;
          padding: 10px 12px;
          border-radius: 999px;
          border: 1px solid rgba(0,0,0,.14);
          background: transparent;
          color: rgba(0,0,0,.78);
          font-weight: 900;
          font-size: 12px;
          letter-spacing: .06em;
          text-transform: uppercase;
        }
      `}</style>

      {/* ✅ HERO: sözlər bitənə kimi şəkil GÖRÜNMÜR, sonra yumşaq gəlir */}
      <FullSplitSection
        hero
        heroReveal={{ showEyebrow, showH1, showLead, showActions, showMeta }}
        imageGate={showMeta}
        flip={false}
        imgUrl={BG_1}
        imgPos="center"
        paperUrl={PAPER}
        eyebrow={t.s1.eyebrow}
        title={t.s1.title}
        lead={t.s1.lead}
        bullets={t.s1.bullets}
        chips={t.s1.chips}
        cta1Href={toContact}
        cta1Label={t.cta1}
        cta2Href={toServices}
        cta2Label={t.cta2}
      />

      {/* Other sections: normal scroll reveal, şəkil dərhal görünür */}
      <FullSplitSection
        flip
        imgUrl={BG_2}
        imgPos="center"
        paperUrl={PAPER}
        eyebrow={t.s2.eyebrow}
        title={t.s2.title}
        lead={t.s2.lead}
        bullets={t.s2.bullets}
        chips={t.s2.chips}
        cta1Href={toContact}
        cta1Label={lang === "az" ? "Routing-i quraq" : "Set up routing"}
        cta2Href={toServices}
        cta2Label={t.cta2}
      />

      <FullSplitSection
        flip={false}
        imgUrl={BG_3}
        imgPos="center"
        paperUrl={PAPER}
        eyebrow={t.s3.eyebrow}
        title={t.s3.title}
        lead={t.s3.lead}
        bullets={t.s3.bullets}
        chips={t.s3.chips}
        cta1Href={toContact}
        cta1Label={lang === "az" ? "Handoff planı" : "Handoff plan"}
        cta2Href={toServices}
        cta2Label={t.cta2}
      />

      <FullSplitSection
        flip
        imgUrl={BG_4}
        imgPos="center"
        paperUrl={PAPER}
        eyebrow={t.s4.eyebrow}
        title={t.s4.title}
        lead={t.s4.lead}
        bullets={t.s4.bullets}
        chips={t.s4.chips}
        cta1Href={toContact}
        cta1Label={lang === "az" ? "KPI dashboard" : "KPI dashboard"}
        cta2Href={toServices}
        cta2Label={t.cta2}
      />
    </main>
  );
});
