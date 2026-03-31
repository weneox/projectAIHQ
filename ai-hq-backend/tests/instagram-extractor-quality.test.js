import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInstagramSignals,
  synthesizeInstagramBusinessProfile,
} from "../src/services/sourceSync/instagramHelpers.js";

test("instagram connected-source signals keep business evidence cleaner and setup-compatible", () => {
  const signals = buildInstagramSignals({
    account: {
      username: "lunasmile.az",
      name: "Luna Smile Studio",
      biography:
        "Cosmetic dentistry and whitening in Baku. WhatsApp for appointments. Prices from 40 AZN. https://instagram.com/lunasmile.az https://lunasmile.az",
      website: "",
    },
    page: {
      name: "Luna Smile Studio",
      about:
        "Dental clinic in Baku offering implants, whitening, smile design, and family care.",
      category: "Dental clinic",
      categoryList: [{ name: "Dentist" }],
      emails: ["hello@lunasmile.az"],
      phone: "+994 50 555 12 12",
      website: "https://lunasmile.az",
      location: {
        street: "14 Nizami Street",
        city: "Baku",
        country: "Azerbaijan",
      },
    },
    media: [
      {
        caption:
          "Smile design and whitening packages available. Book consultation on WhatsApp.",
      },
      {
        caption:
          "Implant consultations and whitening treatments with flexible package pricing.",
      },
    ],
  });

  assert.equal(signals.summaryCandidates[0], "Dental clinic in Baku offering implants, whitening, smile design, and family care.");
  assert.ok(signals.externalUrls.includes("https://lunasmile.az/"));
  assert.equal(signals.externalUrls.some((url) => /instagram\.com/i.test(url)), false);
  assert.ok(signals.contactClues.some((item) => /hello@lunasmile\.az/i.test(item)));
  assert.ok(signals.serviceHints.some((item) => /implant|whitening|dental/i.test(item)));
  assert.ok(signals.pricingHints.some((item) => /40 azn|package|pricing/i.test(item)));
  assert.equal(signals.selectionMeta.summaryPrimarySource, "page.about");
});

test("instagram business profile derives support mode and external website from connected account evidence", () => {
  const profile = synthesizeInstagramBusinessProfile(
    buildInstagramSignals({
      account: {
        username: "lunasmile.az",
        name: "Luna Smile Studio",
        biography:
          "Cosmetic dentistry in Baku. WhatsApp for appointments. Prices from 40 AZN.",
      },
      page: {
        name: "Luna Smile Studio",
        about:
          "Dental clinic in Baku offering implants, whitening, smile design, and family care.",
        emails: ["hello@lunasmile.az"],
        phone: "+994 50 555 12 12",
        website: "https://lunasmile.az",
        location: {
          street: "14 Nizami Street",
          city: "Baku",
          country: "Azerbaijan",
        },
      },
      media: [
        {
          caption:
            "Smile design and whitening packages available. Book consultation on WhatsApp.",
        },
      ],
    })
  );

  assert.equal(profile.websiteUrl, "https://lunasmile.az/");
  assert.equal(profile.supportMode, "whatsapp");
  assert.equal(profile.primaryEmail, "hello@lunasmile.az");
  assert.equal(profile.primaryPhone, "+994505551212");
  assert.match(profile.primaryAddress, /Nizami Street/i);
  assert.equal(profile.selectionMeta.websiteSource, "page.website");
});
