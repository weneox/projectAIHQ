// src/components/Header.tsx
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
import { ArrowUpRight, ChevronDown, Globe2, Menu, X } from "lucide-react";
import { DEFAULT_LANG, type Lang } from "../i18n/lang";

function cx(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const LANG_MENU: Lang[] = ["az", "tr", "ru", "en", "es"];
const LOGO_SRC = "/image/neox-logo.png";

function isLang(x: string | undefined | null): x is Lang {
  if (!x) return false;
  const v = String(x).toLowerCase();
  return (LANG_MENU as readonly string[]).includes(v);
}

type ItemDef = {
  id: string;
  label: string;
  note?: string;
  to: string;
};

type MegaKind = "services" | "company";
type MobileTab = "main" | MegaKind;

export default function Header({ introReady }: { introReady: boolean }) {
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(paramLang) ? paramLang : DEFAULT_LANG;

  const location = useLocation();
  const mobilePanelId = useId();
  const megaPanelId = useId();

  const headerRef = useRef<HTMLElement | null>(null);
  const megaRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [openMega, setOpenMega] = useState<MegaKind | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSoft, setMobileSoft] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("main");

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

  const services: ItemDef[] = useMemo(
    () => [
      {
        id: "ai-chat",
        label: "Süni İntellekt çat sistemləri",
        note: "Sayt, sosial şəbəkə və mesaj cavab axınları",
        to: "/services/chatbot-24-7",
      },
      {
        id: "automation",
        label: "Biznes avtomatlaşdırması",
        note: "Lead, yönləndirmə, təsdiq və daxili proseslər",
        to: "/services/business-workflows",
      },
      {
        id: "websites",
        label: "Premium veb saytlar",
        note: "Brendə uyğun sürətli və satış yönümlü saytlar",
        to: "/services/websites",
      },
      {
        id: "mobile-apps",
        label: "Mobil tətbiqlər",
        note: "Müştəri və komanda üçün təmiz tətbiq interfeysləri",
        to: "/services/mobile-apps",
      },
      {
        id: "social-systems",
        label: "Sosial media sistemləri",
        note: "Kontent, cavab, lead və kampaniya axınları",
        to: "/services/smm-automation",
      },
      {
        id: "support",
        label: "Texniki dəstək",
        note: "Qurulum, optimallaşdırma və davamlı texniki nəzarət",
        to: "/services/technical-support",
      },
    ],
    []
  );

  const company: ItemDef[] = useMemo(
    () => [
      {
        id: "about",
        label: "Haqqımızda",
        note: "NEOX-un yanaşması, fəlsəfəsi və istiqaməti",
        to: "/about",
      },
      {
        id: "use-cases",
        label: "İstifadə sahələri",
        note: "Klinika, mağaza, xidmət və əməliyyat komandaları",
        to: "/use-cases",
      },
      {
        id: "pricing",
        label: "Qiymətlər",
        note: "Layihə miqyası və ehtiyaca uyğun əməkdaşlıq",
        to: "/pricing",
      },
      {
        id: "contact",
        label: "Əlaqə",
        note: "Biznesiniz üçün uyğun sistemi müzakirə edək",
        to: "/contact",
      },
    ],
    []
  );

  const resources: ItemDef[] = useMemo(
    () => [
      {
        id: "blog",
        label: "Bloq",
        note: "Süni İntellekt, avtomatlaşdırma və biznes sistemləri",
        to: "/blog",
      },
      {
        id: "faq",
        label: "Suallar",
        note: "Başlamazdan əvvəl ən çox verilən suallar",
        to: "/faq",
      },
      {
        id: "guides",
        label: "Bələdçilər",
        note: "Praktiki tətbiq və sistem qurulum izahları",
        to: "/resources/guides",
      },
    ],
    []
  );

  const megaItems = openMega === "company" ? company : services;
  const megaTitle = openMega === "company" ? "Şirkət" : "Xidmətlər";
  const megaHint =
    openMega === "company"
      ? "Şirkət, istifadə sahələri və əlaqə məlumatları."
      : "Biznesiniz üçün qurduğumuz əsas rəqəmsal sistemlər.";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    closeMega();
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
      const inHeader = headerRef.current?.contains(node);
      const inMega = megaRef.current?.contains(node);

      if (!inHeader && !inMega) closeMega();
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [closeMega]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (mobileOpen) closeMobile();
      closeMega();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeMega, closeMobile, mobileOpen]);

  useEffect(() => {
    if (!openMega) return undefined;

    const closeOnScrollIntent = () => {
      closeMega();
    };

    window.addEventListener("wheel", closeOnScrollIntent, { capture: true, passive: true });
    window.addEventListener("touchmove", closeOnScrollIntent, { capture: true, passive: true });

    return () => {
      window.removeEventListener("wheel", closeOnScrollIntent, { capture: true });
      window.removeEventListener("touchmove", closeOnScrollIntent, { capture: true });
    };
  }, [closeMega, openMega]);

  const MegaPanel = () => {
    if (!openMega || !mounted) return null;

    return createPortal(
      <div
        ref={megaRef}
        id={megaPanelId}
        className="neoMegaPortal is-open"
        role="menu"
        aria-label={megaTitle}
        onMouseEnter={() => setOpenMega(openMega)}
        onMouseLeave={closeMega}
      >
        <style>{`
          .neoMegaPortal,
          .neoMegaPortal *{
            box-sizing:border-box;
            font-family:
              "Inter Variable",
              Inter,
              ui-sans-serif,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .neoMegaPortal a,
          .neoMegaPortal a:hover,
          .neoMegaPortal a:focus,
          .neoMegaPortal a:active{
            text-decoration:none !important;
          }

          .neoMegaPortal{
            position:fixed;
            top:var(--nx-header-h, 56px);
            left:0;
            right:0;
            z-index:99998;
            background:#fff;
            color:#0d1420;
            overflow:hidden;
            opacity:0;
            transform:translate3d(0,-8px,0);
            clip-path:inset(0 0 100% 0);
            border-top:1px solid rgba(13,20,32,.055);
            border-bottom:1px solid rgba(13,20,32,.075);
            box-shadow:0 24px 48px rgba(13,20,32,.06);
            animation:neoMegaOpen .24s cubic-bezier(.2,.8,.2,1) forwards;
            will-change:opacity, transform, clip-path;
          }

          @keyframes neoMegaOpen{
            to{
              opacity:1;
              transform:translate3d(0,0,0);
              clip-path:inset(0 0 0 0);
            }
          }

          .neoMegaShell{
            width:min(100%,1440px);
            margin:0 auto;
            padding:28px clamp(18px,5vw,80px) 34px;
          }

          .neoMegaHead{
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:24px;
            margin-bottom:22px;
          }

          .neoMegaKicker{
            margin:0;
            color:#0d1420;
            font-size:12px;
            line-height:1;
            font-weight:760;
            letter-spacing:.08em;
            text-transform:uppercase;
          }

          .neoMegaHint{
            margin:0;
            max-width:360px;
            color:#7a8597;
            font-size:13px;
            line-height:1.4;
            font-weight:450;
            letter-spacing:-.01em;
            text-align:right;
          }

          .neoMegaList{
            display:grid;
            grid-template-columns:repeat(3,minmax(0,1fr));
            gap:0 42px;
          }

          .neoMegaItem{
            min-height:84px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:18px;
            padding:18px 0;
            color:#263244;
            border:0;
            border-bottom:1px solid rgba(13,20,32,.075);
            background:transparent;
            position:relative;
            transition:
              color .16s ease,
              transform .16s cubic-bezier(.2,.8,.2,1);
          }

          .neoMegaItem:hover,
          .neoMegaItem.is-active{
            color:#3148c7;
            transform:translateX(3px);
          }

          .neoMegaCopy{
            min-width:0;
            display:grid;
            gap:6px;
          }

          .neoMegaName{
            color:inherit;
            font-size:16px;
            line-height:1.12;
            font-weight:680;
            letter-spacing:-.035em;
          }

          .neoMegaNote{
            max-width:260px;
            color:#7a8597;
            font-size:14px;
            line-height:1.35;
            font-weight:430;
            letter-spacing:-.015em;
          }

          .neoMegaArrow{
            flex:0 0 auto;
            color:currentColor;
            opacity:.58;
            transition:
              opacity .16s ease,
              transform .16s cubic-bezier(.2,.8,.2,1);
          }

          .neoMegaItem:hover .neoMegaArrow,
          .neoMegaItem.is-active .neoMegaArrow{
            opacity:.9;
            transform:translate(2px,-2px);
          }

          @media (max-width:1100px){
            .neoMegaList{
              grid-template-columns:repeat(2,minmax(0,1fr));
              gap:0 34px;
            }
          }

          @media (max-width:980px){
            .neoMegaPortal{
              display:none;
            }
          }

          @media (prefers-reduced-motion:reduce){
            .neoMegaPortal{
              animation:none !important;
              opacity:1;
              transform:none;
              clip-path:inset(0 0 0 0);
            }

            .neoMegaItem,
            .neoMegaArrow{
              transition:none !important;
            }
          }
        `}</style>

        <div className="neoMegaShell">
          <div className="neoMegaHead">
            <p className="neoMegaKicker">{megaTitle}</p>
            <p className="neoMegaHint">{megaHint}</p>
          </div>

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
                <ArrowUpRight className="neoMegaArrow" size={16} strokeWidth={1.9} aria-hidden="true" />
              </NavLink>
            ))}
          </div>
        </div>
      </div>,
      document.body
    );
  };

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
    mobileTab === "services"
      ? services
      : mobileTab === "company"
        ? company
        : [
            { id: "home", label: "Ana səhifə", to: "/" },
            { id: "services", label: "Xidmətlər", note: "Süni İntellekt, sayt və avtomatlaşdırma", to: "/services" },
            { id: "resources", label: "Resurslar", note: "Bloq, suallar və bələdçilər", to: "/blog" },
            { id: "contact", label: "Əlaqə", note: "Biznesiniz üçün sistemi müzakirə edək", to: "/contact" },
          ];

  return (
    <>
      <header ref={headerRef} className={cx("neoHdr", introReady && "neoHdr--in", openMega && "is-megaOpen")}>
        <style>{`
          .neoHdr,
          .neoHdr *{
            box-sizing:border-box;
            font-family:
              "Inter Variable",
              Inter,
              ui-sans-serif,
              system-ui,
              -apple-system,
              BlinkMacSystemFont,
              "Segoe UI",
              sans-serif;
          }

          .neoHdr a,
          .neoHdr a:hover,
          .neoHdr a:focus,
          .neoHdr a:active{
            text-decoration:none !important;
          }

          .neoHdr{
            --neo-white:#fff;
            --neo-ink:#0d1420;
            --neo-muted:#667286;
            --neo-muted-strong:#4f5868;
            --neo-accent:#3148c7;
            --neo-accent-hover:#293fb8;

            position:fixed;
            top:0;
            left:0;
            right:0;
            z-index:99999;
            height:var(--nx-header-h, 56px);
            background:#fff;
            color:var(--neo-ink);
            opacity:0;
            transform:translate3d(0,-8px,0);
            border-bottom:1px solid rgba(13,20,32,.075);
            box-shadow:none;
            transition:
              opacity .28s cubic-bezier(.2,.8,.2,1),
              transform .28s cubic-bezier(.2,.8,.2,1);
            isolation:isolate;
          }

          .neoHdr--in{
            opacity:1;
            transform:translate3d(0,0,0);
          }

          .neoInner{
            position:relative;
            z-index:2;
            height:var(--nx-header-h, 56px);
            width:100%;
            padding:0 clamp(18px,5vw,80px);
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:24px;
            background:#fff;
            box-shadow:none;
          }

          .neoBrand{
            display:inline-flex;
            align-items:center;
            justify-content:flex-start;
            gap:0;
            min-width:0;
            color:var(--neo-ink);
          }

          .neoBrandMark{
            width:104px;
            height:40px;
            display:inline-flex;
            align-items:center;
            justify-content:flex-start;
            transition:
              transform .2s cubic-bezier(.2,.8,.2,1),
              filter .2s ease;
          }

          .neoBrandLogo{
            width:100px;
            height:38px;
            object-fit:contain;
            object-position:left center;
            display:block;
            filter:none;
            user-select:none;
            -webkit-user-drag:none;
          }

          .neoBrand:hover .neoBrandMark{
            transform:translateY(-1px) scale(1.015);
          }

          .neoNav{
            position:absolute;
            left:50%;
            top:50%;
            transform:translate(-50%,-50%);
            display:flex;
            align-items:center;
            justify-content:center;
            gap:4px;
            white-space:nowrap;
          }

          .neoTop,
          .neoTopLink{
            height:34px;
            border:0;
            background:transparent;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:7px;
            padding:0 12px;
            border-radius:10px;
            color:var(--neo-muted);
            font-size:14px;
            font-weight:620;
            letter-spacing:-.022em;
            line-height:1;
            cursor:pointer;
            position:relative;
            transition:
              color .16s ease,
              background .16s ease,
              transform .16s cubic-bezier(.2,.8,.2,1);
          }

          .neoTop::after,
          .neoTopLink::after{
            display:none;
          }

          .neoTop:hover,
          .neoTopLink:hover{
            color:var(--neo-muted-strong);
            background:rgba(13,20,32,.035);
          }

          .neoTop.is-active,
          .neoTop.is-open,
          .neoTopLink.is-active{
            color:#0d1420;
            background:rgba(13,20,32,.055);
          }

          .neoTop:active,
          .neoTopLink:active{
            transform:translateY(1px);
          }

          .neoChev{
            opacity:.62;
            transition:
              transform .18s cubic-bezier(.2,.8,.2,1),
              opacity .18s ease;
          }

          .neoTop.is-open .neoChev{
            transform:rotate(180deg);
            opacity:.9;
          }

          .neoRight{
            display:flex;
            align-items:center;
            justify-content:flex-end;
            gap:10px;
            min-width:0;
          }

          .neoLangPill{
            height:38px;
            min-width:82px;
            border-radius:14px;
            border:1px solid rgba(13,20,32,.075);
            background:#fff;
            color:#4f5868;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:8px;
            padding:0 12px;
            font-size:13px;
            font-weight:640;
            box-shadow:none;
            user-select:none;
          }

          .neoCta{
            height:38px;
            min-width:134px;
            display:inline-flex;
            align-items:center;
            justify-content:center;
            gap:8px;
            padding:0 16px;
            border-radius:15px;
            background:var(--neo-accent);
            color:#fff !important;
            font-size:14px;
            font-weight:720;
            letter-spacing:-.02em;
            box-shadow:0 10px 22px rgba(49,72,199,.18);
            transition:
              transform .16s cubic-bezier(.2,.8,.2,1),
              box-shadow .16s ease,
              background .16s ease;
          }

          .neoCta:hover{
            background:var(--neo-accent-hover);
            transform:translateY(-1px);
            box-shadow:0 14px 26px rgba(49,72,199,.22);
          }

          .neoBurger{
            width:38px;
            height:38px;
            display:none;
            align-items:center;
            justify-content:center;
            border-radius:12px;
            border:1px solid rgba(13,20,32,.08);
            background:#fff;
            color:#111827;
            cursor:pointer;
            box-shadow:none;
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
            top:var(--nx-header-h, 56px);
            left:0;
            right:0;
            background:#fff;
            color:#0a1020;
            box-shadow:0 26px 58px rgba(7,13,28,.16);
            transform:translate3d(0,-14px,0);
            opacity:0;
            transition:
              transform .24s cubic-bezier(.2,.8,.2,1),
              opacity .2s ease;
            overflow:hidden;
          }

          .neoSheet.is-open{
            transform:translate3d(0,0,0);
            opacity:1;
          }

          .neoMTop{
            height:64px;
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:14px;
            padding:0 18px;
            background:#fff;
            border-bottom:1px solid rgba(13,20,32,.07);
          }

          .neoMTitle{
            font-size:12px;
            font-weight:760;
            letter-spacing:.18em;
            color:#7a8495;
            text-transform:uppercase;
          }

          .neoMClose{
            width:42px;
            height:42px;
            display:flex;
            align-items:center;
            justify-content:center;
            border-radius:12px;
            border:1px solid rgba(7,11,20,.08);
            background:#fff;
            color:#111827;
            cursor:pointer;
          }

          .neoMTabs{
            display:grid;
            grid-template-columns:repeat(3,1fr);
            gap:8px;
            padding:14px 18px;
            border-bottom:1px solid rgba(13,20,32,.07);
          }

          .neoTab{
            min-height:42px;
            border:0;
            border-radius:12px;
            background:#f8f9fb;
            color:#5b6575;
            font-size:13px;
            font-weight:640;
            cursor:pointer;
          }

          .neoTab.is-on{
            background:#101827;
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
            border-bottom:1px solid rgba(7,11,20,.08);
          }

          .neoMItemText{
            display:grid;
            gap:4px;
            min-width:0;
          }

          .neoMItemText b{
            font-size:17px;
            line-height:1.15;
            font-weight:720;
            letter-spacing:-.035em;
          }

          .neoMItemText small{
            color:#7a8495;
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
              min-width:124px;
            }

            .neoBrandMark{
              width:98px;
            }

            .neoBrandLogo{
              width:94px;
            }
          }

          @media (max-width:980px){
            .neoInner{
              padding:0 14px;
            }

            .neoNav,
            .neoCta,
            .neoLangPill{
              display:none;
            }

            .neoBurger{
              display:inline-flex;
              width:38px;
              height:38px;
            }

            .neoBrandMark{
              width:92px;
              height:38px;
            }

            .neoBrandLogo{
              width:88px;
              height:36px;
            }
          }

          @media (max-width:560px){
            .neoBrandMark{
              width:84px;
              height:36px;
            }

            .neoBrandLogo{
              width:80px;
              height:34px;
            }

            .neoMTabs{
              grid-template-columns:1fr;
            }
          }

          @media (prefers-reduced-motion:reduce){
            .neoHdr,
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
              <img className="neoBrandLogo" src={LOGO_SRC} alt="" loading="eager" decoding="async" draggable={false} />
            </span>
          </Link>

          <nav className="neoNav" aria-label="Əsas naviqasiya">
            <NavLink to={withLang("/")} end className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}>
              Ana səhifə
            </NavLink>

            <button
              type="button"
              className={cx("neoTop", openMega === "services" && "is-open is-active")}
              aria-haspopup="menu"
              aria-expanded={openMega === "services"}
              aria-controls={megaPanelId}
              onMouseEnter={() => setOpenMega("services")}
              onFocus={() => setOpenMega("services")}
              onClick={() => setOpenMega((current) => (current === "services" ? null : "services"))}
            >
              Xidmətlər
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
              Şirkət
              <ChevronDown className="neoChev" size={15} strokeWidth={2} aria-hidden="true" />
            </button>

            <NavLink to={withLang("/blog")} className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}>
              Resurslar
            </NavLink>

            <NavLink to={withLang("/contact")} className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}>
              Əlaqə
            </NavLink>
          </nav>

          <div className="neoRight">
            <div className="neoLangPill" aria-label="Sayt dili" data-wg-notranslate>
              <Globe2 size={16} strokeWidth={1.9} aria-hidden="true" />
              AZ
            </div>

            <NavLink to={withLang("/contact")} className="neoCta">
              Əlaqə saxla
              <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
            </NavLink>

            <button
              className="neoBurger"
              type="button"
              aria-label={mobileOpen ? "Menyunu bağla" : "Menyunu aç"}
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

        <div id={mobilePanelId} className={cx("neoMOv", mobileOpen && "is-open")} aria-hidden={!mobileOpen}>
          <button className="neoBg" type="button" aria-label="Menyunu bağla" onClick={closeMobile} />

          <div className={cx("neoSheet", mobileSoft && "is-open")} role="dialog" aria-modal="true" aria-label="Mobil menyu">
            <div className="neoMTop">
              <div className="neoMTitle">Naviqasiya</div>
              <button type="button" className="neoMClose" aria-label="Menyunu bağla" onClick={closeMobile}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="neoMTabs" role="tablist" aria-label="Mobil naviqasiya bölmələri">
              <button type="button" className={cx("neoTab", mobileTab === "main" && "is-on")} onClick={() => setMobileTab("main")}>
                Əsas
              </button>
              <button type="button" className={cx("neoTab", mobileTab === "services" && "is-on")} onClick={() => setMobileTab("services")}>
                Xidmətlər
              </button>
              <button type="button" className={cx("neoTab", mobileTab === "company" && "is-on")} onClick={() => setMobileTab("company")}>
                Şirkət
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

      <MegaPanel />
    </>
  );
}