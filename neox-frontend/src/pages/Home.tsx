import { useMemo, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  Globe,
  LineChart,
  MessageSquare,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Workflow,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && ["az", "en", "tr", "ru", "es"].includes(value));
}

function withLang(path: string, lang: Lang) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

function delay(step: number): CSSProperties {
  return {
    animationDelay: `${step * 90}ms`,
  };
}

type ServiceCard = {
  icon: LucideIcon;
  title: string;
  desc: string;
  points: string[];
  to: string;
};

type WorkflowStep = {
  index: string;
  title: string;
  desc: string;
};

export default function Home() {
  const { t } = useTranslation();
  const { lang: routeLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(routeLang) ? routeLang : DEFAULT_LANG;

  const stats = useMemo(
    () => [
      {
        value: "24/7",
        label:
          t("home.stats.0") ||
          "Automated responses across web, social, and first-contact flows.",
      },
      {
        value: "<5m",
        label:
          t("home.stats.1") ||
          "Designed for fast lead capture, routing, and operator follow-up.",
      },
      {
        value: "1 system",
        label:
          t("home.stats.2") ||
          "One operational layer for messaging, workflow, and visibility.",
      },
    ],
    [t]
  );

  const services = useMemo<ServiceCard[]>(
    () => [
      {
        icon: Bot,
        title: t("home.services.0.title") || "AI chat and reply systems",
        desc:
          t("home.services.0.desc") ||
          "Premium conversational systems for website, social, and customer communication flows.",
        points: [
          t("home.services.0.points.0") || "Website and messaging automation",
          t("home.services.0.points.1") || "Lead capture and routing",
          t("home.services.0.points.2") || "Operator handoff logic",
        ],
        to: "/services/chatbot-24-7",
      },
      {
        icon: Workflow,
        title: t("home.services.1.title") || "Business workflow automation",
        desc:
          t("home.services.1.desc") ||
          "We connect the repetitive parts of the business so actions, notifications, and records move without manual friction.",
        points: [
          t("home.services.1.points.0") || "Internal process mapping",
          t("home.services.1.points.1") || "Approvals, alerts, and ops flows",
          t("home.services.1.points.2") || "Clean business logic",
        ],
        to: "/services/business-workflows",
      },
      {
        icon: Globe,
        title: t("home.services.2.title") || "Web and product experiences",
        desc:
          t("home.services.2.desc") ||
          "Elegant digital products with brand-level presentation, clear UX, and stable implementation.",
        points: [
          t("home.services.2.points.0") || "Landing pages and websites",
          t("home.services.2.points.1") || "Conversion-first UX",
          t("home.services.2.points.2") || "Premium frontend execution",
        ],
        to: "/services/websites",
      },
    ],
    [t]
  );

  const workflow = useMemo<WorkflowStep[]>(
    () => [
      {
        index: "01",
        title: t("home.workflow.0.title") || "Business mapping",
        desc:
          t("home.workflow.0.desc") ||
          "We identify where communication, requests, handoffs, and delays are happening.",
      },
      {
        index: "02",
        title: t("home.workflow.1.title") || "System design",
        desc:
          t("home.workflow.1.desc") ||
          "We design a cleaner structure for user flows, automation logic, and operator control.",
      },
      {
        index: "03",
        title: t("home.workflow.2.title") || "Execution and refinement",
        desc:
          t("home.workflow.2.desc") ||
          "We launch, measure, refine, and keep the system aligned with real business usage.",
      },
    ],
    [t]
  );

  return (
    <main className="neo-site neo-homeHero">
      <section className="neo-section neo-section--hero neo-section--flushTop">
        <div className="neo-container">
          <div className="neo-homeHeroGrid">
            <div className="neo-heroCopy">
              <div className="neo-stack-24">
                <div data-neo style={delay(0)}>
                  <span className="neo-eyebrow">
                    {t("home.eyebrow") || "Premium business systems"}
                  </span>
                </div>

                <div className="neo-stack-20">
                  <h1 className="neo-display" data-neo style={delay(1)}>
                    {t("home.title.0") || "We design"}{" "}
                    <span className="neo-gradientText">
                      {t("home.title.glow") || "clearer digital systems"}
                    </span>{" "}
                    {t("home.title.1") || "for modern businesses."}
                  </h1>

                  <p className="neo-body-lg" data-neo style={{ ...delay(2), maxWidth: 760 }}>
                    {t("home.sub") ||
                      "NEOX builds refined digital operations — from customer-facing communication to internal workflow structure — with strong design, clear logic, and business-grade execution."}
                  </p>
                </div>

                <div className="neo-actions" data-neo style={delay(3)}>
                  <Link to={withLang("/contact", lang)} className="neo-btn neo-btn--primary">
                    {t("home.cta.primary") || "Start a conversation"}
                    <ArrowUpRight size={16} />
                  </Link>

                  <Link to={withLang("/services/chatbot-24-7", lang)} className="neo-btn">
                    {t("home.cta.secondary") || "Explore services"}
                  </Link>
                </div>

                <div className="neo-pillRow" data-neo style={delay(4)}>
                  <span className="neo-pill">
                    <Bot size={14} />
                    {t("home.pills.0") || "AI reply systems"}
                  </span>
                  <span className="neo-pill">
                    <Workflow size={14} />
                    {t("home.pills.1") || "Workflow automation"}
                  </span>
                  <span className="neo-pill">
                    <LineChart size={14} />
                    {t("home.pills.2") || "Operational visibility"}
                  </span>
                </div>
              </div>
            </div>

            <div className="neo-heroVisual" data-neo style={delay(2)}>
              <div className="neo-heroVisualContent">
                <div className="neo-heroTopRow">
                  <div className="neo-heroWindowDots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>

                  <span className="neo-pill">
                    <Sparkles size={14} />
                    {t("home.hero.visual.badge") || "Live operating view"}
                  </span>
                </div>

                <div className="neo-heroPanel">
                  <div className="neo-heroScreenCard neo-stack-16">
                    <div className="neo-stack-12">
                      <div className="neo-title-md">
                        {t("home.hero.visual.title") || "Business runtime"}
                      </div>
                      <p className="neo-body">
                        {t("home.hero.visual.desc") ||
                          "A cleaner business layer where channels, workflows, and responses move through one structured system."}
                      </p>
                    </div>

                    <ul className="neo-list">
                      <li className="neo-listItem">
                        {t("home.hero.visual.points.0") ||
                          "Website, social, and inbound requests feed one operational flow."}
                      </li>
                      <li className="neo-listItem">
                        {t("home.hero.visual.points.1") ||
                          "Operators see cleaner state, clearer actions, and less manual repetition."}
                      </li>
                      <li className="neo-listItem">
                        {t("home.hero.visual.points.2") ||
                          "Design, automation, and visibility stay aligned."}
                      </li>
                    </ul>
                  </div>

                  <div className="neo-miniMetricGrid">
                    <div className="neo-miniMetric">
                      <div className="neo-miniMetricValue">Web</div>
                      <div className="neo-miniMetricLabel">
                        {t("home.hero.metrics.0") || "Site and landing experiences"}
                      </div>
                    </div>

                    <div className="neo-miniMetric">
                      <div className="neo-miniMetricValue">AI</div>
                      <div className="neo-miniMetricLabel">
                        {t("home.hero.metrics.1") || "Response and workflow logic"}
                      </div>
                    </div>

                    <div className="neo-miniMetric">
                      <div className="neo-miniMetricValue">Ops</div>
                      <div className="neo-miniMetricLabel">
                        {t("home.hero.metrics.2") || "Operator and internal visibility"}
                      </div>
                    </div>

                    <div className="neo-miniMetric">
                      <div className="neo-miniMetricValue">Brand</div>
                      <div className="neo-miniMetricLabel">
                        {t("home.hero.metrics.3") || "Premium interface quality"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="neo-heroBottomRow">
                  <span className="neo-pill">
                    <ShieldCheck size={14} />
                    {t("home.hero.footer.0") || "Structured delivery"}
                  </span>

                  <span className="neo-pill">
                    <MessageSquare size={14} />
                    {t("home.hero.footer.1") || "Customer communication"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="neo-section neo-section--tight">
        <div className="neo-container">
          <div className="neo-divider" />
          <div className="neo-statGrid" style={{ marginTop: 18 }}>
            {stats.map((item, index) => (
              <div key={item.value + item.label} className="neo-stat" data-neo style={delay(index)}>
                <div className="neo-statValue">{item.value}</div>
                <div className="neo-statLabel">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="neo-section">
        <div className="neo-container neo-stack-32">
          <div className="neo-stack-16" style={{ maxWidth: 760 }}>
            <div data-neo style={delay(0)}>
              <span className="neo-eyebrow">
                {t("home.services.kicker") || "What we build"}
              </span>
            </div>

            <h2 className="neo-title-xl" data-neo style={delay(1)}>
              {t("home.services.title.0") || "Beautiful systems are"}{" "}
              <span className="neo-gradientText">
                {t("home.services.title.glow") || "not enough"}
              </span>
              . {t("home.services.title.1") || "They also need to operate well."}
            </h2>

            <p className="neo-body-lg" data-neo style={{ ...delay(2), maxWidth: 720 }}>
              {t("home.services.sub") ||
                "We focus on the intersection of product feel, communication structure, and operational clarity — so the business looks better and runs better at the same time."}
            </p>
          </div>

          <div className="neo-grid-3">
            {services.map((service, index) => {
              const Icon = service.icon;

              return (
                <article
                  key={service.title}
                  className="neo-card neo-card--hover neo-stack-20"
                  data-neo
                  style={delay(index + 1)}
                >
                  <div className="neo-stack-16">
                    <span
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        display: "grid",
                        placeItems: "center",
                        border: "1px solid var(--neo-line)",
                        background: "rgba(255,255,255,.82)",
                        boxShadow: "var(--neo-shadow-xs)",
                        color: "var(--neo-accent)",
                      }}
                    >
                      <Icon size={20} />
                    </span>

                    <div className="neo-stack-12">
                      <h3 className="neo-title-md">{service.title}</h3>
                      <p className="neo-body">{service.desc}</p>
                    </div>
                  </div>

                  <ul className="neo-list">
                    {service.points.map((point) => (
                      <li key={point} className="neo-listItem">
                        {point}
                      </li>
                    ))}
                  </ul>

                  <div style={{ marginTop: "auto" }}>
                    <Link to={withLang(service.to, lang)} className="neo-btn neo-btn--ghost">
                      {t("home.services.more") || "See details"}
                      <ChevronRight size={16} />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="neo-section">
        <div className="neo-container neo-grid-2">
          <div className="neo-stack-24">
            <div data-neo style={delay(0)}>
              <span className="neo-eyebrow">
                {t("home.workflow.kicker") || "How we work"}
              </span>
            </div>

            <div className="neo-stack-16">
              <h2 className="neo-title-xl" data-neo style={delay(1)}>
                {t("home.workflow.title.0") || "We turn scattered work into"}{" "}
                <span className="neo-gradientText">
                  {t("home.workflow.title.glow") || "one cleaner flow"}
                </span>
                .
              </h2>

              <p className="neo-body-lg" data-neo style={{ ...delay(2), maxWidth: 700 }}>
                {t("home.workflow.sub") ||
                  "The goal is not random automation. The goal is a more elegant operating model — fewer broken handoffs, faster response, clearer states, and stronger customer-facing quality."}
              </p>
            </div>

            <div className="neo-actions" data-neo style={delay(3)}>
              <Link to={withLang("/about", lang)} className="neo-btn">
                {t("home.workflow.cta.0") || "Read about NEOX"}
              </Link>

              <Link to={withLang("/contact", lang)} className="neo-btn neo-btn--primary">
                {t("home.workflow.cta.1") || "Discuss your system"}
              </Link>
            </div>
          </div>

          <div className="neo-surface neo-surface--soft" data-neo style={{ ...delay(2), padding: 20 }}>
            <div className="neo-stack-16">
              {workflow.map((step) => (
                <div
                  key={step.index}
                  className="neo-card"
                  style={{
                    padding: 18,
                    background: "rgba(255,255,255,.72)",
                  }}
                >
                  <div className="neo-stack-12">
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 10,
                        color: "var(--neo-text-muted)",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--neo-accent)",
                          fontSize: 13,
                          fontWeight: 800,
                        }}
                      >
                        {step.index}
                      </span>
                      {t("home.workflow.stepLabel") || "Step"}
                    </div>

                    <div className="neo-title-md">{step.title}</div>
                    <p className="neo-body">{step.desc}</p>
                  </div>
                </div>
              ))}

              <div
                className="neo-card"
                style={{
                  padding: 18,
                  background: "linear-gradient(180deg, rgba(37,99,235,.06), rgba(255,255,255,.82))",
                }}
              >
                <div className="neo-stack-12">
                  <div className="neo-title-md">
                    {t("home.workflow.final.title") || "Outcome"}
                  </div>

                  <p className="neo-body">
                    {t("home.workflow.final.desc") ||
                      "A stronger digital presence with cleaner communication, better routing, and more confidence in how the business operates day to day."}
                  </p>

                  <div className="neo-pillRow">
                    <span className="neo-pill">
                      <MessageSquare size={14} />
                      {t("home.workflow.final.pills.0") || "Clearer conversations"}
                    </span>
                    <span className="neo-pill">
                      <PhoneCall size={14} />
                      {t("home.workflow.final.pills.1") || "Better first contact"}
                    </span>
                    <span className="neo-pill">
                      <LineChart size={14} />
                      {t("home.workflow.final.pills.2") || "Stronger visibility"}
                    </span>
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