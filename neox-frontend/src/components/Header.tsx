import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, ChevronDown, Globe, Menu, X } from "lucide-react";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

type MegaMenuId = "products" | "company" | null;

type MenuItem = {
  label: string;
  to: string;
  note?: string;
};

type MenuColumn = {
  title: string;
  items: MenuItem[];
};

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function isLang(value: string | undefined | null): value is Lang {
  return Boolean(value && ["az", "en", "tr", "ru", "es"].includes(value));
}

function withLang(path: string, lang: Lang) {
  if (path === "/") return `/${lang}`;
  return `/${lang}${path.startsWith("/") ? path : `/${path}`}`;
}

function stripLangPrefix(pathname: string) {
  return pathname.replace(/^\/(az|en|tr|ru|es)(?=\/|$)/i, "") || "/";
}

function langLabel(lang: Lang) {
  switch (lang) {
    case "az":
      return "AZ";
    case "en":
      return "EN";
    case "tr":
      return "TR";
    case "ru":
      return "RU";
    case "es":
      return "ES";
    default:
      return String(lang).toUpperCase();
  }
}

function langFullName(lang: Lang) {
  switch (lang) {
    case "az":
      return "Azərbaycan";
    case "en":
      return "English";
    case "tr":
      return "Türkçe";
    case "ru":
      return "Русский";
    case "es":
      return "Español";
    default:
      return String(lang).toUpperCase();
  }
}

