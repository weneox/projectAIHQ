// src/pages/Blog.tsx
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { Search, Filter, Sparkles } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";

// ✅ sualtı ikonlar
import { Fish, Waves, Anchor, Shell, Droplets, Compass } from "lucide-react";

/* =========================
   ŞƏKİLLƏR (SƏNİN VERDİYİN)
   ========================= */
const DAY_HERO_IMG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771195679/ChatGPT_Image_Feb_16_2026_02_45_45_AM_mpzrzt.png";
const NIGHT_HERO_IMG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771195665/ChatGPT_Image_Feb_16_2026_02_40_45_AM_kn8wrt.png";

const DAY_SCI_BG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771197628/ChatGPT_Image_Feb_16_2026_03_20_10_AM_fwlwmr.png";
const NIGHT_SCI_BG =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1771197629/ChatGPT_Image_Feb_16_2026_03_20_15_AM_lqozta.png";

/* ---------------- backend types (qorunur) ---------------- */
type ApiPost = {
  id?: string | number;
  slug?: string;
  title?: string;
  excerpt?: string;
  author?: string;
  date?: string;
  read_time?: string;
  category?: string;
  image_url?: string;
  coverUrl?: string;
  cover_url?: string;
  published_at?: string;
  publishedAt?: string;
  createdAt?: string;
};

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  author: string;
  date: string;
  read_time: string;
  category: string;
  image_url: string;
}

/* ---------------- helpers ---------------- */
function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

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

function cloudinaryAuto(url: string) {
  try {
    if (!url.includes("/upload/")) return url;
    if (url.includes("/upload/q_auto") || url.includes("/upload/f_auto")) return url;
    return url.replace("/upload/", "/upload/q_auto,f_auto/");
  } catch {
    return url;
  }
}

/* ---------------- SEO ---------------- */
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

    setMetaProp("og:type", "website");
    setMetaProp("og:title", opts.title);
    setMetaProp("og:description", opts.description);
    setMetaProp("og:url", canonicalUrl);

    if (opts.ogImage) {
      const img = /^https?:\/\//i.test(opts.ogImage) ? opts.ogImage : base + opts.ogImage;
      setMetaProp("og:image", img);
      setMetaName("twitter:image", img);
    }

    setMetaName("twitter:card", "summary_large_image");
    setMetaName("twitter:title", opts.title);
    setMetaName("twitter:description", opts.description);

    return () => {
      document.title = prevTitle;
    };
  }, [opts.title, opts.description, opts.canonicalPath, opts.ogImage]);
}

/* ---------------- backend normalize (qorunur) ---------------- */
function normalizePosts(rows: any[]): BlogPost[] {
  const out: BlogPost[] = [];
  for (const r of rows || []) {
    const a = (r || {}) as ApiPost;
    const title = String(a.title || "").trim();
    const slug = String(a.slug || "").trim();
    if (!title || !slug) continue;

    const date = a.published_at || a.publishedAt || a.date || a.createdAt || new Date().toISOString();
    const cover = a.coverUrl || a.cover_url || a.image_url || "";

    out.push({
      id: String(a.id ?? slug),
      slug,
      title,
      excerpt: String(a.excerpt || ""),
      author: String(a.author || "NEOX"),
      date: String(date),
      read_time: String(a.read_time || "5 dəq"),
      category: String(a.category || "General"),
      image_url: String(cover || ""),
    });
  }
  return out;
}

/* =========================
   6 BLOK (akvarium + overlay expand)
   ========================= */
type FocusBlock = {
  key: string;
  code: string;
  name: string;
  subtitle: string;
  desc: string;
  accent: "ice" | "cyan" | "indigo" | "violet" | "azure" | "mint";
  icon: React.ReactNode;
  queryHint?: string;
};

