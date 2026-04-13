// src/pages/Pricing.tsx
import React, { useEffect, useState } from "react";
import { CheckCircle, X, ArrowRight, Sparkles, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/** Reveal (failsafe) */
function useRevealAll(rootMargin = "0px 0px -12% 0px") {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    if (!els.length) return;

    const showAll = () => els.forEach((el) => el.classList.add("is-in"));

    if (typeof IntersectionObserver === "undefined") {
      showAll();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin }
    );

    els.forEach((el) => io.observe(el));

    // fallback: heç nə olmasa 0.7s sonra hamısını aç
    const t = window.setTimeout(() => {
      showAll();
      io.disconnect();
    }, 700);

    return () => {
      window.clearTimeout(t);
      io.disconnect();
    };
  }, [rootMargin]);
}

/** FAQ accordion */
function FAQItem({ q, a, i }: { q: string; a: string; i: number }) {
  const [open, setOpen] = useState(i === 0);

  return (
    <div className="neox-card reveal reveal-bottom">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 text-left"
      >
        <div className="text-white font-semibold">{q}</div>
        <span
          className="neox-chip"
          style={{
            borderColor: open ? "rgba(0,220,255,.22)" : "rgba(255,255,255,.10)",
            background: open ? "rgba(0,220,255,.08)" : "rgba(255,255,255,.03)",
            color: open ? "rgba(190,245,255,.92)" : "rgba(255,255,255,.68)",
          }}
        >
          {open ? "OPEN" : "VIEW"}
        </span>
      </button>

      {open ? <div className="mt-3 text-white/70 leading-[1.75]">{a}</div> : null}
    </div>
  );
}

type Plan = {
  key: "starter" | "pro" | "enterprise";
  name: string;
  desc: string;
  price: string;
  period?: string;
  badge?: string;
  accent: "cyan" | "violet" | "pink";
  cta: { label: string; to: string; primary?: boolean };
  features: Array<{ ok: boolean; text: string }>;
};

const PLANS: Plan[] = [
  {
    key: "starter",
    name: "Starter",
    desc: "Kiçik komandalar üçün sürətli başlanğıc.",
    price: "$99",
    period: "/month",
    accent: "violet",
    cta: { label: "Start Trial", to: "/contact" },
    features: [
      { ok: true, text: "Up to 5 AI agents" },
      { ok: true, text: "10,000 tasks / month" },
      { ok: true, text: "Basic integrations" },
      { ok: true, text: "Email support (24h)" },
      { ok: true, text: "Standard analytics" },
      { ok: false, text: "Priority support" },
      { ok: false, text: "Custom integrations" },
      { ok: false, text: "Dedicated account manager" },
    ],
  },
  {
    key: "pro",
    name: "Professional",
    desc: "Böyüyən bizneslər üçün ən güclü seçim.",
    price: "$299",
    period: "/month",
    badge: "MOST POPULAR",
    accent: "cyan",
    cta: { label: "Start Trial", to: "/contact", primary: true },
    features: [
      { ok: true, text: "Up to 25 AI agents" },
      { ok: true, text: "100,000 tasks / month" },
      { ok: true, text: "Advanced integrations" },
      { ok: true, text: "Priority support (4h)" },
      { ok: true, text: "Advanced analytics & reporting" },
      { ok: true, text: "Custom workflows" },
      { ok: true, text: "API access" },
      { ok: false, text: "Dedicated account manager" },
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    desc: "Böyük təşkilatlar üçün xüsusi memarlıq + SLA.",
    price: "Custom",
    accent: "pink",
    cta: { label: "Contact Sales", to: "/contact", primary: true },
    features: [
      { ok: true, text: "Unlimited AI agents" },
      { ok: true, text: "Unlimited tasks" },
      { ok: true, text: "Custom integrations" },
      { ok: true, text: "24/7 dedicated support" },
      { ok: true, text: "Custom analytics & reports" },
      { ok: true, text: "Dedicated account manager" },
      { ok: true, text: "On-premise option" },
      { ok: true, text: "SLA guarantee" },
    ],
  },
];

const FAQS = [
  {
    q: "Free trial-da nə var?",
    a: "Hər plan 14 günlük sınaqla gəlir. O tier-in əsas imkanları aktiv olur. Start üçün sales flow-a görə şərtlər dəyişə bilər.",
  },
  {
    q: "Planı sonra dəyişə bilərəm?",
    a: "Bəli. İstədiyin vaxt upgrade/downgrade edə bilərsən. Dəyişiklik növbəti billing dövrünün əvvəlində tətbiq olunur.",
  },
  {
    q: "Task limitini keçsəm nə olur?",
    a: "Limitə yaxınlaşanda xəbərdarlıq edirik. Ya planı yüksəldirsən, ya da əlavə limit veririk. (Səhifədə per-task qiymət yazmırıq.)",
  },
  {
    q: "Annual endirim var?",
    a: "Bəli. İllik ödənişdə endirim və enterprise üçün multi-year paketlər mövcuddur.",
  },
  {
    q: "Data təhlükəsizdirmi?",
    a: "Bəli. Şifrələmə, audit log, access control və layihəyə görə compliance tələblərinə uyğun guardrails tətbiq edirik.",
  },
  {
    q: "Dəstək necə işləyir?",
    a: "Starter: email support. Pro: prioritet support. Enterprise: 24/7 SLA + dedicated support.",
  },
];

function AccentRing({ accent }: { accent: Plan["accent"] }) {
  const ring =
    accent === "cyan"
      ? "radial-gradient(closest-side at 50% 40%, rgba(0,220,255,.22), transparent 62%)"
      : accent === "violet"
      ? "radial-gradient(closest-side at 50% 40%, rgba(150,90,255,.22), transparent 62%)"
      : "radial-gradient(closest-side at 50% 40%, rgba(255,80,200,.20), transparent 62%)";

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background: ring,
        opacity: 0.9,
        filter: "blur(0.2px)",
        maskImage: "radial-gradient(circle at 50% 40%, rgba(0,0,0,1), rgba(0,0,0,0) 70%)",
      }}
    />
  );
}

