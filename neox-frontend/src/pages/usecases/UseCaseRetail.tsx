// src/pages/usecases/UseCaseRetail.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageSquareText,
  PackageSearch,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
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

type IconType = typeof ShoppingBag;

type CardItem = {
  title: string;
  desc: string;
  icon: IconType;
};

type FlowStep = {
  number: string;
  title: string;
  desc: string;
};

const painPoints: CardItem[] = [
  {
    title: "Eyni məhsul sualları təkrarlanır",
    desc: "Qiymət, stok, ölçü, rəng və çatdırılma haqqında suallar komandaya çox vaxt aparır.",
    icon: MessageSquareText,
  },
  {
    title: "Müştəri cavab gözləmir",
    desc: "Retail-də gec cavab satış itkisi deməkdir. Müştəri başqa mağazaya keçə bilər.",
    icon: Clock3,
  },
  {
    title: "Sifariş niyyəti itir",
    desc: "Müştəri maraq göstərir, amma məlumat toplanmadıqda lead mesaj içində qalır.",
    icon: ReceiptText,
  },
];

const solutions: CardItem[] = [
  {
    title: "Məhsul və stok cavabları",
    desc: "Sistem məhsul, qiymət, ölçü, rəng və stok suallarını strukturlaşdırılmış cavab axınına salır.",
    icon: PackageSearch,
  },
  {
    title: "Sifariş məlumatı toplama",
    desc: "Ad, telefon, məhsul, ölçü, ünvan və ödəniş tipi kimi məlumatlar səliqəli toplanır.",
    icon: ShoppingBag,
  },
  {
    title: "Çatdırılma və ödəniş izahı",
    desc: "Çatdırılma vaxtı, ödəniş üsulları və qaytarma şərtləri təsdiqlənmiş qaydaya görə cavablanır.",
    icon: Truck,
  },
  {
    title: "Satışa yaxın handoff",
    desc: "Müştəri almağa yaxındırsa və ya xüsusi sual verirsə, operatora ötürülür.",
    icon: Workflow,
  },
];

const flow: FlowStep[] = [
  {
    number: "01",
    title: "Müştəri məhsul soruşur",
    desc: "Qiymət, stok, ölçü, rəng, çatdırılma və ya sifariş niyyəti ilə yazır.",
  },
  {
    number: "02",
    title: "Sistem niyyəti anlayır",
    desc: "Məlumat sorğusu, sifariş istəyi və operator ehtiyacı ayrılır.",
  },
  {
    number: "03",
    title: "Cavab və məlumat toplama",
    desc: "Sadə sual cavablanır, sifariş üçün lazımi məlumatlar toplanır.",
  },
  {
    number: "04",
    title: "Satış axını yaranır",
    desc: "Müştəri məlumatı və maraqlandığı məhsul komanda üçün görünən qalır.",
  },
];

const results = [
  { value: "24/7", label: "məhsul suallarına ilkin cavab" },
  { value: "↑", label: "lead toplama imkanı" },
  { value: "↓", label: "təkrar manual cavablar" },
];

const rules = [
  "Stok və qiymət cavabları təsdiqlənmiş məlumatla verilir.",
  "Sifarişə yaxın müştəri operatora və ya satış komandasına ötürülür.",
  "Çatdırılma və qaytarma şərtləri vahid qaydada cavablanır.",
  "Müştərinin məhsul marağı lead kimi saxlanılır.",
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

function RetailPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <Store size={15} strokeWidth={2} aria-hidden="true" />
                Retail axını
              </span>
              <h2 className="nx-h3">Məhsul sualları satış axınına çevrilir.</h2>
            </div>

            <ShoppingBag size={21} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
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
                  <p className="nx-h4">“Bu modelin qara rəngi stokda var?”</p>
                </div>
                <span className="nx-badge nx-badge--soft">Məhsul</span>
              </div>

              <hr className="nx-divider" />

              <div className="nx-row">
                <div className="nx-stack-xs">
                  <p className="nx-eyebrow">Sistem cavabı</p>
                  <p className="nx-copy-sm">
                    Məhsul/stok cavabı verilir, sifariş niyyəti varsa məlumat toplanır və satışa yönləndirilir.
                  </p>
                </div>
                <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
              </div>
            </div>
          </div>

          <p className="nx-copy-sm">
            Retail-də əsas məqsəd sualı cavablandırmaqla yanaşı, marağı satış axınına çevirməkdir.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function UseCaseRetail() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Retail</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Mağazalar üçün <span className="nx-gradient-text">məhsul və satış cavab sistemi.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Məhsul, qiymət, stok, çatdırılma və sifariş sualları daha sürətli cavablanır.
                  Sistem müştəri marağını itirmir və onu səliqəli satış axınına çevirir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Mağazam üçün danışaq
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/use-cases")} className="nx-button">
                  Bütün sahələr
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Məhsul sualları</span>
                <span className="nx-chip">Sifariş axını</span>
                <span className="nx-chip">Satış handoff</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <RetailPreview />
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
                <h2 className="nx-title-sm">Retail-də cavab gecikəndə satış fürsəti itir.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Müştəri məhsul haqqında yazanda tez cavab almaq istəyir. Stok, qiymət və çatdırılma sualları
                manual cavablandıqda komanda yüklənir.
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
                <h2 className="nx-title">Məhsul sualı cavablanır, satış niyyəti isə itmir.</h2>
                <p className="nx-lead">
                  Sistem sadə məhsul suallarına cavab verir, sifarişə yaxın müştəridən lazımi məlumatları
                  toplayır və satış komandası üçün görünən edir.
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
                <h2 className="nx-title-sm">Məhsul sorğusu satış axınına çevrilir.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Məhsul kataloqu, stok məlumatı, çatdırılma qaydası və operator handoff biznesinizə görə qurulur.
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
                  Satışa uyğun
                </span>

                <h2 className="nx-title-sm">Retail cavab sistemi həm sürətli, həm satış yönümlü olmalıdır.</h2>

                <p className="nx-lead">
                  Məqsəd təkcə “cavab verdik” deyil. Məqsəd müştərinin marağını qorumaq, doğru məlumat toplamaq
                  və satışa yaxın sorğunu komandaya ötürməkdir.
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
                <p className="nx-kicker">Mağaza üçün nə lazımdır?</p>
                <h2 className="nx-title">Məhsul məlumatı və satış qaydası əvvəl strukturlaşmalıdır.</h2>
                <p className="nx-lead">
                  Stok, qiymət, çatdırılma, ödəniş, qaytarma və operatora ötürmə qaydası əvvəl hazırlanır,
                  sonra cavab sistemi həmin məlumatla işləyir.
                </p>
              </div>
            </div>

            <div className="nx-grid nx-grid--2">
              {[
                { title: "Məhsul məlumatı", icon: PackageSearch },
                { title: "Çatdırılma qaydası", icon: Truck },
                { title: "Ödəniş üsulları", icon: CreditCard },
                { title: "Sifariş axını", icon: ReceiptText },
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
                  Retail-ə uyğun
                </span>

                <h2 className="nx-title-sm">Mağazanız üçün məhsul və satış cavab axınını quraq.</h2>

                <p className="nx-lead">
                  Müştərilər ən çox nə soruşur, hansı məhsullar önəmlidir və satışa yaxın hallarda komanda
                  necə qoşulmalıdır — bunları sistemə çevirək.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Mağazam üçün danışaq
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