import { ArrowRight, Bot, BrainCircuit, Check, Code2, MessageCircle, Sparkles, Workflow, Zap } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

const LANGS: Lang[] = ["az", "tr", "ru", "en", "es"];

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && (LANGS as readonly string[]).includes(value));
}

function useSafeLang(): Lang {
  const { lang } = useParams<{ lang?: string }>();
  return isLang(lang) ? lang : DEFAULT_LANG;
}

function withLang(lang: Lang, path: string) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

const CARD_IMAGE =
  "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1800&auto=format&fit=crop";

export default function PremiumServiceCards() {
  const lang = useSafeLang();

  return (
    <section className="nx-section nx-premium-card-section">
      <div className="nx-container-wide">
        <div className="nx-premium-card-head">
          <p className="nx-kicker">Xidmət sistemləri</p>
          <div className="nx-premium-card-title-row">
            <h2 className="nx-title-sm">Biznes üçün qurulan ağıllı sistemlər</h2>
            <p className="nx-copy">
              Veb, mesajlaşma və avtomatlaşdırma modulları eyni premium dizayn dili ilə təqdim olunur.
            </p>
          </div>
        </div>

        <div className="nx-premium-card-grid">
          <Link
            to={withLang(lang, "/services/web-systems")}
            className="nx-premium-card nx-premium-card--blur"
            aria-label="Veb sistemi haqqında daha ətraflı"
          >
            <div className="nx-premium-card-media">
              <img src={CARD_IMAGE} alt="" loading="lazy" />
              <div className="nx-premium-card-media-shade" />
              <div className="nx-premium-card-orb nx-premium-card-orb--one" />
              <div className="nx-premium-card-orb nx-premium-card-orb--two" />
            </div>

            <div className="nx-premium-card-top">
              <span className="nx-premium-card-badge">
                <Code2 size={14} />
                Veb sistem
              </span>
            </div>

            <div className="nx-premium-card-body">
              <h3>Veb sistemi qurur</h3>
              <p>Brendə uyğun, sürətli və satış yönümlü web səhifələri biznes axını ilə birlikdə hazırlayırıq.</p>
            </div>

            <div className="nx-premium-card-center-cta">
              <span>
                Daha ətraflı
                <ArrowRight size={17} />
              </span>
            </div>
          </Link>

          <Link
            to={withLang(lang, "/services/automation")}
            className="nx-premium-card nx-premium-card--workflow"
            aria-label="İş axını avtomatlaşdırması haqqında daha ətraflı"
          >
            <div className="nx-workflow-visual" aria-hidden="true">
              <div className="nx-workflow-line nx-workflow-line--a" />
              <div className="nx-workflow-line nx-workflow-line--b" />
              <div className="nx-workflow-line nx-workflow-line--c" />

              <span className="nx-workflow-node nx-workflow-node--main">
                <Workflow size={24} />
              </span>
              <span className="nx-workflow-node nx-workflow-node--top">
                <MessageCircle size={18} />
              </span>
              <span className="nx-workflow-node nx-workflow-node--right">
                <Bot size={18} />
              </span>
              <span className="nx-workflow-node nx-workflow-node--bottom">
                <Check size={18} />
              </span>
              <span className="nx-workflow-pulse" />
            </div>

            <div className="nx-premium-card-body nx-premium-card-body--workflow">
              <span className="nx-premium-card-badge nx-premium-card-badge--light">
                <Zap size={14} />
                Workflow
              </span>
              <h3>İş axınını avtomatlaşdırır</h3>
              <p>Cavab, yönləndirmə, lead izləmə və komanda proseslərini daha səliqəli sistemə salırıq.</p>
            </div>

            <div className="nx-premium-card-foot">
              <span>Daha ətraflı</span>
              <ArrowRight size={17} />
            </div>
          </Link>

          <Link
            to={withLang(lang, "/services/ai-replies")}
            className="nx-premium-card nx-premium-card--featured"
            aria-label="Süni İntellekt cavabları haqqında daha ətraflı"
          >
            <div className="nx-featured-glow" aria-hidden="true" />
            <div className="nx-featured-visual" aria-hidden="true">
              <div className="nx-featured-ring nx-featured-ring--one" />
              <div className="nx-featured-ring nx-featured-ring--two" />
              <div className="nx-featured-core">
                <BrainCircuit size={42} />
              </div>
              <span className="nx-featured-dot nx-featured-dot--a" />
              <span className="nx-featured-dot nx-featured-dot--b" />
              <span className="nx-featured-dot nx-featured-dot--c" />
            </div>

            <div className="nx-premium-card-body nx-premium-card-body--featured">
              <span className="nx-premium-card-badge nx-premium-card-badge--dark">
                <Sparkles size={14} />
                Süni İntellekt
              </span>
              <h3>Süni İntellekt cavabları</h3>
              <p>Kanallardan gələn suallara kontekstə uyğun cavab verir, yönləndirir və komandaya ötürür.</p>

              <div className="nx-featured-chips">
                <span>Avtomatik cavab</span>
                <span>Yönləndirmə</span>
                <span>Kontekst</span>
              </div>
            </div>

            <div className="nx-featured-cta">
              <span>Daha ətraflı</span>
              <ArrowRight size={17} />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}