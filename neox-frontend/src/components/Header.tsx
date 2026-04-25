import {
  Bot,
  Building2,
  Check,
  ChevronDown,
  CircleHelp,
  Hotel,
  Landmark,
  Megaphone,
  Menu,
  MonitorSmartphone,
  Newspaper,
  Smartphone,
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

const LANGS: Lang[] = ["az", "tr", "ru", "en", "es"];
const LOGO_SRC = "/image/neox-logo.png";

const LANG_META: Record<Lang, { label: string; flag: string }> = {
  az: { label: "AZ", flag: "/image/azerbaijan.png" },
  tr: { label: "TR", flag: "/image/turkey.png" },
  ru: { label: "RU", flag: "/image/russia.png" },
  en: { label: "EN", flag: "/image/english.png" },
  es: { label: "ES", flag: "/image/spain.png" },
};

const AI_CHAT_PREVIEW_IMAGE =
  "https://res.cloudinary.com/dppoomunj/image/upload/v1777145861/ChatGPT_Image_Apr_25_2026_11_36_01_PM_s3x5yd.jpg";

function isLang(value: string | undefined | null): value is Lang {
  if (!value) return false;
  return (LANGS as readonly string[]).includes(String(value).toLowerCase());
}

type ItemDef = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  previewDescription?: string;
  previewImage?: string;
};

type MegaKind = "services" | "industries" | "resources";

