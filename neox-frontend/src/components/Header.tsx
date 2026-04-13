// src/components/Header.tsx
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useNavigate, useParams } from "react-router-dom";
import { ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const LANG_MENU: Lang[] = ["az", "tr", "ru", "en", "es"];
const O_LOGO_SRC = "/image/neox-logo.png"; // logo

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

type ItemDef = { id: string; label: string; to: string };

export default function Header({ introReady }: { introReady: boolean }) {
  const { i18n, t } = useTranslation();
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(paramLang) ? (paramLang as Lang) : DEFAULT_LANG;

  const location = useLocation();
  const navigate = useNavigate();
  const panelId = useId();

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // desktop dropdowns
  const [openDD, setOpenDD] = useState<"services" | "scenarios" | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  // desktop: yalnız neoNav toggle
  const [deskNavOpen, setDeskNavOpen] = useState(false);

  // mobile top-sheet
  const [mOpen, setMOpen] = useState(false);
  const [mSoft, setMSoft] = useState(false);
  const [mTab, setMTab] = useState<"main" | "services" | "scenarios">("main");

  const ddSvcRef = useRef<HTMLDivElement | null>(null);
  const ddScnRef = useRef<HTMLDivElement | null>(null);
  const ddLangRef = useRef<HTMLDivElement | null>(null);

  const deskBtnRef = useRef<HTMLButtonElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    if ("addEventListener" in mq) mq.addEventListener("change", apply);
    else (mq as any).addListener(apply);
    return () => {
      if ("removeEventListener" in mq) mq.removeEventListener("change", apply);
      else (mq as any).removeListener(apply);
    };
  }, []);

  const withLang = useCallback(
    (to: string) => {
      if (to === "/") return `/${lang}`;
      return `/${lang}${to.startsWith("/") ? to : `/${to}`}`;
    },
    [lang]
  );

  const switchLang = useCallback(
    (next: Lang) => {
      if (next === lang) return;

      const rest = location.pathname.replace(/^\/[a-z]{2}(?=\/|$)/i, "");
      const cleaned = rest === "" ? "/" : rest;
      const target = cleaned === "/" ? `/${next}` : `/${next}${cleaned}`;

      setLangOpen(false);
      setOpenDD(null);
      setDeskNavOpen(false);
      setMOpen(false);

      Promise.resolve(i18n.changeLanguage(next))
        .catch(() => {})
        .finally(() => navigate(target + location.search + location.hash, { replace: false }));
    },
    [i18n, lang, location.hash, location.pathname, location.search, navigate]
  );

  const SERVICES: ItemDef[] = useMemo(
    () => [
      { id: "chatbot-24-7", label: "Chatbot 24/7", to: "/services/chatbot-24-7" },
      { id: "business-workflows", label: "Business Workflows", to: "/services/business-workflows" },
      { id: "websites", label: "Websites", to: "/services/websites" },
      { id: "mobile-apps", label: "Mobile Apps", to: "/services/mobile-apps" },
      { id: "smm-automation", label: "SMM Automation", to: "/services/smm-automation" },
      { id: "technical-support", label: "Technical Support", to: "/services/technical-support" },
    ],
    []
  );

  const SCENARIOS: ItemDef[] = useMemo(
    () => [
      { id: "healthcare", label: "Healthcare", to: "/use-cases/healthcare" },
      { id: "logistics", label: "Logistics", to: "/use-cases/logistics" },
      { id: "finance", label: "Finance", to: "/use-cases/finance" },
      { id: "retail", label: "Retail", to: "/use-cases/retail" },
      { id: "hotels", label: "Hotels & Resorts", to: "/use-cases/hotels" },
    ],
    []
  );

  // close on route change
  useEffect(() => {
    setOpenDD(null);
    setLangOpen(false);
    setDeskNavOpen(false);
    setMOpen(false);
    setMSoft(false);
    setMTab("main");
  }, [location.pathname, location.search, location.hash]);

  // lock scroll ONLY for mobile sheet
  useEffect(() => {
    const root = document.documentElement;
    const prev = root.style.overflow;
    if (mOpen) root.style.overflow = "hidden";
    else root.style.overflow = "";
    return () => {
      root.style.overflow = prev;
    };
  }, [mOpen]);

  useEffect(() => {
    if (!mOpen) {
      setMSoft(false);
      return;
    }
    const r = requestAnimationFrame(() => setMSoft(true));
    return () => cancelAnimationFrame(r);
  }, [mOpen]);

  // click outside (desktop: lang + dropdown + nav open)
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const tnode = e.target as Node;

      // lang
      if (langOpen && ddLangRef.current && !ddLangRef.current.contains(tnode)) setLangOpen(false);

      // dropdowns
      if (openDD) {
        const ref = openDD === "services" ? ddSvcRef.current : ddScnRef.current;
        if (ref && !ref.contains(tnode)) setOpenDD(null);
      }

      // desktop nav (pill) close when click outside nav & hamburger
      if (deskNavOpen && !isMobile) {
        const inBtn = deskBtnRef.current?.contains(tnode);
        const inNav = navRef.current?.contains(tnode);
        if (!inBtn && !inNav) {
          setDeskNavOpen(false);
          setOpenDD(null);
        }
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [langOpen, openDD, deskNavOpen, isMobile]);

  // Esc close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (mOpen) closeMobile();
        if (openDD) setOpenDD(null);
        if (langOpen) setLangOpen(false);
        if (deskNavOpen) setDeskNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mOpen, openDD, langOpen, deskNavOpen]);

  const closeMobile = () => {
    setMSoft(false);
    window.setTimeout(() => setMOpen(false), 190);
  };

  const MegaPanel = ({ title, items }: { title: string; items: ItemDef[] }) => {
    return (
      <div className="neoMega" role="menu" aria-label={title}>
        <div className="neoMegaHead">
          <div className="neoMegaTitle">{title}</div>
        </div>

        <div className="neoMegaList">
          {items.map((it) => (
            <NavLink
              key={it.id}
              to={withLang(it.to)}
              role="menuitem"
              className={({ isActive }) => cx("neoMegaItem", isActive && "is-active")}
              onClick={() => setOpenDD(null)}
            >
              <span>{it.label}</span>
              <i className="neoMegaArrow" aria-hidden="true">
                ↗
              </i>
            </NavLink>
          ))}
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
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => switchLang(code)}
        >
          <span className="neoLangCode">{String(code).toUpperCase()}</span>
          <span className="neoLangName">{langFullName(code)}</span>
        </button>
      ))}
    </div>
  );

  const headerNode = (
    <header className={cx("neoHdr", introReady && "neoHdr--in", deskNavOpen && "is-deskNavOpen")}>
      <style>{`
        .neoHdr, .neoHdr *{ box-sizing:border-box; }
        .neoHdr a, .neoHdr a:hover, .neoHdr a:focus, .neoHdr a:active{ text-decoration:none !important; }
        .neoHdr a{ color: inherit; }

        /* ✅ HƏMİŞƏ şəffaf */
        .neoHdr{
          position: fixed;
          top:0; left:0; right:0;
          z-index: 99999;
          background: transparent !important;
          border: 0 !important;
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
        }

        .neoInner{
          position: relative;
          width:100%;
          padding: 0 22px;
          height: 76px;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap: 14px;
        }

        /* ✅ BRAND: tək logo */
        .neoBrand{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width: 60px;   /* ⬅️ böyüdü */
          height: 60px;  /* ⬅️ böyüdü */
          border-radius: 18px;
          padding: 0;
          border: 0;
          background: transparent;
          transform: translateZ(0);
          transition: transform .18s ease, filter .18s ease;
          will-change: transform;
        }

        .neoBrandSpin{
          display:inline-flex;
          align-items:center;
          justify-content:center;
          width: 52px;   /* ⬅️ böyüdü */
          height: 52px;  /* ⬅️ böyüdü */
          will-change: transform;
          animation: neoSpin 18s linear infinite;
        }

        .neoBrandLogo{
          width: 52px;   /* ⬅️ böyüdü */
          height: 52px;  /* ⬅️ böyüdü */
          object-fit: contain;
          display:block;
          filter: drop-shadow(0 8px 18px rgba(0,0,0,.32));
          user-select: none;
          -webkit-user-drag: none;
        }

        .neoBrand:hover{
          transform: translateY(-2px) scale(1.03);
          filter: drop-shadow(0 14px 30px rgba(0,0,0,.35));
        }
        .neoBrand:hover .neoBrandSpin{ animation-play-state: paused; }

        @keyframes neoSpin{
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        @media (prefers-reduced-motion: reduce){
          .neoBrandSpin{ animation: none !important; }
          .neoBrand{ transition: none !important; }
        }

        /* ✅ PILL NAV */
        .neoNav{
          position:absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%,-50%) translateY(-140%);
          opacity: 0;
          pointer-events: none;

          display:flex;
          align-items:center;
          gap: 18px;
          white-space: nowrap;

          padding: 6px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(10,12,18,.26);
          -webkit-backdrop-filter: blur(14px) saturate(1.10);
          backdrop-filter: blur(14px) saturate(1.10);
          box-shadow: 0 24px 90px rgba(0,0,0,.35);

          transition: transform .22s cubic-bezier(.2,.8,.2,1), opacity .18s ease;
        }
        .neoHdr.is-deskNavOpen .neoNav{
          transform: translate(-50%,-50%) translateY(0);
          opacity: 1;
          pointer-events: auto;
        }

        .neoTop{
          display:inline-flex;
          align-items:center;
          height: 44px;
          padding: 0 10px;
          border: 0;
          background: transparent;
          color: rgba(255,255,255,.88);
          font-weight: 700;
          font-size: 15.5px;
          cursor:pointer;
          border-radius: 12px;
        }
        .neoTop:hover{ color: rgba(255,255,255,.98); }
        .neoTop.is-active{ color: rgba(255,255,255,.98); }

        .neoChev{ opacity:.55; margin-left: 8px; transition: transform .18s ease, opacity .18s ease; }
        .neoDD.is-open .neoChev{ transform: rotate(180deg); opacity:.9; }
        .neoDD{ position: relative; display:inline-flex; }

        .neoPanelWrap{
          position:absolute;
          top: calc(100% + 12px);
          left: 0;
          border-radius: 18px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(10,12,18,.86);
          -webkit-backdrop-filter: blur(16px) saturate(1.08);
          backdrop-filter: blur(16px) saturate(1.08);
          box-shadow: 0 24px 90px rgba(0,0,0,.68);
          opacity: 0;
          pointer-events:none;
          transform: translateY(-10px) scale(.99);
          transition: opacity .18s ease, transform .18s ease;
          overflow:hidden;
        }
        .neoDD.is-open .neoPanelWrap{ opacity: 1; pointer-events:auto; transform: translateY(0) scale(1); }
        .neoPanelWrap.neoPanelWrap--mega{
          width: min(680px, 84vw);
          left: 50%;
          transform: translate(-50%, -10px) scale(.99);
        }
        .neoDD.is-open .neoPanelWrap.neoPanelWrap--mega{ transform: translate(-50%, 0) scale(1); }

        /* Mega minimal (terminal/preview YOX) */
        .neoMega{ padding: 12px; }
        .neoMegaHead{ display:flex; justify-content:space-between; gap:10px; padding: 6px 6px 12px; border-bottom: 1px solid rgba(255,255,255,.08); margin-bottom: 12px; }
        .neoMegaTitle{ font-weight: 920; font-size: 12px; letter-spacing: .18em; color: rgba(255,255,255,.78); text-transform: uppercase; }
        .neoMegaList{ display:grid; gap: 8px; }
        .neoMegaItem{
          display:flex; justify-content:space-between; gap:12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(255,255,255,.03);
          color: rgba(255,255,255,.92);
          font-weight: 880;
        }
        .neoMegaItem:hover{ background: rgba(255,255,255,.06); }

        /* Lang */
        .neoLangWrap{ position: relative; display:inline-flex; }
        .neoLangBtn{
          display:inline-flex; align-items:center; gap: 10px;
          height: 44px; padding: 0 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.12);
          background: rgba(10,12,18,.20);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          color: rgba(255,255,255,.92);
          font-weight: 650;
          font-size: 12.5px;
          cursor:pointer;
        }
        .neoLangPanel{
          position:absolute;
          top: calc(100% + 10px);
          right: 0;
          width: 240px;
          padding: 10px;
          border-radius: 16px;
          border: 1px solid rgba(255,255,255,.10);
          background: rgba(10,12,18,.90);
          box-shadow: 0 24px 90px rgba(0,0,0,.70);
          opacity: 0;
          pointer-events:none;
          transform: translateY(-10px) scale(.99);
          transition: opacity .18s ease, transform .18s ease;
          z-index: 100001;
        }
        .neoLangWrap.is-open .neoLangPanel{ opacity: 1; pointer-events:auto; transform: translateY(0) scale(1); }
        .neoLangItem{ width:100%; display:flex; justify-content: space-between; gap: 10px; padding: 11px 12px; border-radius: 12px; background: transparent; border: 1px solid rgba(255,255,255,0); color: rgba(255,255,255,.90); cursor:pointer; font-weight: 620; }
        .neoLangItem + .neoLangItem{ margin-top: 6px; }
        .neoLangItem:hover{ background: rgba(255,255,255,.04); }
        .neoLangItem.is-active{ background: rgba(120,170,255,.10); }
        .neoLangCode{ font-weight: 820; letter-spacing: .14em; opacity: .95; }
        .neoLangName{ opacity: .78; font-size: 12px; white-space: nowrap; }

        /* Desktop hamburger -> X */
        .neoDeskBurger{
          width: 48px; height: 44px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(10,12,18,.20);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          display:inline-flex;
          align-items:center; justify-content:center;
          cursor:pointer;
        }
        .neoHB{ width: 18px; height: 12px; position: relative; display:block; }
        .neoHB i{
          position:absolute; left:0; right:0;
          height:2px; border-radius:999px;
          background: rgba(255,255,255,.90);
          transition: transform .18s ease, top .18s ease, opacity .18s ease;
        }
        .neoHB i:nth-child(1){ top:0; }
        .neoHB i:nth-child(2){ top:5px; }
        .neoHB i:nth-child(3){ top:10px; }
        .neoDeskBurger.is-open .neoHB i:nth-child(1){ top:5px; transform: rotate(45deg); }
        .neoDeskBurger.is-open .neoHB i:nth-child(2){ opacity: 0; }
        .neoDeskBurger.is-open .neoHB i:nth-child(3){ top:5px; transform: rotate(-45deg); }

        /* Mobile */
        .neoBurger{
          width: 48px; height: 44px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(10,12,18,.20);
          -webkit-backdrop-filter: blur(10px);
          backdrop-filter: blur(10px);
          color: rgba(255,255,255,.92);
          display:none;
          align-items:center; justify-content:center;
          cursor:pointer;
        }
        .neoBurgerLines{ width: 18px; height: 12px; display:grid; gap: 4px; }
        .neoBurgerLines i{ height: 2px; border-radius: 999px; background: rgba(255,255,255,.90); display:block; }

        @media (max-width: 980px){
          .neoNav{ display:none; }
          .neoBurger{ display:inline-flex; }
          .neoDeskBurger{ display:none; }
          .neoInner{ height: 68px; padding: 0 14px; }

          /* ⬅️ mobil logo biraz böyük */
          .neoBrand{ width: 56px; height: 56px; border-radius: 16px; }
          .neoBrandSpin, .neoBrandLogo{ width: 48px; height: 48px; }
        }

        /* MOBILE TOP-SHEET */
        .neoMOv{ position: fixed; inset: 0; z-index: 100000; opacity: 0; pointer-events: none; transition: opacity .18s ease; }
        .neoMOv.is-open{ opacity: 1; pointer-events: auto; }
        .neoBg{ position:absolute; inset:0; border:0; background: rgba(0,0,0,.45); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
        .neoSheet{
          position:absolute; top: calc(68px + 10px); left: 10px; right: 10px;
          max-width: 520px; margin: 0 auto;
          border-radius: 18px; border: 1px solid rgba(255,255,255,.10);
          background: rgba(10,12,18,.94);
          box-shadow: 0 40px 120px rgba(0,0,0,.75);
          transform: translateY(-16px); opacity: 0;
          transition: transform .26s cubic-bezier(.2,.8,.2,1), opacity .22s ease;
          overflow:hidden;
        }
        .neoSheet.is-open{ transform: translateY(0); opacity: 1; }
        .neoMTop{ padding: 14px 14px 12px; border-bottom: 1px solid rgba(255,255,255,.07); display:flex; align-items:center; justify-content: space-between; gap: 12px; }
        .neoMTitle{ font-weight: 820; font-size: 12px; letter-spacing: .16em; color: rgba(255,255,255,.72); display:flex; align-items:center; gap: 10px; }
        .neoMDot{ width: 9px; height: 9px; border-radius: 999px; background: rgba(120,170,255,.92); box-shadow: 0 0 0 4px rgba(120,170,255,.12); }
        .neoMClose{ width: 40px; height: 40px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.04); color: rgba(255,255,255,.92); display:flex; align-items:center; justify-content:center; cursor: pointer; }
        .neoMTabs{ padding: 12px 12px 0; display:flex; gap: 8px; }
        .neoTab{ flex: 1; height: 44px; border-radius: 16px; border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.03); color: rgba(255,255,255,.90); font-weight: 820; font-size: 14px; cursor:pointer; }
        .neoTab.is-on{ background: rgba(120,170,255,.12); border-color: rgba(120,170,255,.22); }
        .neoMBody{ padding: 12px 12px 14px; display:grid; gap: 10px; max-height: min(62vh, 520px); overflow: auto; -webkit-overflow-scrolling: touch; }
        .neoMItem{ display:flex; align-items:center; justify-content: space-between; gap: 12px; padding: 14px; border-radius: 18px; border: 1px solid rgba(255,255,255,.10); background: rgba(255,255,255,.04); color: rgba(255,255,255,.94); font-weight: 860; font-size: 15px; }
        .neoMItem span{ opacity: .55; font-weight: 850; }
      `}</style>

      <div className="neoInner">
        {/* LEFT */}
        <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <Link to={`/${lang}`} className="neoBrand" aria-label="NEOX" data-wg-notranslate>
            <span className="neoBrandSpin" aria-hidden="true">
              <img className="neoBrandLogo" src={O_LOGO_SRC} alt="" loading="eager" decoding="async" draggable={false} />
            </span>
          </Link>
        </div>

        {/* DESKTOP PILL NAV (toggle olunur) */}
        <nav ref={navRef} className="neoNav" aria-label="Primary navigation">
          <NavLink
            to={withLang("/")}
            end
            className={({ isActive }) => cx("neoTop", isActive && "is-active")}
            onClick={() => setDeskNavOpen(false)}
          >
            {t("nav.home") || "Ana səhifə"}
          </NavLink>

          <NavLink
            to={withLang("/about")}
            className={({ isActive }) => cx("neoTop", isActive && "is-active")}
            onClick={() => setDeskNavOpen(false)}
          >
            {t("nav.about") || "Haqqımızda"}
          </NavLink>

          <div ref={ddSvcRef} className={cx("neoDD", openDD === "services" && "is-open")}>
            <button
              type="button"
              className={cx("neoTop", openDD === "services" && "is-active")}
              aria-haspopup="menu"
              aria-expanded={openDD === "services"}
              onClick={() => setOpenDD((c) => (c === "services" ? null : "services"))}
            >
              {t("nav.services") || "Xidmətlər"}
              <span className="neoChev" aria-hidden="true">
                <ChevronDown size={16} />
              </span>
            </button>
            <div className="neoPanelWrap neoPanelWrap--mega">{openDD === "services" ? <MegaPanel title="Services" items={SERVICES} /> : null}</div>
          </div>

          <div ref={ddScnRef} className={cx("neoDD", openDD === "scenarios" && "is-open")}>
            <button
              type="button"
              className={cx("neoTop", openDD === "scenarios" && "is-active")}
              aria-haspopup="menu"
              aria-expanded={openDD === "scenarios"}
              onClick={() => setOpenDD((c) => (c === "scenarios" ? null : "scenarios"))}
            >
              {t("nav.useCases") || "Ssenarilər"}
              <span className="neoChev" aria-hidden="true">
                <ChevronDown size={16} />
              </span>
            </button>
            <div className="neoPanelWrap neoPanelWrap--mega">{openDD === "scenarios" ? <MegaPanel title="Scenarios" items={SCENARIOS} /> : null}</div>
          </div>

          <NavLink to={withLang("/faq")} className={({ isActive }) => cx("neoTop", isActive && "is-active")} onClick={() => setDeskNavOpen(false)}>
            FAQ
          </NavLink>

          <NavLink to={withLang("/blog")} className={({ isActive }) => cx("neoTop", isActive && "is-active")} onClick={() => setDeskNavOpen(false)}>
            {t("nav.blog") || "Blog"}
          </NavLink>

          <NavLink to={withLang("/contact")} className={({ isActive }) => cx("neoTop", isActive && "is-active")} onClick={() => setDeskNavOpen(false)}>
            {t("nav.contact") || "Əlaqə"}
          </NavLink>
        </nav>

        {/* RIGHT */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* LANG */}
          <div ref={ddLangRef} className={cx("neoLangWrap", langOpen && "is-open")} data-wg-notranslate>
            <button
              type="button"
              className="neoLangBtn"
              aria-haspopup="menu"
              aria-expanded={langOpen}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setLangOpen((v) => !v)}
            >
              {String(lang).toUpperCase()}
              <span aria-hidden="true" style={{ opacity: 0.75 }}>
                <ChevronDown size={14} />
              </span>
            </button>
            {LangPanel}
          </div>

          {/* DESKTOP hamburger (yalnız neoNav toggle) */}
          <button
            ref={deskBtnRef}
            className={cx("neoDeskBurger", deskNavOpen && "is-open")}
            type="button"
            aria-label={deskNavOpen ? "Close menu" : "Open menu"}
            aria-expanded={deskNavOpen}
            onClick={() => {
              if (isMobile) return;
              setLangOpen(false);
              setOpenDD(null);
              setDeskNavOpen((v) => !v);
            }}
          >
            <span className="neoHB" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>

          {/* MOBILE BTN */}
          <button
            className="neoBurger"
            type="button"
            aria-label={mOpen ? "Close menu" : "Open menu"}
            aria-expanded={mOpen}
            aria-controls={panelId}
            onClick={() => {
              if (!mOpen) {
                setMTab("main");
                setMOpen(true);
              } else closeMobile();
            }}
          >
            <span className="neoBurgerLines" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </button>
        </div>
      </div>

      {/* MOBILE TOP SHEET */}
      {createPortal(
        <div className={cx("neoMOv", mOpen && "is-open")} aria-hidden={!mOpen}>
          <button className="neoBg" type="button" aria-label="Close" onClick={closeMobile} />
          <div id={panelId} className={cx("neoSheet", mSoft && "is-open")} role="dialog" aria-modal="true" aria-label="Menu">
            <div className="neoMTop">
              <div className="neoMTitle">
                <span className="neoMDot" aria-hidden="true" /> MENU
              </div>
              <button className="neoMClose" type="button" aria-label="Close" onClick={closeMobile}>
                <X size={18} />
              </button>
            </div>

            <div className="neoMTabs">
              <button className={cx("neoTab", mTab === "main" && "is-on")} onClick={() => setMTab("main")} type="button">
                Menu
              </button>
              <button className={cx("neoTab", mTab === "services" && "is-on")} onClick={() => setMTab("services")} type="button">
                Services
              </button>
              <button className={cx("neoTab", mTab === "scenarios" && "is-on")} onClick={() => setMTab("scenarios")} type="button">
                Scenarios
              </button>
            </div>

            <div className="neoMBody">
              {mTab === "main" ? (
                <>
                  <NavLink to={withLang("/")} end className="neoMItem" onClick={closeMobile}>
                    {t("nav.home") || "Ana səhifə"} <span aria-hidden="true">↵</span>
                  </NavLink>

                  <NavLink to={withLang("/about")} className="neoMItem" onClick={closeMobile}>
                    {t("nav.about") || "Haqqımızda"} <span aria-hidden="true">↵</span>
                  </NavLink>

                  <NavLink to={withLang("/faq")} className="neoMItem" onClick={closeMobile}>
                    FAQ <span aria-hidden="true">↵</span>
                  </NavLink>

                  <NavLink to={withLang("/blog")} className="neoMItem" onClick={closeMobile}>
                    {t("nav.blog") || "Blog"} <span aria-hidden="true">↵</span>
                  </NavLink>

                  <NavLink to={withLang("/contact")} className="neoMItem" onClick={closeMobile}>
                    {t("nav.contact") || "Əlaqə"} <span aria-hidden="true">↵</span>
                  </NavLink>
                </>
              ) : mTab === "services" ? (
                <>
                  {SERVICES.map((s) => (
                    <NavLink key={s.id} to={withLang(s.to)} className="neoMItem" onClick={closeMobile}>
                      {s.label} <span aria-hidden="true">↵</span>
                    </NavLink>
                  ))}
                </>
              ) : (
                <>
                  {SCENARIOS.map((u) => (
                    <NavLink key={u.id} to={withLang(u.to)} className="neoMItem" onClick={closeMobile}>
                      {u.label} <span aria-hidden="true">↵</span>
                    </NavLink>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );

  if (!mounted) return null;
  return createPortal(headerNode, document.body);
}
