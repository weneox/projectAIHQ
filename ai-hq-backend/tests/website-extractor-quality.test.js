import test from "node:test";
import assert from "node:assert/strict";

import { cfg } from "../src/config.js";
import { analyzePage } from "../src/services/sourceSync/websiteExtractor/pageModel.js";
import { __test__ as websiteExtractorTest } from "../src/services/sourceSync/websiteExtractor/index.js";
import { buildSiteRollup } from "../src/services/sourceSync/websiteExtractor/rollup.js";
import {
  buildWebsiteSignals,
  synthesizeBusinessProfile,
} from "../src/services/sourceSync/websiteHelpers.js";

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

test("website extractor runtime defaults now match the stronger crawl limits unless explicitly overridden", () => {
  const previous = {
    websiteFetchTimeoutMs: cfg.sourceSync.websiteFetchTimeoutMs,
    websitePageTimeoutMs: cfg.sourceSync.websitePageTimeoutMs,
    websiteEntryTimeoutMs: cfg.sourceSync.websiteEntryTimeoutMs,
    websiteExtractTimeoutMs: cfg.sourceSync.websiteExtractTimeoutMs,
    websiteFinalizeReserveMs: cfg.sourceSync.websiteFinalizeReserveMs,
    websiteMinStepBudgetMs: cfg.sourceSync.websiteMinStepBudgetMs,
    websiteRobotsTimeoutMs: cfg.sourceSync.websiteRobotsTimeoutMs,
    websiteSitemapTimeoutMs: cfg.sourceSync.websiteSitemapTimeoutMs,
    websiteMaxPagesAllowed: cfg.sourceSync.websiteMaxPagesAllowed,
    websiteMaxCandidatesQueued: cfg.sourceSync.websiteMaxCandidatesQueued,
    websiteMaxFetchPages: cfg.sourceSync.websiteMaxFetchPages,
  };

  try {
    cfg.sourceSync.websiteFetchTimeoutMs = undefined;
    cfg.sourceSync.websitePageTimeoutMs = undefined;
    cfg.sourceSync.websiteEntryTimeoutMs = undefined;
    cfg.sourceSync.websiteExtractTimeoutMs = undefined;
    cfg.sourceSync.websiteFinalizeReserveMs = undefined;
    cfg.sourceSync.websiteMinStepBudgetMs = undefined;
    cfg.sourceSync.websiteRobotsTimeoutMs = undefined;
    cfg.sourceSync.websiteSitemapTimeoutMs = undefined;
    cfg.sourceSync.websiteMaxPagesAllowed = undefined;
    cfg.sourceSync.websiteMaxCandidatesQueued = undefined;
    cfg.sourceSync.websiteMaxFetchPages = undefined;

    const limits = websiteExtractorTest.resolveWebsiteCrawlLimits();
    assert.deepEqual(limits, {
      maxPagesAllowed: 6,
      maxCandidatesQueued: 40,
      maxFetchPages: 10,
      totalCrawlMs: 32000,
      entryFetchMs: 18000,
      robotsFetchMs: 2200,
      sitemapFetchMs: 4500,
      pageFetchMs: 7000,
      finalizeReserveMs: 4000,
      minStepBudgetMs: 400,
    });
  } finally {
    Object.assign(cfg.sourceSync, previous);
  }
});

test("buildSiteRollup salvages minimum contact evidence and debug metadata from fetched pages even when kept pages stay weak", () => {
  const weakHome = analyzePage({
    html: `
      <html>
        <head><title>Alpha Studio</title></head>
        <body><h1>Alpha Studio</h1><p>Creative work.</p></body>
      </html>
    `,
    pageUrl: "https://alpha.example/",
  });

  const contactPage = analyzePage({
    html: `
      <html>
        <head><title>Contact | Alpha Studio</title></head>
        <body>
          <h1>Contact Alpha Studio</h1>
          <p>Email: hello@alpha.example</p>
          <p>Phone: +994 50 700 11 22</p>
          <p>Address: 22 Nizami Street, Baku, Azerbaijan</p>
          <a href="https://instagram.com/alphastudio.az">Instagram</a>
        </body>
      </html>
    `,
    pageUrl: "https://alpha.example/contact",
  });

  const rollup = buildSiteRollup(weakHome, [weakHome], ["fallback_identity_only_extraction"], {
    fetchedPages: [weakHome, contactPage],
    pageAdmissions: [
      { url: weakHome.url, admitted: true, admissionReason: "fallback_identity_only_page" },
      { url: contactPage.url, admitted: false, admissionReason: "weak_generic_page" },
    ],
  });

  assert.ok(rollup.identitySignals.contactEmails.includes("hello@alpha.example"));
  assert.ok(rollup.identitySignals.contactPhones.includes("+994507001122"));
  assert.ok(rollup.identitySignals.addresses.some((item) => /nizami street/i.test(item)));
  assert.ok(
    rollup.identitySignals.socialLinks.some(
      (item) => item.platform === "instagram" && /alphastudio/i.test(item.url)
    )
  );
  assert.ok(
    rollup.identitySignals.contactPageClues.some((item) => /contact/i.test(item.url))
  );
  assert.equal(rollup.identitySignals.minimumContactSalvage.used, true);
  assert.ok(
    rollup.debug.pagesWithContactSignals.some((item) => /alpha\.example\/contact/i.test(item.url))
  );
  assert.ok(rollup.debug.weakSelectionReasons.includes("limited_kept_page_coverage"));
});

