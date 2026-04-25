// src/pages/Blog.tsx
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  BookOpenText,
  Bot,
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

type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  icon: typeof Bot;
  featured?: boolean;
};

const posts: BlogPost[] = [
  {
    slug: "ai-cavab-sistemi-nedir",
    title: "Süni İntellekt cavab sistemi nədir və biznesə necə kömək edir?",
    excerpt:
      "Sadə chatbot ilə real biznes cavab sistemi arasındakı fərq: niyyət, qayda, handoff və lead axını.",
    category: "Süni İntellekt",
    readTime: "5 dəq",
    icon: Bot,
    featured: true,
  },
  {
    slug: "premium-vebsayt-niye-sadece-dizayn-deyil",
    title: "Premium vebsayt niyə sadəcə gözəl dizayn deyil?",
    excerpt:
      "Yaxşı vebsayt brend görünüşündən əlavə müştəri axınını, mesajlaşmanı və satış məntiqini daşımalıdır.",
    category: "Vebsayt",
    readTime: "4 dəq",
    icon: Layers3,
  },
  {
    slug: "instagram-dm-avtomatlasdirma",
    title: "Instagram DM avtomatlaşdırması necə qurulmalıdır?",
    excerpt:
      "Müştəri yazanda cavab gecikməsin, lead itməsin və lazım olanda operatora düzgün ötürülsün.",
    category: "Mesajlaşma",
    readTime: "6 dəq",
    icon: MessageSquareText,
  },
  {
    slug: "biznes-workflow-avtomatlasdirma",
    title: "Biznes workflow avtomatlaşdırması haradan başlamalıdır?",
    excerpt:
      "Təkrar işləri, təsdiqləri, bildirişləri və komanda yönləndirməsini daha səliqəli sistemə salmaq.",
    category: "Avtomatlaşdırma",
    readTime: "5 dəq",
    icon: Workflow,
  },
];

const guides = [
  "Müştəri suallarını necə strukturlaşdırmaq olar?",
  "Vebsaytdan lead toplama axını necə qurulur?",
  "Süni İntellekt cavablarında nəzarət necə saxlanılır?",
  "Panel-panel görüntüdən necə qaçmaq olar?",
];

function BlogCard({ post }: { post: BlogPost }) {
  const withLang = useLocalizedPath();
  const Icon = post.icon;

  return (
    <Link
      to={withLang(`/blog/${post.slug}`)}
      className={post.featured ? "nx-card nx-card--link nx-blog-card is-featured" : "nx-card nx-card--link nx-blog-card"}
    >
      <div className="nx-row nx-row--top">
        <span className="nx-badge nx-badge--soft nx-badge--plain">
          <Icon size={16} strokeWidth={2} aria-hidden="true" />
        </span>

        <ArrowUpRight size={16} strokeWidth={1.9} className="nx-muted" aria-hidden="true" />
      </div>

      <div className="nx-stack-sm">
        <div className="nx-chip-row">
          <span className="nx-chip">{post.category}</span>
          <span className="nx-chip">
            <Clock3 size={13} strokeWidth={2} aria-hidden="true" />
            {post.readTime}
          </span>
        </div>

        <div className="nx-stack-xs">
          <h2 className="nx-h3">{post.title}</h2>
          <p className="nx-copy-sm">{post.excerpt}</p>
        </div>
      </div>
    </Link>
  );
}

