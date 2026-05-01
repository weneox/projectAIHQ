import {
  arr,
  firstText,
  joinHumanList,
  normalizeIsoLanguage,
  sentence,
  s,
  uniqStrings,
} from "./normalize.js";

const SUPPORTED_INTENTS = new Set([
  "smalltalk.greeting",
  "smalltalk.gratitude",
  "clarify.unclear",
  "sales_interest",
  "handoff.request",
  "support.request",

  "contact.general",
  "contact.phone",
  "contact.email",
  "contact.website",
  "contact.address",

  "identity.name",
  "business.summary",
  "business.services",
  "business.products",
  "business.pricing",
  "business.booking",
  "business.social",
  "business.language",

  "behavior.policy",
]);

function cleanReply(text = "") {
  return s(text)
    .replace(/\s+/g, " ")
    .replace(/\.\./g, ".")
    .replace(/\s+([,.!?؟:;])/g, "$1")
    .trim();
}

function normalizeIntentOrder(classification = {}) {
  const ordered = uniqStrings([
    ...arr(classification?.intents),
    classification?.primaryIntent,
  ])
    .map((item) => s(item))
    .filter((item) => item && item !== "unknown")
    .filter((item) => SUPPORTED_INTENTS.has(item));

  return ordered.length ? ordered : ["clarify.unclear"];
}

function pushPart({ parts, factsUsed, part = "", fact = "" }) {
  const text = s(part);
  if (!text) return;

  parts.push(text);
  if (s(fact)) factsUsed.push(fact);
}

function pushUnavailable({ parts, factsUsed, key, label }) {
  pushPart({
    parts,
    factsUsed,
    part: `${label}.`,
    fact: `${key}: not approved`,
  });
}

function pushFact({
  parts,
  factsUsed,
  usedFacts,
  label,
  value,
  factKey,
}) {
  const safe = s(value);
  const key = s(factKey || label);

  if (!safe || usedFacts.has(key)) return false;

  usedFacts.add(key);

  pushPart({
    parts,
    factsUsed,
    part: `${label}: ${safe}.`,
    fact: `${key}: ${safe}`,
  });

  return true;
}

function joinFacts(items = [], language = "en") {
  return joinHumanList(
    arr(items)
      .map((item) => s(item))
      .filter(Boolean),
    language
  );
}

function behaviorFactParts(facts = {}) {
  return [
    facts.behavior?.tone ? `Tone: ${facts.behavior.tone}` : "",
    facts.behavior?.primaryCta ? `Primary CTA: ${facts.behavior.primaryCta}` : "",
    facts.behavior?.handoffPolicy ? `Handoff policy: ${facts.behavior.handoffPolicy}` : "",
  ].filter(Boolean);
}

function renderContactGeneral({ parts, factsUsed, usedFacts, facts }) {
  let pushed = 0;

  pushed += Number(
    pushFact({
      parts,
      factsUsed,
      usedFacts,
      label: "Phone",
      value: facts.phone,
      factKey: "Primary phone",
    })
  );

  pushed += Number(
    pushFact({
      parts,
      factsUsed,
      usedFacts,
      label: "Email",
      value: facts.email,
      factKey: "Primary email",
    })
  );

  pushed += Number(
    pushFact({
      parts,
      factsUsed,
      usedFacts,
      label: "Website",
      value: facts.website,
      factKey: "Website",
    })
  );

  pushed += Number(
    pushFact({
      parts,
      factsUsed,
      usedFacts,
      label: "Address",
      value: facts.address,
      factKey: "Address",
    })
  );

  if (!pushed) {
    pushUnavailable({
      parts,
      factsUsed,
      key: "Contact",
      label: "Contact information has not been added yet",
    });
  }
}

