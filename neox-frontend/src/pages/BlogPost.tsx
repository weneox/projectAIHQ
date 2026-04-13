// src/pages/BlogPost.tsx
import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Calendar, Clock, User } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

const LANGS = ["az", "tr", "en", "ru", "es"] as const;
type Lang = (typeof LANGS)[number];

function getLangFromPath(pathname: string): Lang {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return (LANGS as readonly string[]).includes(seg) ? (seg as Lang) : "en";
}
function withLang(lang: Lang, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `/${lang}${p}`;
}
function safeDateLabel(d: string, lang: Lang) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  const map: Record<Lang, string> = { az: "az-AZ", tr: "tr-TR", en: "en-US", ru: "ru-RU", es: "es-ES" };
  return dt.toLocaleDateString(map[lang], { year: "numeric", month: "short", day: "2-digit" });
}

type Post = {
  id?: string | number;
  slug: string;
  title: string;
  excerpt?: string;
  content?: string; // HTML və ya plain
  author?: string;
  category?: string;
  read_time?: string;
  published_at?: string;
  publishedAt?: string;
  date?: string;
  createdAt?: string;
  coverUrl?: string;
  cover_url?: string;
  image_url?: string;
  seo_title?: string;
  seo_description?: string;
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

/* ---------------- SEO (native head inject) ---------------- */
function useSeo(opts: { title: string; description: string; canonicalPath: string; ogImage?: string }) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = opts.title;

    const ensureMeta = (selector: string, create: () => HTMLMetaElement) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };

    const ensureLink = (selector: string, create: () => HTMLLinkElement) => {
      let el = document.head.querySelector(selector) as HTMLLinkElement | null;
      if (!el) {
        el = create();
        document.head.appendChild(el);
      }
      return el;
    };

    const setMetaName = (name: string, content: string) => {
      const el = ensureMeta(`meta[name="${name}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("name", name);
        return m;
      });
      el.setAttribute("content", content);
    };

    const setMetaProp = (property: string, content: string) => {
      const el = ensureMeta(`meta[property="${property}"]`, () => {
        const m = document.createElement("meta");
        m.setAttribute("property", property);
        return m;
      });
      el.setAttribute("content", content);
    };

    const base = window.location.origin;
    const canonicalUrl = base + opts.canonicalPath;

    const canonical = ensureLink(`link[rel="canonical"]`, () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    });
    canonical.setAttribute("href", canonicalUrl);

    setMetaName("description", opts.description);

    setMetaProp("og:type", "article");
    setMetaProp("og:title", opts.title);
    setMetaProp("og:description", opts.description);
    setMetaProp("og:url", canonicalUrl);

    const img = opts.ogImage
      ? /^https?:\/\//i.test(opts.ogImage)
        ? opts.ogImage
        : base + opts.ogImage
      : "";

    if (img) setMetaProp("og:image", img);

    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", opts.title);
    setMetaName("twitter:description", opts.description);
    if (img) setMetaName("twitter:image", img);

    return () => {
      document.title = prevTitle;
    };
  }, [opts.title, opts.description, opts.canonicalPath, opts.ogImage]);
}

function normalizePost(j: any): Post | null {
  const p = (j?.post || j?.data || j) as any;
  if (!p) return null;

  const slug = String(p.slug || "").trim();
  const title = String(p.title || "").trim();
  if (!slug || !title) return null;

  return {
    id: p.id,
    slug,
    title,
    excerpt: typeof p.excerpt === "string" ? p.excerpt : "",
    content: typeof p.content === "string" ? p.content : "",
    author: typeof p.author === "string" && p.author.trim() ? p.author : "NEOX",
    category: typeof p.category === "string" ? p.category : "",
    read_time: typeof p.read_time === "string" ? p.read_time : "",
    published_at: p.published_at || p.publishedAt || p.date || p.createdAt || "",
    publishedAt: p.publishedAt,
    date: p.date,
    createdAt: p.createdAt,
    coverUrl: p.coverUrl || "",
    cover_url: p.cover_url || "",
    image_url: p.image_url || "",
    seo_title: typeof p.seo_title === "string" ? p.seo_title : "",
    seo_description: typeof p.seo_description === "string" ? p.seo_description : "",
  };
}

export default function BlogPost() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const lang = getLangFromPath(location.pathname);

  const API_BASE_RAW = (import.meta as any)?.env?.VITE_API_BASE || "";
  const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "");

  const [loading, setLoading] = useState(true);
  const [post, setPost] = useState<Post | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // fetch
  useEffect(() => {
    let dead = false;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        if (!API_BASE || !slug) {
          setPost(null);
          return;
        }

        const res = await fetch(`${API_BASE}/api/posts/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`, {
          headers: { Accept: "application/json" },
        });

        // 404 və s.
        if (!res.ok) {
          const msg = `HTTP ${res.status}`;
          throw new Error(msg);
        }

        const j = await res.json();
        const p = normalizePost(j);

        if (!dead) setPost(p);
      } catch (e: any) {
        if (!dead) {
          setPost(null);
          setErr(String(e?.message || e));
        }
      } finally {
        if (!dead) setLoading(false);
      }
    })();

    return () => {
      dead = true;
    };
  }, [API_BASE, slug, lang]);

  const cover = useMemo(() => {
    const c = post?.coverUrl || post?.cover_url || post?.image_url || "";
    return String(c || "").trim();
  }, [post]);

  const date = useMemo(() => {
    const d = post?.published_at || post?.publishedAt || post?.date || post?.createdAt || "";
    return String(d || "").trim();
  }, [post]);

  // SEO (post gələndən sonra)
  const seoTitle = useMemo(() => {
    if (!post) return t("blog.post.loadingTitle", "Blog Post");
    const base = post.seo_title?.trim() || post.title;
    return `${base} — NEOX`;
  }, [post, t]);

  const seoDesc = useMemo(() => {
    if (!post) return t("blog.post.loadingDesc", "Read the latest insights from NEOX.");
    const d = (post.seo_description || post.excerpt || "").trim();
    return d || t("blog.post.defaultDesc", "Read the latest insights from NEOX.");
  }, [post, t]);

  useSeo({
    title: seoTitle,
    description: seoDesc,
    canonicalPath: withLang(lang, `/blog/${slug || ""}`),
    ogImage: cover || undefined,
  });

  const isHtml = !!post?.content && post.content.trim().startsWith("<");

  return (
    <main className="min-h-[100vh] bg-black text-white">
      {/* JSON-LD (post varsa) */}
      {post ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              {
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: post.title,
                description: (post.excerpt || "").trim() || undefined,
                image: cover ? [cover] : undefined,
                author: post.author ? { "@type": "Person", name: post.author } : undefined,
                datePublished: date || undefined,
                dateModified: date || undefined,
                inLanguage: lang,
                mainEntityOfPage: {
                  "@type": "WebPage",
                  "@id": window.location.href,
                },
              },
              null,
              0
            ),
          }}
        />
      ) : null}

      <div className="mx-auto max-w-[980px] px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <Link to={withLang(lang, "/blog")} className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t("blog.post.back", "Back to Blog")}
        </Link>

        {loading ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 animate-pulse">
            <div className="h-8 w-2/3 rounded bg-white/[0.06]" />
            <div className="mt-4 h-4 w-1/2 rounded bg-white/[0.06]" />
            <div className="mt-6 h-[240px] rounded bg-white/[0.05]" />
          </div>
        ) : err ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-white font-semibold text-[18px]">{t("blog.post.error", "Failed to load post")}</div>
            <div className="mt-2 text-white/70">{err}</div>

            {!API_BASE ? (
              <div className="mt-4 text-white/60 text-[13px]">
                VITE_API_BASE boşdur. Deploy env-də VITE_API_BASE-i backend URL-ə set et.
              </div>
            ) : null}
          </div>
        ) : !post ? (
          <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <div className="text-white font-semibold text-[18px]">{t("blog.post.notFound", "Post not found")}</div>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-[34px] sm:text-[44px] font-semibold leading-[1.08] break-words">{post.title}</h1>

            <div className="mt-4 flex flex-wrap items-center gap-4 text-white/60 text-[13px]">
              <span className="inline-flex items-center gap-2">
                <User className="w-4 h-4" />
                {post.author || "NEOX"}
              </span>

              {date ? (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {safeDateLabel(date, lang)}
                </span>
              ) : null}

              <span className="inline-flex items-center gap-2">
                <Clock className="w-4 h-4" />
                {post.read_time || "5 dəq"}
              </span>

              {post.category ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1">
                  {post.category}
                </span>
              ) : null}
            </div>

            {cover ? (
              <div className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
                <img src={cover} alt={post.title} className="w-full h-[320px] sm:h-[420px] object-cover opacity-[0.95]" />
              </div>
            ) : null}

            {post.excerpt ? <p className="mt-6 text-white/75 leading-[1.9] text-[16px]">{post.excerpt}</p> : null}

            <article className={cx("mt-8 max-w-none", "prose prose-invert")}>
              {post.content ? (
                isHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: post.content }} />
                ) : (
                  <div className="whitespace-pre-wrap text-white/85 leading-[1.9]">{post.content}</div>
                )
              ) : (
                <div className="text-white/75 leading-[1.9]">{t("blog.post.empty", "Content coming soon.")}</div>
              )}
            </article>
          </>
        )}
      </div>
    </main>
  );
}
