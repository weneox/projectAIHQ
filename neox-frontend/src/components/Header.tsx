// src/components/Header.tsx
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowUpRight, ChevronDown, Globe2, Menu, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const LANG_MENU: Lang[] = ["az", "tr", "ru", "en", "es"];
const O_LOGO_SRC = "/image/neox-logo.png";

function isLang(x: string | undefined | null): x is Lang {
  if (!x) return false;
  const v = String(x).toLowerCase();
  return (LANG_MENU as readonly string[]).includes(v);
}

function langFullName(c: Lang) {
  switch (c) {
    case "az":
      return "Azərbaycan";
    case "tr":
      return "Türk";
    case "ru":
      return "Русский";
    case "en":
      return "English";
    case "es":
      return "Español";
    default:
      return String(c).toUpperCase();
  }
}

type ItemDef = {
  id: string;
  label: string;
  note?: string;
  to: string;
};

type MegaKind = "capabilities" | "company";
type MobileTab = "main" | MegaKind;

export default function Header({ introReady }: { introReady: boolean }) {
  const { i18n, t } = useTranslation();
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(paramLang) ? (paramLang as Lang) : DEFAULT_LANG;

  const location = useLocation();
  const navigate = useNavigate();
  const mobilePanelId = useId();
  const megaPanelId = useId();

  const headerRef = useRef<HTMLElement | null>(null);
  const langRef = useRef<HTMLDivElement | null>(null);

  const [openMega, setOpenMega] = useState<MegaKind | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSoft, setMobileSoft] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("main");

  const tr = useCallback(
    (key: string, fallback: string) => {
      const value = t(key);
      return typeof value === "string" && value && value !== key ? value : fallback;
    },
    [t]
  );

  const withLang = useCallback(
    (to: string) => {
      if (to === "/") return `/${lang}`;
      return `/${lang}${to.startsWith("/") ? to : `/${to}`}`;
    },
    [lang]
  );

  const closeMega = useCallback(() => setOpenMega(null), []);

  const closeMobile = useCallback(() => {
    setMobileSoft(false);
    window.setTimeout(() => setMobileOpen(false), 190);
  }, []);

  const switchLang = useCallback(
    (next: Lang) => {
      if (next === lang) return;

      const rest = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/i, "");
      const cleaned = rest === "" ? "/" : rest;
      const target = cleaned === "/" ? `/${next}` : `/${next}${cleaned}`;

      setLangOpen(false);
      closeMega();
      setMobileOpen(false);

      Promise.resolve(i18n.changeLanguage(next))
        .catch(() => {})
        .finally(() => navigate(target + location.search + location.hash, { replace: false }));
    },
    [closeMega, i18n, lang, location.hash, location.pathname, location.search, navigate]
  );

  const capabilities: ItemDef[] = useMemo(
    () => [
      {
        id: "chatbot-24-7",
        label: "AI Chat Systems",
        note: "Website, social, inbound automation",
        to: "/services/chatbot-24-7",
      },
      {
        id: "business-workflows",
        label: "Workflow Automation",
        note: "Approvals, routing, internal actions",
        to: "/services/business-workflows",
      },
      {
        id: "websites",
        label: "Web Experiences",
        note: "Landing pages, premium interfaces",
        to: "/services/websites",
      },
      {
        id: "mobile-apps",
        label: "Mobile Apps",
        note: "Customer and operator apps",
        to: "/services/mobile-apps",
      },
      {
        id: "smm-automation",
        label: "Social Automation",
        note: "Content, response and lead flows",
        to: "/services/smm-automation",
      },
      {
        id: "technical-support",
        label: "Technical Support",
        note: "Setup, maintenance and repair",
        to: "/services/technical-support",
      },
    ],
    []
  );

  const company: ItemDef[] = useMemo(
    () => [
      {
        id: "about",
        label: "About NEOX",
        note: "Company, philosophy and direction",
        to: "/about",
      },
      {
        id: "use-cases",
        label: "Use Cases",
        note: "Healthcare, retail, logistics and more",
        to: "/use-cases",
      },
      {
        id: "pricing",
        label: "Pricing",
        note: "Scope-based engagement direction",
        to: "/pricing",
      },
      {
        id: "contact",
        label: "Contact",
        note: "Discuss your business system",
        to: "/contact",
      },
    ],
    []
  );

  const resources: ItemDef[] = useMemo(
    () => [
      {
        id: "blog",
        label: "Blog",
        note: "Ideas, product notes and AI strategy",
        to: "/blog",
      },
      {
        id: "faq",
        label: "FAQ",
        note: "Quick answers before starting",
        to: "/faq",
      },
      {
        id: "guides",
        label: "Guides",
        note: "Practical implementation references",
        to: "/resources/guides",
      },
    ],
    []
  );

  const megaItems = openMega === "company" ? company : capabilities;
  const megaTitle = openMega === "company" ? "Company" : "Capabilities";

  useEffect(() => {
    closeMega();
    setLangOpen(false);
    setMobileOpen(false);
    setMobileSoft(false);
    setMobileTab("main");
  }, [closeMega, location.pathname, location.search, location.hash]);

  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      root.style.overflow = prev;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) {
      setMobileSoft(false);
      return;
    }
    const frame = requestAnimationFrame(() => setMobileSoft(true));
    return () => cancelAnimationFrame(frame);
  }, [mobileOpen]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const node = event.target as Node;
      if (headerRef.current && !headerRef.current.contains(node)) {
        closeMega();
      }
      if (langOpen && langRef.current && !langRef.current.contains(node)) {
        setLangOpen(false);
      }
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [closeMega, langOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (mobileOpen) closeMobile();
      closeMega();
      setLangOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMega, closeMobile, mobileOpen]);

  const MegaPanel = () => {
    if (!openMega) return null;

    return (
      <div
        id={megaPanelId}
        className="neoMegaWrap is-open"
        role="menu"
        aria-label={megaTitle}
        onMouseEnter={() => setOpenMega(openMega)}
      >
        <div className="neoMegaCanvas">
          <div className="neoMegaLeft">
            <div className="neoMegaKicker">{megaTitle}</div>

            <div className="neoMegaList">
              {megaItems.map((item) => (
                <NavLink
                  key={item.id}
                  to={withLang(item.to)}
                  role="menuitem"
                  className={({ isActive }) => cx("neoMegaItem", isActive && "is-active")}
                  onClick={closeMega}
                >
                  <span className="neoMegaCopy">
                    <span className="neoMegaName">{item.label}</span>
                    {item.note ? <span className="neoMegaNote">{item.note}</span> : null}
                  </span>
                  <ArrowUpRight className="neoMegaArrow" size={17} strokeWidth={1.9} aria-hidden="true" />
                </NavLink>
              ))}
            </div>
          </div>

          <div className="neoMegaMedia" aria-hidden="true" />
        </div>
      </div>
    );
  };

  const LangPanel = (
    <div className="neoLangPanel" role="menu" aria-label="Language menu" aria-hidden={!langOpen}>
      {LANG_MENU.map((code) => (
        <button
          key={code}
          type="button"
          role="menuitem"
          className={cx("neoLangItem", code === lang && "is-active")}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => switchLang(code)}
        >
          <span className="neoLangCode">{String(code).toUpperCase()}</span>
          <span className="neoLangName">{langFullName(code)}</span>
        </button>
      ))}
    </div>
  );

  const MobileItem = ({ item, strong = false }: { item: ItemDef; strong?: boolean }) => (
    <NavLink
      to={withLang(item.to)}
      className={({ isActive }) => cx("neoMItem", strong && "neoMItem--strong", isActive && "is-active")}
      onClick={closeMobile}
    >
      <span className="neoMItemText">
        <b>{item.label}</b>
        {item.note ? <small>{item.note}</small> : null}
      </span>
      <ArrowUpRight size={16} strokeWidth={1.9} aria-hidden="true" />
    </NavLink>
  );

  const mobileItems =
    mobileTab === "capabilities"
      ? capabilities
      : mobileTab === "company"
        ? company
        : [
            { id: "home", label: tr("nav.home", "Home"), to: "/" },
            { id: "resources", label: "Resources", note: "Blog, FAQ and guides", to: "/blog" },
            { id: "contact", label: tr("nav.contact", "Contact"), to: "/contact" },
          ];

  return (
    <header
      ref={headerRef}
      className={cx("neoHdr", introReady && "neoHdr--in", openMega && "is-megaOpen")}
      onMouseLeave={() => closeMega()}
    >
      <style>{`
        .neoHdr,
        .neoHdr *{
          box-sizing:border-box;
        }

        .neoHdr a,
        .neoHdr a:hover,
        .neoHdr a:focus,
        .neoHdr a:active{
          text-decoration:none !important;
        }

        .neoHdr{
          position:fixed;
          top:0;
          left:0;
          right:0;
          z-index:99999;
          background:#fff;
          color:#0a1020;
          opacity:0;
          transform:translate3d(0,-10px,0);
          box-shadow:0 16px 44px rgba(7,13,28,.055);
          transition:
            opacity .32s cubic-bezier(.2,.8,.2,1),
            transform .32s cubic-bezier(.2,.8,.2,1),
            box-shadow .22s ease;
        }

        .neoHdr--in{
          opacity:1;
          transform:translate3d(0,0,0);
        }

        .neoHdr.is-megaOpen{
          box-shadow:0 10px 28px rgba(7,13,28,.045);
        }

        .neoInner{
          position:relative;
          height:76px;
          width:100%;
          padding:0 clamp(18px,5vw,80px);
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:24px;
          background:#fff;
        }

        .neoBrand{
          display:inline-flex;
          align-items:center;
          gap:12px;
          min-width:0;
          color:#0a1020;
        }

        .neoBrandMark{
          width:42px;
          height:42px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          transition:transform .22s cubic-bezier(.2,.8,.2,1), filter .22s ease;
        }

        .neoBrandLogo{
          width:38px;
          height:38px;
          object-fit:contain;
          display:block;
          filter:drop-shadow(0 9px 18px rgba(9,22,45,.18));
          user-select:none;
          -webkit-user-drag:none;
        }

        .neoBrandWord{
          font-size:14px;
          font-weight:850;
          letter-spacing:-.02em;
          color:#111827;
          line-height:1;
        }

        .neoBrand:hover .neoBrandMark{
          transform:translateY(-1px) scale(1.025);
          filter:drop-shadow(0 13px 22px rgba(14,31,64,.16));
        }

        .neoNav{
          position:absolute;
          left:50%;
          top:50%;
          transform:translate(-50%,-50%);
          display:flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          white-space:nowrap;
        }

        .neoTop,
        .neoTopLink{
          height:42px;
          border:0;
          background:transparent;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:7px;
          padding:0 14px;
          border-radius:12px;
          color:#263145;
          font-size:14px;
          font-weight:760;
          letter-spacing:-.025em;
          line-height:1;
          cursor:pointer;
          transition:
            color .16s ease,
            background .16s ease,
            transform .16s cubic-bezier(.2,.8,.2,1);
        }

        .neoTop:hover,
        .neoTop.is-active,
        .neoTopLink:hover,
        .neoTopLink.is-active{
          color:#060b16;
          background:#f5f6f8;
        }

        .neoTop:active,
        .neoTopLink:active{
          transform:translateY(1px);
        }

        .neoChev{
          opacity:.62;
          transition:transform .18s cubic-bezier(.2,.8,.2,1), opacity .18s ease;
        }

        .neoTop.is-open .neoChev{
          transform:rotate(180deg);
          opacity:.95;
        }

        .neoRight{
          display:flex;
          align-items:center;
          justify-content:flex-end;
          gap:10px;
          min-width:0;
        }

        .neoLangWrap{
          position:relative;
          display:inline-flex;
        }

        .neoLangBtn{
          height:44px;
          min-width:92px;
          border-radius:12px;
          border:1px solid #edf0f5;
          background:#fff;
          color:#111827;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:9px;
          padding:0 13px;
          font-size:13px;
          font-weight:780;
          cursor:pointer;
          box-shadow:0 10px 26px rgba(8,18,38,.045);
          transition:border-color .16s ease, box-shadow .16s ease, background .16s ease;
        }

        .neoLangBtn:hover,
        .neoLangWrap.is-open .neoLangBtn{
          border-color:#dfe5ee;
          background:#fbfcfe;
          box-shadow:0 14px 32px rgba(8,18,38,.07);
        }

        .neoLangPanel{
          position:absolute;
          top:calc(100% + 10px);
          right:0;
          width:236px;
          padding:8px;
          border-radius:16px;
          border:1px solid #edf0f5;
          background:#fff;
          box-shadow:0 28px 70px rgba(7,13,28,.16);
          opacity:0;
          pointer-events:none;
          transform:translate3d(0,-8px,0) scale(.985);
          transform-origin:top right;
          transition:opacity .18s ease, transform .2s cubic-bezier(.2,.8,.2,1);
        }

        .neoLangWrap.is-open .neoLangPanel{
          opacity:1;
          pointer-events:auto;
          transform:translate3d(0,0,0) scale(1);
        }

        .neoLangItem{
          width:100%;
          min-height:42px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:12px;
          border:0;
          border-radius:11px;
          background:transparent;
          color:#182234;
          padding:0 11px;
          cursor:pointer;
          transition:background .16s ease, color .16s ease;
        }

        .neoLangItem:hover,
        .neoLangItem.is-active{
          background:#f5f7fb;
          color:#07101f;
        }

        .neoLangCode{
          font-size:12px;
          font-weight:850;
          letter-spacing:.12em;
        }

        .neoLangName{
          font-size:12px;
          font-weight:600;
          color:#6a7588;
        }

        .neoCta{
          height:44px;
          min-width:126px;
          display:inline-flex;
          align-items:center;
          justify-content:center;
          gap:9px;
          padding:0 17px;
          border-radius:12px;
          background:#2457ff;
          color:#fff !important;
          font-size:14px;
          font-weight:820;
          letter-spacing:-.02em;
          box-shadow:0 18px 38px rgba(36,87,255,.24);
          transition:transform .16s cubic-bezier(.2,.8,.2,1), box-shadow .16s ease, background .16s ease;
        }

        .neoCta:hover{
          background:#1d4df0;
          transform:translateY(-1px);
          box-shadow:0 22px 44px rgba(36,87,255,.28);
        }

        .neoBurger{
          width:44px;
          height:44px;
          display:none;
          align-items:center;
          justify-content:center;
          border-radius:12px;
          border:1px solid #edf0f5;
          background:#fff;
          color:#121b2d;
          cursor:pointer;
          box-shadow:0 10px 26px rgba(8,18,38,.045);
        }

        .neoMegaWrap{
          position:absolute;
          top:100%;
          left:0;
          right:0;
          background:#fff;
          overflow:hidden;
          opacity:0;
          pointer-events:none;
          clip-path:inset(0 0 100% 0);
          transform:translate3d(0,-8px,0);
          box-shadow:0 44px 80px rgba(7,13,28,.13);
          transition:
            opacity .18s ease,
            transform .28s cubic-bezier(.2,.8,.2,1),
            clip-path .32s cubic-bezier(.2,.8,.2,1);
          will-change:opacity, transform, clip-path;
        }

        .neoMegaWrap.is-open{
          opacity:1;
          pointer-events:auto;
          clip-path:inset(0 0 0 0);
          transform:translate3d(0,0,0);
        }

        .neoMegaCanvas{
          width:100%;
          min-height:342px;
          display:grid;
          grid-template-columns:minmax(360px,44%) minmax(0,1fr);
          gap:0;
          padding:34px clamp(22px,5vw,82px) 38px;
          background:#fff;
        }

        .neoMegaLeft{
          min-width:0;
          max-width:720px;
          padding-right:clamp(28px,4vw,72px);
        }

        .neoMegaKicker{
          margin-bottom:20px;
          color:#667287;
          font-size:12px;
          font-weight:850;
          letter-spacing:.18em;
          text-transform:uppercase;
        }

        .neoMegaList{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
          column-gap:40px;
          row-gap:0;
        }

        .neoMegaItem{
          min-height:72px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:18px;
          padding:14px 0;
          color:#0d1728;
          border:0;
          background:transparent;
          position:relative;
          transition:color .16s ease, transform .16s cubic-bezier(.2,.8,.2,1);
        }

        .neoMegaItem::after{
          content:"";
          position:absolute;
          left:0;
          right:0;
          bottom:0;
          height:1px;
          background:linear-gradient(90deg, rgba(15,23,42,.09), rgba(15,23,42,0));
          transform-origin:left;
          transform:scaleX(.72);
          opacity:.8;
          transition:transform .18s ease, opacity .18s ease;
        }

        .neoMegaItem:hover,
        .neoMegaItem.is-active{
          color:#2457ff;
          transform:translateX(3px);
        }

        .neoMegaItem:hover::after,
        .neoMegaItem.is-active::after{
          transform:scaleX(1);
          opacity:1;
        }

        .neoMegaCopy{
          min-width:0;
          display:grid;
          gap:5px;
        }

        .neoMegaName{
          font-size:17px;
          line-height:1.1;
          font-weight:860;
          letter-spacing:-.035em;
        }

        .neoMegaNote{
          color:#6a7689;
          font-size:14px;
          line-height:1.35;
          font-weight:560;
          letter-spacing:-.015em;
        }

        .neoMegaArrow{
          flex:0 0 auto;
          color:currentColor;
          opacity:.68;
        }

        .neoMegaMedia{
          min-height:270px;
          background:#fff;
        }

        .neoMOv{
          position:fixed;
          inset:0;
          z-index:100000;
          opacity:0;
          pointer-events:none;
          transition:opacity .18s ease;
        }

        .neoMOv.is-open{
          opacity:1;
          pointer-events:auto;
        }

        .neoBg{
          position:absolute;
          inset:0;
          border:0;
          background:rgba(9,14,24,.22);
          -webkit-backdrop-filter:blur(6px);
          backdrop-filter:blur(6px);
        }

        .neoSheet{
          position:absolute;
          top:78px;
          left:0;
          right:0;
          background:#fff;
          color:#0a1020;
          box-shadow:0 34px 80px rgba(7,13,28,.22);
          transform:translate3d(0,-14px,0);
          opacity:0;
          transition:transform .24s cubic-bezier(.2,.8,.2,1), opacity .2s ease;
          overflow:hidden;
        }

        .neoSheet.is-open{
          transform:translate3d(0,0,0);
          opacity:1;
        }

        .neoMTop{
          height:66px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:14px;
          padding:0 18px;
          background:#fff;
        }

        .neoMTitle{
          font-size:12px;
          font-weight:860;
          letter-spacing:.18em;
          color:#6b7587;
          text-transform:uppercase;
        }

        .neoMClose{
          width:42px;
          height:42px;
          display:flex;
          align-items:center;
          justify-content:center;
          border-radius:12px;
          border:1px solid #edf0f5;
          background:#fff;
          color:#111827;
          cursor:pointer;
        }

        .neoMTabs{
          display:grid;
          grid-template-columns:repeat(3,1fr);
          gap:8px;
          padding:0 18px 14px;
        }

        .neoTab{
          min-height:42px;
          border:0;
          border-radius:12px;
          background:#f5f7fb;
          color:#2b3548;
          font-size:13px;
          font-weight:780;
          cursor:pointer;
        }

        .neoTab.is-on{
          background:#111827;
          color:#fff;
        }

        .neoMBody{
          display:grid;
          gap:0;
          max-height:min(62vh,560px);
          overflow:auto;
          padding:0 18px 18px;
          -webkit-overflow-scrolling:touch;
        }

        .neoMItem{
          min-height:66px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:16px;
          padding:14px 0;
          color:#0f172a;
          border-bottom:1px solid #edf0f5;
        }

        .neoMItemText{
          display:grid;
          gap:4px;
          min-width:0;
        }

        .neoMItemText b{
          font-size:17px;
          line-height:1.15;
          font-weight:830;
          letter-spacing:-.035em;
        }

        .neoMItemText small{
          color:#6b7587;
          font-size:13px;
          line-height:1.35;
        }

        @media (max-width:1180px){
          .neoNav{
            gap:2px;
          }

          .neoTop,
          .neoTopLink{
            padding:0 10px;
            font-size:13px;
          }

          .neoCta{
            min-width:112px;
          }
        }

        @media (max-width:980px){
          .neoInner{
            height:68px;
            padding:0 14px;
          }

          .neoNav,
          .neoCta{
            display:none;
          }

          .neoBurger{
            display:inline-flex;
          }

          .neoBrandMark{
            width:40px;
            height:40px;
          }

          .neoBrandLogo{
            width:36px;
            height:36px;
          }

          .neoBrandWord{
            font-size:13px;
          }

          .neoLangBtn{
            height:42px;
            min-width:82px;
            padding:0 11px;
          }

          .neoSheet{
            top:68px;
          }
        }

        @media (max-width:560px){
          .neoBrandWord{
            display:none;
          }

          .neoMTabs{
            grid-template-columns:1fr;
          }
        }

        @media (prefers-reduced-motion:reduce){
          .neoHdr,
          .neoMegaWrap,
          .neoSheet,
          .neoBrandMark,
          .neoTop,
          .neoTopLink,
          .neoCta{
            transition:none !important;
          }
        }
      `}</style>

      <div className="neoInner">
        <Link to={`/${lang}`} className="neoBrand" aria-label="NEOX" data-wg-notranslate>
          <span className="neoBrandMark" aria-hidden="true">
            <img className="neoBrandLogo" src={O_LOGO_SRC} alt="" loading="eager" decoding="async" draggable={false} />
          </span>
          <span className="neoBrandWord">NEOX</span>
        </Link>

        <nav className="neoNav" aria-label="Primary navigation">
          <NavLink to={withLang("/")} end className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}>
            {tr("nav.home", "Home")}
          </NavLink>

          <button
            type="button"
            className={cx("neoTop", openMega === "capabilities" && "is-open is-active")}
            aria-haspopup="menu"
            aria-expanded={openMega === "capabilities"}
            aria-controls={megaPanelId}
            onMouseEnter={() => setOpenMega("capabilities")}
            onFocus={() => setOpenMega("capabilities")}
            onClick={() => setOpenMega((current) => (current === "capabilities" ? null : "capabilities"))}
          >
            Capabilities
            <ChevronDown className="neoChev" size={15} strokeWidth={2} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={cx("neoTop", openMega === "company" && "is-open is-active")}
            aria-haspopup="menu"
            aria-expanded={openMega === "company"}
            aria-controls={megaPanelId}
            onMouseEnter={() => setOpenMega("company")}
            onFocus={() => setOpenMega("company")}
            onClick={() => setOpenMega((current) => (current === "company" ? null : "company"))}
          >
            Company
            <ChevronDown className="neoChev" size={15} strokeWidth={2} aria-hidden="true" />
          </button>

          <NavLink to={withLang("/blog")} className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}>
            Resources
          </NavLink>

          <NavLink to={withLang("/contact")} className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}>
            {tr("nav.contact", "Contact")}
          </NavLink>
        </nav>

        <div className="neoRight">
          <div ref={langRef} className={cx("neoLangWrap", langOpen && "is-open")} data-wg-notranslate>
            <button
              type="button"
              className="neoLangBtn"
              aria-haspopup="menu"
              aria-expanded={langOpen}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                closeMega();
                setLangOpen((value) => !value);
              }}
            >
              <Globe2 size={16} strokeWidth={1.9} aria-hidden="true" />
              {String(lang).toUpperCase()}
              <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
            </button>
            {LangPanel}
          </div>

          <NavLink to={withLang("/contact")} className="neoCta">
            Contact
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
          </NavLink>

          <button
            className="neoBurger"
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls={mobilePanelId}
            onClick={() => {
              if (!mobileOpen) {
                closeMega();
                setMobileTab("main");
                setMobileOpen(true);
              } else {
                closeMobile();
              }
            }}
          >
            {mobileOpen ? <X size={19} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>
      </div>

      <MegaPanel />

      <div id={mobilePanelId} className={cx("neoMOv", mobileOpen && "is-open")} aria-hidden={!mobileOpen}>
        <button className="neoBg" type="button" aria-label="Close menu" onClick={closeMobile} />

        <div className={cx("neoSheet", mobileSoft && "is-open")} role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="neoMTop">
            <div className="neoMTitle">Navigation</div>
            <button type="button" className="neoMClose" aria-label="Close menu" onClick={closeMobile}>
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="neoMTabs" role="tablist" aria-label="Mobile navigation sections">
            <button type="button" className={cx("neoTab", mobileTab === "main" && "is-on")} onClick={() => setMobileTab("main")}>
              Main
            </button>
            <button type="button" className={cx("neoTab", mobileTab === "capabilities" && "is-on")} onClick={() => setMobileTab("capabilities")}>
              Capabilities
            </button>
            <button type="button" className={cx("neoTab", mobileTab === "company" && "is-on")} onClick={() => setMobileTab("company")}>
              Company
            </button>
          </div>

          <div className="neoMBody">
            {mobileItems.map((item, index) => (
              <MobileItem key={item.id} item={item} strong={index === 0 && mobileTab === "main"} />
            ))}

            {mobileTab === "main" ? resources.map((item) => <MobileItem key={item.id} item={item} />) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
