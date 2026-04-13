// src/pages/usecases/UseCaseSingle.tsx
import React, { memo, useEffect, useMemo, useRef } from "react";
import type { LucideIcon } from "lucide-react";
import { ShoppingBag, Landmark, Stethoscope, Truck } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

/* helpers */
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}
const LANGS = ["az", "tr", "en", "ru", "es"] as const;
type Lang = (typeof LANGS)[number];
function getLangFromPath(pathname: string): Lang {
  const seg = (pathname || "/").split("/")[1] || "az";
  return (LANGS as readonly string[]).includes(seg) ? (seg as Lang) : "az";
}
function withLang(path: string, lang: Lang) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${p}`;
}

/* Reveal (same behavior) */
function useRevealScopedBatched(
  rootRef: React.RefObject<HTMLElement>,
  rootMargin = "0px 0px -18% 0px"
) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    root.classList.add("uc-io");
    const els = Array.from(root.querySelectorAll<HTMLElement>(".uc-reveal"));
    if (!els.length) return;

    const revealNow = (el: HTMLElement) => el.classList.add("is-in");

    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (prefersReduced || typeof IntersectionObserver === "undefined") {
      els.forEach(revealNow);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          io.unobserve(el);
          revealNow(el);
        }
      },
      { threshold: 0.12, rootMargin }
    );

    els.forEach((el) => io.observe(el));

    const fallback = window.setTimeout(() => {
      els.forEach(revealNow);
      io.disconnect();
    }, 2200);

    return () => {
      window.clearTimeout(fallback);
      io.disconnect();
    };
  }, [rootRef, rootMargin]);
}

/* SEO */
function useSeo(opts: { title: string; description: string; canonicalPath: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = opts.title;

    const base = window.location.origin;
    const canonicalUrl = base + opts.canonicalPath;

    let canonical = document.head.querySelector(`link[rel="canonical"]`) as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalUrl);

    let desc = document.head.querySelector(`meta[name="description"]`) as HTMLMetaElement | null;
    if (!desc) {
      desc = document.createElement("meta");
      desc.setAttribute("name", "description");
      document.head.appendChild(desc);
    }
    desc.setAttribute("content", opts.description);

    return () => {
      document.title = prevTitle;
    };
  }, [opts.title, opts.description, opts.canonicalPath]);
}

/* types */
type Tint = "cyan" | "violet" | "pink" | "amber";
type CaseText = {
  sektor: string;
  basliq: string;
  hekayə: string;
  maddeler: string[];
  neticeler: Array<{ k: string; v: string; sub: string }>;
};
type CaseItem = CaseText & { icon: LucideIcon; tint: Tint };

/* tiny UI */
const BreadcrumbPill = memo(function BreadcrumbPill({ text }: { text: string }) {
  return (
    <div className="uc-crumb uc-reveal reveal-top" aria-label="Breadcrumb">
      <span className="uc-crumbDot" aria-hidden="true" />
      <span className="uc-crumbText">{text}</span>
    </div>
  );
});

const Bullet = memo(function Bullet({ text }: { text: string }) {
  return (
    <div className="uc-bullet flex items-start gap-2">
      <span className="uc-crumbDot" aria-hidden="true" style={{ width: 7, height: 7 }} />
      <span className="text-white/75 leading-[1.65] break-words">{text}</span>
    </div>
  );
});

const ResultTile = memo(function ResultTile({ k, v, sub }: { k: string; v: string; sub: string }) {
  return (
    <div className="uc-tile uc-pop uc-contain">
      <div className="uc-tileK">{k}</div>
      <div className="uc-tileV mt-1">{v}</div>
      <div className="text-white/55 text-[12px] mt-2 leading-[1.5]">{sub}</div>
    </div>
  );
});

export default function UseCaseSingle({
  caseIndex,
  canonicalPath,
}: {
  caseIndex: number; // 0..3
  canonicalPath: string; // "/use-cases/finance" etc (lang will be prepended)
}) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const lang = getLangFromPath(pathname);
  const rootRef = useRef<HTMLElement | null>(null);

  const toContact = withLang("/contact", lang);
  const toServices = withLang("/services", lang);

  const casesText = useMemo(() => {
    const v = t("useCases.cases", { returnObjects: true }) as unknown;
    return (Array.isArray(v) ? v : []) as CaseText[];
  }, [t, lang]);

  const meta = useMemo(
    () =>
      [
        { icon: ShoppingBag, tint: "cyan" as Tint },
        { icon: Landmark, tint: "violet" as Tint },
        { icon: Stethoscope, tint: "pink" as Tint },
        { icon: Truck, tint: "amber" as Tint },
      ][caseIndex] ?? { icon: ShoppingBag, tint: "cyan" as Tint },
    [caseIndex]
  );

  const c: CaseItem = useMemo(() => {
    const txt = casesText[caseIndex] || ({} as any);
    return {
      icon: meta.icon,
      tint: meta.tint,
      sektor: txt?.sektor || "",
      basliq: txt?.basliq || "",
      hekayə: txt?.hekayə || "",
      maddeler: Array.isArray(txt?.maddeler) ? txt.maddeler : [],
      neticeler: Array.isArray(txt?.neticeler) ? txt.neticeler : [],
    };
  }, [casesText, caseIndex, meta.icon, meta.tint]);

  // ✅ FIX: dynamic icon component
  const Icon = c.icon;

  useSeo({
    title: c.sektor ? `${c.sektor} — ${t("useCases.seo.title")}` : t("useCases.seo.title"),
    description: c.hekayə || t("useCases.seo.description"),
    canonicalPath: withLang(canonicalPath, lang),
  });

  useRevealScopedBatched(rootRef);

  return (
    <main ref={rootRef as any} className="uc-page">
      {/* eyni vizual dili saxlayırıq (səndə olan classlar) */}
      <section className="uc-hero uc-section" aria-label={t("useCases.aria.hero")}>
        <div className="uc-heroBG" aria-hidden="true" />
        <div className="uc-heroInner">
          <div className="relative z-[1] mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 w-full">
            <div className="mx-auto max-w-[980px] text-center">
              <div className="flex justify-center">
                <BreadcrumbPill text={c.sektor || t("useCases.hero.crumb")} />
              </div>

              <h1 className={cx("mt-6 text-white break-words uc-reveal reveal-bottom")}>
                <span className="block text-[36px] leading-[1.05] sm:text-[56px] font-semibold">
                  <span className="uc-grad">{c.basliq || t("useCases.hero.title.highlight")}</span>
                </span>
              </h1>

              <p
                className={cx(
                  "mt-5 text-[16px] sm:text-[18px] leading-[1.7] text-white/70 break-words uc-reveal reveal-bottom"
                )}
              >
                {c.hekayə || t("useCases.hero.subtitle")}
              </p>

              <div className={cx("mt-8 flex flex-wrap items-center justify-center gap-3 uc-reveal reveal-bottom")}>
                <Link to={toContact} className="uc-btn">
                  {t("useCases.cta.ownCase")} <span aria-hidden="true">→</span>
                </Link>
                <Link to={toServices} className="uc-btn uc-btnGhost">
                  {t("useCases.cta.services")}
                </Link>
              </div>

              <div className="uc-divider" />
            </div>
          </div>
        </div>
        <div className="uc-spacer" />
      </section>

      {/* Single case content */}
      <section className="uc-section py-16 sm:py-20" aria-label={c.sektor || "Use Case"}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-start uc-stack" data-tint={c.tint}>
            {/* TEXT */}
            <div className="uc-reveal reveal-left">
              <article className="uc-card uc-pop uc-contain" data-tint={c.tint}>
                <header className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="uc-ic" aria-hidden="true">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-white font-semibold text-[18px] break-words">{c.sektor}</div>
                      <div className="text-white/55 text-[13px] mt-1 break-words">{t("useCases.labels.realScenario")}</div>
                    </div>
                  </div>
                  <span className="text-[11px] px-3 py-1 rounded-full border tracking-[.08em] uppercase border-white/10 bg-white/[0.04] text-white/80">
                    {t("useCases.labels.case")}
                  </span>
                </header>

                <div className="mt-4 uc-line" />

                <h3 className="mt-4 text-white text-[20px] sm:text-[22px] font-semibold break-words">{c.basliq}</h3>

                <div className="mt-5 space-y-3">
                  {c.maddeler.map((b) => (
                    <Bullet key={b} text={b} />
                  ))}
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {c.neticeler.map((r) => (
                    <ResultTile key={`${r.v}-${r.k}`} k={r.k} v={r.v} sub={r.sub} />
                  ))}
                </div>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link to={toContact} className="uc-btn">
                    {t("useCases.cta.schedule")} <span aria-hidden="true">→</span>
                  </Link>
                  <Link to={toServices} className="uc-btn uc-btnGhost">
                    {t("useCases.cta.services")}
                  </Link>
                </div>
              </article>
            </div>

            {/* VISUAL placeholder (video later) */}
            <div className="uc-reveal reveal-right">
              <div className="uc-hud uc-pop uc-contain" data-tint={c.tint}>
                <div className="uc-hudInner">
                  <Icon className="uc-hudIcon" aria-hidden="true" />
                  <div className="text-white/70 text-center max-w-[420px]">
                    <div className="text-[12px] tracking-[.14em] uppercase text-white/60">Visual panel</div>
                    <div className="mt-2 text-white font-semibold">Video will be placed here</div>
                    <div className="mt-2 text-white/55 text-[13px] leading-[1.6]">
                      Növbəti mərhələdə bu hissəyə Cloudinary video bloklarını əlavə edəcəyik.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