export default function Pricing() {
  useRevealAll();

  return (
    <main className="relative overflow-hidden" style={{ background: "#05060b", minHeight: "100vh" }}>
      {/* HERO */}
      <section className={cx("neox-hero neox-section", "py-20 sm:py-24")}>
        <div className="neox-bg" style={{ pointerEvents: "none" }}>
          <div className="neox-bg-orbs" />
          <div className="neox-bg-grid" />
          <div className="neox-bg-scan" />
          <div className="neox-bg-noise" />
          <div className="neox-bg-vignette" />
        </div>

        <div className="relative z-[1] mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[920px] text-center">
            <div
              className={cx(
                "reveal reveal-top",
                "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2"
              )}
            >
              <Sparkles className="h-4 w-4 text-white/70" />
              <span className="text-[12px] tracking-[0.14em] uppercase text-white/70">NEOX / Pricing</span>
            </div>

            <h1 className={cx("reveal reveal-bottom", "mt-5 text-[40px] leading-[1.05] sm:text-[56px] font-semibold text-white")}>
              Simple pricing.
              <span className="neox-gradient-text"> Serious automation</span>.
            </h1>

            <p className={cx("reveal reveal-bottom", "mt-5 text-[16px] sm:text-[18px] leading-[1.7] text-white/70")}>
              Paketləri “agent sayı + avtomatlaşdırma həcmi + dəstək səviyyəsi” ilə seç.
              İstədiyin vaxt upgrade edərsən — məqsəd: ölçülən nəticə və stabil sistem.
            </p>

            <div className={cx("reveal reveal-bottom", "mt-8 flex flex-wrap items-center justify-center gap-3")}>
              <Link to="/contact" className="cyber-btn">
                <span className="cyber-btn-inner">Plan seçək →</span>
              </Link>
              <Link to="/services" className="cyber-btn cyber-btn-ghost">
                <span className="cyber-btn-inner">Services</span>
              </Link>
            </div>

            <div className="mt-10 neox-hero-divider" />
          </div>
        </div>
      </section>

      {/* PLANS */}
      <section className="neox-section py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 md:grid-cols-3">
            {PLANS.map((p, i) => {
              const isPopular = p.key === "pro";
              const cardClass = isPopular ? "hud-card" : "neox-card";
              const dir = i === 0 ? "reveal-left" : i === 1 ? "reveal-top" : "reveal-right";

              return (
                <div
                  key={p.key}
                  className={cx("reveal", dir, cardClass, "relative")}
                  style={{
                    padding: isPopular ? 0 : undefined,
                    overflow: "hidden",
                    borderColor: isPopular ? "rgba(0,220,255,.22)" : "rgba(255,255,255,.10)",
                  }}
                >
                  {isPopular ? (
                    <>
                      <AccentRing accent={p.accent} />
                      <div className="hud-card-top">
                        <div className="flex items-center gap-2">
                          <div className="hud-dot" />
                          <div className="text-white/75 text-[12px] tracking-[0.14em] uppercase">Recommended</div>
                        </div>
                        <span className="hud-tag">{p.badge}</span>
                      </div>

                      <div className="hud-card-body">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-white font-semibold text-[20px]">{p.name}</div>
                            <div className="text-white/60 text-[13px] mt-1">{p.desc}</div>
                          </div>
                          <span className="neox-chip">NEOX</span>
                        </div>

                        <div className="mt-5 flex items-end gap-2">
                          <div className="text-white text-[44px] font-semibold leading-none">{p.price}</div>
                          <div className="text-white/55 pb-1">{p.period}</div>
                        </div>

                        <div className="mt-5">
                          <Link to={p.cta.to} className="cyber-btn" style={{ width: "100%", justifyContent: "center" as any }}>
                            <span className="cyber-btn-inner">{p.cta.label}</span>
                          </Link>
                        </div>

                        <div className="mt-6 space-y-3">
                          {p.features.map((f) => (
                            <div key={f.text} className="flex items-start gap-2">
                              {f.ok ? (
                                <CheckCircle className="w-5 h-5 text-cyan-300 mt-[2px]" />
                              ) : (
                                <X className="w-5 h-5 text-white/30 mt-[2px]" />
                              )}
                              <span className={cx("leading-[1.6]", f.ok ? "text-white/75" : "text-white/35")}>{f.text}</span>
                            </div>
                          ))}
                        </div>

                        <div className="hud-shard hud-shard-a" />
                        <div className="hud-shard hud-shard-b" />
                        <div className="hud-shard hud-shard-c" />
                      </div>
                    </>
                  ) : (
                    <>
                      <AccentRing accent={p.accent} />
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold text-[20px]">{p.name}</div>
                          <div className="text-white/60 text-[13px] mt-1">{p.desc}</div>
                        </div>
                        <span className="neox-chip">Tier</span>
                      </div>

                      <div className="mt-4 neox-card-line" />

                      <div className="mt-4 flex items-end gap-2">
                        <div className="text-white text-[40px] font-semibold leading-none">{p.price}</div>
                        {p.period ? <div className="text-white/55 pb-1">{p.period}</div> : null}
                      </div>

                      <div className="mt-5">
                        <Link
                          to={p.cta.to}
                          className={cx("cyber-btn", p.cta.primary ? "" : "cyber-btn-ghost")}
                          style={{ width: "100%", justifyContent: "center" as any }}
                        >
                          <span className="cyber-btn-inner">{p.cta.label}</span>
                        </Link>
                      </div>

                      <div className="mt-6 space-y-3">
                        {p.features.map((f) => (
                          <div key={f.text} className="flex items-start gap-2">
                            {f.ok ? (
                              <CheckCircle className="w-5 h-5 text-cyan-300 mt-[2px]" />
                            ) : (
                              <X className="w-5 h-5 text-white/30 mt-[2px]" />
                            )}
                            <span className={cx("leading-[1.6]", f.ok ? "text-white/75" : "text-white/35")}>{f.text}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* TRUST ROW */}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <div className={cx("reveal reveal-left", "neox-card")}>
              <div className="flex items-center gap-3">
                <div className="neox-ic">
                  <Shield className="h-5 w-5" />
                </div>
                <div className="text-white font-semibold">Security-first</div>
              </div>
              <div className="mt-4 neox-card-line" />
              <p className="mt-4 text-white/70 leading-[1.75]">
                Access control, audit log, encryption və production guardrails — enterprise səviyyə yanaşma.
              </p>
            </div>

            <div className={cx("reveal reveal-bottom", "neox-card")}>
              <div className="flex items-center gap-3">
                <div className="neox-ic">
                  <Zap className="h-5 w-5" />
                </div>
                <div className="text-white font-semibold">Fast ROI</div>
              </div>
              <div className="mt-4 neox-card-line" />
              <p className="mt-4 text-white/70 leading-[1.75]">
                Pilot → KPI → scale. Ən vacibi: ölçülən nəticə və stabil əməliyyat.
              </p>
            </div>

            <div className={cx("reveal reveal-right", "neox-card")}>
              <div className="flex items-center gap-3">
                <div className="neox-ic">
                  <ArrowRight className="h-5 w-5" />
                </div>
                <div className="text-white font-semibold">Upgrade anytime</div>
              </div>
              <div className="mt-4 neox-card-line" />
              <p className="mt-4 text-white/70 leading-[1.75]">
                Biznes böyüdükcə agent sayını, inteqrasiyaları və dəstəyi rahat artırırsan.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="neox-section alt py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className={cx("reveal reveal-top", "text-[28px] sm:text-[38px] font-semibold text-white")}>FAQ</h2>
            <p className={cx("reveal reveal-bottom", "mt-3 text-white/65 max-w-[780px] mx-auto leading-[1.7]")}>
              Qısa cavablar. İstəsən, pricing-i tam sənin biznese görə “paket + KPI” kimi də yaza bilərik.
            </p>
          </div>

          <div className="mt-10 max-w-[860px] mx-auto space-y-4">
            {FAQS.map((f, i) => (
              <FAQItem key={f.q} q={f.q} a={f.a} i={i} />
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="neox-final py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className={cx("reveal reveal-bottom", "neox-final-card")}>
            <div className="max-w-[740px]">
              <div className="text-white/70 text-[12px] tracking-[0.14em] uppercase">still have questions?</div>
              <div className="mt-2 text-white text-[24px] sm:text-[30px] font-semibold">
                Gəl 15 dəqiqəyə planı “sənə uyğun” edək.
              </div>
              <p className="mt-3 text-white/70 leading-[1.75]">
                Sən prosesi danış — biz agent arxitekturasını, roadmap-i və ilkin KPI-ları çıxaraq.
              </p>
            </div>

            <Link to="/contact" className="cyber-btn">
              <span className="cyber-btn-inner">
                Contact Sales <ArrowRight className="ml-2 w-5 h-5" />
              </span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
