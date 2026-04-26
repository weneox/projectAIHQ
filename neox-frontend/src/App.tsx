// src/App.tsx
import React, { useEffect, useMemo } from "react";
import { Routes, Route, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";

import Layout from "./components/Layout";

import Home from "./pages/Home";
import About from "./pages/About";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Blog from "./pages/Blog";
import BlogPost from "./pages/BlogPost";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";

import CardLab from "./pages/design-lab/CardLab";

import UseCaseHealthcare from "./pages/usecases/UseCaseHealthcare";
import UseCaseLogistics from "./pages/usecases/UseCaseLogistics";
import UseCaseFinance from "./pages/usecases/UseCaseFinance";
import UseCaseRetail from "./pages/usecases/UseCaseRetail";
import UseCaseHotel from "./pages/usecases/UseCaseHotel";

import ServiceChatbot247 from "./pages/services/ServiceChatbot247";
import ServiceBusinessWorkflows from "./pages/services/ServiceBusinessWorkflows";
import ServiceWebsites from "./pages/services/ServiceWebsites";
import ServiceMobileApps from "./pages/services/ServiceMobileApps";
import ServiceSmmAutomation from "./pages/services/ServiceSmmAutomation";
import ServiceTechnicalSupport from "./pages/services/ServiceTechSupport";

import ResourcesFaq from "./pages/resources/ResourcesFaq";

import AdminLayout from "./pages/Admin/AdminLayout";
import AdminLeads from "./pages/Admin/AdminLeads";
import AdminChats from "./pages/Admin/AdminChats";
import AdminMagic from "./pages/Admin/AdminMagic";
import AdminBlog from "./pages/Admin/AdminBlog";
import AdminMedia from "./pages/Admin/AdminMedia";

import { LANGS, DEFAULT_LANG, type Lang } from "./i18n/lang";

const AUTO_FALLBACK_LANG: Lang = "en";

function isLang(x: unknown): x is Lang {
  return typeof x === "string" && (LANGS as readonly string[]).includes(x);
}

function getLangFromPath(pathname: string): Lang | null {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return isLang(seg) ? seg : null;
}

function getLangFromBrowser(): Lang {
  const list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]).map((x) =>
    (x || "").toLowerCase().split("-")[0]
  );

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

function AdminMagicRedirect({ toLang }: { toLang: Lang }) {
  const loc = useLocation();
  return <Navigate to={`/${toLang}/admin/magic${loc.search}${loc.hash}`} replace />;
}

function UseCasesRedirect() {
  const { lang } = useParams<{ lang?: string }>();
  const safeLang: Lang = isLang(lang) ? lang : DEFAULT_LANG;
  return <Navigate to={`/${safeLang}/use-cases/healthcare`} replace />;
}

export default function App() {
  const { i18n } = useTranslation();
  const location = useLocation();

  useEffect(() => {
    const urlLang = getLangFromPath(location.pathname);
    if (urlLang && i18n.language !== urlLang) i18n.changeLanguage(urlLang);
    if (urlLang) document.documentElement.lang = urlLang;
  }, [location.pathname, i18n]);

  const rootLang = useMemo(() => getAutoLang(), []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${rootLang}`} replace />} />

      <Route path="/admin/magic" element={<AdminMagicRedirect toLang={rootLang} />} />
      <Route path="/admin" element={<Navigate to={`/${rootLang}/admin`} replace />} />
      <Route path="/admin/*" element={<Navigate to={`/${rootLang}/admin`} replace />} />

      <Route path="/:lang" element={<LangGate />}>
        <Route path="admin/magic" element={<AdminMagic />} />

        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="leads" replace />} />
          <Route path="leads" element={<AdminLeads />} />
          <Route path="chats" element={<AdminChats />} />
          <Route path="chats/:id" element={<AdminChats />} />
          <Route path="blog" element={<AdminBlog />} />
          <Route path="media" element={<AdminMedia />} />
        </Route>

        <Route element={<WithLayout />}>
          <Route index element={<Home />} />
          <Route path="about" element={<About />} />

          <Route path="design-lab/cards" element={<CardLab />} />

          <Route path="services" element={<Navigate to="chatbot-24-7" replace />} />
          <Route path="services/chatbot-24-7" element={<ServiceChatbot247 />} />
          <Route path="services/business-workflows" element={<ServiceBusinessWorkflows />} />
          <Route path="services/websites" element={<ServiceWebsites />} />
          <Route path="services/mobile-apps" element={<ServiceMobileApps />} />
          <Route path="services/smm-automation" element={<ServiceSmmAutomation />} />
          <Route path="services/technical-support" element={<ServiceTechnicalSupport />} />

          <Route path="use-cases" element={<UseCasesRedirect />} />
          <Route path="use-cases/healthcare" element={<UseCaseHealthcare />} />
          <Route path="use-cases/logistics" element={<UseCaseLogistics />} />
          <Route path="use-cases/finance" element={<UseCaseFinance />} />
          <Route path="use-cases/retail" element={<UseCaseRetail />} />
          <Route path="use-cases/hotels" element={<UseCaseHotel />} />

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

      <Route path="*" element={<Navigate to={`/${DEFAULT_LANG}`} replace />} />
    </Routes>
  );
}