const FocusBlocks = memo(function FocusBlocks({
  t,
  lang,
  setQ,
  setCat,
}: {
  t: (k: string, def?: string) => string;
  lang: Lang;
  setQ: React.Dispatch<React.SetStateAction<string>>;
  setCat: React.Dispatch<React.SetStateAction<string>>;
}) {
  const blocks: FocusBlock[] = useMemo(
    () => [
      {
        key: "reef",
        code: "REEF",
        name: t("blog.focus.reef.name", "Dərinlikdə ideyalar"),
        subtitle: t("blog.focus.reef.subtitle", "Insight • Qısa qeydlər • Praktika"),
        desc: t("blog.focus.reef.desc", "Qısa, tətbiq edilə bilən ideyalar və təcrübədən çıxan nəticələr."),
        accent: "cyan",
        icon: <Waves className="w-5 h-5" />,
        queryHint: "insight",
      },
      {
        key: "currents",
        code: "CURRENTS",
        name: t("blog.focus.currents.name", "Axınlar və sistemlər"),
        subtitle: t("blog.focus.currents.subtitle", "Workflow • Avtomat • Sürət"),
        desc: t("blog.focus.currents.desc", "Axınlar, proseslər və real iş sistemləri üçün qısa parçalar."),
        accent: "ice",
        icon: <Droplets className="w-5 h-5" />,
        queryHint: "workflow",
      },
      {
        key: "navigation",
        code: "NAV",
        name: t("blog.focus.navigation.name", "Yol xəritəsi"),
        subtitle: t("blog.focus.navigation.subtitle", "Plan • Prioritet • Çərçivə"),
        desc: t("blog.focus.navigation.desc", "Planlama, prioritetləşdirmə və fokus üçün çərçivələr."),
        accent: "azure",
        icon: <Compass className="w-5 h-5" />,
        queryHint: "roadmap",
      },
      {
        key: "harbor",
        code: "HARBOR",
        name: t("blog.focus.harbor.name", "Məhsul limanı"),
        subtitle: t("blog.focus.harbor.subtitle", "Discovery • UX • Delivery"),
        desc: t("blog.focus.harbor.desc", "Məhsul düşüncəsi, discovery, UX və delivery nüansları."),
        accent: "indigo",
        icon: <Anchor className="w-5 h-5" />,
        queryHint: "product",
      },
      {
        key: "school",
        code: "SCHOOL",
        name: t("blog.focus.school.name", "Nümunələr və ssenarilər"),
        subtitle: t("blog.focus.school.subtitle", "Real case • Pattern • Tətbiq"),
        desc: t("blog.focus.school.desc", "Müxtəlif nümunələr, pattern-lər və tətbiq ssenariləri."),
        accent: "mint",
        icon: <Fish className="w-5 h-5" />,
        queryHint: "case",
      },
      {
        key: "seabed",
        code: "SEABED",
        name: t("blog.focus.seabed.name", "Detallar & dizayn dili"),
        subtitle: t("blog.focus.seabed.subtitle", "UI • Motion • Detail"),
        desc: t("blog.focus.seabed.desc", "UI detalları, motion hissi və vizual iyerarxiya."),
        accent: "violet",
        icon: <Shell className="w-5 h-5" />,
        queryHint: "design",
      },
    ],
    [t]
  );

  const [active, setActive] = useState(blocks[0]?.key);

  useEffect(() => {
    if (!blocks.some((b) => b.key === active)) setActive(blocks[0]?.key);
  }, [blocks, active]);

  const activeBlock = useMemo(() => blocks.find((b) => b.key === active) || blocks[0], [blocks, active]);

  const applyHint = (b: FocusBlock) => {
    setCat(t("blog.filters.all", "Hamısı"));
    setQ(b.queryHint || "");
    setActive(b.key);
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bl-chip bl-chip--soft">
          <Sparkles className="w-4 h-4" />
          <span>{t("blog.focus.pill", "6 mövzu • 1 blog axını")}</span>
        </div>

        <h2 className="mt-4 text-white text-[26px] sm:text-[34px] font-semibold leading-[1.15]">
          {t("blog.focus.title.before", "Yeni")}{" "}
          <span className="bl-gradient">{t("blog.focus.title.highlight", "mövzular")}</span>
        </h2>

        <p className="mt-3 text-white/70 leading-[1.8] max-w-[860px] mx-auto">
          {t("blog.focus.subtitle", "Kartın üzərinə kliklə — axtarış avtomatik dolacaq.")}
        </p>
      </div>

      <div className="mt-8 bl-prodGrid bl-prodGrid--stable">
        {blocks.map((b) => (
          <article
            key={b.key}
            className={cx("bl-prodCard", `acc-${b.accent}`, b.key === active && "is-active")}
            aria-label={b.name}
          >
            <button type="button" className="bl-prodHit" onClick={() => applyHint(b)}>
              <div className="bl-prodRail">
                <div className="bl-prodRailLine" aria-hidden="true" />
                <div className="bl-prodRailText">{b.code}</div>
              </div>

              <div className="bl-prodBody">
                <div className="bl-prodTop">
                  <span className="bl-prodIcon">{b.icon}</span>
                  <span className="bl-prodKicker">{b.subtitle}</span>
                </div>

                <div className="bl-prodTitle">{b.name}</div>

                <div className="bl-prodMini">
                  <span className="bl-prodBadge">{t("blog.focus.badge", "Topic")}</span>
                  <span className="bl-prodNum">{String(blocks.findIndex((x) => x.key === b.key) + 1).padStart(2, "0")}</span>
                </div>

                <div className="bl-prodHint">{t("blog.focus.hint", "Kliklə: filtr tətbiq et")}</div>
              </div>
            </button>

            {/* ✅ Akvarium layer */}
            <div className="aq-layer" aria-hidden="true">
              <span className="aq-fish aq-fish--1" />
              <span className="aq-fish aq-fish--2" />
              <span className="aq-fish aq-fish--3" />
              <span className="aq-bubble aq-bubble--1" />
              <span className="aq-bubble aq-bubble--2" />
              <span className="aq-bubble aq-bubble--3" />
            </div>
          </article>
        ))}
      </div>

      {/* ✅ Expand overlay */}
      <div className="bl-expandOverlay" aria-hidden={!activeBlock}>
        <div className="bl-expandCard">
          <div className="bl-expandTop">
            <span className="bl-expandDot" aria-hidden="true" />
            <div className="bl-expandTitle">{activeBlock?.name}</div>
          </div>

          <div className="mt-2 text-white/70 leading-[1.75]">{activeBlock?.desc}</div>

          <div className="mt-4 flex flex-wrap gap-10px">
            <span className="bl-chip">{activeBlock?.code}</span>
            <span className="bl-chip bl-chip--soft">{activeBlock?.subtitle}</span>
          </div>

          <div className="mt-4 text-white/45 text-[12px]">{lang.toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
});

/* =========================
   PAGE
   ========================= */
export default function Blog() {
  const { t } = useTranslation();
  const location = useLocation();
  const lang = getLangFromPath(location.pathname);

  useSeo({
    title: t("blog.seo.title"),
    description: t("blog.seo.description"),
    canonicalPath: withLang(lang, "/blog"),
  });

  const API_BASE_RAW = (import.meta as any)?.env?.VITE_API_BASE || "";
  const API_BASE = String(API_BASE_RAW || "").replace(/\/+$/, "");

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasBackend, setHasBackend] = useState<boolean>(!!API_BASE);

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(t("blog.filters.all"));

  const [mode, setMode] = useState<"day" | "night">(() => {
    const saved = (localStorage.getItem("theme") || "").toLowerCase();
    if (saved === "dark") return "night";
    if (saved === "light") return "day";
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    return prefersDark ? "night" : "day";
  });

  const isNight = mode === "night";

  const heroImg = cloudinaryAuto(isNight ? NIGHT_HERO_IMG : DAY_HERO_IMG);
  const sciBg = cloudinaryAuto(isNight ? NIGHT_SCI_BG : DAY_SCI_BG);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isNight);
    localStorage.setItem("theme", isNight ? "dark" : "light");
  }, [isNight]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    posts.forEach((p) => s.add(p.category || t("blog.filters.general")));
    return [t("blog.filters.all"), ...Array.from(s)];
  }, [posts, t]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        setLoading(true);

        if (!API_BASE) {
          setHasBackend(false);
          setPosts([]);
          return;
        }

        setHasBackend(true);

        const res = await fetch(`${API_BASE}/api/posts?lang=${encodeURIComponent(lang)}`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const j = await res.json();
        const rows = Array.isArray(j)
          ? j
          : Array.isArray(j?.posts)
          ? j.posts
          : Array.isArray(j?.data)
          ? j.data
          : Array.isArray(j?.items)
          ? j.items
          : [];
        setPosts(normalizePosts(rows));
      } catch (err) {
        console.error("Postları gətirərkən xəta:", err);
        setHasBackend(!!API_BASE);
        setPosts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [lang, API_BASE]);

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  return (
    <main className={`neo-page ${isNight ? "isNight" : "isDay"}`}>
      <style>{`
        :root{
          /* ✅ UseCase palitra (eyni) */
          --acc: rgba(0,170,255,1);
          --accSoft: rgba(0,170,255,.12);
          --accSoft2: rgba(0,170,255,.18);
        }

        html, body { margin:0; padding:0; width:100%; height:100%; overflow-x:clip; background: transparent !important; }
        #root{ width:100%; overflow-x: clip; }

        .neo-page{
          min-height:100vh;
          overflow-x:hidden;
          background: transparent;
          isolation:isolate;
        }

        /* ===== HERO ===== */
        .neo-hero{
          position:relative;
          width:100%;
          background:#000;
          overflow:hidden;
          isolation:isolate;
        }
        .neo-hero img{
          display:block;
          width:100%;
          height:auto;
          object-fit:contain;
          user-select:none;
          -webkit-user-drag:none;
          position:relative;
          z-index:1;
        }

        .neo-page.isDay .neo-hero img{
          filter: brightness(0.92) contrast(1.06) saturate(1.05);
        }

        /* ===== HERO overlay content ===== */
        .neo-heroOverlay{
          position:absolute;
          inset:0;
          z-index:2;
          display:flex;
          align-items:center;
          justify-content:center;
          padding: 44px 16px 18px;
          pointer-events:none;
        }
        .neo-heroOverlayInner{
          width:100%;
          max-width: 980px;
          text-align:center;
          pointer-events:auto;
          position:relative;
          z-index:1;
          transform: translate3d(0,-22px,0);
        }
        @media (max-width: 640px){
          .neo-heroOverlay{ padding-top: 34px; }
          .neo-heroOverlayInner{ transform: translate3d(0,-10px,0); }
        }

        .neo-heroOverlay::before{
          content:"";
          position:absolute;
          inset:0;
          z-index:0;
          pointer-events:none;
          background:
            radial-gradient(1100px 560px at 50% 40%, rgba(0,0,0,.14), rgba(0,0,0,.34)),
            linear-gradient(to bottom, rgba(0,0,0,.20), rgba(0,0,0,.08));
        }
        .neo-page.isNight .neo-heroOverlay::before{
          background:
            radial-gradient(1100px 560px at 50% 40%, rgba(0,0,0,.38), rgba(0,0,0,.62)),
            linear-gradient(to bottom, rgba(0,0,0,.42), rgba(0,0,0,.20));
        }

        /* ===== Hero -> Sci fade ===== */
        .neo-heroFadeBottom{
          position:absolute;
          left:0; right:0;
          bottom:-1px;
          height: 88px;
          z-index:3;
          pointer-events:none;
          background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.50));
        }
        .neo-page.isDay .neo-heroFadeBottom{
          background: linear-gradient(to bottom, rgba(0,0,0,0), rgba(0,0,0,0.42));
        }

        .neo-sciFadeTop{
          position:absolute;
          left:0; right:0;
          top:-1px;
          height: 92px;
          z-index:3;
          pointer-events:none;
          background: linear-gradient(to top, rgba(0,0,0,0), rgba(0,0,0,0.55));
        }
        .neo-page.isDay .neo-sciFadeTop{
          background: linear-gradient(to top, rgba(0,0,0,0), rgba(0,0,0,0.46));
        }

        /* ===== Toggle (clean) ===== */
        .neo-mode-wrap{
          position:absolute;
          top:90px;
          left:18px;
          z-index:9999;
        }
        .neo-mode-pill{
          display:flex; align-items:center; gap:10px;
          height:42px; padding:8px;
          border-radius:999px;
          background: rgba(0,0,0,0.55);
          border: 1px solid rgba(255,255,255,0.14);
          box-shadow: 0 10px 28px rgba(0,0,0,0.28);
          transition: width 180ms ease, padding 180ms ease, background 180ms ease;
          overflow:hidden;
          width:46px;
        }
        .neo-mode-pill.isOpen{ width:190px; padding: 8px 10px; background: rgba(0,0,0,0.62); }
        .neo-mode-iconBtn{
          width:30px; height:30px; border-radius:999px;
          border:1px solid rgba(255,255,255,0.14);
          background: rgba(0,0,0,0.22);
          color:#fff; display:grid; place-items:center; cursor:pointer;
        }
        .neo-mode-actions{
          display:flex; align-items:center; gap:8px; margin-left:2px;
          opacity:0; pointer-events:none; transform: translateX(-4px);
          transition: opacity 160ms ease, transform 160ms ease;
          white-space:nowrap;
        }
        .neo-mode-pill.isOpen .neo-mode-actions{ opacity:1; pointer-events:auto; transform: translateX(0px); }
        .neo-mode-btn{
          border:none; background:transparent; color:#fff;
          padding:6px 10px; border-radius:999px;
          cursor:pointer; font-size:13px; opacity:.72;
        }
        .neo-mode-btn.active{ background: rgba(255,255,255,0.14); opacity:1; }

        /* ===== shared UI (UseCase accent) ===== */
        .bl-panel{
          border-radius:18px;
          border:1px solid rgba(255,255,255,.10);
          background: rgba(0,0,0,.22);
          box-shadow: 0 14px 52px rgba(0,0,0,.45);
        }
        .bl-chip{
          display:inline-flex; align-items:center; gap:8px;
          padding:7px 10px; border-radius:999px;
          border:1px solid rgba(255,255,255,.10);
          background: rgba(0,0,0,.22);
          color: rgba(255,255,255,.86);
          font-size:12px;
        }
        .bl-chip--soft{
          border-color: rgba(0,170,255,.22);
          background: rgba(0,170,255,.12);
          color: rgba(255,255,255,.90);
        }

        /* ✅ əvvəlki rainbow gradient getdi → UseCase kimi “ağ → mavi” */
        .bl-gradient{
          background: linear-gradient(90deg,#ffffff 0%, rgba(255,255,255,.92) 55%, var(--acc) 100%);
          -webkit-background-clip:text; background-clip:text; color:transparent;
        }

        /* ===== SCI section ===== */
        .neo-sci{
          position:relative;
          isolation:isolate;
          overflow:hidden;
          background-image: var(--sci-bg);
          background-size: cover;
          background-position:center;
          background-repeat:no-repeat;
          padding: 76px 0 96px;
        }
        .neo-sci::before{
          content:"";
          position:absolute; inset:0; z-index:0;
          background:
            radial-gradient(1200px 520px at 50% 40%, rgba(0,0,0,0.18), rgba(0,0,0,0.42)),
            linear-gradient(to bottom, rgba(0,0,0,0.18), rgba(0,0,0,0.22));
          pointer-events:none;
        }
        .neo-sci-inner{ position:relative; z-index:2; }

        /* ===== grid stable ===== */
        .bl-prodGrid{ display:grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap:14px; position:relative; }
        @media (max-width:1024px){ .bl-prodGrid{ grid-template-columns: repeat(6, minmax(0,1fr)); } }
        @media (max-width:640px){ .bl-prodGrid{ grid-template-columns: repeat(1, minmax(0,1fr)); } }

        .bl-prodGrid--stable .bl-prodCard{ grid-column: span 4; }
        @media (max-width:1024px){ .bl-prodGrid--stable .bl-prodCard{ grid-column: span 3; } }
        @media (max-width:640px){ .bl-prodGrid--stable .bl-prodCard{ grid-column: span 1; } }

        .bl-prodCard{
          border-radius:22px;
          border:1px solid rgba(255,255,255,.10);
          background: rgba(0,0,0,.20);
          box-shadow: 0 18px 70px rgba(0,0,0,.50);
          overflow:hidden;
          position:relative;
          transform: translateZ(0);
          contain: paint;
        }
        .bl-prodHit{ width:100%; text-align:left; display:flex; gap:14px; padding:14px; background:transparent; border:0; color:inherit; cursor:pointer; position:relative; z-index:2; }
        .bl-prodRail{ width:44px; flex:0 0 auto; display:flex; flex-direction:column; align-items:center; justify-content:space-between; padding:8px 0; }
        .bl-prodRailLine{ width:1px; flex:1 1 auto; background: linear-gradient(180deg, transparent, rgba(255,255,255,.22), transparent); }
        .bl-prodRailText{ writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing:.22em; font-size:12px; color: rgba(255,255,255,.70); text-transform:uppercase; margin-top:10px; }

        .bl-prodBody{ flex:1; min-width:0; padding: 6px 6px 6px 0; }
        .bl-prodTop{ display:flex; align-items:center; gap:10px; color: rgba(255,255,255,.78); }
        .bl-prodIcon{
          width:34px; height:34px; border-radius:12px;
          border:1px solid rgba(255,255,255,.10);
          background: rgba(0,0,0,.18);
          display:grid; place-items:center;
        }
        .bl-prodKicker{ font-size:12px; color: rgba(255,255,255,.64); overflow:hidden; text-overflow: ellipsis; white-space:nowrap; }
        .bl-prodTitle{ margin-top:12px; font-size:20px; line-height:1.2; font-weight:650; color: rgba(255,255,255,.95); }
        .bl-prodMini{ margin-top:18px; display:flex; align-items: baseline; justify-content:space-between; gap:12px; }
        .bl-prodBadge{ font-size:12px; padding:6px 10px; border-radius:999px; border:1px solid rgba(255,255,255,.10); background: rgba(0,0,0,.22); color: rgba(255,255,255,.72); }
        .bl-prodNum{ font-size:44px; line-height:1; font-weight:800; letter-spacing:.04em; color: rgba(255,255,255,.14); -webkit-text-stroke: 1px rgba(255,255,255,.22); }
        .bl-prodHint{ margin-top:10px; font-size:12px; color: rgba(255,255,255,.55); }

        /* accent glow-lar daha kontrollu */
        .acc-ice{ --a: rgba(0,170,255,.08); }
        .acc-cyan{ --a: rgba(0,170,255,.10); }
        .acc-indigo{ --a: rgba(0,170,255,.08); }
        .acc-violet{ --a: rgba(0,170,255,.08); }
        .acc-azure{ --a: rgba(0,170,255,.08); }
        .acc-mint{ --a: rgba(0,170,255,.06); }

        .bl-prodCard::before{
          content:"";
          position:absolute; inset:-35% -35%;
          background: radial-gradient(560px 280px at 30% 18%, var(--a, rgba(0,170,255,.10)), transparent 62%);
          opacity:.9;
          pointer-events:none;
          z-index:0;
        }

        /* ✅ Akvarium */
        .aq-layer{
          position:absolute; inset:0;
          z-index:1;
          pointer-events:none;
          overflow:hidden;
          opacity: .85;
        }
        .aq-layer::before{
          content:"";
          position:absolute; inset:0;
          background:
            radial-gradient(520px 180px at 30% 20%, rgba(0,170,255,.10), transparent 60%),
            radial-gradient(520px 180px at 80% 70%, rgba(0,170,255,.08), transparent 60%),
            linear-gradient(to bottom, rgba(255,255,255,.04), rgba(0,0,0,0));
        }

        .aq-fish{
          position:absolute;
          width: 44px; height: 22px;
          border-radius: 999px;
          background: rgba(255,255,255,.10);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.10), 0 12px 26px rgba(0,0,0,.22);
          transform: translate3d(-20%, 0, 0);
          opacity: .75;
        }
        .aq-fish::before{
          content:"";
          position:absolute;
          right:-10px; top:50%;
          width: 0; height: 0;
          transform: translateY(-50%);
          border-left: 10px solid rgba(255,255,255,.10);
          border-top: 6px solid transparent;
          border-bottom: 6px solid transparent;
        }
        .aq-fish::after{
          content:"";
          position:absolute;
          left: 10px; top: 7px;
          width: 4px; height: 4px;
          border-radius: 999px;
          background: rgba(255,255,255,.32);
        }

        .aq-fish--1{ top: 18%; left: -18%; animation: aq-swim 14s linear infinite; }
        .aq-fish--2{ top: 52%; left: -24%; animation: aq-swim 18s linear infinite; transform: translate3d(-20%,0,0) scale(.92); opacity:.62; }
        .aq-fish--3{ top: 74%; left: -30%; animation: aq-swim 22s linear infinite; transform: translate3d(-20%,0,0) scale(.82); opacity:.50; }

        @keyframes aq-swim{
          0%{ transform: translate3d(-30%, 0, 0) rotate(-2deg); }
          50%{ transform: translate3d(110%, -10px, 0) rotate(2deg); }
          100%{ transform: translate3d(220%, 0, 0) rotate(-2deg); }
        }

        .aq-bubble{
          position:absolute;
          width: 8px; height: 8px;
          border-radius: 999px;
          background: rgba(255,255,255,.16);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.14);
          opacity: .55;
        }
        .aq-bubble--1{ left: 18%; bottom: -10%; animation: aq-bubble 7s ease-in infinite; }
        .aq-bubble--2{ left: 62%; bottom: -12%; animation: aq-bubble 9s ease-in infinite; width: 10px; height: 10px; opacity:.45; }
        .aq-bubble--3{ left: 82%; bottom: -14%; animation: aq-bubble 11s ease-in infinite; width: 6px; height: 6px; opacity:.40; }

        @keyframes aq-bubble{
          0%{ transform: translate3d(0, 0, 0) scale(1); opacity: .0; }
          15%{ opacity: .55; }
          100%{ transform: translate3d(-8px, -140px, 0) scale(1.25); opacity: 0; }
        }

        /* ✅ Expand overlay */
        .bl-expandOverlay{
          position: sticky;
          top: 18px;
          margin-top: 18px;
          z-index: 30;
          pointer-events: none;
          display:flex;
          justify-content:center;
        }
        .bl-expandCard{
          pointer-events:auto;
          width: min(920px, 100%);
          border-radius: 22px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(0,0,0,.30);
          box-shadow: 0 18px 70px rgba(0,0,0,.55);
          padding: 16px 16px 18px;
        }
        .bl-expandTop{ display:flex; align-items:center; gap:10px; }
        .bl-expandDot{
          width: 10px; height: 10px; border-radius: 999px;
          background: var(--acc);
          box-shadow: 0 0 0 4px rgba(0,170,255,.14);
        }
        .bl-expandTitle{ font-weight: 700; color: rgba(255,255,255,.95); }
      `}</style>

      {/* ========================= HERO ========================= */}
      <section className="neo-hero">
        {/* Toggle */}
        <div className="neo-mode-wrap" ref={wrapRef}>
          <div
            className={`neo-mode-pill ${open ? "isOpen" : ""}`}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <button className="neo-mode-iconBtn" onClick={() => setOpen((v) => !v)} type="button">
              {isNight ? "🌙" : "☀️"}
            </button>

            <div className="neo-mode-actions" role="group" aria-label="Theme">
              <button className={`neo-mode-btn ${mode === "day" ? "active" : ""}`} onClick={() => setMode("day")} type="button">
                Gündüz
              </button>
              <button className={`neo-mode-btn ${mode === "night" ? "active" : ""}`} onClick={() => setMode("night")} type="button">
                Gecə
              </button>
            </div>
          </div>
        </div>

        <img src={heroImg} alt="" draggable={false} />

        <div className="neo-heroFadeBottom" />

        <div className="neo-heroOverlay">
          <div className="neo-heroOverlayInner">
            <div className="inline-flex items-center gap-2 bl-chip bl-chip--soft">
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--acc)" }} />
              <span>{t("blog.hero.crumb", "NEOX / BLOG")}</span>
            </div>

            <h1 className="mt-6 text-white text-[38px] sm:text-[60px] font-semibold leading-[1.05]">
              {t("blog.hero.title.before", "Resurslar")}{" "}
              <span className="bl-gradient">{t("blog.hero.title.highlight", "& İnsaytlar")}</span>
            </h1>

            <p className="mt-5 text-[16px] sm:text-[18px] leading-[1.7] text-white/70">
              {t(
                "blog.hero.subtitle",
                "AI avtomatlaşdırma, agentlər, satış sistemləri və real use-case-lər. Qısa, praktik, nəticəyə fokus."
              )}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <div className="bl-panel flex items-center gap-2 w-full sm:w-[420px]" style={{ padding: "12px 14px" }}>
                <Search className="w-5 h-5 text-white/50 flex-shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t("blog.filters.searchPlaceholder", "Yazılarda axtar...")}
                  className="w-full bg-transparent outline-none text-white/85 placeholder:text-white/40"
                />
              </div>

              <div className="bl-panel flex items-center gap-2 w-full sm:w-[260px]" style={{ padding: "12px 14px" }}>
                <Filter className="w-5 h-5 text-white/50 flex-shrink-0" />
                <select
                  value={cat}
                  onChange={(e) => setCat(e.target.value)}
                  className="w-full bg-transparent outline-none text-white/85"
                >
                  {categories.map((c) => (
                    <option key={c} value={c} style={{ color: "#0b0f14" }}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {hasBackend ? null : null}
            {loading ? null : null}
          </div>
        </div>
      </section>

      {/* ========================= SCI (2-ci section) ========================= */}
      <section
        className="neo-sci"
        style={
          {
            ["--sci-bg" as any]: `url("${sciBg}")`,
          } as React.CSSProperties
        }
      >
        <div className="neo-sciFadeTop" />
        <div className="neo-sci-inner">
          <FocusBlocks t={t as any} lang={lang} setQ={setQ} setCat={setCat} />
        </div>
      </section>

      {/* ✅ 3-cü sectionlar LƏĞV */}
    </main>
  );
}
