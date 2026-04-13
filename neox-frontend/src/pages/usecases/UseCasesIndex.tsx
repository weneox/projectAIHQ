import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShoppingBag, Landmark, Stethoscope, Truck } from "lucide-react";
import {
  UC_STYLES,
  BreadcrumbPill,
  cx,
  getLangFromPath,
  withLang,
  useMedia,
  usePrefersReducedMotion,
  useRevealScopedBatched,
  useSeo,
} from "./_ucShared";

export default function UseCasesIndex() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const lang = getLangFromPath(pathname);

  const reduced = usePrefersReducedMotion();
  const isMobile = useMedia("(max-width: 560px)", false);
  const rootRef = useRef<HTMLElement | null>(null);

  const [enter, setEnter] = useState(false);
  useEffect(() => {
    const tt = window.setTimeout(() => setEnter(true), 220);
    return () => window.clearTimeout(tt);
  }, []);
  const d = (ms: number) => ({ ["--d" as any]: `${isMobile ? Math.round(ms * 0.7) : ms}ms` });

  const toContact = withLang("/contact", lang);
  const toServices = withLang("/services", lang);

  const toRetail = withLang("/use-cases/retail", lang);
  const toFinance = withLang("/use-cases/finance", lang);
  const toHealthcare = withLang("/use-cases/healthcare", lang);
  const toLogistics = withLang("/use-cases/logistics", lang);

  useSeo({
    title: t("useCases.seo.title", { defaultValue: "NEOX — Use Cases" }),
    description: t("useCases.seo.description", { defaultValue: "Real scenarios where NEOX automates operations." }),
    canonicalPath: withLang("/use-cases", lang),
  });

  useRevealScopedBatched(rootRef, { batchSize: 3, batchDelayMs: 90, rootMargin: "0px 0px -18% 0px" });

  return (
    <main ref={rootRef as any} className="uc-page">
      <style>{UC_STYLES}</style>

      {/* HERO */}
      <section className="uc-hero uc-section" aria-label="Use cases hero">
        <div className="uc-heroBG" aria-hidden="true" />

        <div className="uc-heroInner">
          <div className="relative z-[1] mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 w-full">
            <div className="mx-auto max-w-[980px] text-center">
              <div className="flex justify-center">
                <BreadcrumbPill text={t("useCases.hero.crumb", { defaultValue: "Use Cases" })} enter={enter} delayMs={0} />
              </div>

              <h1 className={cx("mt-6 text-white break-words uc-enter", enter && "uc-in")} style={d(90)}>
                <span className="block text-[40px] leading-[1.05] sm:text-[60px] font-semibold">
                  {t("useCases.hero.title.before", { defaultValue: "Choose a" })}{" "}
                  <span className="uc-grad">{t("useCases.hero.title.highlight", { defaultValue: "Scenario" })}</span>{" "}
                  {t("useCases.hero.title.after", { defaultValue: "to explore" })}
                </span>
              </h1>

              <p
                className={cx(
                  "mt-5 text-[16px] sm:text-[18px] leading-[1.7] text-white/70 break-words uc-enter",
                  enter && "uc-in"
                )}
                style={d(180)}
              >
                {t("useCases.hero.subtitle", { defaultValue: "Each page is a real scenario with measurable results." })}
              </p>

              <div className={cx("mt-8 flex flex-wrap items-center justify-center gap-3 uc-enter", enter && "uc-in")} style={d(270)}>
                <Link to={toContact} className="uc-btn">
                  {t("useCases.cta.ownCase", { defaultValue: "Talk to NEOX" })} <span aria-hidden="true">→</span>
                </Link>
                <Link to={toServices} className="uc-btn uc-btnGhost">
                  {t("useCases.cta.services", { defaultValue: "See Services" })}
                </Link>
              </div>

              <div className="uc-divider" />
            </div>
          </div>
        </div>

        <div className="uc-spacer" />
      </section>

      {/* SCENARIO GRID */}
      <section className="uc-section py-16 sm:py-20" aria-label="Scenarios">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className={cx("uc-reveal reveal-bottom", "text-center max-w-[880px] mx-auto")}>
            <h2 className="text-white text-[26px] sm:text-[34px] font-semibold">
              {t("useCasesIndex.pickTitle", { defaultValue: "Pick a scenario" })}
            </h2>
            <p className="mt-3 text-white/65 leading-[1.75]">
              {t("useCasesIndex.pickSub", {
                defaultValue: "Open a scenario page to see the story, key automations, and results (then we’ll add the videos).",
              })}
            </p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <Link to={toRetail} className={cx("uc-reveal reveal-left", "uc-card uc-pop uc-contain")} data-tint="cyan">
              <div className="flex items-center gap-3">
                <div className="uc-ic" aria-hidden="true">
                  <ShoppingBag className="h-5 w-5" />
                </div>
                <div className="text-white font-semibold text-[18px]">Retail</div>
              </div>
              <div className="mt-4 uc-line" />
              <p className="mt-4 text-white/70 leading-[1.75]">
                Reduce response time, qualify leads, and automate customer questions — without losing the human touch.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-white/70 font-semibold">
                Open scenario <span aria-hidden="true">→</span>
              </div>
            </Link>

            <Link to={toFinance} className={cx("uc-reveal reveal-right", "uc-card uc-pop uc-contain")} data-tint="violet">
              <div className="flex items-center gap-3">
                <div className="uc-ic" aria-hidden="true">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="text-white font-semibold text-[18px]">Finance</div>
              </div>
              <div className="mt-4 uc-line" />
              <p className="mt-4 text-white/70 leading-[1.75]">
                Automate onboarding, document collection, and follow-ups while keeping compliance and audit clarity.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-white/70 font-semibold">
                Open scenario <span aria-hidden="true">→</span>
              </div>
            </Link>

            <Link to={toHealthcare} className={cx("uc-reveal reveal-left", "uc-card uc-pop uc-contain")} data-tint="pink">
              <div className="flex items-center gap-3">
                <div className="uc-ic" aria-hidden="true">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div className="text-white font-semibold text-[18px]">Healthcare</div>
              </div>
              <div className="mt-4 uc-line" />
              <p className="mt-4 text-white/70 leading-[1.75]">
                Schedule faster, reduce no-shows, answer patients instantly, and route complex cases to operators.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-white/70 font-semibold">
                Open scenario <span aria-hidden="true">→</span>
              </div>
            </Link>

            <Link to={toLogistics} className={cx("uc-reveal reveal-right", "uc-card uc-pop uc-contain")} data-tint="amber">
              <div className="flex items-center gap-3">
                <div className="uc-ic" aria-hidden="true">
                  <Truck className="h-5 w-5" />
                </div>
                <div className="text-white font-semibold text-[18px]">Logistics</div>
              </div>
              <div className="mt-4 uc-line" />
              <p className="mt-4 text-white/70 leading-[1.75]">
                Track shipments, auto-update customers, and reduce support tickets using event-driven automation.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 text-white/70 font-semibold">
                Open scenario <span aria-hidden="true">→</span>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {reduced ? null : null}
    </main>
  );
}
