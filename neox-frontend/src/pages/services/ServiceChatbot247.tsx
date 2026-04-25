// src/pages/services/ServiceChatbot247.tsx
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  DatabaseZap,
  FileText,
  MessageSquareText,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Workflow,
} from "lucide-react";
import { DEFAULT_LANG, LANGS, type Lang } from "../../i18n/lang";

function isLang(value: string | undefined | null): value is Lang {
  if (!value) return false;
  return (LANGS as readonly string[]).includes(value);
}

function useLocalizedPath() {
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang = isLang(paramLang) ? paramLang : DEFAULT_LANG;

  return (path: string) => {
    if (path === "/") return `/${lang}`;
    return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
  };
}

type ServiceItem = {
  title: string;
  desc: string;
  icon: LucideIcon;
};

type Step = {
  number: string;
  title: string;
  desc: string;
};

const features: ServiceItem[] = [
  {
    title: "24/7 ilkin cavab",
    desc: "Müştəri sualları gecə-gündüz qarşılanır, sadə və təkrar sorğular cavabsız qalmır.",
    icon: Clock3,
  },
  {
    title: "Biznes məlumatına bağlı cavab",
    desc: "Sistem xidmətləriniz, qiymət məntiqiniz, FAQ-larınız və qaydalarınız əsasında cavab verir.",
    icon: FileText,
  },
  {
    title: "Operatora ötürmə",
    desc: "Satışa yaxın, riskli və ya xüsusi insan müdaxiləsi tələb edən suallar komandaya yönləndirilir.",
    icon: UserRoundCheck,
  },
  {
    title: "Lead toplama",
    desc: "Ad, telefon, maraqlandığı xidmət və sorğu tipi strukturlaşdırılmış formada saxlanılır.",
    icon: DatabaseZap,
  },
];

const channels: ServiceItem[] = [
  {
    title: "Sayt çat sistemi",
    desc: "Vebsayt üzərindən gələn suallar üçün premium və sadə cavab axını.",
    icon: MessageSquareText,
  },
  {
    title: "Instagram DM",
    desc: "Müştəri mesajları, FAQ, qiymət və operatora ötürmə üçün cavab sistemi.",
    icon: MessagesSquare,
  },
  {
    title: "WhatsApp yönləndirmə",
    desc: "Müştərinin WhatsApp-a keçidi və qısa brif mesajı daha rahat hazırlanır.",
    icon: Workflow,
  },
  {
    title: "Daxili komanda axını",
    desc: "Sistem cavablandıra bilməyəndə sorğu komanda üçün daha aydın görünür.",
    icon: ShieldCheck,
  },
];

const steps: Step[] = [
  {
    number: "01",
    title: "Məlumat bazası hazırlanır",
    desc: "Xidmətlər, FAQ, qiymət, iş saatı, ünvan və cavab qaydaları strukturlaşdırılır.",
  },
  {
    number: "02",
    title: "Cavab məntiqi qurulur",
    desc: "Hansı sual avtomatik cavablanır, hansı halda operatora ötürülür — qaydalar yazılır.",
  },
  {
    number: "03",
    title: "Kanalda test edilir",
    desc: "Sayt, Instagram və ya seçilmiş mesaj kanalında real suallarla test edilir.",
  },
  {
    number: "04",
    title: "İşə salınır və ölçülür",
    desc: "Cavab keyfiyyəti, handoff halları və lead axını izlənərək optimallaşdırılır.",
  },
];

const results = [
  { value: "24/7", label: "müştəri suallarına ilkin cavab" },
  { value: "↓", label: "təkrar manual cavablar" },
  { value: "↑", label: "lead toplama səliqəsi" },
];

const rules = [
  "Sistem yalnız təsdiqlənmiş biznes məlumatı ilə cavab verir.",
  "Əmin olmadığı və riskli hallarda operatora ötürür.",
  "Müştəri məlumatı strukturlaşdırılmış lead kimi qalır.",
  "Cavab dili brendinizə və xidmət üslubunuza uyğun yazılır.",
];

function ItemCard({ item }: { item: ServiceItem }) {
  const Icon = item.icon;

  return (
    <article className="nx-card nx-card--quiet">
      <div className="nx-stack-sm">
        <div className="nx-row nx-row--top">
          <span className="nx-badge nx-badge--soft nx-badge--plain">
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <ArrowUpRight size={16} strokeWidth={1.9} className="nx-muted" aria-hidden="true" />
        </div>

        <div className="nx-stack-xs">
          <h3 className="nx-h4">{item.title}</h3>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>
      </div>
    </article>
  );
}

