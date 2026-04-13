import React from "react";
import { Link, useParams } from "react-router-dom";
import type { Lang } from "../../i18n/lang";

export default function AboutCompany() {
  const { lang } = useParams<{ lang: Lang }>();
  return (
    <main className="pageShell">
      <section className="pageHero">
        <h1>Company</h1>
        <p>NEOX haqqında şirkət məlumatları burada olacaq.</p>
        <div className="pageActions">
          <Link className="btn" to={`/${lang}/contact`}>Contact</Link>
          <Link className="btn btnGhost" to={`/${lang}/about`}>Back to About</Link>
        </div>
      </section>
    </main>
  );
}
