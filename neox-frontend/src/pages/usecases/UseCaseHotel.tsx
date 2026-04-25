// src/pages/usecases/UseCaseHotel.tsx
import { Link, useParams } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowUpRight,
  BedDouble,
  BellRing,
  Bot,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  ConciergeBell,
  Hotel,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Utensils,
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
  icon: LucideIcon;
};

type FlowStep = {
  number: string;
  title: string;
  desc: string;
};

const painPoints: CardItem[] = [
  {
    title: "Rezervasiya sualları çoxalır",
    desc: "Qiymət, otaq tipi, tarix, mövcudluq və xidmət sualları komandanın vaxtını alır.",
    icon: MessageSquareText,
  },
  {
    title: "Cavab gecikəndə booking itir",
    desc: "Qonaq tez cavab istəyir. Gecikən cavab başqa hotel seçimi ilə nəticələnə bilər.",
    icon: Clock3,
  },
  {
    title: "Xidmət məlumatı dağınıqdır",
    desc: "Otaq, restoran, transfer, spa və check-in məlumatları fərqli yerlərdə qalanda qarışıqlıq yaranır.",
    icon: ConciergeBell,
  },
];

const solutions: CardItem[] = [
  {
    title: "24/7 ilkin cavab",
    desc: "Sistem otaq, qiymət, tarix, xidmət və ümumi məlumat suallarına ilkin cavab verir.",
    icon: Bot,
  },
  {
    title: "Rezervasiya məlumatı toplama",
    desc: "Ad, tarix, qonaq sayı, otaq tipi və əlaqə məlumatı səliqəli toplanır.",
    icon: CalendarCheck,
  },
  {
    title: "Xidmət yönləndirməsi",
    desc: "Restoran, spa, transfer və əlavə xidmət sualları uyğun məlumatla cavablanır.",
    icon: Utensils,
  },
  {
    title: "Satışa yaxın handoff",
    desc: "Qonaq rezervasiya etməyə yaxındırsa və ya xüsusi tələb varsa, komanda qoşulur.",
    icon: Workflow,
  },
];

const flow: FlowStep[] = [
  {
    number: "01",
    title: "Qonaq sorğu göndərir",
    desc: "Otaq, qiymət, tarix, xidmət və ya rezervasiya haqqında mesaj gəlir.",
  },
  {
    number: "02",
    title: "Sistem niyyəti ayırır",
    desc: "Ümumi məlumat, rezervasiya niyyəti, xidmət sualı və operator ehtiyacı ayrılır.",
  },
  {
    number: "03",
    title: "Cavab və məlumat toplama",
    desc: "Sadə sual cavablanır, rezervasiya üçün lazımi məlumatlar toplanır.",
  },
  {
    number: "04",
    title: "Komanda davam edir",
    desc: "Satışa yaxın və xüsusi sorğular hotel komandası üçün görünən olur.",
  },
];

const results = [
  { value: "24/7", label: "qonaq suallarına ilkin cavab" },
  { value: "↑", label: "booking niyyətinin tutulması" },
  { value: "1", label: "vahid rezervasiya axını" },
];

const rules = [
  "Qiymət və mövcudluq təsdiqlənmiş məlumatla cavablanır.",
  "Xüsusi istək və satışa yaxın sorğu komandaya ötürülür.",
  "Qonağın tarix, otaq və əlaqə məlumatı strukturlaşdırılır.",
  "Sistem qonağı yormadan növbəti addıma aparır.",
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

function HotelPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Hotel size={15} strokeWidth={2} aria-hidden="true" />
                Hotel axını
              </span>
              <h2 className="nx-h3">Qonaq sorğusu rezervasiya axınına çevrilir.</h2>
            </div>

            <BedDouble size={21} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
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
                  <p className="nx-h4">“2 nəfər üçün həftəsonu otaq varmı?”</p>
                </div>
                <span className="nx-badge nx-badge--soft">Rezervasiya</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Sistem cavabı</p>
                  <p className="nx-copy-sm">
                    Tarix, qonaq sayı və otaq istəyi toplanır, satışa yaxın sorğu komandaya ötürülür.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Hotel üçün əsas məsələ sürətli cavab, doğru məlumat və qonağı rezervasiyaya rahat aparan axındır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UseCaseHotel() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Hotel və resortlar</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Hotel üçün <span className="nx-gradient-text">rezervasiya və qonaq cavab sistemi.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Qonaqların otaq, qiymət, tarix, restoran, transfer və xidmət sualları daha səliqəli cavablanır.
                  Sistem ilkin məlumatı verir və rezervasiyaya yaxın sorğunu komandaya ötürür.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Hotelim üçün danışaq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/use-cases")} className="nx-button">
                  Bütün sahələr
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Rezervasiya</span>
                <span className="nx-chip">Qonaq sualları</span>
                <span className="nx-chip">Satış handoff</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <HotelPreview />
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
                <h2 className="nx-title-sm">Hotel biznesində cavab gecikməsi rezervasiya itkisi yaradır.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Qonaq tez cavab istəyir: otaq varmı, qiymət nədir, check-in saatı necədir, transfer var?
                Bu suallar manual cavablandıqda komanda yüklənir.
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
                <h2 className="nx-title">Qonaq sualları cavablanır, rezervasiya niyyəti itmir.</h2>
                <p className="nx-lead">
                  Sistem ümumi hotel məlumatını verir, rezervasiya üçün lazımi məlumatları toplayır və
                  satışa yaxın hallarda komandanı prosesə qoşur.
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
                <h2 className="nx-title-sm">Qonaq sorğusu dörd addımda idarə olunur.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Otaq, tarix, qonaq sayı, xidmət və operator qaydaları hotelinizə uyğun sistemləşdirilir.
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
                  Qonaq təcrübəsi
                </span>

                <h2 className="nx-title-sm">Cavab sistemi hotelin servis hissini daşımalıdır.</h2>

                <p className="nx-lead">
                  Avtomatlaşdırma soyuq hiss yaratmamalıdır. Cavab dili, məlumat axını və operatora ötürmə
                  hotelin premium təcrübəsinə uyğun qurulmalıdır.
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

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Hotel üçün nə lazımdır?</p>
                <h2 className="nx-title">Rezervasiya və xidmət qaydaları əvvəl strukturlaşmalıdır.</h2>
                <p className="nx-lead">
                  Otaq tipləri, qiymət məntiqi, check-in/out, restoran, transfer, spa, əlavə xidmətlər və
                  operator qaydaları sistemin əsas məlumatıdır.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Otaq tipləri", icon: BedDouble },
                { title: "Rezervasiya qaydası", icon: CalendarCheck },
                { title: "Qonaq xidmətləri", icon: ConciergeBell },
                { title: "Komanda handoff", icon: UserRoundCheck },
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
                  Hotelə uyğun
                </span>

                <h2 className="nx-title-sm">Hoteliniz üçün qonaq cavab axınını quraq.</h2>

                <p className="nx-lead">
                  Qonaqlarınız nə soruşur, hansı xidmətləri önə çıxarmaq lazımdır və rezervasiya axını necə olmalıdır —
                  bunları sistemə çevirək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Hotel üçün danışaq
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