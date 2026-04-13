import React from "react";
import { Helmet } from "@vuer-ai/react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

const SUPPORTED_LANGS = ["az", "tr", "en", "ru", "es"] as const;
type Lang = (typeof SUPPORTED_LANGS)[number];

function getLangFromPath(pathname: string): Lang {
  const seg = (pathname.split("/")[1] || "").toLowerCase();
  return (SUPPORTED_LANGS as readonly string[]).includes(seg) ? (seg as Lang) : "en";
}

function withLang(path: string, lang: Lang) {
  if (!path.startsWith("/")) return `/${lang}/${path}`;
  return `/${lang}${path}`;
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-white/[0.03] px-5 py-5 backdrop-blur-sm">
      <h2 className="text-[18px] font-semibold tracking-[-0.03em] text-white">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[14px] leading-7 text-white/70">
        {children}
      </div>
    </section>
  );
}

export default function Privacy() {
  const { pathname } = useLocation();
  const lang = getLangFromPath(pathname);

  return (
    <div className="min-h-screen bg-black text-white">
      <Helmet>
        <title>Privacy Notice — Weneox</title>
        <meta
          name="description"
          content="Read how Weneox collects, uses, stores, and protects information across its public site and product surfaces."
        />
      </Helmet>

      <div className="mx-auto max-w-[980px] px-5 py-12 md:px-6 md:py-16">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            to={withLang("/", lang)}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.07] hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1.5 text-[12px] font-medium text-cyan-200">
            <ShieldCheck className="h-4 w-4" />
            Privacy
          </div>
        </div>

        <div className="max-w-[760px]">
          <h1 className="text-[2.3rem] font-semibold leading-[0.96] tracking-[-0.06em] md:text-[2.9rem]">
            Privacy notice
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-white/65">
            This page explains what information we collect, why we use it, and
            how to contact us about privacy-related questions.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <Section title="What we collect">
            <p>
              We may collect account details, contact details, company and
              workspace information, connected channel metadata, conversations,
              setup inputs, analytics signals, and operator activity needed to
              run the service.
            </p>
            <p>
              This may include names, email addresses, phone numbers, company
              information, message content, and product configuration data.
            </p>
          </Section>

          <Section title="Why we use it">
            <p>
              We use information to authenticate users, operate workspace
              features, support AI-assisted workflows, route communications,
              improve reliability, investigate failures, and provide support.
            </p>
          </Section>

          <Section title="Retention">
            <p>
              We keep data for as long as needed to provide the service,
              maintain operational records, support security and reliability,
              and meet legal or contractual obligations.
            </p>
          </Section>

          <Section title="Sharing and processors">
            <p>
              We may rely on hosting, infrastructure, communications, and other
              service providers to operate the product. Access is limited to
              what is reasonably necessary to provide the service.
            </p>
          </Section>

          <Section title="Your requests">
            <p>
              You can contact us about privacy questions, access requests,
              correction requests, or deletion-related inquiries.
            </p>
            <p className="inline-flex items-center gap-2 text-white">
              <Mail className="h-4 w-4" />
              info@weneox.com
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
