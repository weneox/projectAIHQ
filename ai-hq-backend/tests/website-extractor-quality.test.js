import test from "node:test";
import assert from "node:assert/strict";

import { analyzePage } from "../src/services/sourceSync/websiteExtractor/pageModel.js";
import { buildSiteRollup } from "../src/services/sourceSync/websiteExtractor/rollup.js";

const HOME_HTML = `
<html>
  <head>
    <title>Luna Smile Studio | Cosmetic Dentistry in Baku</title>
    <meta
      name="description"
      content="Luna Smile Studio is a Baku dental clinic providing cosmetic dentistry, implants, whitening, and family care with transparent consultation-first treatment planning."
    />
    <meta property="og:site_name" content="Luna Smile Studio" />
  </head>
  <body>
    <nav>Home About Services Pricing Blog Contact</nav>
    <main>
      <h1>Luna Smile Studio</h1>
      <p>
        Luna Smile Studio is a Baku dental clinic focused on cosmetic dentistry,
        implants, whitening, and family dental care.
      </p>
      <p>
        We help patients restore confidence with consultation-led treatment plans,
        modern diagnostics, and clear next-step guidance.
      </p>
      <ul>
        <li>Smile design</li>
        <li>Dental implants</li>
        <li>Teeth whitening</li>
        <li>Home</li>
      </ul>
      <p>Updated 2024-05-01 14:30</p>
      <p>Phone: +994 50 555 12 12</p>
      <p>Email: hello@lunasmile.az</p>
      <p>Address: 14 Nizami Street, Baku, Azerbaijan</p>
      <a href="https://instagram.com/lunasmile.az?utm_source=site">Instagram</a>
      <a href="https://www.facebook.com/lunasmileclinic">Facebook</a>
      <a href="/pricing">Pricing</a>
      <a href="/contact">Contact us</a>
    </main>
  </body>
</html>
`;

const PRICING_HTML = `
<html>
  <head><title>Pricing | Luna Smile Studio</title></head>
  <body>
    <h1>Pricing & Packages</h1>
    <p>Consultation from 30 AZN. Whitening packages from 180 AZN.</p>
    <p>Request a custom quote for implant treatment plans.</p>
    <p>Updated 2024-05-01</p>
  </body>
</html>
`;

const CONTACT_HTML = `
<html>
  <head><title>Contact | Luna Smile Studio</title></head>
  <body>
    <h1>Contact Luna Smile Studio</h1>
    <p>Call our clinic team for appointments and treatment questions.</p>
    <p>Phone: +994 12 444 11 22</p>
    <p>Email: appointments@lunasmile.az</p>
    <p>14 Nizami Street, Baku, Azerbaijan</p>
    <p>Mon-Fri 09:00-18:00</p>
  </body>
</html>
`;

test("analyzePage extracts clean website business signals without timestamp phone false positives", () => {
  const page = analyzePage({
    html: HOME_HTML,
    pageUrl: "https://lunasmile.az/",
  });

  assert.equal(page.title, "Luna Smile Studio");
  assert.ok(page.phones.includes("+994505551212"));
  assert.equal(page.phones.some((item) => item.includes("20240501")), false);
  assert.ok(page.emails.includes("hello@lunasmile.az"));
  assert.ok(page.addresses.some((item) => /nizami street/i.test(item)));
  assert.ok(page.serviceHints.includes("Smile design"));
  assert.ok(page.serviceHints.includes("Dental implants"));
  assert.equal(page.serviceHints.includes("Home"), false);
  assert.ok(page.socialLinks.some((item) => item.platform === "instagram"));
  assert.equal(
    page.socialLinks.find((item) => item.platform === "instagram")?.url,
    "https://instagram.com/lunasmile.az"
  );
});

test("buildSiteRollup prefers clean business-relevant identity, service, pricing, and provenance", () => {
  const homePage = analyzePage({
    html: HOME_HTML,
    pageUrl: "https://lunasmile.az/",
  });
  const pricingPage = analyzePage({
    html: PRICING_HTML,
    pageUrl: "https://lunasmile.az/pricing",
  });
  const contactPage = analyzePage({
    html: CONTACT_HTML,
    pageUrl: "https://lunasmile.az/contact",
  });

  const rollup = buildSiteRollup(homePage, [homePage, pricingPage, contactPage], []);

  assert.equal(rollup.identitySignals.primaryName, "Luna Smile Studio");
  assert.equal(
    /\b(contact|call our clinic team|appointments and treatment questions)\b/i.test(
      rollup.identitySignals.primaryDescription
    ),
    false
  );
  assert.ok(
    rollup.identitySignals.descriptionCandidates.some((item) =>
      /baku dental clinic focused on cosmetic dentistry/i.test(item)
    )
  );
  assert.ok(rollup.identitySignals.contactEmails.includes("hello@lunasmile.az"));
  assert.ok(rollup.identitySignals.contactEmails.includes("appointments@lunasmile.az"));
  assert.ok(rollup.identitySignals.contactPhones.includes("+994505551212"));
  assert.ok(rollup.identitySignals.contactPhones.includes("+994124441122"));
  assert.ok(rollup.identitySignals.serviceHints.includes("Dental implants"));
  assert.ok(rollup.identitySignals.pricingHints.some((item) => /from 30 azn/i.test(item)));
  assert.equal(
    rollup.identitySignals.selectionMeta?.primaryDescription?.url,
    "https://lunasmile.az/"
  );
  assert.ok(
    ["about", "hero", "meta", "paragraph"].includes(
      rollup.identitySignals.selectionMeta?.primaryDescription?.source
    )
  );
});
