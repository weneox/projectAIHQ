// src/pages/resources/ResourcesFaq.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  HelpCircle,
  Layers3,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
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

type FaqItem = {
  q: string;
  a: string;
  category: string;
};

type Topic = {
  title: string;
  desc: string;
  icon: typeof Bot;
};

const topics: Topic[] = [
  {
    title: "Süni İntellekt cavabları",
    desc: "Müştəri suallarına biznes qaydalarına uyğun cavab sistemi.",
    icon: Bot,
  },
  {
    title: "Premium vebsayt",
    desc: "Brendə uyğun, sürətli, light premium və satış yönümlü səth.",
    icon: Layers3,
  },
  {
    title: "Mesajlaşma axını",
    desc: "Instagram, sayt və digər kanallardan gələn sorğuların idarəsi.",
    icon: MessageSquareText,
  },
  {
    title: "Avtomatlaşdırma",
    desc: "Təkrar işləri azaltmaq üçün workflow və yönləndirmə sistemləri.",
    icon: Workflow,
  },
];

const faqs: FaqItem[] = [
  {
    category: "Başlanğıc",
    q: "NEOX tam olaraq nə edir?",
    a: "NEOX bizneslər üçün premium veb səthlər, Süni İntellekt cavab sistemləri və avtomatlaşdırılmış iş axınları qurur. Məqsəd dağınıq mesajları, manual işləri və zəif veb təcrübəni daha səliqəli sistemə çevirməkdir.",
  },
  {
    category: "Vebsayt",
    q: "Təkcə vebsayt hazırlamaq mümkündür?",
    a: "Bəli. Amma yanaşmamız sadəcə dizayn etmək deyil. Vebsaytı müştəri sorğusu, əlaqə, lead və satış məntiqi ilə birlikdə düşünürük.",
  },
  {
    category: "Süni İntellekt",
    q: "Süni İntellekt cavab sistemi adi chatbot-dan nə ilə fərqlənir?",
    a: "Adi chatbot daha çox hazır cavablar verir. Süni İntellekt cavab sistemi isə xidmətlərinizə, FAQ-lara, qaydalara və operatora ötürmə məntiqinə bağlı işləyir.",
  },
  {
    category: "Mesajlaşma",
    q: "Instagram DM və sayt mesajlarını bir axına salmaq olar?",
    a: "Bəli. Məqsəd mesajları sadəcə toplamaq yox, onları cavablandırmaq, yönləndirmək və lead kimi görünən hala gətirməkdir.",
  },
  {
    category: "Avtomatlaşdırma",
    q: "Biznes avtomatlaşdırması haradan başlayır?",
    a: "Ən çox təkrarlanan və komandanı yoran işdən başlayırıq: müştəri cavabları, lead qeydiyyatı, yönləndirmə, bildirişlər və sadə təsdiq axınları.",
  },
  {
    category: "Qiymət",
    q: "Qiymət necə hesablanır?",
    a: "Qiymət layihənin real həcminə görə dəyişir. Sadə landing, Süni İntellekt cavab sistemi və tam avtomatlaşdırma eyni scope deyil. Əvvəl ehtiyac müəyyən edilir, sonra təklif hazırlanır.",
  },
  {
    category: "İcra",
    q: "Layihə nə qədər vaxt aparır?",
    a: "Kiçik layihələr daha sürətli başlaya bilər. Daha geniş sistemlərdə əvvəl analiz, sonra dizayn və qurulum mərhələləri olur. Dəqiq müddət scope razılaşdırılandan sonra deyilir.",
  },
  {
    category: "Nəzarət",
    q: "Süni İntellekt səhv cavab versə nə olur?",
    a: "Sistem qaydalarla qurulur. Riskli, həssas və əmin olmayan hallarda operatora ötürmə məntiqi saxlanılır. Məqsəd nəzarəti itirmək yox, manual yükü azaltmaqdır.",
  },
  {
    category: "Dəstək",
    q: "Qurulumdan sonra dəstək olur?",
    a: "Bəli. Sistem işə düşəndən sonra cavab keyfiyyəti, axınlar və lazımi dəyişikliklər izlənə və optimallaşdırıla bilər.",
  },
];

const quickAnswers = [
  "Başlamaq üçün qısa biznes məlumatı kifayətdir.",
  "Hazır saytınız varsa, onun üzərinə də sistem qurula bilər.",
  "Süni İntellekt cavabları qaydasız işləməməlidir.",
  "Ən yaxşı nəticə veb + mesaj + avtomatlaşdırma birlikdə düşünüləndə yaranır.",
];

function TopicCard({ item }: { item: Topic }) {
  const Icon = item.icon;

  return (
    <article className="nx-card nx-card--compact nx-card--quiet">
      <div className="nx-stack-sm">
        <span className="nx-badge nx-badge--soft nx-badge--plain">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>

        <div className="nx-stack-xs">
          <h2 className="nx-h4">{item.title}</h2>
          <p className="nx-copy-sm">{item.desc}</p>
        </div>
      </div>
    </article>
  );
}

