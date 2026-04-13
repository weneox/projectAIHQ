// src/pages/resources/ResourcesGuides.tsx
import React, { memo, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { Lang } from "../../i18n/lang";
import { BookOpen, Rocket, ShieldCheck, TrendingUp } from "lucide-react";

/* ---------------- helpers ---------------- */
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** Reduced motion */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const on = () => setReduced(!!mq.matches);
    on();
    mq.addEventListener ? mq.addEventListener("change", on) : mq.addListener(on);
    return () => {
      mq.removeEventListener ? mq.removeEventListener("change", on) : mq.removeListener(on);
    };
  }, []);
  return reduced;
}

const GUIDES = [
  {
    id: "use-cases",
    title: "Use-Cases",
    desc: "Real biznes ssenariləri: healthcare, retail, logistics və s.",
    icon: BookOpen,
    to: "/use-cases",
    glow: "cyan",
  },
  {
    id: "setup",
    title: "Setup & Launch",
    desc: "Sistemi sıfırdan qur, deploy et, live-a çıxar.",
    icon: Rocket,
    to: "/resources/docs",
    glow: "amber",
  },
  {
    id: "seo",
    title: "SEO Growth",
    desc: "Indexlənmə, page speed və conversion artımı.",
    icon: TrendingUp,
    to: "/resources/guides/seo",
    glow: "violet",
  },
  {
    id: "best",
    title: "Best Practices",
    desc: "Security, UX və performans üçün tövsiyələr.",
    icon: ShieldCheck,
    to: "/resources/guides/best-practices",
    glow: "pink",
  },
] as const;

export default memo(function ResourcesGuides() {
  const { lang } = useParams<{ lang: Lang }>();
  const reduced = usePrefersReducedMotion();

  return (
    <main className="pageShell neo-guides">
      {/* HERO */}
      <section className="pageHero neo-guides-hero">
        <div className="neo-guides-glow" aria-hidden />
        <h1 className="neo-h1">Guides</h1>
        <p className="neo-sub">
          Praktik bələdçilər: use-cases, setup, SEO və best practices.
        </p>

        <div className="pageActions">
          <Link className="btn btnPrimary" to={`/${lang}/contact`}>Contact</Link>
          <Link className="btn btnGhost" to={`/${lang}/resources/faq`}>FAQ</Link>
        </div>
      </section>

      {/* GRID */}
      <section className="neo-container">
        <div className="neo-guides-grid">
          {GUIDES.map((g) => {
            const Icon = g.icon;
            return (
              <Link
                key={g.id}
                to={g.to.startsWith("/") ? `/${lang}${g.to}` : `/${lang}/${g.to}`}
                className={cx(
                  "neo-guide-card",
                  `glow-${g.glow}`,
                  !reduced && "neo-hover-tilt"
                )}
              >
                <div className="neo-guide-ic">
                  <Icon size={22} />
                </div>
                <div className="neo-guide-body">
                  <h3>{g.title}</h3>
                  <p>{g.desc}</p>
                </div>
                <span className="neo-guide-cta">Open →</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* CTA STRIP */}
      <section className="neo-strip-black">
        <div className="neo-strip-inner">
          <h2>Need a tailored guide for your business?</h2>
          <p>Biz sənin use-case-inə uyğun xüsusi bələdçi hazırlaya bilərik.</p>
          <div className="neo-strip-actions">
            <Link className="btn btnPrimary" to={`/${lang}/contact`}>Request a guide</Link>
            <Link className="btn btnGhost" to={`/${lang}/pricing`}>Pricing</Link>
          </div>
        </div>
      </section>

      {/* Local styles (premium, FPS-friendly) */}
      <style>{`
        .neo-guides-hero{
          position:relative;
          overflow:hidden;
        }
        .neo-guides-glow{
          position:absolute;
          inset:-40%;
          background:
            radial-gradient(40% 30% at 20% 20%, rgba(0,240,255,.12), transparent 60%),
            radial-gradient(30% 40% at 80% 30%, rgba(255,190,110,.10), transparent 60%),
            radial-gradient(30% 30% at 50% 80%, rgba(138,111,255,.12), transparent 60%);
          filter: blur(30px);
          pointer-events:none;
        }
        .neo-guides-grid{
          display:grid;
          grid-template-columns: repeat(4, minmax(0,1fr));
          gap:14px;
        }
        @media (max-width: 1024px){
          .neo-guides-grid{ grid-template-columns: repeat(2, minmax(0,1fr)); }
        }
        @media (max-width: 520px){
          .neo-guides-grid{ grid-template-columns: 1fr; }
        }
        .neo-guide-card{
          position:relative;
          display:flex;
          gap:12px;
          padding:18px;
          border-radius:18px;
          border:1px solid rgba(255,255,255,.10);
          background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.02));
          color:inherit;
          text-decoration:none;
          will-change: transform;
          transform: translateZ(0);
        }
        .neo-hover-tilt:hover{
          transform: translateY(-2px) scale(1.01);
        }
        .neo-guide-ic{
          width:40px; height:40px;
          border-radius:12px;
          display:grid; place-items:center;
          background: rgba(255,255,255,.08);
          border:1px solid rgba(255,255,255,.14);
        }
        .neo-guide-body h3{
          margin:0; font-size:18px; letter-spacing:-.01em;
        }
        .neo-guide-body p{
          margin:6px 0 0; color: rgba(255,255,255,.68);
        }
        .neo-guide-cta{
          margin-left:auto;
          align-self:flex-end;
          opacity:.8;
          transition: opacity .2s ease;
        }
        .neo-guide-card:hover .neo-guide-cta{ opacity:1; }

        /* glows */
        .glow-cyan::after,
        .glow-amber::after,
        .glow-violet::after,
        .glow-pink::after{
          content:"";
          position:absolute; inset:-1px;
          border-radius:18px;
          pointer-events:none;
          filter: blur(14px);
          opacity:.35;
        }
        .glow-cyan::after{ box-shadow: 0 0 0 1px rgba(0,240,255,.25) inset, 0 0 24px rgba(0,240,255,.25); }
        .glow-amber::after{ box-shadow: 0 0 0 1px rgba(255,190,110,.25) inset, 0 0 24px rgba(255,190,110,.25); }
        .glow-violet::after{ box-shadow: 0 0 0 1px rgba(138,111,255,.25) inset, 0 0 24px rgba(138,111,255,.25); }
        .glow-pink::after{ box-shadow: 0 0 0 1px rgba(255,105,180,.25) inset, 0 0 24px rgba(255,105,180,.25); }
      `}</style>
    </main>
  );
});
