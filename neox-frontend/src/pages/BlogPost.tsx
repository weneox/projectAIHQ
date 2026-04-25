// src/pages/BlogPost.tsx
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock3,
  Layers3,
  MessageSquareText,
  Sparkles,
  Workflow,
} from "lucide-react";
import { DEFAULT_LANG, LANGS, type Lang } from "../i18n/lang";

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

type ArticleSection = {
  title: string;
  body: string;
};

type Article = {
  slug: string;
  title: string;
  eyebrow: string;
  excerpt: string;
  category: string;
  readTime: string;
  icon: typeof Bot;
  intro: string;
  sections: ArticleSection[];
  takeaways: string[];
};

const articles: Article[] = [
  {
    slug: "ai-cavab-sistemi-nedir",
    title: "Süni İntellekt cavab sistemi nədir və biznesə necə kömək edir?",
    eyebrow: "NEOX / Süni İntellekt",
    excerpt:
      "Sadə chatbot ilə real biznes cavab sistemi arasındakı fərq: niyyət, qayda, handoff və lead axını.",
    category: "Süni İntellekt",
    readTime: "5 dəq",
    icon: Bot,
    intro:
      "Süni İntellekt cavab sistemi sadəcə avtomatik mesaj yazan bot deyil. Düzgün qurulanda o, müştərinin niyyətini anlayır, biznes qaydalarına görə cavab verir, lazım olanda operatora ötürür və sorğunu satış və ya dəstək axınına salır.",
    sections: [
      {
        title: "Chatbot başqa, cavab sistemi başqadır",
        body:
          "Sadə chatbot əvvəlcədən yazılmış suallara cavab verir. Cavab sistemi isə biznesin xidmətlərini, qiymət məntiqini, iş saatlarını, operator qaydalarını və müştəri niyyətini bir yerdə istifadə edir. Bu fərq nəticədə müştəri təcrübəsini daha stabil edir.",
      },
      {
        title: "Əsas məsələ nəzarətdir",
        body:
          "Süni İntellekt biznes adından danışırsa, sərhədlər mütləq olmalıdır. Hansı suallara cavab verəcək, hansı hallarda operatora ötürəcək, hansı məlumatları deməyəcək — bunlar əvvəlcədən sistemə salınmalıdır.",
      },
      {
        title: "Lead axını itmir",
        body:
          "Müştəri qiymət, xidmət və ya görüş haqqında yazanda sistem bunu sadəcə cavablandırmamalıdır. Sorğu qeyd olunmalı, uyğun yerə yönləndirilməli və komanda üçün görünən hala gəlməlidir.",
      },
    ],
    takeaways: [
      "Süni İntellekt cavabı biznes qaydalarına bağlı olmalıdır.",
      "Riskli hallarda operatora ötürmə vacibdir.",
      "Cavab sistemi lead və satış axını ilə birlikdə düşünülməlidir.",
    ],
  },
  {
    slug: "premium-vebsayt-niye-sadece-dizayn-deyil",
    title: "Premium vebsayt niyə sadəcə gözəl dizayn deyil?",
    eyebrow: "NEOX / Vebsayt",
    excerpt:
      "Yaxşı vebsayt brend görünüşündən əlavə müştəri axınını, mesajlaşmanı və satış məntiqini daşımalıdır.",
    category: "Vebsayt",
    readTime: "4 dəq",
    icon: Layers3,
    intro:
      "Premium vebsayt yalnız böyük şəkil, animasiya və gözəl hero demək deyil. Əsl premium hiss istifadəçinin rahat hərəkət etməsi, mesajın aydın olması və biznes məqsədinin düzgün işləməsidir.",
    sections: [
      {
        title: "Vebsayt satış axınının başlanğıcıdır",
        body:
          "İstifadəçi sayta girəndə nə etdiyinizi, ona necə kömək etdiyinizi və növbəti addımın nə olduğunu tez başa düşməlidir. Gözəl dizayn bunu çətinləşdirirsə, premium deyil.",
      },
      {
        title: "Panel-panel görüntü etibarı azaldır",
        body:
          "Çox kart, çox panel, çox izah və çox effekt istifadəçini yorur. Daha yaxşı yanaşma vahid surface dili, sakit spacing və aydın hierarchy qurmaqdır.",
      },
      {
        title: "Texniki tərəf görünməməlidir",
        body:
          "Yaxşı sistem arxada işləyir, istifadəçiyə isə sadə və təmiz təcrübə qalır. Forma, mesaj, lead və əlaqə axını problemsiz işləməlidir.",
      },
    ],
    takeaways: [
      "Premium dizayn sadəlik və aydınlıqdan başlayır.",
      "Sayt biznes məqsədinə xidmət etməlidir.",
      "Hər bölmə istifadəçini növbəti addıma aparmalıdır.",
    ],
  },
  {
    slug: "instagram-dm-avtomatlasdirma",
    title: "Instagram DM avtomatlaşdırması necə qurulmalıdır?",
    eyebrow: "NEOX / Mesajlaşma",
    excerpt:
      "Müştəri yazanda cavab gecikməsin, lead itməsin və lazım olanda operatora düzgün ötürülsün.",
    category: "Mesajlaşma",
    readTime: "6 dəq",
    icon: MessageSquareText,
    intro:
      "Instagram DM bir çox biznes üçün əsas satış və əlaqə kanalına çevrilib. Amma mesaj çoxaldıqca cavab gecikir, lead-lər itir və komanda eyni sualları təkrar cavablayır.",
    sections: [
      {
        title: "Əvvəl sual tipləri ayrılmalıdır",
        body:
          "Qiymət, çatdırılma, görüş, stok, şikayət və əməkdaşlıq mesajları eyni cür cavablanmamalıdır. Sistem əvvəl mesajın niyyətini anlamalıdır.",
      },
      {
        title: "Avtomatik cavab insanı əvəz etməməlidir",
        body:
          "Yaxşı avtomatlaşdırma komandanı tam yox etmir. Sadə və təkrar sualları sistem cavablayır, həssas və satışa yaxın halları isə operatora ötürür.",
      },
      {
        title: "Lead qeydiyyatı vacibdir",
        body:
          "Müştəri maraq göstəribsə, bu məlumat itməməlidir. Ad, telefon, maraqlandığı xidmət və status komanda üçün görünən olmalıdır.",
      },
    ],
    takeaways: [
      "DM avtomatlaşdırması cavab + yönləndirmə + lead sistemidir.",
      "Operatora ötürmə qaydası əvvəlcədən qurulmalıdır.",
      "Müştəri məlumatı dağınıq mesajlarda qalmamalıdır.",
    ],
  },
  {
    slug: "biznes-workflow-avtomatlasdirma",
    title: "Biznes workflow avtomatlaşdırması haradan başlamalıdır?",
    eyebrow: "NEOX / Avtomatlaşdırma",
    excerpt:
      "Təkrar işləri, təsdiqləri, bildirişləri və komanda yönləndirməsini daha səliqəli sistemə salmaq.",
    category: "Avtomatlaşdırma",
    readTime: "5 dəq",
    icon: Workflow,
    intro:
      "Workflow avtomatlaşdırması böyük sistemlə başlamaq məcburiyyətində deyil. Ən yaxşı başlanğıc komandada ən çox təkrarlanan, ən çox gecikən və ən çox səhv yaradan işi tapmaqdır.",
    sections: [
      {
        title: "Təkrar işi tapın",
        body:
          "Hər gün eyni məlumatı yazmaq, eyni mesajı yönləndirmək, eyni təsdiqi gözləmək və eyni hesabatı hazırlamaq avtomatlaşdırma üçün ilk namizədlərdir.",
      },
      {
        title: "Qaydanı sadələşdirin",
        body:
          "Avtomatlaşdırma üçün proses əvvəl aydın olmalıdır. Kim nə vaxt qərar verir, hansı məlumat lazımdır və hansı halda proses dayanır — bunlar bilinməlidir.",
      },
      {
        title: "Kiçik başlayın, ölçərək böyüdün",
        body:
          "Bütün biznesi bir gündə avtomatlaşdırmaq əvəzinə bir kritik axını düzəltmək daha sağlamdır. Sonra nəticəyə görə yeni mərhələlər əlavə olunur.",
      },
    ],
    takeaways: [
      "Avtomatlaşdırma əvvəl proses aydınlaşanda işləyir.",
      "Kiçik, amma real ağrıdan başlamaq daha doğrudur.",
      "Ölçülməyən workflow zamanla yenə qarışır.",
    ],
  },
];