function FaqCard({ item }: { item: FaqItem }) {
  return (
    <article className="nx-card nx-card--quiet nx-faq-card">
      <div className="nx-stack-sm">
        <span className="nx-badge nx-badge--plain">{item.category}</span>

        <div className="nx-stack-xs">
          <h2 className="nx-h4">{item.q}</h2>
          <p className="nx-copy-sm">{item.a}</p>
        </div>
      </div>
    </article>
  );
}

function FaqPreview() {
  return (
    <div className="nx-hero-panel">
      <div className="nx-hero-panel-inner">
        <div className="nx-stack-lg">
          <div className="nx-row nx-row--top">
            <div className="nx-stack-xs">
              <span className="nx-badge nx-badge--soft">
                <HelpCircle size={15} strokeWidth={2} aria-hidden="true" />
                Qısa cavablar
              </span>
              <h2 className="nx-h3">Ən çox soruşulan mövzular</h2>
            </div>

            <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
          </div>

          <div className="nx-grid">
            {quickAnswers.map((item) => (
              <div key={item} className="nx-surface nx-surface--flat nx-surface-pad nx-faq-preview-row">
                <div className="nx-row">
                  <span className="nx-list-item">{item}</span>
                  <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>

          <p className="nx-copy-sm">
            Əsas prinsip sadədir: daha az qarışıqlıq, daha çox işlək sistem.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResourcesFaq() {
  const withLang = useLocalizedPath();

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Suallar</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Başlamazdan əvvəl <span className="nx-gradient-text">aydın cavablar.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  NEOX-un vebsayt, Süni İntellekt cavab sistemi və avtomatlaşdırma yanaşması haqqında
                  ən çox verilən sualları qısa və praktik formada topladıq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Sualınızı yazın
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/pricing")} className="nx-button">
                  Qiymət məntiqi
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Süni İntellekt</span>
                <span className="nx-chip">Vebsayt</span>
                <span className="nx-chip">Avtomatlaşdırma</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <FaqPreview />
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-grid nx-grid--4">
            {topics.map((item) => (
              <TopicCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">FAQ</p>
                <h2 className="nx-title-sm">Ən çox verilən suallar.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Cavabları texniki terminlərlə şişirtmədən yazdıq. Məqsəd nə etdiyimizi və necə düşündüyümüzü
                aydın göstərməkdir.
              </p>
            </div>

            <div className="nx-grid nx-grid--2">
              {faqs.map((item) => (
                <FaqCard key={item.q} item={item} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section-divider">
        <div className="nx-container">
          <div className="nx-split nx-split--top">
            <div className="nx-stack-lg">
              <div className="nx-stack">
                <p className="nx-kicker">Qısa qərar</p>
                <h2 className="nx-title">Nə lazım olduğunu tam bilmirsinizsə, normaldır.</h2>
                <p className="nx-lead">
                  Əksər bizneslər başlanğıcda “bizə nə lazımdır?” sualına dəqiq cavab bilmir.
                  Bizim işimiz həmin qarışıqlığı sistem xəritəsinə çevirməkdir.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Bizə yaz
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/services/chatbot-24-7")} className="nx-button">
                  Xidmətlərə bax
                </Link>
              </div>
            </div>

            <div className="nx-surface nx-surface--soft nx-surface-pad">
              <div className="nx-stack">
                <div className="nx-row nx-row--top">
                  <div className="nx-stack-xs">
                    <span className="nx-badge nx-badge--soft">
                      <Clock3 size={15} strokeWidth={2} aria-hidden="true" />
                      İlk danışıq
                    </span>
                    <h3 className="nx-h3">Biz nəyi aydınlaşdırırıq?</h3>
                  </div>
                </div>

                <ul className="nx-list">
                  <li className="nx-list-item">Müştərilər sizə haradan yazır?</li>
                  <li className="nx-list-item">Ən çox hansı suallar təkrarlanır?</li>
                  <li className="nx-list-item">Hansı manual iş komandanı yavaşladır?</li>
                  <li className="nx-list-item">Veb, cavab sistemi və avtomatlaşdırma harada birləşməlidir?</li>
                </ul>
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
                  <ShieldCheck size={15} strokeWidth={2} aria-hidden="true" />
                  Növbəti addım
                </span>

                <h2 className="nx-title-sm">Sualınız burda yoxdursa, birbaşa yazın.</h2>

                <p className="nx-lead">
                  Biznesinizi qısa izah edin, hansı sistemin daha uyğun olduğunu birlikdə aydınlaşdıraq.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                  Əlaqə saxla
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/blog")} className="nx-button nx-button--full">
                  Resurslara bax
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}