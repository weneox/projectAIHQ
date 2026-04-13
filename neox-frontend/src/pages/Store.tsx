import React from "react";
import { Link, useParams } from "react-router-dom";
import type { Lang } from "../i18n/lang";

export default function Store() {
  const { lang } = useParams<{ lang: Lang }>();
  return (
    <main className="pageShell">
      <section className="pageHero">
        <h1>NEOX Store</h1>
        <p>Packages, add-ons, and solutions — coming soon.</p>
        <div className="pageActions">
          <Link className="btn" to={`/${lang}/pricing`}>Pricing</Link>
          <Link className="btn btnGhost" to={`/${lang}/contact`}>Get a Quote</Link>
        </div>
      </section>
    </main>
  );
}