function ArticleAside({ article }: { article: Article }) {
  const Icon = article.icon;

  return (
    <aside className="nx-article-aside">
      <div className="nx-surface nx-surface--raised nx-surface-pad">
        <div className="nx-stack">
          <div className="nx-row nx-row--top">
            <span className="nx-badge nx-badge--soft nx-badge--plain">
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
            </span>

            <span className="nx-badge nx-badge--plain">
              <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
              {article.readTime}
            </span>
          </div>

          <div className="nx-stack-xs">
            <h2 className="nx-h3">Qısa nəticə</h2>
            <p className="nx-copy-sm">{article.excerpt}</p>
          </div>

          <hr className="nx-divider" />

          <ul className="nx-list">
            {article.takeaways.map((item) => (
              <li key={item} className="nx-list-item">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}

export default function BlogPost() {
  const { slug } = useParams<{ slug?: string }>();
  const withLang = useLocalizedPath();

  const article = articles.find((item) => item.slug === slug);

  if (!article) {
    return <Navigate to={withLang("/blog")} replace />;
  }

  return (
    <main className="nx-page">
      <section className="nx-section nx-section--first">
        <div className="nx-container">
          <div className="nx-stack-lg">
            <Link to={withLang("/blog")} className="nx-link">
              <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
              Resurslara qayıt
            </Link>

            <div className="nx-article-hero">
              <div className="nx-stack">
                <p className="nx-kicker">{article.eyebrow}</p>

                <h1 className="nx-display">{article.title}</h1>

                <p className="nx-lead nx-max-copy">{article.intro}</p>

                <div className="nx-chip-row">
                  <span className="nx-chip">{article.category}</span>
                  <span className="nx-chip">
                    <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
                    {article.readTime}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--tight">
        <div className="nx-container">
          <div className="nx-article-layout">
            <article className="nx-article-body">
              <div className="nx-surface nx-surface--raised nx-surface-pad">
                <div className="nx-article-content">
                  {article.sections.map((section) => (
                    <section key={section.title} className="nx-article-section">
                      <h2>{section.title}</h2>
                      <p>{section.body}</p>
                    </section>
                  ))}

                  <section className="nx-article-section">
                    <h2>Yekun fikir</h2>
                    <p>
                      Ən yaxşı nəticə texnologiyanı ayrıca alət kimi yox, biznesin real axınına bağlı sistem kimi
                      quranda yaranır. Dizayn, cavab məntiqi və avtomatlaşdırma eyni məqsədə xidmət etməlidir:
                      müştəri təcrübəsini sadələşdirmək və komandanın yükünü azaltmaq.
                    </p>
                  </section>
                </div>
              </div>
            </article>

            <ArticleAside article={article} />
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
                  Praktiki addım
                </span>

                <h2 className="nx-title-sm">Bu mövzunu öz biznesinizə tətbiq edək.</h2>

                <p className="nx-lead">
                  Biznesinizdə hansı cavab, veb və avtomatlaşdırma axınının daha vacib olduğunu birlikdə çıxaraq.
                </p>
              </div>

              <div className="nx-stack">
                <div className="nx-card nx-card--compact nx-card--quiet">
                  <div className="nx-row">
                    <span className="nx-h4">Uyğun sistem xəritəsi</span>
                    <CheckCircle2 size={18} strokeWidth={2} color="var(--nx-success)" aria-hidden="true" />
                  </div>
                  <p className="nx-copy-sm nx-mt-xs">
                    Qısa danışıqdan sonra sizə real ehtiyaca uyğun başlanğıc sistemi təklif edirik.
                  </p>
                </div>

                <div className="nx-actions">
                  <Link to={withLang("/contact")} className="nx-button nx-button--primary nx-button--full">
                    Bizə yaz
                    <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                  </Link>

                  <Link to={withLang("/services/chatbot-24-7")} className="nx-button nx-button--full">
                    Xidmətlərə bax
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}