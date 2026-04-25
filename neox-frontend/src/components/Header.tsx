import {
  Bot,
  Building2,
  ChevronDown,
  CircleHelp,
  Globe2,
  Hotel,
  Landmark,
  Mail,
  Megaphone,
  Menu,
  MonitorSmartphone,
  Newspaper,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Truck,
  Wrench,
  Workflow,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";
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
  to: string;
  icon: LucideIcon;
};

type MegaKind = "services" | "company" | "resources";
type MobileTab = "main" | MegaKind;

export default function Header(_props: { introReady: boolean }) {
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
    [lang],
  );

  const closeMega = useCallback(() => setOpenMega(null), []);

  const closeMobile = useCallback(() => {
    setMobileSoft(false);
    window.setTimeout(() => setMobileOpen(false), 180);
  }, []);

  const services: ItemDef[] = useMemo(
    () => [
      {
        id: "ai-chat",
        label: "Süni İntellekt çat sistemləri",
        to: "/services/chatbot-24-7",
        icon: Bot,
      },
      {
        id: "automation",
        label: "Biznes avtomatlaşdırması",
        to: "/services/business-workflows",
        icon: Workflow,
      },
      {
        id: "websites",
        label: "Premium veb saytlar",
        to: "/services/websites",
        icon: MonitorSmartphone,
      },
      {
        id: "mobile-apps",
        label: "Mobil tətbiqlər",
        to: "/services/mobile-apps",
        icon: Smartphone,
      },
      {
        id: "social-systems",
        label: "Sosial media sistemləri",
        to: "/services/smm-automation",
        icon: Megaphone,
      },
      {
        id: "support",
        label: "Texniki dəstək",
        to: "/services/technical-support",
        icon: Wrench,
      },
    ],
    [],
  );

  const company: ItemDef[] = useMemo(
    () => [
      {
        id: "about",
        label: "Haqqımızda",
        to: "/about",
        icon: Building2,
      },
      {
        id: "healthcare",
        label: "Klinikalar",
        to: "/use-cases/healthcare",
        icon: Stethoscope,
      },
      {
        id: "logistics",
        label: "Logistika",
        to: "/use-cases/logistics",
        icon: Truck,
      },
      {
        id: "finance",
        label: "Maliyyə",
        to: "/use-cases/finance",
        icon: Landmark,
      },
      {
        id: "retail",
        label: "Pərakəndə satış",
        to: "/use-cases/retail",
        icon: Store,
      },
      {
        id: "hotels",
        label: "Hotellər",
        to: "/use-cases/hotels",
        icon: Hotel,
      },
      {
        id: "pricing",
        label: "Qiymətlər",
        to: "/pricing",
        icon: Sparkles,
      },
      {
        id: "contact",
        label: "Əlaqə",
        to: "/contact",
        icon: Mail,
      },
    ],
    [],
  );

  const resources: ItemDef[] = useMemo(
    () => [
      {
        id: "blog",
        label: "Bloq",
        to: "/blog",
        icon: Newspaper,
      },
      {
        id: "faq",
        label: "Suallar",
        to: "/faq",
        icon: CircleHelp,
      },
    ],
    [],
  );

  const megaItems =
    openMega === "company" ? company : openMega === "resources" ? resources : services;

  const megaTitle =
    openMega === "company" ? "Şirkət" : openMega === "resources" ? "Resurslar" : "Xidmətlər";

  const mobileItems: ItemDef[] =
    mobileTab === "services"
      ? services
      : mobileTab === "company"
        ? company
        : mobileTab === "resources"
          ? resources
          : [
              { id: "home", label: "Ana səhifə", to: "/", icon: Sparkles },
              { id: "services", label: "Xidmətlər", to: "/services", icon: Workflow },
              { id: "company", label: "Şirkət", to: "/about", icon: Building2 },
              { id: "resources", label: "Resurslar", to: "/blog", icon: Newspaper },
              { id: "contact", label: "Əlaqə", to: "/contact", icon: Mail },
            ];

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
      return undefined;
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

  const MobileItem = ({ item }: { item: ItemDef }) => {
    const Icon = item.icon;

    return (
      <NavLink
        to={withLang(item.to)}
        className={({ isActive }) => cx("neoMItem", isActive && "is-active")}
        onClick={closeMobile}
      >
        <span className="neoMIcon" aria-hidden="true">
          <Icon size={18} strokeWidth={1.9} />
        </span>

        <span className="neoMText">{item.label}</span>
      </NavLink>
    );
  };

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        :root {
          --nx-header-h: 64px;
          --nx-mega-h: 395px;

          --neo-surface-bg: rgba(246, 247, 251, 0.91);
          --neo-surface-blur: blur(30px) saturate(1.08);
          --neo-surface-shadow: 0 28px 70px rgba(15, 23, 42, 0.10);

          --neo-text: #0d1420;
          --neo-text-soft: rgba(13, 20, 32, 0.58);
          --neo-accent: #3347d9;
          --neo-accent-strong: #2739bb;
        }

        .neoHdr,
        .neoHdr *,
        .neoSurface,
        .neoMegaPortal,
        .neoMegaPortal * {
          box-sizing: border-box;
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
        .neoHdr a:active,
        .neoMegaPortal a,
        .neoMegaPortal a:hover,
        .neoMegaPortal a:focus,
        .neoMegaPortal a:active {
          text-decoration: none !important;
        }

        /*
          TƏK MATERIAL:
          Header və dropdown artıq ayrı-ayrı background daşımır.
          Bütün glass görünüşü yalnız bu surface verir.
        */
        .neoSurface {
          position: fixed;
          left: 0;
          right: 0;
          top: 0;
          height: var(--nx-header-h);
          z-index: 2147482998;
          pointer-events: none;
          background: var(--neo-surface-bg);
          -webkit-backdrop-filter: var(--neo-surface-blur);
          backdrop-filter: var(--neo-surface-blur);
          box-shadow: none;
          overflow: hidden;
          transition:
            height 0.22s cubic-bezier(.2,.8,.2,1),
            box-shadow 0.22s ease;
        }

        .neoSurface.is-open {
          height: calc(var(--nx-header-h) + var(--nx-mega-h));
          box-shadow: var(--neo-surface-shadow);
        }

        .neoSurface::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(900px 260px at 14% 0%, rgba(51, 71, 217, 0.045), transparent 72%),
            radial-gradient(860px 260px at 90% 5%, rgba(51, 71, 217, 0.028), transparent 72%);
          opacity: 0.82;
        }

        .neoSurface::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          pointer-events: none;
          background: rgba(13, 20, 32, 0.035);
          opacity: 0;
        }

        .neoHdr {
          position: fixed !important;
          inset: 0 0 auto 0 !important;
          z-index: 2147483000 !important;
          width: 100vw !important;
          height: var(--nx-header-h) !important;
          background: transparent !important;
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
          border: 0 !important;
          box-shadow: none !important;
          color: var(--neo-text);
          isolation: isolate;
        }

        .neoHdr::before,
        .neoHdr::after {
          display: none !important;
          content: none !important;
        }

        .neoInner {
          position: relative;
          z-index: 2;
          height: var(--nx-header-h);
          width: 100%;
          padding: 0 clamp(18px, 5vw, 80px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }

        .neoBrand {
          min-width: 116px;
          display: inline-flex;
          align-items: center;
          color: var(--neo-text);
        }

        .neoBrandMark {
          width: 106px;
          height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          transition:
            transform 0.18s cubic-bezier(.2,.8,.2,1),
            filter 0.18s ease;
        }

        .neoBrandLogo {
          width: 102px;
          height: 40px;
          object-fit: contain;
          object-position: left center;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }

        .neoBrand:hover .neoBrandMark {
          transform: translateY(-1px);
          filter: drop-shadow(0 10px 18px rgba(13, 20, 32, 0.06));
        }

        .neoNav {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 22px;
          white-space: nowrap;
        }

        .neoTop,
        .neoTopLink {
          height: 38px;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 !important;
          border-radius: 0 !important;
          color: var(--neo-text-soft);
          font-size: 14px;
          font-weight: 700;
          letter-spacing: -0.03em;
          line-height: 1;
          cursor: pointer;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          transition:
            color 0.16s ease,
            text-shadow 0.16s ease,
            transform 0.16s cubic-bezier(.2,.8,.2,1);
        }

        .neoTop:hover,
        .neoTopLink:hover,
        .neoTop.is-open,
        .neoTop.is-active,
        .neoTopLink.is-active {
          color: var(--neo-text);
          text-shadow: 0 0 18px rgba(51, 71, 217, 0.16);
        }

        .neoTop:active,
        .neoTopLink:active {
          transform: translateY(1px);
        }

        .neoChev {
          opacity: 0.56;
          transition:
            transform 0.18s cubic-bezier(.2,.8,.2,1),
            opacity 0.18s ease;
        }

        .neoTop.is-open .neoChev {
          transform: rotate(180deg);
          opacity: 0.9;
        }

        .neoRight {
          min-width: 236px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
        }

        .neoLangPill {
          height: 40px;
          min-width: 86px;
          border-radius: 16px;
          border: 0;
          background: rgba(255, 255, 255, 0.42);
          -webkit-backdrop-filter: blur(18px);
          backdrop-filter: blur(18px);
          color: rgba(13, 20, 32, 0.7);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 13px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.015em;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.62),
            0 8px 20px rgba(13,20,32,0.035);
          user-select: none;
        }

        .neoCta {
          height: 40px;
          min-width: 142px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 17px;
          border-radius: 16px;
          background: linear-gradient(135deg, var(--neo-accent) 0%, var(--neo-accent-strong) 100%);
          color: #fff !important;
          font-size: 14px;
          font-weight: 760;
          letter-spacing: -0.025em;
          box-shadow:
            0 16px 34px rgba(51, 71, 217, 0.22),
            inset 0 1px 0 rgba(255,255,255,0.22);
          transition:
            transform 0.16s cubic-bezier(.2,.8,.2,1),
            box-shadow 0.16s ease,
            filter 0.16s ease;
        }

        .neoCta:hover {
          transform: translateY(-1px);
          filter: saturate(1.05);
          box-shadow:
            0 20px 40px rgba(51, 71, 217, 0.28),
            inset 0 1px 0 rgba(255,255,255,0.24);
        }

        .neoBurger {
          width: 40px;
          height: 40px;
          display: none;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          border: 0;
          background: rgba(255, 255, 255, 0.42);
          color: #111827;
          cursor: pointer;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.58),
            0 8px 20px rgba(13,20,32,0.04);
        }

        .neoMegaPortal {
          position: fixed;
          top: var(--nx-header-h);
          left: 0;
          right: 0;
          height: var(--nx-mega-h);
          z-index: 2147482999;
          color: var(--neo-text);
          overflow: hidden;
          opacity: 0;
          transform: translate3d(0, -6px, 0);
          clip-path: inset(0 0 100% 0);
          background: transparent !important;
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
          border: 0 !important;
          box-shadow: none !important;
          animation: neoMegaOpen 0.2s cubic-bezier(.2,.8,.2,1) forwards;
          will-change: opacity, transform, clip-path;
        }

        .neoMegaPortal::before,
        .neoMegaPortal::after {
          display: none !important;
          content: none !important;
        }

        @keyframes neoMegaOpen {
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
            clip-path: inset(0 0 0 0);
          }
        }

        .neoMegaShell {
          position: relative;
          z-index: 1;
          width: min(100%, 1460px);
          height: 100%;
          margin: 0 auto;
          padding:
            52px
            clamp(18px, 5vw, 80px)
            52px;
          display: grid;
          grid-template-columns: minmax(520px, 690px) minmax(280px, 1fr);
          gap: clamp(46px, 7vw, 130px);
          align-items: start;
        }

        .neoMegaList {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 30px 58px;
          align-content: start;
        }

        .neoMegaItem {
          min-height: 34px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 0;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          color: rgba(13, 20, 32, 0.72);
          transition:
            color 0.16s ease,
            transform 0.16s cubic-bezier(.2,.8,.2,1),
            text-shadow 0.16s ease;
        }

        .neoMegaItem:hover,
        .neoMegaItem.is-active {
          color: var(--neo-text);
          transform: translateX(4px);
          text-shadow: 0 0 18px rgba(51, 71, 217, 0.16);
        }

        .neoMegaIcon {
          width: 24px;
          height: 24px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--neo-accent);
          opacity: 0.86;
        }

        .neoMegaName {
          min-width: 0;
          color: inherit;
          font-size: 16px;
          line-height: 1.12;
          font-weight: 740;
          letter-spacing: -0.045em;
        }

        .neoMegaEmpty {
          min-height: 210px;
          pointer-events: none;
        }

        .neoMOv {
          position: fixed;
          inset: 0;
          z-index: 2147483001;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.18s ease;
        }

        .neoMOv.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .neoBg {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(9, 14, 24, 0.22);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
        }

        .neoSheet {
          position: absolute;
          top: var(--nx-header-h);
          left: 12px;
          right: 12px;
          border-radius: 0 0 26px 26px;
          background: var(--neo-surface-bg);
          -webkit-backdrop-filter: var(--neo-surface-blur);
          backdrop-filter: var(--neo-surface-blur);
          color: var(--neo-text);
          box-shadow: 0 26px 64px rgba(7, 13, 28, 0.18);
          transform: translate3d(0, -14px, 0);
          opacity: 0;
          transition:
            transform 0.24s cubic-bezier(.2,.8,.2,1),
            opacity 0.2s ease;
          overflow: hidden;
        }

        .neoSheet.is-open {
          transform: translate3d(0, 0, 0);
          opacity: 1;
        }

        .neoMTop {
          height: 58px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          padding: 0 18px;
        }

        .neoMTitle {
          font-size: 12px;
          font-weight: 780;
          letter-spacing: 0.14em;
          color: rgba(13,20,32,0.56);
          text-transform: uppercase;
        }

        .neoMClose {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          border: 0;
          background: rgba(255,255,255,0.52);
          color: #111827;
          cursor: pointer;
        }

        .neoMTabs {
          display: grid;
          grid-template-columns: repeat(4,1fr);
          gap: 8px;
          padding: 8px 18px 14px;
        }

        .neoTab {
          min-height: 40px;
          border: 0;
          border-radius: 14px;
          background: rgba(13,20,32,0.045);
          color: rgba(13,20,32,0.62);
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }

        .neoTab.is-on {
          background: #0d1420;
          color: #fff;
        }

        .neoMBody {
          display: grid;
          gap: 6px;
          max-height: min(62vh, 560px);
          overflow: auto;
          padding: 4px 18px 20px;
          -webkit-overflow-scrolling: touch;
        }

        .neoMItem {
          min-height: 54px;
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 10px 8px;
          color: rgba(13,20,32,0.78);
          border-radius: 16px;
        }

        .neoMItem:hover,
        .neoMItem.is-active {
          background: rgba(255,255,255,0.50);
          color: var(--neo-text);
        }

        .neoMIcon {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--neo-accent);
        }

        .neoMText {
          font-size: 16px;
          line-height: 1.15;
          font-weight: 730;
          letter-spacing: -0.04em;
        }

        @media (max-width: 1180px) {
          .neoNav {
            gap: 16px;
          }

          .neoTop,
          .neoTopLink {
            font-size: 13px;
          }

          .neoRight {
            min-width: 206px;
          }

          .neoCta {
            min-width: 128px;
          }

          .neoBrand {
            min-width: 100px;
          }

          .neoBrandMark {
            width: 98px;
          }

          .neoBrandLogo {
            width: 94px;
          }

          .neoMegaShell {
            grid-template-columns: minmax(480px, 620px) minmax(160px, 1fr);
          }
        }

        @media (max-width: 1040px) {
          .neoMegaShell {
            grid-template-columns: 1fr;
          }

          .neoMegaEmpty {
            display: none;
          }
        }

        @media (max-width: 980px) {
          .neoInner {
            padding: 0 16px;
          }

          .neoNav,
          .neoCta,
          .neoLangPill,
          .neoMegaPortal {
            display: none;
          }

          .neoRight {
            min-width: auto;
          }

          .neoBurger {
            display: inline-flex;
          }

          .neoBrandMark {
            width: 94px;
            height: 40px;
          }

          .neoBrandLogo {
            width: 90px;
            height: 38px;
          }
        }

        @media (max-width: 560px) {
          :root {
            --nx-header-h: 62px;
          }

          .neoBrandMark {
            width: 84px;
            height: 36px;
          }

          .neoBrandLogo {
            width: 80px;
            height: 34px;
          }

          .neoMTabs {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .neoSurface,
          .neoMegaPortal {
            transition: none !important;
            animation: none !important;
          }

          .neoMegaPortal {
            opacity: 1;
            transform: none;
            clip-path: inset(0 0 0 0);
          }

          .neoSheet,
          .neoBrandMark,
          .neoTop,
          .neoTopLink,
          .neoCta,
          .neoMegaItem {
            transition: none !important;
          }
        }
      `}</style>

      <div className={cx("neoSurface", openMega && "is-open")} aria-hidden="true" />

      <header ref={headerRef} className="neoHdr">
        <div className="neoInner">
          <Link to={`/${lang}`} className="neoBrand" aria-label="NEOX" data-wg-notranslate>
            <span className="neoBrandMark" aria-hidden="true">
              <img
                className="neoBrandLogo"
                src={LOGO_SRC}
                alt=""
                loading="eager"
                decoding="async"
                draggable={false}
              />
            </span>
          </Link>

          <nav className="neoNav" aria-label="Əsas naviqasiya">
            <NavLink
              to={withLang("/")}
              end
              onMouseEnter={closeMega}
              className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}
            >
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

            <button
              type="button"
              className={cx("neoTop", openMega === "resources" && "is-open is-active")}
              aria-haspopup="menu"
              aria-expanded={openMega === "resources"}
              aria-controls={megaPanelId}
              onMouseEnter={() => setOpenMega("resources")}
              onFocus={() => setOpenMega("resources")}
              onClick={() => setOpenMega((current) => (current === "resources" ? null : "resources"))}
            >
              Resurslar
              <ChevronDown className="neoChev" size={15} strokeWidth={2} aria-hidden="true" />
            </button>

            <NavLink
              to={withLang("/contact")}
              onMouseEnter={closeMega}
              className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}
            >
              Əlaqə
            </NavLink>
          </nav>

          <div className="neoRight">
            <div className="neoLangPill" aria-label="Sayt dili" data-wg-notranslate>
              <Globe2 size={16} strokeWidth={1.9} aria-hidden="true" />
              {String(lang).toUpperCase()}
            </div>

            <NavLink to={withLang("/contact")} className="neoCta">
              Əlaqə saxla
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
              <div className="neoMTitle">Menyu</div>
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

              <button type="button" className={cx("neoTab", mobileTab === "resources" && "is-on")} onClick={() => setMobileTab("resources")}>
                Resurslar
              </button>
            </div>

            <div className="neoMBody">
              {mobileItems.map((item) => (
                <MobileItem key={item.id} item={item} />
              ))}
            </div>
          </div>
        </div>
      </header>

      {openMega ? (
        <div ref={megaRef} id={megaPanelId} className="neoMegaPortal" role="menu" aria-label={megaTitle}>
          <div className="neoMegaShell">
            <div className="neoMegaList">
              {megaItems.map((item) => {
                const Icon = item.icon;

                return (
                  <NavLink
                    key={item.id}
                    to={withLang(item.to)}
                    className={({ isActive }) => cx("neoMegaItem", isActive && "is-active")}
                    onClick={closeMega}
                    role="menuitem"
                  >
                    <span className="neoMegaIcon" aria-hidden="true">
                      <Icon size={20} strokeWidth={1.85} />
                    </span>

                    <span className="neoMegaName">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>

            <div className="neoMegaEmpty" aria-hidden="true" />
          </div>
        </div>
      ) : null}
    </>,
    document.body,
  );
}