export default function Header(_props: { introReady: boolean }) {
  const { lang: paramLang } = useParams<{ lang?: string }>();
  const lang: Lang = isLang(paramLang) ? paramLang : DEFAULT_LANG;

  const location = useLocation();

  const mobilePanelId = useId();
  const megaPanelId = useId();

  const shellRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [openMega, setOpenMega] = useState<MegaKind | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hoveredMegaItemId, setHoveredMegaItemId] = useState<string | null>(null);

  const withLang = useCallback(
    (to: string) => {
      if (to === "/") return `/${lang}`;
      return `/${lang}${to.startsWith("/") ? to : `/${to}`}`;
    },
    [lang],
  );

  const buildLangPath = useCallback(
    (nextLang: Lang) => {
      const segments = location.pathname.split("/").filter(Boolean);

      if (segments.length > 0 && isLang(segments[0])) {
        segments[0] = nextLang;
      } else {
        segments.unshift(nextLang);
      }

      return `/${segments.join("/")}${location.search}${location.hash}`;
    },
    [location.hash, location.pathname, location.search],
  );

  const closeMega = useCallback(() => setOpenMega(null), []);
  const closeLang = useCallback(() => setLangOpen(false), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const services: ItemDef[] = useMemo(
    () => [
      {
        id: "ai-chat",
        label: "Süni İntellekt çat sistemləri",
        to: "/services/chatbot-24-7",
        icon: Bot,
        previewDescription:
          "Müştəri mesajlarını avtomatik cavablandırır, sorğuları toplayır və lazım olduqda operatora yönləndirir.",
        previewImage: AI_CHAT_PREVIEW_IMAGE,
      },
      {
        id: "automation",
        label: "Biznes avtomatlaşdırması",
        to: "/services/business-workflows",
        icon: Workflow,
        previewDescription:
          "Təkrarlanan işləri sistemləşdirir, komanda yükünü azaldır və prosesləri daha sürətli edir.",
      },
      {
        id: "websites",
        label: "Premium veb saytlar",
        to: "/services/websites",
        icon: MonitorSmartphone,
        previewDescription:
          "Brendinizə uyğun sürətli, premium və etibar yaradan veb saytlar hazırlayırıq.",
      },
      {
        id: "mobile-apps",
        label: "Mobil tətbiqlər",
        to: "/services/mobile-apps",
        icon: Smartphone,
        previewDescription:
          "Biznesiniz üçün rahat istifadəli və peşəkar mobil tətbiq həlləri qururuq.",
      },
      {
        id: "social-systems",
        label: "Sosial media sistemləri",
        to: "/services/smm-automation",
        icon: Megaphone,
        previewDescription:
          "Mesaj, cavab və kontent axınlarını daha nizamlı idarə etmək üçün sistemlər qururuq.",
      },
      {
        id: "support",
        label: "Texniki dəstək",
        to: "/services/technical-support",
        icon: Wrench,
        previewDescription:
          "Sistemlərin stabil işləməsi və texniki problemlərin operativ həlli üçün dəstək veririk.",
      },
    ],
    [],
  );

  const industries: ItemDef[] = useMemo(
    () => [
      {
        id: "healthcare",
        label: "Klinikalar",
        to: "/use-cases/healthcare",
        icon: Stethoscope,
        previewDescription:
          "Pasiyent ünsiyyəti və daxili iş axınlarını daha sistemli idarə etmək üçün həllər.",
      },
      {
        id: "logistics",
        label: "Logistika",
        to: "/use-cases/logistics",
        icon: Truck,
        previewDescription:
          "Sifariş, koordinasiya və operativ ünsiyyət proseslərini sürətləndirən sistemlər.",
      },
      {
        id: "finance",
        label: "Maliyyə",
        to: "/use-cases/finance",
        icon: Landmark,
        previewDescription:
          "Müştəri sorğularını və məlumat axınını daha nizamlı və sürətli idarə etməyə kömək edir.",
      },
      {
        id: "retail",
        label: "Pərakəndə satış",
        to: "/use-cases/retail",
        icon: Store,
        previewDescription:
          "Satış və müştəri sorğularını vahid axında toplamaq üçün uyğun həllər təqdim edir.",
      },
      {
        id: "hotels",
        label: "Hotellər",
        to: "/use-cases/hotels",
        icon: Hotel,
        previewDescription:
          "Rezervasiya və qonaq əlaqələrini daha rahat və sürətli idarə etməyə imkan yaradır.",
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
        previewDescription:
          "Süni İntellekt, avtomatlaşdırma və biznes sistemləri barədə faydalı yazılar.",
      },
      {
        id: "faq",
        label: "Suallar",
        to: "/faq",
        icon: CircleHelp,
        previewDescription: "Ən çox verilən suallara qısa və aydın cavablar burada toplanıb.",
      },
    ],
    [],
  );

  const megaItems =
    openMega === "industries"
      ? industries
      : openMega === "resources"
        ? resources
        : services;

  const megaTitle =
    openMega === "industries"
      ? "Sahələr"
      : openMega === "resources"
        ? "Resurslar"
        : "Xidmətlər";

  const activePreviewItem =
    megaItems.find((item) => item.id === hoveredMegaItemId) ?? megaItems[0] ?? null;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    closeMega();
    closeLang();
    closeMobile();
  }, [location.pathname, location.search, location.hash, closeMega, closeLang, closeMobile]);

  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = mobileOpen ? "hidden" : "";

    return () => {
      root.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const node = event.target as Node;
      const insideShell = shellRef.current?.contains(node);

      if (!insideShell) {
        closeMega();
        closeLang();
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMega();
      closeLang();
      closeMobile();
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [closeLang, closeMega, closeMobile]);

  useEffect(() => {
    if (!openMega) {
      setHoveredMegaItemId(null);
      return;
    }

    if (openMega === "services") {
      setHoveredMegaItemId(services[0]?.id ?? null);
      return;
    }

    if (openMega === "industries") {
      setHoveredMegaItemId(industries[0]?.id ?? null);
      return;
    }

    if (openMega === "resources") {
      setHoveredMegaItemId(resources[0]?.id ?? null);
    }
  }, [openMega, services, industries, resources]);

  const openMenu = useCallback(
    (kind: MegaKind) => {
      closeLang();
      setOpenMega(kind);
    },
    [closeLang],
  );

  if (!mounted) return null;

  return createPortal(
    <>
      <style>{`
        :root {
          --nx-header-h: 56px;
          --nx-mega-h: 286px;

          --neo-bg: rgba(248, 249, 252, 0.955);
          --neo-panel-bg: rgba(248, 249, 252, 0.968);
          --neo-blur: blur(22px) saturate(1.02);
          --neo-text: #0f172a;
          --neo-muted: rgba(15, 23, 42, 0.58);
          --neo-accent: #26368f;
          --neo-accent-hover: #1f2f80;
          --neo-accent-bright: #4459df;
        }

        .neoShell,
        .neoShell *,
        .neoMOv,
        .neoMOv * {
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

        .neoShell a,
        .neoShell a:hover,
        .neoShell a:focus,
        .neoShell a:active,
        .neoMOv a,
        .neoMOv a:hover,
        .neoMOv a:focus,
        .neoMOv a:active {
          text-decoration: none !important;
        }

        .neoShell {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 2147483000;
          height: var(--nx-header-h);
          overflow: visible;
          background: var(--neo-bg);
          -webkit-backdrop-filter: var(--neo-blur);
          backdrop-filter: var(--neo-blur);
          color: var(--neo-text);
          border: 0 !important;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            0 6px 18px rgba(15, 23, 42, 0.018) !important;
          transition:
            height 160ms cubic-bezier(.2,.8,.2,1),
            background-color 160ms ease,
            box-shadow 160ms ease;
        }

        .neoShell.is-open {
          height: calc(var(--nx-header-h) + var(--nx-mega-h));
          background: var(--neo-panel-bg);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.66),
            0 14px 34px rgba(15, 23, 42, 0.035) !important;
        }

        .neoShell::before {
          display: none !important;
          content: none !important;
        }

        .neoShell::after {
          content: "";
          position: absolute;
          left: 30px;
          right: 30px;
          bottom: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            rgba(15, 23, 42, 0) 0%,
            rgba(15, 23, 42, 0.045) 14%,
            rgba(15, 23, 42, 0.045) 86%,
            rgba(15, 23, 42, 0) 100%
          );
          pointer-events: none;
        }

        .neoHdr {
          height: var(--nx-header-h);
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
        }

        .neoInner {
          height: 100%;
          width: 100%;
          max-width: 1460px;
          margin: 0 auto;
          padding: 0 clamp(18px, 4vw, 40px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          position: relative;
        }

        .neoBrand {
          min-width: 104px;
          display: inline-flex;
          align-items: center;
          flex: 0 0 auto;
        }

        .neoBrandMark {
          width: 96px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
        }

        .neoBrandLogo {
          width: 92px;
          height: 32px;
          object-fit: contain;
          object-position: left center;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }

        .neoNav {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 27px;
          white-space: nowrap;
        }

        .neoTop,
        .neoTopLink {
          height: 32px;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 0 !important;
          border-radius: 0 !important;
          color: var(--neo-muted);
          font-size: 14px;
          font-weight: 560;
          letter-spacing: -0.024em;
          line-height: 1;
          cursor: pointer;
          outline: none;
          appearance: none;
          -webkit-appearance: none;
          transition: color 150ms ease;
        }

        .neoTop:hover,
        .neoTopLink:hover {
          color: var(--neo-accent-bright);
        }

        .neoTop.is-open,
        .neoTop.is-active,
        .neoTopLink.is-active {
          color: var(--neo-text);
        }

        .neoChev {
          opacity: 0.48;
          transition:
            transform 160ms ease,
            opacity 160ms ease,
            color 160ms ease;
        }

        .neoTop:hover .neoChev,
        .neoTop.is-open .neoChev,
        .neoLangBtn:hover .neoChev,
        .neoLangBtn.is-open .neoChev {
          color: var(--neo-accent-bright);
          opacity: 0.86;
        }

        .neoTop.is-open .neoChev,
        .neoLangBtn.is-open .neoChev {
          transform: rotate(180deg);
        }

        .neoRight {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 14px;
          flex: 0 0 auto;
          position: relative;
        }

        .neoLangWrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .neoLangBtn {
          height: 32px;
          border: 0 !important;
          border-radius: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: rgba(15, 23, 42, 0.78);
          font-size: 13.5px;
          font-weight: 560;
          letter-spacing: -0.012em;
          cursor: pointer;
          transition: color 150ms ease;
        }

        .neoLangBtn:hover,
        .neoLangBtn.is-open {
          color: var(--neo-accent-bright);
        }

        .neoFlag {
          width: 24px;
          height: 16px;
          display: block;
          object-fit: cover;
          object-position: center;
          flex: 0 0 auto;
          border-radius: 2px;
        }

        .neoLangMenu {
          position: absolute;
          top: calc(100% + 11px);
          right: 0;
          width: 138px;
          padding: 8px 0;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.95);
          -webkit-backdrop-filter: blur(22px) saturate(1.04);
          backdrop-filter: blur(22px) saturate(1.04);
          box-shadow:
            0 16px 34px rgba(15, 23, 42, 0.1),
            inset 0 1px 0 rgba(255,255,255,0.8);
          opacity: 0;
          transform: translateY(-5px);
          animation: neoLangOpen 150ms cubic-bezier(.2,.8,.2,1) forwards;
        }

        @keyframes neoLangOpen {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .neoLangList {
          display: grid;
          gap: 0;
        }

        .neoLangItem {
          min-height: 37px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 0 12px;
          color: rgba(15, 23, 42, 0.58);
          font-size: 13px;
          font-weight: 540;
          letter-spacing: -0.012em;
          transition: color 140ms ease;
        }

        .neoLangItem:hover,
        .neoLangItem.is-active {
          color: var(--neo-accent-bright);
        }

        .neoLangItemLeft {
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .neoLangText {
          color: inherit;
        }

        .neoCta {
          height: 34px;
          min-height: 34px;
          min-width: 126px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          border: 0;
          border-radius: 11px;
          background: var(--neo-accent);
          color: #ffffff !important;
          font-size: 14px;
          font-weight: 600;
          line-height: 1;
          letter-spacing: -0.016em;
          box-shadow: none;
          transform: none;
          transition:
            background-color 170ms ease,
            transform 170ms ease;
        }

        .neoCta:hover {
          background: var(--neo-accent-hover);
          color: #ffffff !important;
          transform: translateY(-1px);
        }

        .neoCta:active {
          transform: translateY(0);
        }

        .neoBurger {
          width: 38px;
          height: 38px;
          display: none;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          border: 0;
          background: rgba(255, 255, 255, 0.68);
          color: var(--neo-text);
          cursor: pointer;
          box-shadow: none;
        }

        .neoMegaPanel {
          height: var(--nx-mega-h);
          background: transparent !important;
          border: 0 !important;
          box-shadow: none !important;
          overflow: hidden;
          opacity: 0;
          transform: translateY(-5px);
          animation: neoMegaOpen 150ms cubic-bezier(.2,.8,.2,1) forwards;
        }

        @keyframes neoMegaOpen {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .neoMegaInner {
          width: 100%;
          max-width: 1460px;
          margin: 0 auto;
          padding: 20px clamp(18px, 4vw, 40px) 18px;
        }

        .neoMegaTitle {
          margin: 0 0 16px;
          color: rgba(15, 23, 42, 0.42);
          font-size: 12px;
          font-weight: 640;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .neoMegaLayout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 372px;
          align-items: start;
          gap: 36px;
        }

        .neoMegaGrid {
          max-width: 760px;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(3, 40px);
          grid-auto-flow: column;
          gap: 18px 52px;
        }

        .neoMegaGrid.is-small {
          max-width: 520px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: none;
          grid-auto-flow: row;
        }

        .neoMegaItem {
          min-height: 36px;
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 0;
          color: rgba(15, 23, 42, 0.7);
          transform: translateX(0);
          transition:
            color 170ms ease,
            transform 170ms ease;
        }

        .neoMegaIcon {
          width: 22px;
          height: 22px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--neo-accent-bright);
          opacity: 0.82;
          transition:
            color 170ms ease,
            opacity 170ms ease,
            transform 170ms ease;
        }

        .neoMegaName {
          color: inherit;
          font-size: 15px;
          line-height: 1.18;
          font-weight: 530;
          letter-spacing: -0.028em;
          transition:
            color 170ms ease,
            font-weight 170ms ease;
        }

        .neoMegaItem:hover,
        .neoMegaItem.is-active {
          color: var(--neo-accent-bright);
          transform: translateX(4px);
        }

        .neoMegaItem:hover .neoMegaIcon,
        .neoMegaItem.is-active .neoMegaIcon {
          opacity: 1;
          transform: translateX(1px);
        }

        .neoMegaItem:hover .neoMegaName,
        .neoMegaItem.is-active .neoMegaName {
          font-weight: 580;
        }

        .neoMegaPreview {
          min-width: 0;
        }

        .neoMegaPreviewImage {
          width: 100%;
          height: 142px;
          display: block;
          object-fit: cover;
          object-position: center;
          border-radius: 18px;
          background: #eef2ff;
        }

        .neoMegaPreviewText {
          margin: 10px 0 0;
          color: rgba(15, 23, 42, 0.72);
          font-size: 13.5px;
          line-height: 1.46;
          font-weight: 510;
          letter-spacing: -0.014em;
          max-width: 372px;
        }

        .neoMegaPreviewPlaceholder {
          width: 100%;
          height: 142px;
          border-radius: 18px;
          background:
            linear-gradient(135deg, rgba(68, 89, 223, 0.12), rgba(15, 23, 42, 0.04)),
            #eef2ff;
        }

        .neoMOv {
          position: fixed;
          inset: 0;
          z-index: 2147483003;
          opacity: 0;
          pointer-events: none;
          transition: opacity 160ms ease;
        }

        .neoMOv.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .neoBg {
          position: absolute;
          inset: 0;
          border: 0;
          background: rgba(15, 23, 42, 0.18);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
        }

        .neoSheet {
          position: absolute;
          top: 12px;
          left: 12px;
          right: 12px;
          border-radius: 22px;
          background: rgba(248, 249, 252, 0.97);
          -webkit-backdrop-filter: blur(22px);
          backdrop-filter: blur(22px);
          box-shadow: 0 24px 56px rgba(15, 23, 42, 0.13);
          overflow: hidden;
        }

        .neoMTop {
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 18px;
        }

        .neoMTitle {
          font-size: 13px;
          font-weight: 620;
          letter-spacing: 0.12em;
          color: rgba(15, 23, 42, 0.46);
          text-transform: uppercase;
        }

        .neoMClose {
          width: 40px;
          height: 40px;
          border: 0;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.78);
          color: var(--neo-text);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .neoMBody {
          max-height: min(78vh, 720px);
          overflow: auto;
          padding: 10px 16px 18px;
          display: grid;
          gap: 18px;
        }

        .neoMGroup {
          display: grid;
          gap: 5px;
        }

        .neoMGroupTitle {
          padding: 0 8px;
          margin: 0 0 4px;
          color: rgba(15, 23, 42, 0.42);
          font-size: 12px;
          font-weight: 620;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .neoMItem {
          min-height: 46px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 8px;
          border-radius: 14px;
          color: rgba(15, 23, 42, 0.72);
          transition:
            color 160ms ease,
            background 160ms ease,
            transform 160ms ease;
        }

        .neoMItem:hover,
        .neoMItem.is-active {
          background: rgba(47, 73, 216, 0.07);
          color: var(--neo-accent-bright);
          transform: translateX(3px);
        }

        .neoMIcon {
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--neo-accent-bright);
          opacity: 0.74;
        }

        .neoMItem:hover .neoMIcon,
        .neoMItem.is-active .neoMIcon {
          opacity: 1;
        }

        .neoMText {
          font-size: 15px;
          font-weight: 540;
          letter-spacing: -0.026em;
        }

        .neoMFooter {
          padding: 0 16px 18px;
        }

        .neoMCta {
          min-height: 48px;
          width: 100%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 13px;
          background: var(--neo-accent);
          color: #fff !important;
          font-size: 15px;
          font-weight: 600;
          letter-spacing: -0.018em;
        }

        @media (max-width: 1180px) {
          .neoNav {
            gap: 20px;
          }

          .neoTop,
          .neoTopLink {
            font-size: 13.5px;
          }

          .neoMegaLayout {
            grid-template-columns: minmax(0, 1fr) 328px;
            gap: 24px;
          }

          .neoMegaPreviewImage,
          .neoMegaPreviewPlaceholder {
            height: 132px;
          }

          .neoMegaPreviewText {
            max-width: 328px;
            font-size: 13px;
            line-height: 1.42;
          }
        }

        @media (max-width: 980px) {
          :root {
            --nx-header-h: 60px;
          }

          .neoShell {
            height: var(--nx-header-h) !important;
          }

          .neoNav,
          .neoLangWrap,
          .neoCta,
          .neoMegaPanel {
            display: none !important;
          }

          .neoBurger {
            display: inline-flex;
          }

          .neoInner {
            padding: 0 16px;
          }

          .neoBrandMark {
            width: 94px;
          }

          .neoBrandLogo {
            width: 90px;
          }
        }

        @media (max-width: 640px) {
          .neoMegaGrid,
          .neoMegaGrid.is-small {
            grid-template-columns: 1fr;
            grid-template-rows: none;
            grid-auto-flow: row;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .neoShell,
          .neoMegaPanel,
          .neoLangMenu,
          .neoTop,
          .neoTopLink,
          .neoCta,
          .neoMegaItem,
          .neoMegaIcon,
          .neoMegaName,
          .neoLangBtn,
          .neoMItem {
            transition: none !important;
            animation: none !important;
          }

          .neoMegaPanel,
          .neoLangMenu {
            opacity: 1 !important;
            transform: none !important;
          }
        }
      `}</style>

      <div ref={shellRef} className={cx("neoShell", openMega && "is-open")}>
        <header className="neoHdr">
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
                onMouseEnter={() => openMenu("services")}
                onFocus={() => openMenu("services")}
                onClick={() => setOpenMega((current) => (current === "services" ? null : "services"))}
              >
                Xidmətlər
                <ChevronDown className="neoChev" size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>

              <button
                type="button"
                className={cx("neoTop", openMega === "industries" && "is-open is-active")}
                aria-haspopup="menu"
                aria-expanded={openMega === "industries"}
                aria-controls={megaPanelId}
                onMouseEnter={() => openMenu("industries")}
                onFocus={() => openMenu("industries")}
                onClick={() => setOpenMega((current) => (current === "industries" ? null : "industries"))}
              >
                Sahələr
                <ChevronDown className="neoChev" size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>

              <NavLink
                to={withLang("/about")}
                onMouseEnter={closeMega}
                className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}
              >
                Haqqımızda
              </NavLink>

              <button
                type="button"
                className={cx("neoTop", openMega === "resources" && "is-open is-active")}
                aria-haspopup="menu"
                aria-expanded={openMega === "resources"}
                aria-controls={megaPanelId}
                onMouseEnter={() => openMenu("resources")}
                onFocus={() => openMenu("resources")}
                onClick={() => setOpenMega((current) => (current === "resources" ? null : "resources"))}
              >
                Resurslar
                <ChevronDown className="neoChev" size={15} strokeWidth={1.8} aria-hidden="true" />
              </button>

              <NavLink
                to={withLang("/pricing")}
                onMouseEnter={closeMega}
                className={({ isActive }) => cx("neoTopLink", isActive && "is-active")}
              >
                Qiymətlər
              </NavLink>
            </nav>

            <div className="neoRight">
              <div className="neoLangWrap">
                <button
                  type="button"
                  className={cx("neoLangBtn", langOpen && "is-open")}
                  aria-haspopup="menu"
                  aria-expanded={langOpen}
                  aria-label="Dili dəyiş"
                  onClick={() => {
                    closeMega();
                    setLangOpen((current) => !current);
                  }}
                >
                  <img
                    className="neoFlag"
                    src={LANG_META[lang].flag}
                    alt=""
                    aria-hidden="true"
                    loading="eager"
                    decoding="async"
                    draggable={false}
                  />
                  <span>{LANG_META[lang].label}</span>
                  <ChevronDown className="neoChev" size={14} strokeWidth={1.8} aria-hidden="true" />
                </button>

                {langOpen ? (
                  <div className="neoLangMenu" role="menu" aria-label="Dil seçimi">
                    <div className="neoLangList">
                      {LANGS.map((item) => {
                        const active = item === lang;

                        return (
                          <Link
                            key={item}
                            to={buildLangPath(item)}
                            className={cx("neoLangItem", active && "is-active")}
                            onClick={closeLang}
                            role="menuitem"
                          >
                            <span className="neoLangItemLeft">
                              <img
                                className="neoFlag"
                                src={LANG_META[item].flag}
                                alt=""
                                aria-hidden="true"
                                loading="lazy"
                                decoding="async"
                                draggable={false}
                              />
                              <span className="neoLangText">{LANG_META[item].label}</span>
                            </span>

                            {active ? <Check size={15} strokeWidth={1.9} aria-hidden="true" /> : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <NavLink
                to={withLang("/contact")}
                onMouseEnter={() => {
                  closeMega();
                  closeLang();
                }}
                className="neoCta"
              >
                Əlaqə saxla
              </NavLink>

              <button
                className="neoBurger"
                type="button"
                aria-label={mobileOpen ? "Menyunu bağla" : "Menyunu aç"}
                aria-expanded={mobileOpen}
                aria-controls={mobilePanelId}
                onClick={() => {
                  closeMega();
                  closeLang();
                  setMobileOpen((current) => !current);
                }}
              >
                {mobileOpen ? <X size={19} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
              </button>
            </div>
          </div>
        </header>

        {openMega ? (
          <div id={megaPanelId} className="neoMegaPanel" role="menu" aria-label={megaTitle}>
            <div className="neoMegaInner">
              <div className="neoMegaTitle">{megaTitle}</div>

              <div className="neoMegaLayout">
                <div className={cx("neoMegaGrid", megaItems.length <= 2 && "is-small")}>
                  {megaItems.map((item) => {
                    const Icon = item.icon;
                    const previewActive = activePreviewItem?.id === item.id;

                    return (
                      <NavLink
                        key={item.id}
                        to={withLang(item.to)}
                        className={({ isActive }) =>
                          cx("neoMegaItem", (isActive || previewActive) && "is-active")
                        }
                        onClick={closeMega}
                        onMouseEnter={() => setHoveredMegaItemId(item.id)}
                        onFocus={() => setHoveredMegaItemId(item.id)}
                        role="menuitem"
                      >
                        <span className="neoMegaIcon" aria-hidden="true">
                          <Icon size={20} strokeWidth={1.8} />
                        </span>
                        <span className="neoMegaName">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>

                {activePreviewItem ? (
                  <aside className="neoMegaPreview" aria-live="polite">
                    {activePreviewItem.previewImage ? (
                      <img
                        className="neoMegaPreviewImage"
                        src={activePreviewItem.previewImage}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="neoMegaPreviewPlaceholder" />
                    )}

                    <p className="neoMegaPreviewText">
                      {activePreviewItem.previewDescription ??
                        "Bu bölmə haqqında qısa məlumat burada göstərilir."}
                    </p>
                  </aside>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div id={mobilePanelId} className={cx("neoMOv", mobileOpen && "is-open")} aria-hidden={!mobileOpen}>
        <button className="neoBg" type="button" aria-label="Menyunu bağla" onClick={closeMobile} />

        {mobileOpen ? (
          <div className="neoSheet" role="dialog" aria-modal="true" aria-label="Mobil menyu">
            <div className="neoMTop">
              <div className="neoMTitle">Menyu</div>

              <button type="button" className="neoMClose" aria-label="Menyunu bağla" onClick={closeMobile}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <div className="neoMBody">
              <div className="neoMGroup">
                <div className="neoMGroupTitle">Əsas</div>

                <NavLink
                  to={withLang("/")}
                  end
                  className={({ isActive }) => cx("neoMItem", isActive && "is-active")}
                  onClick={closeMobile}
                >
                  <span className="neoMIcon" aria-hidden="true">
                    <Building2 size={18} strokeWidth={1.8} />
                  </span>
                  <span className="neoMText">Ana səhifə</span>
                </NavLink>

                <NavLink
                  to={withLang("/about")}
                  className={({ isActive }) => cx("neoMItem", isActive && "is-active")}
                  onClick={closeMobile}
                >
                  <span className="neoMIcon" aria-hidden="true">
                    <Building2 size={18} strokeWidth={1.8} />
                  </span>
                  <span className="neoMText">Haqqımızda</span>
                </NavLink>

                <NavLink
                  to={withLang("/pricing")}
                  className={({ isActive }) => cx("neoMItem", isActive && "is-active")}
                  onClick={closeMobile}
                >
                  <span className="neoMIcon" aria-hidden="true">
                    <Building2 size={18} strokeWidth={1.8} />
                  </span>
                  <span className="neoMText">Qiymətlər</span>
                </NavLink>
              </div>

              <div className="neoMGroup">
                <div className="neoMGroupTitle">Xidmətlər</div>

                {services.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.id}
                      to={withLang(item.to)}
                      className={({ isActive }) => cx("neoMItem", isActive && "is-active")}
                      onClick={closeMobile}
                    >
                      <span className="neoMIcon" aria-hidden="true">
                        <Icon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="neoMText">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>

              <div className="neoMGroup">
                <div className="neoMGroupTitle">Sahələr</div>

                {industries.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.id}
                      to={withLang(item.to)}
                      className={({ isActive }) => cx("neoMItem", isActive && "is-active")}
                      onClick={closeMobile}
                    >
                      <span className="neoMIcon" aria-hidden="true">
                        <Icon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="neoMText">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>

              <div className="neoMGroup">
                <div className="neoMGroupTitle">Resurslar</div>

                {resources.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.id}
                      to={withLang(item.to)}
                      className={({ isActive }) => cx("neoMItem", isActive && "is-active")}
                      onClick={closeMobile}
                    >
                      <span className="neoMIcon" aria-hidden="true">
                        <Icon size={18} strokeWidth={1.8} />
                      </span>
                      <span className="neoMText">{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>

            <div className="neoMFooter">
              <NavLink to={withLang("/contact")} className="neoMCta" onClick={closeMobile}>
                Əlaqə saxla
              </NavLink>
            </div>
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  );
}