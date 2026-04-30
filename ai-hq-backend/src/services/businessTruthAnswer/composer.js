import { firstText, joinHumanList, sentence, s, uniqStrings } from "./normalize.js";

function pushFact({ parts, factsUsed, used, label, value, factKey }) {
  const safe = s(value);
  if (!safe || used.has(factKey)) return;

  used.add(factKey);
  parts.push(`${label}: ${safe}.`);
  factsUsed.push(`${factKey}: ${safe}`);
}

function pushUnavailable({ parts, factsUsed, key, label }) {
  parts.push(`${label}.`);
  factsUsed.push(`${key}: not approved`);
}

function joinFacts(items = [], language = "en") {
  return joinHumanList(
    Array.isArray(items) ? items.map((item) => s(item)).filter(Boolean) : [],
    language
  );
}

function cleanReply(text = "") {
  return s(text)
    .replace(/\s+/g, " ")
    .replace(/\.\./g, ".")
    .replace(/\s+([,.!?؟:;])/g, "$1")
    .trim();
}

function buildBehaviorFacts(facts = {}) {
  return [
    facts.behavior?.tone ? `tone: ${facts.behavior.tone}` : "",
    facts.behavior?.primaryCta ? `CTA: ${facts.behavior.primaryCta}` : "",
    facts.behavior?.handoffPolicy ? `handoff: ${facts.behavior.handoffPolicy}` : "",
  ].filter(Boolean);
}

export function composeApprovedTruthAnswer({
  classification = {},
  facts = {},
} = {}) {
  const language = s(classification.language || "en") || "en";
  const intents = uniqStrings(classification.intents || [classification.primaryIntent]);

  const parts = [];
  const factsUsed = [];
  const used = new Set();

  if (intents.includes("smalltalk.greeting")) {
    parts.push("Hello, how can I help?");
    factsUsed.push("Smalltalk: greeting");
  }

  if (intents.includes("smalltalk.gratitude")) {
    parts.push("You are welcome.");
    factsUsed.push("Smalltalk: gratitude");
  }

  if (intents.includes("clarify.unclear")) {
    parts.push("Sure, what information do you need?");
    factsUsed.push("Clarification: unclear");
  }

  if (intents.includes("business.summary")) {
    const value = firstText(facts.summary, facts.industry, facts.displayName);
    if (value) {
      parts.push(sentence(value));
      factsUsed.push(`Business summary: ${value}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Business summary",
        label: "Business information has not been added yet",
      });
    }
  }

  if (intents.includes("business.services")) {
    if (facts.summary) {
      parts.push(sentence(facts.summary));
      factsUsed.push(`Business summary: ${facts.summary}`);
    } else if (facts.services?.length) {
      const list = joinFacts(facts.services, language);
      parts.push(`Services: ${list}.`);
      factsUsed.push(`Services: ${list}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Services",
        label: "The approved service list has not been added yet",
      });
    }
  }

  if (intents.includes("contact.general")) {
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Phone",
      value: facts.phone,
      factKey: "Primary phone",
    });
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Email",
      value: facts.email,
      factKey: "Primary email",
    });
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Website",
      value: facts.website,
      factKey: "Website",
    });
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Address",
      value: facts.address,
      factKey: "Address",
    });

    if (!used.size) {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Contact",
        label: "Contact information has not been added yet",
      });
    }
  }

  if (intents.includes("contact.phone")) {
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Phone",
      value: facts.phone,
      factKey: "Primary phone",
    });
  }

  if (intents.includes("contact.email")) {
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Email",
      value: facts.email,
      factKey: "Primary email",
    });
  }

  if (intents.includes("contact.website")) {
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Website",
      value: facts.website,
      factKey: "Website",
    });
  }

  if (intents.includes("contact.address")) {
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Address",
      value: facts.address,
      factKey: "Address",
    });
  }

  if (intents.includes("identity.name")) {
    pushFact({
      parts,
      factsUsed,
      used,
      label: "Business name",
      value: facts.displayName,
      factKey: "Business name",
    });
  }

  if (intents.includes("business.products")) {
    if (facts.products?.length) {
      const list = joinFacts(facts.products, language);
      parts.push(`Products: ${list}.`);
      factsUsed.push(`Products: ${list}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Products",
        label: "The approved product list has not been added yet",
      });
    }
  }

  if (intents.includes("business.pricing")) {
    if (facts.pricing) {
      parts.push(`Pricing: ${facts.pricing}.`);
      factsUsed.push(`Pricing: ${facts.pricing}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Pricing",
        label: "A confirmed price has not been added yet",
      });
    }
  }

  if (intents.includes("business.booking")) {
    if (facts.booking) {
      parts.push(`Booking: ${facts.booking}.`);
      factsUsed.push(`Booking: ${facts.booking}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Booking",
        label: "Booking information has not been added yet",
      });
    }
  }

  if (intents.includes("business.social")) {
    if (facts.socialLinks?.length) {
      const list = joinFacts(facts.socialLinks, language);
      parts.push(`Social links: ${list}.`);
      factsUsed.push(`Social links: ${list}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Social links",
        label: "Social links have not been added yet",
      });
    }
  }

  if (intents.includes("business.language")) {
    if (facts.languages?.length) {
      const list = joinFacts(facts.languages, language);
      parts.push(`Supported languages: ${list}.`);
      factsUsed.push(`Languages: ${list}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Languages",
        label: "Supported languages have not been added yet",
      });
    }
  }

  if (intents.includes("behavior.policy")) {
    const behaviorParts = buildBehaviorFacts(facts);

    if (behaviorParts.length) {
      const text = joinHumanList(behaviorParts, language);
      parts.push(`Approved AI behavior: ${text}.`);
      factsUsed.push(`Behavior: ${text}`);
    } else {
      pushUnavailable({
        parts,
        factsUsed,
        key: "Behavior",
        label: "Approved AI behavior rules have not been added yet",
      });
    }
  }

  const replyText = cleanReply(uniqStrings(parts).join(" "));

  if (!replyText && classification.shouldHandle) {
    return {
      replyText: "This information has not been added yet.",
      factsUsed: ["approved_truth: unavailable"],
    };
  }

  return {
    replyText,
    factsUsed,
  };
}