function StepCard({ step }: { step: Step }) {
  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack-sm">
        <span className="nx-badge nx-badge--plain">{step.number}</span>
        <div className="nx-stack-xs">
          <h3 className="nx-h4">{step.title}</h3>
          <p className="nx-copy-sm">{step.desc}</p>
        </div>
      </div>
    </article>
  );
}

function ChatbotPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Bot size={15} strokeWidth={2} aria-hidden="true" />
                Cavab sistemi
              </span>
              <h2 className="nx-h3">Müştəri sualı cavabsız qalmır.</h2>
            </div>

            <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
          </div>

          <div className="nx-grid nx-grid--3">
            {results.map((item) => (
              <div key={item.label} className="nx-surface nx-surface--flat nx-surface-pad">
                <div className="nx-metric">
                  <span className="nx-metric-value">{item.value}</span>
                  <span className="nx-metric-label">{item.label}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="nx-surface nx-surface--flat nx-surface-pad">
            <div className="nx-stack">
              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Müştəri</p>
                  <p className="nx-h4">“Salam, qiymətlər necədir?”</p>
                </div>
                <span className="nx-badge nx-badge--soft">FAQ</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">NEOX sistemi</p>
                  <p className="nx-copy-sm">
                    Xidmətə uyğun cavab verir, maraq varsa əlaqə məlumatı toplayır və komandaya ötürür.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Məqsəd sadəcə “bot cavabı” deyil — müştəri sualını biznes axınına çevirməkdir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ServiceChatbot247() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / 24/7 Chatbot</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Biznesiniz üçün <span className="nx-gradient-text">24/7 Süni İntellekt cavab sistemi.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Müştərilər saytınızda və sosial kanallarda sual verəndə cavab gecikməsin.
                  Sistem FAQ, xidmət, qiymət, lead və operatora ötürmə məntiqi ilə işləyir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Cavab sistemi quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">FAQ cavabları</span>
                <span className="nx-chip">Lead toplama</span>
                <span className="nx-chip">Operator handoff</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <ChatbotPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Nə edir?</p>
                <h2 className="nx-title-sm">Sadə chatbot yox, biznesə bağlı cavab axını.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Cavab sistemi sizin xidmətlərə, qaydalara və müştəri niyyətinə görə işləyir.
                Məqsəd komandanın təkrar cavab yükünü azaltmaqdır.
              </p>
            </div>

            <div className="nx-grid nx-grid--4">
              {features.map((item) => (
                <ItemCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Kanallar</p>
                <h2 className="nx-title">Cavab sistemi müştərinin yazdığı yerdə işləməlidir.</h2>
                <p className="nx-lead">
                  Sayt, Instagram və digər mesajlaşma nöqtələri vahid cavab məntiqi ilə işləyə bilər.
                  Hər kanalın dili fərqli olsa da sistemin əsası eyni qalır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/services/websites")} className="nx-button">
                  Vebsayt xidmətləri
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Kanalımı danışım
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {channels.map((item) => (
                <ItemCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Qurulum</p>
                <h2 className="nx-title-sm">Cavab sistemi mərhələli şəkildə qurulur.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Əvvəl biznes məlumatı, sonra cavab qaydaları, sonra kanal testi və optimallaşdırma.
              </p>
            </div>

            <div className="nx-grid nx-grid--4">
              {steps.map((step) => (
                <StepCard key={step.number} step={step} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">
                  <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
                  Kontrollu davranış
                </span>

                <h2 className="nx-title-sm">Süni İntellekt cavabı sərhədsiz işləməməlidir.</h2>

                <p className="nx-lead">
                  Sistemin nəyi cavablayacağı, nəyi cavablamayacağı və nə vaxt operatora ötürəcəyi əvvəlcədən qurulur.
                  Bu, həm müştəri təcrübəsini, həm də biznes nəzarətini qoruyur.
                </p>
              </div>

              <div className="nx-grid">
                {rules.map((rule) => (
                  <div key={rule} className="nx-row">
                    <span className="nx-list-item">{rule}</span>
                    <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last nx-section-divider">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">
                  <Sparkles size={15} strokeWidth={2} aria-hidden="true" />
                  Başlayaq
                </span>

                <h2 className="nx-title-sm">Müştəri suallarınızı cavab sisteminə çevirək.</h2>

                <p className="nx-lead">
                  Xidmətlərinizi, ən çox verilən sualları və operator qaydalarını göndərin,
                  sizin üçün uyğun 24/7 cavab axınını quraq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Cavab sistemi quraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/resources/faq")} className="nx-button nx-button--full">
                  Suallara bax
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}