export default function Header({ introReady = true }: { introReady?: boolean }) {
  const { pathname, search, hash } = useLocation();
  const { lang: routeLang } = useParams<{ lang?: string }>();
  const navigate = useNavigate();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const lang: Lang = isLang(routeLang) ? routeLang : DEFAULT_LANG;

  const [activeMega, setActiveMega] = useState<MegaMenuId>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const productColumns = useMemo<MenuColumn[]>(
    () => [
      {
        title: "Products",
        items: [
          {
            label: "AI Chat Systems",
            to: "/services/chatbot-24-7",
            note: "Website, social, inbound automation",
          },
          {
            label: "Workflow Automation",
            to: "/services/business-workflows",
            note: "Approvals, routing, internal actions",
          },
          {
            label: "Web Experiences",
            to: "/services/websites",
            note: "Landing pages, sites, premium interfaces",
          },
        ],
      },
      {
        title: "Solutions",
        items: [
          {
            label: "Use Cases",
            to: "/use-cases",
            note: "Operational flows by business model",
          },
          {
            label: "Pricing",
            to: "/pricing",
            note: "Scope-based engagement direction",
          },
          {
            label: "Contact",
            to: "/contact",
            note: "Discuss your business system",
          },
        ],
      },
    ],
    []
  );

  const companyColumns = useMemo<MenuColumn[]>(
    () => [
      {
        title: "Company",
        items: [
          {
            label: "About NEOX",
            to: "/about",
            note: "How we think and what we build",
          },
          {
            label: "Blog",
            to: "/blog",
            note: "Insights, writing, execution",
          },
          {
            label: "Resources",
            to: "/blog",
            note: "Product direction and thinking",
          },
        ],
      },
      {
        title: "Explore",
        items: [
          {
            label: "Services",
            to: "/services/chatbot-24-7",
            note: "Execution pillars and system layers",
          },
          {
            label: "Use Cases",
            to: "/use-cases",
            note: "Business application examples",
          },
          {
            label: "Contact",
            to: "/contact",
            note: "Start a direct conversation",
          },
        ],
      },
    ],
    []
  );

  const simpleNav = useMemo(
    () => [
      { label: "Resources", to: "/blog" },
      { label: "Contact", to: "/contact" },
    ],
    []
  );

  const currentMegaColumns = activeMega === "products" ? productColumns : companyColumns;

  useEffect(() => {
    setActiveMega(null);
    setLangOpen(false);
    setMobileOpen(false);
  }, [pathname, search, hash]);

  useEffect(() => {
    const prev = document.documentElement.style.overflow;
    if (mobileOpen) document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMega(null);
        setLangOpen(false);
        setMobileOpen(false);
      }
    };

    const onMouseDown = (event: MouseEvent) => {
      const node = event.target as Node | null;
      if (!node) return;
      if (rootRef.current && !rootRef.current.contains(node)) {
        setActiveMega(null);
        setLangOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("mousedown", onMouseDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("mousedown", onMouseDown);
    };
  }, []);

  const switchLang = (nextLang: Lang) => {
    if (nextLang === lang) {
      setLangOpen(false);
      return;
    }

    const rest = stripLangPrefix(pathname);
    const nextPath = rest === "/" ? `/${nextLang}` : `/${nextLang}${rest}`;

    setLangOpen(false);
    setMobileOpen(false);
    setActiveMega(null);

    navigate(`${nextPath}${search}${hash}`);
  };

  return (
    <>
      <style>{`
        .nx-headerRoot{
          position: fixed;
          inset: 0 0 auto 0;
          z-index: 1200;
          pointer-events: none;
        }

        .nx-headerShell{
          width: 100%;
          pointer-events: auto;
        }

        .nx-headerBar{
          min-height: 72px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,.97);
          border-bottom: 1px solid rgba(15,23,42,.07);
          box-shadow: 0 8px 22px rgba(15,23,42,.04);
          backdrop-filter: blur(14px);
        }

        .nx-headerInner{
          width: min(1380px, calc(100% - 40px));
          min-height: 72px;
          display: grid;
          grid-template-columns: auto 1fr auto;
          align-items: center;
          gap: 22px;
        }

        .nx-brand{
          display: inline-flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
          text-decoration: none !important;
        }

        .nx-brandMark{
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
        }

        .nx-brandMark img{
          width: 34px;
          height: 34px;
          object-fit: contain;
          display: block;
        }

        .nx-brandText{
          display: inline-flex;
          align-items: center;
        }

        .nx-brandTitle{
          color: #0f172a;
          font-size: 13px;
          line-height: 1;
          font-weight: 800;
          letter-spacing: .02em;
        }

        .nx-nav{
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2px;
          min-width: 0;
        }

        .nx-navBtn,
        .nx-navLink{
          min-height: 40px;
          padding: 0 14px;
          border-radius: 10px;
          border: 0;
          background: transparent;
          color: #334155;
          font-size: 14px;
          font-weight: 650;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none !important;
          cursor: pointer;
          white-space: nowrap;
          transition: color .18s ease, background .18s ease;
        }

        .nx-navBtn:hover,
        .nx-navLink:hover,
        .nx-navBtn.is-open{
          color: #0f172a;
          background: rgba(15,23,42,.04);
        }

        .nx-navRight{
          display: flex;
          align-items: center;
          gap: 10px;
          justify-content: flex-end;
        }

        .nx-langWrap{
          position: relative;
        }

        .nx-langBtn{
          min-height: 40px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid rgba(15,23,42,.08);
          background: #ffffff;
          color: #334155;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 650;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(15,23,42,.03);
        }

        .nx-langPanel{
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 220px;
          padding: 8px;
          border-radius: 16px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.98);
          box-shadow: 0 18px 42px rgba(15,23,42,.10);
          backdrop-filter: blur(16px);
        }

        .nx-langItem{
          width: 100%;
          min-height: 42px;
          padding: 0 12px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: #334155;
          font-size: 14px;
          font-weight: 650;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          transition: background .18s ease, border-color .18s ease, color .18s ease;
        }

        .nx-langItem:hover,
        .nx-langItem.is-active{
          background: rgba(37,99,235,.07);
          border-color: rgba(37,99,235,.08);
          color: #2563eb;
        }

        .nx-cta{
          min-height: 40px;
          padding: 0 16px;
          border-radius: 10px;
          border: 1px solid rgba(37,99,235,.18);
          background: linear-gradient(180deg, #315fe9 0%, #244fda 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 750;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          text-decoration: none !important;
          box-shadow: 0 10px 22px rgba(37,99,235,.14);
          white-space: nowrap;
          transition: transform .18s ease, box-shadow .18s ease;
        }

        .nx-cta:hover{
          transform: translateY(-1px);
          box-shadow: 0 14px 28px rgba(37,99,235,.18);
        }

        .nx-mobileBtn{
          display: none;
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1px solid rgba(15,23,42,.08);
          background: #ffffff;
          color: #0f172a;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .nx-megaWrap{
          background: transparent;
        }

        .nx-mega{
          width: min(1380px, calc(100% - 40px));
          margin: 0 auto;
          border-top: 1px solid rgba(15,23,42,.06);
          border-left: 1px solid rgba(15,23,42,.06);
          border-right: 1px solid rgba(15,23,42,.06);
          border-bottom: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.98);
          box-shadow: 0 20px 46px rgba(15,23,42,.10);
          overflow: hidden;
        }

        .nx-megaInner{
          display: grid;
          grid-template-columns: 1.08fr .92fr;
        }

        .nx-megaCols{
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0;
          padding: 26px 20px;
        }

        .nx-megaCol{
          padding: 0 10px;
        }

        .nx-megaColTitle{
          margin-bottom: 14px;
          color: #64748b;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .14em;
          text-transform: uppercase;
        }

        .nx-megaList{
          display: grid;
          gap: 8px;
        }

        .nx-megaLink{
          padding: 13px 14px;
          border-radius: 14px;
          border: 1px solid transparent;
          text-decoration: none !important;
          transition: background .18s ease, border-color .18s ease, transform .18s ease;
        }

        .nx-megaLink:hover{
          background: rgba(15,23,42,.03);
          border-color: rgba(15,23,42,.05);
          transform: translateY(-1px);
        }

        .nx-megaLabel{
          color: #0f172a;
          font-size: 16px;
          line-height: 1.2;
          font-weight: 750;
          letter-spacing: -.02em;
        }

        .nx-megaNote{
          margin-top: 6px;
          color: #64748b;
          font-size: 13px;
          line-height: 1.55;
        }

        .nx-megaAside{
          padding: 20px;
          border-left: 1px solid rgba(15,23,42,.06);
          background:
            radial-gradient(420px 220px at 10% 0%, rgba(37,99,235,.07), transparent 62%),
            linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
          display: grid;
          align-content: center;
        }

        .nx-megaCard{
          padding: 20px;
          border-radius: 18px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.84);
          box-shadow: 0 10px 24px rgba(15,23,42,.05);
        }

        .nx-megaEyebrow{
          color: #64748b;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: .16em;
          text-transform: uppercase;
        }

        .nx-megaHeadline{
          margin-top: 10px;
          color: #0f172a;
          font-size: 28px;
          line-height: 1.04;
          font-weight: 800;
          letter-spacing: -.04em;
          max-width: 520px;
        }

        .nx-megaText{
          margin-top: 12px;
          color: #475569;
          font-size: 14px;
          line-height: 1.75;
          max-width: 520px;
        }

        .nx-megaPills{
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: 16px;
        }

        .nx-megaPill{
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(15,23,42,.08);
          background: rgba(255,255,255,.9);
          color: #334155;
          display: inline-flex;
          align-items: center;
          font-size: 12px;
          font-weight: 650;
        }

        .nx-mobilePanel{
          display: none;
        }

        @media (max-width: 1120px){
          .nx-nav{
            display: none;
          }

          .nx-mobileBtn{
            display: inline-flex;
          }

          .nx-headerInner{
            grid-template-columns: auto 1fr auto;
          }

          .nx-navRight .nx-cta{
            display: none;
          }
        }

        @media (max-width: 760px){
          .nx-headerBar{
            min-height: 64px;
          }

          .nx-headerInner{
            width: calc(100% - 24px);
            min-height: 64px;
            gap: 10px;
          }

          .nx-langWrap{
            display: none;
          }

          .nx-brandMark img{
            width: 30px;
            height: 30px;
          }

          .nx-brandTitle{
            font-size: 13px;
          }

          .nx-mobilePanel{
            display: block;
            width: calc(100% - 24px);
            margin: 0 auto;
            border-left: 1px solid rgba(15,23,42,.06);
            border-right: 1px solid rgba(15,23,42,.06);
            border-bottom: 1px solid rgba(15,23,42,.08);
            background: rgba(255,255,255,.98);
            box-shadow: 0 18px 40px rgba(15,23,42,.10);
            overflow: hidden;
          }

          .nx-mobileInner{
            padding: 12px;
            display: grid;
            gap: 8px;
          }

          .nx-mobileItem{
            min-height: 46px;
            padding: 0 14px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            color: #334155;
            font-size: 15px;
            font-weight: 650;
            text-decoration: none !important;
            border: 1px solid transparent;
            background: transparent;
          }

          .nx-mobileItem:hover{
            background: rgba(15,23,42,.03);
            border-color: rgba(15,23,42,.05);
          }

          .nx-megaWrap{
            display: none;
          }
        }
      `}</style>

      <header ref={rootRef} className={cx("nx-headerRoot", introReady && "is-ready")}>
        <div className="nx-headerShell">
          <div className="nx-headerBar">
            <div className="nx-headerInner">
              <Link to={withLang("/", lang)} className="nx-brand" aria-label="NEOX">
                <span className="nx-brandMark">
                  <img src="/image/neox-logo.png" alt="NEOX" draggable={false} />
                </span>

                <span className="nx-brandText">
                  <span className="nx-brandTitle">NEOX</span>
                </span>
              </Link>

              <nav className="nx-nav" aria-label="Primary navigation">
                <button
                  type="button"
                  className={cx("nx-navBtn", activeMega === "products" && "is-open")}
                  onClick={() => {
                    setLangOpen(false);
                    setActiveMega((prev) => (prev === "products" ? null : "products"));
                  }}
                >
                  Our Products & Services
                  <ChevronDown size={16} />
                </button>

                <button
                  type="button"
                  className={cx("nx-navBtn", activeMega === "company" && "is-open")}
                  onClick={() => {
                    setLangOpen(false);
                    setActiveMega((prev) => (prev === "company" ? null : "company"));
                  }}
                >
                  Company
                  <ChevronDown size={16} />
                </button>

                {simpleNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={withLang(item.to, lang)}
                    className="nx-navLink"
                    onClick={() => setActiveMega(null)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="nx-navRight">
                <div className="nx-langWrap">
                  <button
                    type="button"
                    className="nx-langBtn"
                    onClick={() => {
                      setActiveMega(null);
                      setLangOpen((prev) => !prev);
                    }}
                  >
                    <Globe size={15} />
                    {langLabel(lang)}
                    <ChevronDown size={14} />
                  </button>

                  {langOpen ? (
                    <div className="nx-langPanel">
                      {(["az", "en", "tr", "ru", "es"] as Lang[]).map((code) => (
                        <button
                          key={code}
                          type="button"
                          className={cx("nx-langItem", code === lang && "is-active")}
                          onClick={() => switchLang(code)}
                        >
                          <span>{langFullName(code)}</span>
                          <span>{langLabel(code)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <Link to={withLang("/contact", lang)} className="nx-cta">
                  Contact
                  <ArrowUpRight size={16} />
                </Link>

                <button
                  type="button"
                  className="nx-mobileBtn"
                  aria-label={mobileOpen ? "Close menu" : "Open menu"}
                  onClick={() => {
                    setActiveMega(null);
                    setLangOpen(false);
                    setMobileOpen((prev) => !prev);
                  }}
                >
                  {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </div>

          {activeMega ? (
            <div className="nx-megaWrap">
              <div className="nx-mega">
                <div className="nx-megaInner">
                  <div className="nx-megaCols">
                    {currentMegaColumns.map((column) => (
                      <div key={column.title} className="nx-megaCol">
                        <div className="nx-megaColTitle">{column.title}</div>

                        <div className="nx-megaList">
                          {column.items.map((item) => (
                            <Link
                              key={item.label}
                              to={withLang(item.to, lang)}
                              className="nx-megaLink"
                              onClick={() => setActiveMega(null)}
                            >
                              <div className="nx-megaLabel">{item.label}</div>
                              {item.note ? <div className="nx-megaNote">{item.note}</div> : null}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <aside className="nx-megaAside">
                    <div className="nx-megaCard">
                      <div className="nx-megaEyebrow">
                        {activeMega === "products" ? "Operational Layer" : "Company Direction"}
                      </div>

                      <div className="nx-megaHeadline">
                        {activeMega === "products"
                          ? "Structured products for modern business flows."
                          : "A cleaner company layer with strong execution logic."}
                      </div>

                      <div className="nx-megaText">
                        {activeMega === "products"
                          ? "Burada sonra product preview, short visual card, və ya featured block yerləşdirəcəyik. Hələlik sadəcə məntiq və düzgün struktur qurulub."
                          : "Burada sonra company preview, key message, və ya featured case yerləşdirəcəyik. Hələlik məqsəd header və mega-menu strukturudur."}
                      </div>

                      <div className="nx-megaPills">
                        <span className="nx-megaPill">Preview area</span>
                        <span className="nx-megaPill">Logic ready</span>
                        <span className="nx-megaPill">Image later</span>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          ) : null}

          {mobileOpen ? (
            <div className="nx-mobilePanel">
              <div className="nx-mobileInner">
                <button
                  type="button"
                  className="nx-mobileItem"
                  onClick={() => {
                    setMobileOpen(false);
                    setActiveMega("products");
                  }}
                >
                  <span>Our Products & Services</span>
                  <ChevronDown size={16} />
                </button>

                <button
                  type="button"
                  className="nx-mobileItem"
                  onClick={() => {
                    setMobileOpen(false);
                    setActiveMega("company");
                  }}
                >
                  <span>Company</span>
                  <ChevronDown size={16} />
                </button>

                {simpleNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={withLang(item.to, lang)}
                    className="nx-mobileItem"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span>{item.label}</span>
                  </NavLink>
                ))}

                <NavLink
                  to={withLang("/contact", lang)}
                  className="nx-mobileItem"
                  onClick={() => setMobileOpen(false)}
                >
                  <span>Contact</span>
                  <ArrowUpRight size={16} />
                </NavLink>
              </div>
            </div>
          ) : null}
        </div>
      </header>
    </>
  );
}