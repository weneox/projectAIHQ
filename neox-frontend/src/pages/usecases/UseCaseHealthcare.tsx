// src/pages/usecases/UseCaseHealthcare.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BellRing,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  FileText,
  HeartPulse,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
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

type CardItem = {
  title: string;
  desc: string;
  icon: typeof Bot;
};

type FlowStep = {
  number: string;
  title: string;
  desc: string;
};

const painPoints: CardItem[] = [
  {
    title: "Pasiyent sualları təkrarlanır",
    desc: "Qiymət, həkim, xidmət, ünvan və iş saatı sualları komandaya çox vaxt aparır.",
    icon: MessageSquareText,
  },
  {
    title: "Görüş istəkləri dağınıq qalır",
    desc: "Instagram, WhatsApp, sayt və zənglərdən gələn müraciətlər eyni axında görünmür.",
    icon: CalendarCheck,
  },
  {
    title: "Cavab gecikəndə pasiyent itir",
    desc: "Klinika üçün sürətli cavab güvən yaradır. Gecikmə başqa klinikaya keçidlə nəticələnə bilər.",
    icon: Clock3,
  },
];

const solutions: CardItem[] = [
  {
    title: "24/7 ilkin cavab",
    desc: "Sistem xidmətlər, qiymət aralığı, ünvan, iş saatı və ilkin yönləndirmə suallarına cavab verir.",
    icon: Bot,
  },
  {
    title: "Görüş üçün məlumat toplama",
    desc: "Pasiyentin adı, əlaqə nömrəsi, maraqlandığı xidmət və uyğun vaxt istəyi strukturlaşdırılır.",
    icon: UserRoundCheck,
  },
  {
    title: "Operatora təhlükəsiz ötürmə",
    desc: "Həssas, tibbi və fərdi qərar tələb edən suallar avtomatik yox, komandaya ötürülür.",
    icon: ShieldCheck,
  },
  {
    title: "Xidmət məlumatı vahid olur",
    desc: "Sayt, mesaj və cavab sistemi eyni klinika məlumatı ilə danışır.",
    icon: FileText,
  },
];

const flow: FlowStep[] = [
  {
    number: "01",
    title: "Pasiyent yazır",
    desc: "Instagram, sayt forması, WhatsApp və ya digər kanaldan sorğu gəlir.",
  },
  {
    number: "02",
    title: "Sistem niyyəti anlayır",
    desc: "Qiymət, görüş, xidmət, ünvan, iş saatı və ya operator ehtiyacı ayrılır.",
  },
  {
    number: "03",
    title: "Uyğun cavab verilir",
    desc: "Sadə suallar cavablanır, həssas hallar isə klinika komandasına ötürülür.",
  },
  {
    number: "04",
    title: "Lead görünən olur",
    desc: "Pasiyent məlumatı və maraqlandığı xidmət komanda üçün səliqəli qalır.",
  },
];

const results = [
  { value: "24/7", label: "ilkin cavab imkanı" },
  { value: "↓", label: "təkrar manual cavablar" },
  { value: "1", label: "vahid pasiyent axını" },
];

const safeRules = [
  "Tibbi diaqnoz və müalicə qərarı avtomatik verilmir.",
  "Həssas suallar operatora və ya klinika komandasına ötürülür.",
  "Sistem yalnız təsdiqlənmiş xidmət və klinika məlumatları ilə cavab verir.",
  "Pasiyent məlumatı lead kimi səliqəli toplanır.",
];

