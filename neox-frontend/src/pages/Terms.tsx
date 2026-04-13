import React from "react";
import { Helmet } from "@vuer-ai/react-helmet-async";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, FileText } from "lucide-react";

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

export default function Terms() {
  const { pathname } = useLocation();
  const lang = getLangFromPath(pathname);

  return (
    <div className="min-h-screen bg-black text-white">
      <Helmet>
        <title>Terms of Use — Weneox</title>
        <meta
          name="description"
          content="Read the core terms that govern access to and use of Weneox public and product surfaces."
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

          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-white/75">
            <FileText className="h-4 w-4" />
            Terms
          </div>
        </div>

        <div className="max-w-[760px]">
          <h1 className="text-[2.3rem] font-semibold leading-[0.96] tracking-[-0.06em] md:text-[2.9rem]">
            Terms of use
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-white/65">
            These terms describe the basic rules for using Weneox public pages,
            product surfaces, and workspace access.
          </p>
        </div>

        <div className="mt-8 grid gap-4">
          <Section title="Use of the service">
            <p>
              You may use the service only for lawful business purposes and only
              for workspaces, channels, and data you are authorized to access.
            </p>
          </Section>

          <Section title="Accounts and access">
            <p>
              You are responsible for protecting account credentials, managing
              who has access to your workspace, and reporting unauthorized use.
            </p>
          </Section>

          <Section title="Customer content">
            <p>
              You remain responsible for the content, instructions, data, and
              connected sources you provide to the platform.
            </p>
          </Section>

          <Section title="Availability and change">
            <p>
              Product behavior, channel availability, and workspace features may
              change as the platform evolves. Availability can vary by setup,
              runtime posture, and connected provider state.
            </p>
          </Section>

          <Section title="AI-assisted behavior">
            <p>
              Some features may assist with drafting, routing, or automation
              decisions. Human review and operator oversight may still be
              required depending on the product surface and workspace state.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For legal, support, or commercial questions, contact info@weneox.com.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