function renderIntent({ intent, language, parts, factsUsed, usedFacts, facts }) {
  if (intent === "smalltalk.greeting") {
    pushPart({
      parts,
      factsUsed,
      part: "Hello, how can I help?",
      fact: "Smalltalk: greeting",
    });
    return;
  }

  if (intent === "smalltalk.gratitude") {
    pushPart({
      parts,
      factsUsed,
      part: "You are welcome.",
      fact: "Smalltalk: gratitude",
    });
    return;
  }

  if (intent === "clarify.unclear") {
    pushPart({
      parts,
      factsUsed,
      part: "Sure, what information do you need?",
      fact: "Clarification: unclear",
    });
    return;
  }

  if (intent === "support.request") {
    pushPart({
      parts,
      factsUsed,
      part: "I am here. Please write what happened, and we will help.",
      fact: "Support: requested",
    });
    return;
  }

  if (intent === "handoff.request") {
    pushPart({
      parts,
      factsUsed,
      part: "A human operator can help with this.",
      fact: "Handoff: requested",
    });
    return;
  }

  if (intent === "sales_interest") {
    pushPart({
      parts,
      factsUsed,
      part: "Tell us briefly what you need, and we will guide you.",
      fact: "Sales interest: general",
    });
    return;
  }

  if (intent === "contact.general") {
    renderContactGeneral({ parts, factsUsed, usedFacts, facts });
    return;
  }

  if (intent === "contact.phone") {
    if (
      !pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Phone",
        value: facts.phone,
        factKey: "Primary phone",
      })
    ) {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Primary phone",
        label: "Phone number has not been added yet",
      });
    }
    return;
  }

  if (intent === "contact.email") {
    if (
      !pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Email",
        value: facts.email,
        factKey: "Primary email",
      })
    ) {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Primary email",
        label: "Email address has not been added yet",
      });
    }
    return;
  }

  if (intent === "contact.website") {
    if (
      !pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Website",
        value: facts.website,
        factKey: "Website",
      })
    ) {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Website",
        label: "Website has not been added yet",
      });
    }
    return;
  }

  if (intent === "contact.address") {
    if (
      !pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Address",
        value: facts.address,
        factKey: "Address",
      })
    ) {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Address",
        label: "Address has not been added yet",
      });
    }
    return;
  }

  if (intent === "identity.name") {
    if (
      !pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Business name",
        value: facts.displayName,
        factKey: "Business name",
      })
    ) {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Business name",
        label: "Business name has not been added yet",
      });
    }
    return;
  }

  if (intent === "business.summary") {
    const value = firstText(facts.summary, facts.industry, facts.displayName);

    if (value) {
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Business summary",
        value,
        factKey: "Business summary",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Business summary",
        label: "Business information has not been added yet",
      });
    }
    return;
  }

  if (intent === "business.services") {
    if (facts.services?.length) {
      const list = joinFacts(facts.services, language);
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Services",
        value: list,
        factKey: "Services",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Services",
        label: "The approved service list has not been added yet",
      });
    }
    return;
  }

  if (intent === "business.products") {
    if (facts.products?.length) {
      const list = joinFacts(facts.products, language);
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Products",
        value: list,
        factKey: "Products",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Products",
        label: "The approved product list has not been added yet",
      });
    }
    return;
  }

  if (intent === "business.pricing") {
    if (facts.pricing) {
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Pricing",
        value: facts.pricing,
        factKey: "Pricing",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Pricing",
        label: "A confirmed price has not been added yet",
      });
    }
    return;
  }

  if (intent === "business.booking") {
    if (facts.booking) {
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Booking",
        value: facts.booking,
        factKey: "Booking",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Booking",
        label: "Booking information has not been added yet",
      });
    }
    return;
  }

  if (intent === "business.social") {
    if (facts.socialLinks?.length) {
      const list = joinFacts(facts.socialLinks, language);
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Social links",
        value: list,
        factKey: "Social links",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Social links",
        label: "Social links have not been added yet",
      });
    }
    return;
  }

  if (intent === "business.language") {
    if (facts.languages?.length) {
      const list = joinFacts(facts.languages, language);
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Supported languages",
        value: list,
        factKey: "Languages",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Languages",
        label: "Supported languages have not been added yet",
      });
    }
    return;
  }

  if (intent === "behavior.policy") {
    const behaviorParts = behaviorFactParts(facts);

    if (behaviorParts.length) {
      const text = joinHumanList(behaviorParts, language);
      pushFact({
        parts,
        factsUsed,
        usedFacts,
        label: "Approved AI behavior",
        value: text,
        factKey: "Behavior",
      });
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Behavior",
        label: "Approved AI behavior rules have not been added yet",
      });
    }
  }
}

export function composeApprovedTruthAnswer({
  classification = {},
  facts = {},
} = {}) {
  const language = normalizeIsoLanguage(classification.language || "en", "en");
  const intents = normalizeIntentOrder(classification);

  const parts = [];
  const factsUsed = [];
  const usedFacts = new Set();

  for (const intent of intents) {
    renderIntent({
      intent,
      language,
      parts,
      factsUsed,
      usedFacts,
      facts,
    });
  }

  const replyText = cleanReply(parts.join(" "));

  if (!replyText && classification.shouldHandle) {
    return {
      replyText: "This information has not been added yet.",
      factsUsed: ["approved_truth: unavailable"],
    };
  }

  return {
    replyText,
    factsUsed: uniqStrings(factsUsed),
  };
}