function InfoCard({ item }: { item: CardItem }) {
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

function FlowCard({ step }: { step: FlowStep }) {
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

function HealthcarePreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Stethoscope size={15} strokeWidth={2} aria-hidden="true" />
                Klinik axın
              </span>
              <h2 className="nx-h3">Pasiyent sorğusu itmədən idarə olunur.</h2>
            </div>

            <HeartPulse size={21} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
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
                  <p className="nx-eyebrow">Sorğu</p>
                  <p className="nx-h4">“Salam, dermatoloq qəbulu neçəyədir?”</p>
                </div>
                <span className="nx-badge nx-badge--soft">Instagram DM</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Sistem cavabı</p>
                  <p className="nx-copy-sm">
                    Xidmət məlumatı verilir, uyğun əlaqə məlumatı toplanır və lazım olsa operatora ötürülür.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Məqsəd tibbi qərar vermək deyil; pasiyent sorğusunu düzgün qarşılamaq, yönləndirmək və komandaya görünən etməkdir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UseCaseHealthcare() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Klinikalar</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Klinikalar üçün <span className="nx-gradient-text">pasiyent cavab sistemi.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Klinikaya gələn mesajlar, görüş istəkləri və xidmət sualları daha səliqəli cavablanır.
                  Süni İntellekt ilkin cavab verir, həssas hallarda isə pasiyenti komandaya yönləndirir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Klinikam üçün danışaq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/use-cases")} className="nx-button">
                  Bütün sahələr
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Appointment</span>
                <span className="nx-chip">FAQ cavabları</span>
                <span className="nx-chip">Operator handoff</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <HealthcarePreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Problem</p>
                <h2 className="nx-title-sm">Klinikalarda ən çox vaxt alan mesajlar təkrarlanan suallardır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Pasiyent üçün cavab sürəti vacibdir. Komanda üçün isə hər sorğunun düzgün toplanması,
                itirilməməsi və lazım olanda insana ötürülməsi vacibdir.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {painPoints.map((item) => (
                <InfoCard key={item.title} item={item} />
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
                <p className="nx-kicker">Həll</p>
                <h2 className="nx-title">Pasiyent mesajları üçün kontrollu və premium cavab axını.</h2>
                <p className="nx-lead">
                  Klinikada cavab sistemi ehtiyatlı qurulmalıdır. Sistem sadə məlumatları verir,
                  görüş üçün məlumat toplayır və tibbi qərar tələb edən halları avtomatik cavablandırmır.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Cavab sistemləri
                </Link>

                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Sistem xəritəsi çıxaraq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {solutions.map((item) => (
                <InfoCard key={item.title} item={item} />
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
                <p className="nx-kicker">Axın</p>
                <h2 className="nx-title-sm">Pasiyent sorğusu dörd addımda idarə olunur.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Bu axın klinikanın real qaydalarına görə dəyişir: xidmətlər, həkimlər, iş saatları,
                qəbul forması və operator qaydaları sistemə uyğunlaşdırılır.
              </p>
            </div>

            <div className="nx-grid nx-grid--4">
              {flow.map((step) => (
                <FlowCard key={step.number} step={step} />
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
                  Təhlükəsiz cavab
                </span>

                <h2 className="nx-title-sm">Klinika sistemində əsas məsələ düzgün sərhəddir.</h2>

                <p className="nx-lead">
                  Süni İntellekt klinika adından danışanda cavablar təsdiqlənmiş məlumatlara dayanmalıdır.
                  Hər şeyi avtomatlaşdırmaq yox, düzgün hissəni avtomatlaşdırmaq lazımdır.
                </p>
              </div>

              <div className="nx-grid">
                {safeRules.map((rule) => (
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

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Klinika üçün nə lazımdır?</p>
                <h2 className="nx-title">Başlamaq üçün çox məlumat yox, düzgün məlumat lazımdır.</h2>
                <p className="nx-lead">
                  Klinikaya uyğun cavab sistemi qurmaq üçün xidmətlər, iş saatları, ünvan, həkim və ya
                  şöbə strukturu, görüş qaydası və operatora ötürmə halları lazımdır.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Xidmət siyahısı", icon: FileText },
                { title: "Görüş qaydası", icon: CalendarCheck },
                { title: "Bildiriş axını", icon: BellRing },
                { title: "Operator qaydası", icon: UserRoundCheck },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="nx-card nx-card--compact nx-card--quiet">
                    <div className="nx-stack-sm">
                      <span className="nx-badge nx-badge--soft nx-badge--plain">
                        <Icon size={16} strokeWidth={2} aria-hidden="true" />
                      </span>
                      <h3 className="nx-h4">{item.title}</h3>
                    </div>
                  </article>
                );
              })}
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
                  Klinikaya uyğun
                </span>

                <h2 className="nx-title-sm">Klinikanız üçün pasiyent cavab axınını quraq.</h2>

                <p className="nx-lead">
                  Hansı xidmətləriniz var, pasiyentlər ən çox nə soruşur və komanda hansı hallarda cavaba qoşulmalıdır —
                  bunları birlikdə sistemə çevirək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Klinikam üçün danışaq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button nx-button--full">
                  Qiymət məntiqi
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}