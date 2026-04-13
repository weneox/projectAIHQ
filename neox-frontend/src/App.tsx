// src/App.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Layout from "./components/Layout";
import IntroScreen from "./components/IntroScreen";
import MatrixLoader from "./components/MatrixLoader";
import SmoothWheelScroll from "./components/SmoothWheelScroll";

// pages
import Home from "./pages/Home";
import About from "./pages/About";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

// ✅ Use Cases split pages
import UseCasesIndex from "./pages/usecases/UseCasesIndex";
import UseCaseHealthcare from "./pages/usecases/UseCaseHealthcare";
import UseCaseLogistics from "./pages/usecases/UseCaseLogistics";
import UseCaseFinance from "./pages/usecases/UseCaseFinance";
import UseCaseRetail from "./pages/usecases/UseCaseRetail";
import UseCaseHotel from "./pages/usecases/UseCaseHotel";

// ✅ Services (6 pages)
import ServiceChatbot247 from "./pages/services/ServiceChatbot247";
import ServiceBusinessWorkflows from "./pages/services/ServiceBusinessWorkflows";
import ServiceWebsites from "./pages/services/ServiceWebsites";
import ServiceMobileApps from "./pages/services/ServiceMobileApps";
import ServiceSmmAutomation from "./pages/services/ServiceSmmAutomation";
// ⚠️ Səndə fayl adı ServiceTechSupport.tsx olduğu üçün bu import belədir:
import ServiceTechnicalSupport from "./pages/services/ServiceTechSupport";

// ✅ Resources pages
import ResourcesDocs from "./pages/resources/ResourcesDocs";
import ResourcesGuides from "./pages/resources/ResourcesGuides";
import ResourcesFaq from "./pages/resources/ResourcesFaq";

// ✅ ADMIN
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminLeads from "./pages/Admin/AdminLeads";
import AdminChats from "./pages/Admin/AdminChats";
import AdminMagic from "./pages/Admin/AdminMagic";

// ✅ skeleton admin pages
import AdminBlog from "./pages/Admin/AdminBlog";
import AdminProducts from "./pages/Admin/AdminProducts";
import AdminMedia from "./pages/Admin/AdminMedia";

// i18n
import { LANGS, DEFAULT_LANG, type Lang } from "./i18n/lang";

type Boot = "intro" | "loader" | "app";
const AUTO_FALLBACK_LANG: Lang = "en";
const BOOT_SEEN_KEY = "neox_boot_seen_v1";

/* ---------------- helpers ---------------- */
function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as readonly string[]).includes(x);
}

function getLangFromPath(pathname: string): Lang | null {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return isLang(seg) ? seg : null;
}

function getLangFromBrowser(): Lang {
  const list = (navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language]
  ).map((x) => (x || "").toLowerCase().split("-")[0]);

  for (const base of list) {
    if (isLang(base)) return base as Lang;
  }
  return AUTO_FALLBACK_LANG;
}

function getAutoLang(): Lang {
  try {
    const saved = localStorage.getItem("lang");
    if (isLang(saved)) return saved;
  } catch {}
  return getLangFromBrowser();
}