test("buildWebsiteSignals and synthesizeBusinessProfile preserve weak-homepage contact salvage across generic business sites", () => {
  const weakHome = analyzePage({
    html: `
      <html>
        <head><title>Northstar Legal</title></head>
        <body>
          <h1>Northstar Legal</h1>
          <p>Commercial advisory for founders and growing teams.</p>
          <a href="/contact">Contact</a>
        </body>
      </html>
    `,
    pageUrl: "https://northstar.example/",
  });

  const contactPage = analyzePage({
    html: `
      <html>
        <head><title>Contact | Northstar Legal</title></head>
        <body>
          <h1>Contact Northstar Legal</h1>
          <p>Email: hello@northstar.example</p>
          <p>Phone: +44 20 7946 0958</p>
          <p>Address: 22 King Street, London, UK</p>
          <a href="https://linkedin.com/company/northstar-legal">LinkedIn</a>
        </body>
      </html>
    `,
    pageUrl: "https://northstar.example/contact",
  });

  const aboutPage = analyzePage({
    html: `
      <html>
        <head>
          <title>About | Northstar Legal</title>
          <meta name="description" content="Northstar Legal helps founders with commercial contracts, SaaS terms, employment support, and practical legal operations." />
        </head>
        <body>
          <h1>About Northstar Legal</h1>
          <p>Northstar Legal helps founders with commercial contracts, SaaS terms, employment support, and practical legal operations.</p>
        </body>
      </html>
    `,
    pageUrl: "https://northstar.example/about",
  });

  const rollup = buildSiteRollup(weakHome, [weakHome, aboutPage], [], {
    fetchedPages: [weakHome, aboutPage, contactPage],
    pageAdmissions: [
      { url: weakHome.url, admitted: true, admissionReason: "fallback_identity_only_page" },
      { url: aboutPage.url, admitted: true, admissionReason: "business_critical_page_with_content" },
      { url: contactPage.url, admitted: false, admissionReason: "business_critical_page_with_content" },
    ],
  });

  const websiteSignals = buildWebsiteSignals({
    pages: [weakHome, aboutPage],
    site: rollup,
    crawl: { warnings: ["limited_page_coverage"] },
  });
  const profile = synthesizeBusinessProfile(websiteSignals);

  assert.equal(profile.companyTitle, "Northstar Legal");
  assert.ok(profile.emails.includes("hello@northstar.example"));
  assert.ok(profile.phones.includes("+442079460958"));
  assert.ok(profile.addresses.some((item) => /king street/i.test(item)));
  assert.ok(profile.socialLinks.some((item) => item.platform === "linkedin"));
  assert.ok(/founders/i.test(profile.companySummaryShort));
  assert.equal(profile.emails.length >= 1, true);
});

test("service-heavy sites preserve offering hints from summary text and booking-style service pages", () => {
  const homePage = analyzePage({
    html: `
      <html>
        <head>
          <title>PeakFit Studio</title>
          <meta name="description" content="PeakFit Studio offers personal training, reformer pilates, nutrition coaching, and recovery plans." />
        </head>
        <body>
          <h1>PeakFit Studio</h1>
          <p>Training plans for strength, mobility, and sustainable results.</p>
          <a href="/services">Services</a>
          <a href="/pricing">Pricing</a>
        </body>
      </html>
    `,
    pageUrl: "https://peakfit.example/",
  });

  const servicesPage = analyzePage({
    html: `
      <html>
        <head><title>Services | PeakFit Studio</title></head>
        <body>
          <h1>Services</h1>
          <ul>
            <li>Personal training</li>
            <li>Reformer pilates</li>
            <li>Nutrition coaching</li>
            <li>Recovery programming</li>
          </ul>
          <p>Book a consultation to match the right coaching plan.</p>
        </body>
      </html>
    `,
    pageUrl: "https://peakfit.example/services",
  });

  const pricingPage = analyzePage({
    html: `
      <html>
        <head><title>Memberships | PeakFit Studio</title></head>
        <body>
          <h1>Plans & Pricing</h1>
          <p>Starter plan from 90 USD per month.</p>
          <p>Reformer package from 180 USD.</p>
          <p>Custom coaching quotes are available for teams.</p>
        </body>
      </html>
    `,
    pageUrl: "https://peakfit.example/pricing",
  });

  const rollup = buildSiteRollup(homePage, [homePage, servicesPage, pricingPage], []);
  const websiteSignals = buildWebsiteSignals({
    pages: [homePage, servicesPage, pricingPage],
    site: rollup,
    crawl: { warnings: [] },
  });
  const profile = synthesizeBusinessProfile(websiteSignals);

  assert.ok(profile.services.some((item) => /personal training/i.test(item)));
  assert.ok(profile.services.some((item) => /reformer pilates/i.test(item)));
  assert.ok(/personal training/i.test(profile.companySummaryShort));
  assert.ok(/PeakFit Studio/i.test(profile.companySummaryShort));
});