export default function Blog() {
  const withLang = useLocalizedPath();
  const featured = posts.find((post) => post.featured);
  const rest = posts.filter((post) => !post.featured);

  return (
    <main className="nx-page">
      <section className="nx-hero">
        <div className="nx-container">
          <div className="nx-hero-grid">
            <div className="nx-hero-copy">
              <p className="nx-kicker">NEOX / Resurslar</p>

              <div className="nx-stack">
                <h1 className="nx-display">
                  Süni İntellekt və biznes sistemləri haqqında{" "}
                  <span className="nx-gradient-text">aydın yazılar.</span>
                </h1>

                <p className="nx-lead nx-max-copy">
                  Şablon texniki məqalələr yox. Biznes üçün real faydası olan vebsayt, avtomatlaşdırma,
                  mesajlaşma və Süni İntellekt cavab sistemi mövzuları.
                </p>
              </div>

              <div className="nx-actions">
                <Link to={withLang("/contact")} className="nx-button nx-button--primary">
                  Mövzunu müzakirə et
                  <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>

                <Link to={withLang("/faq")} className="nx-button">
                  Suallara bax
                </Link>
              </div>

              <div className="nx-chip-row">
                <span className="nx-chip">Süni İntellekt</span>
                <span className="nx-chip">Vebsayt</span>
                <span className="nx-chip">Avtomatlaşdırma</span>
              </div>
            </div>

            <div className="nx-hero-visual">
              <div className="nx-hero-panel">
                <div className="nx-hero-panel-inner">
                  <div className="nx-stack-lg">
                    <div className="nx-row nx-row--top">
                      <div className="nx-stack-xs">
                        <span className="nx-badge nx-badge--soft">
                          <BookOpenText size={15} strokeWidth={2} aria-hidden="true" />
                          Oxu xəritəsi
                        </span>
                        <h2 className="nx-h3">Əvvəl sistemi başa düş, sonra qur.</h2>
                      </div>

                      <Sparkles size={20} strokeWidth={1.9} color="var(--nx-accent)" aria-hidden="true" />
                    </div>

                    <div className="nx-grid">
                      {guides.map((guide, index) => (
                        <div key={guide} className="nx-surface nx-surface--flat nx-surface-pad nx-blog-guide-row">
                          <div className="nx-row">
                            <div className="nx-stack-xs">
                              <p className="nx-eyebrow">0{index + 1}</p>
                              <p className="nx-h4">{guide}</p>
                            </div>

                            <ArrowUpRight size={16} strokeWidth={1.9} className="nx-muted" aria-hidden="true" />
                          </div>
                        </div>
                      ))}
                    </div>

                    <p className="nx-copy-sm">
                      Məqsəd çox termin yox, düzgün qərar verməyə kömək edən sadə izahdır.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {featured ? (
        <section className="nx-section nx-section--tight">
          <div className="nx-container">
            <div className="nx-stack-lg">
              <div className="nx-row nx-row--top">
                <div className="nx-stack-sm nx-max-copy">
                  <p className="nx-kicker">Seçilmiş yazı</p>
                  <h2 className="nx-title-sm">Başlamaq üçün ən faydalı mövzu.</h2>
                </div>

                <p className="nx-copy nx-max-tight">
                  Süni İntellekt sistemini chatbot kimi yox, biznes cavab və yönləndirmə sistemi kimi düşünmək lazımdır.
                </p>
              </div>

              <BlogCard post={featured} />
            </div>
          </div>
        </section>
      ) : null}

      <section className="nx-section">
        <div className="nx-container">
          <div className="nx-stack-xl">
            <div className="nx-row nx-row--top">
              <div className="nx-stack-sm nx-max-copy">
                <p className="nx-kicker">Son yazılar</p>
                <h2 className="nx-title-sm">Praktiki və biznes yönümlü məqalələr.</h2>
              </div>

              <p className="nx-copy nx-max-tight">
                Buradakı yazılar daha çox qərar vermək üçündür: nə lazımdır, nə artıqdır və sistemi necə daha təmiz qurmaq olar.
              </p>
            </div>

            <div className="nx-grid nx-grid--3">
              {rest.map((post) => (
                <BlogCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="nx-section nx-section--last nx-section-divider">
        <div className="nx-container">
          <div className="nx-surface nx-surface--raised nx-surface-pad">
            <div className="nx-split">
              <div className="nx-stack">
                <span className="nx-badge nx-badge--soft">Fikir aydındırsa</span>

                <h2 className="nx-title-sm">Oxumaq kifayət deyil — sistemi qurmaq lazımdır.</h2>

                <p className="nx-lead">
                  Biznesiniz üçün hansı veb, mesajlaşma və Süni İntellekt cavab axınının lazım olduğunu birlikdə çıxaraq.
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
      </section>
    </main>
  );
}