function hasSeenBoot(): boolean {
  try {
    return localStorage.getItem(BOOT_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markBootSeen() {
  try {
    localStorage.setItem(BOOT_SEEN_KEY, "1");
  } catch {}
}

/* ---------------- route gates ---------------- */
function LangGate() {
  const { i18n } = useTranslation();
  const { lang } = useParams<{ lang?: string }>();
  const location = useLocation();

  const safeLang: Lang = isLang(lang) ? (lang as Lang) : DEFAULT_LANG;

  useEffect(() => {
    if (i18n.language !== safeLang) i18n.changeLanguage(safeLang);
    try {
      localStorage.setItem("lang", safeLang);
    } catch {}
    document.documentElement.lang = safeLang;
  }, [safeLang, i18n]);

  if (!lang || lang !== safeLang) {
    const rest = location.pathname.replace(/^\/[^/]+/, "");
    const next = `/${safeLang}${rest || ""}${location.search}${location.hash}`;
    return <Navigate to={next} replace />;
  }

  return <Outlet />;
}

function WithLayout() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function AdminOnlyGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AdminMagicRedirect({ toLang }: { toLang: Lang }) {
  const loc = useLocation();
  const next = `/${toLang}/admin/magic${loc.search}${loc.hash}`;
  return <Navigate to={next} replace />;
}

export default function App() {
  const { i18n } = useTranslation();
  const location = useLocation();

  const [boot, setBoot] = useState<Boot>(() => (hasSeenBoot() ? "app" : "intro"));

  const introOnce = useRef(false);
  const loaderOnce = useRef(false);

  useEffect(() => {
    const urlLang = getLangFromPath(location.pathname);
    if (urlLang && i18n.language !== urlLang) i18n.changeLanguage(urlLang);
    if (urlLang) document.documentElement.lang = urlLang;
  }, [location.pathname, i18n]);

  const handleIntroDone = useCallback(() => {
    if (introOnce.current) return;
    introOnce.current = true;
    setBoot("loader");
  }, []);

  const handleLoaderDone = useCallback(() => {
    if (loaderOnce.current) return;
    loaderOnce.current = true;
    markBootSeen();
    setBoot("app");
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = boot === "app" ? prev || "" : "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, [boot]);

  const rootLang = useMemo(() => getAutoLang(), []);

  return (
    <>
      {boot === "intro" && <IntroScreen onDone={handleIntroDone} />}
      {boot === "loader" && <MatrixLoader onDone={handleLoaderDone} />}

      {boot === "app" && (
        <>
          <SmoothWheelScroll enabled={true} minWidth={980} />

          <AdminOnlyGate>
            <Routes>
              {/* root redirect */}
              <Route path="/" element={<Navigate to={`/${rootLang}`} replace />} />

              {/* magic link legacy redirect */}
              <Route path="/admin/magic" element={<AdminMagicRedirect toLang={rootLang} />} />
              <Route path="/admin" element={<Navigate to={`/${rootLang}/admin`} replace />} />
              <Route path="/admin/*" element={<Navigate to={`/${rootLang}/admin`} replace />} />

              {/* lang-scoped app */}
              <Route path="/:lang" element={<LangGate />}>
                {/* admin magic consumer */}
                <Route path="admin/magic" element={<AdminMagic />} />

                {/* admin area */}
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="leads" replace />} />
                  <Route path="leads" element={<AdminLeads />} />
                  <Route path="chats" element={<AdminChats />} />
                  <Route path="chats/:id" element={<AdminChats />} />
                  <Route path="blog" element={<AdminBlog />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="media" element={<AdminMedia />} />
                </Route>

                {/* public pages with layout */}
                <Route element={<WithLayout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />

                  {/* Services */}
                  <Route path="services" element={<Navigate to="services/chatbot-24-7" replace />} />
                  <Route path="services/chatbot-24-7" element={<ServiceChatbot247 />} />
                  <Route path="services/business-workflows" element={<ServiceBusinessWorkflows />} />
                  <Route path="services/websites" element={<ServiceWebsites />} />
                  <Route path="services/mobile-apps" element={<ServiceMobileApps />} />
                  <Route path="services/smm-automation" element={<ServiceSmmAutomation />} />
                  <Route path="services/technical-support" element={<ServiceTechnicalSupport />} />

                  {/* Use Cases */}
                  <Route path="use-cases" element={<UseCasesIndex />} />
                  <Route path="use-cases/healthcare" element={<UseCaseHealthcare />} />
                  <Route path="use-cases/logistics" element={<UseCaseLogistics />} />
                  <Route path="use-cases/finance" element={<UseCaseFinance />} />
                  <Route path="use-cases/retail" element={<UseCaseRetail />} />
                  <Route path="use-cases/hotels" element={<UseCaseHotel />} />

                  {/* Resources */}
                  <Route path="resources/docs" element={<ResourcesDocs />} />
                  <Route path="resources/guides" element={<ResourcesGuides />} />

                  {/* FAQ */}
                  <Route path="faq" element={<ResourcesFaq />} />
                  <Route path="resources/faq" element={<ResourcesFaq />} />

                  <Route path="pricing" element={<Pricing />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="privacy" element={<Privacy />} />
                  <Route path="terms" element={<Terms />} />

                  <Route path="blog" element={<Blog />} />
                  <Route path="blog/:slug" element={<BlogPost />} />
                </Route>
              </Route>

              {/* fallback */}
              <Route path="*" element={<Navigate to={`/${DEFAULT_LANG}`} replace />} />
            </Routes>
          </AdminOnlyGate>
        </>
      )}
    </>
  );
}
