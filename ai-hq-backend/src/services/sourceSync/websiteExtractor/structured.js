import { arr, compactText, lower, obj, s, uniq, uniqBy } from "./shared.js";
import {
  cleanInlineText,
  meaningfulLines,
  sanitizeNarrativeText,
  stripHtmlToText,
} from "./text.js";
import {
  normalizePhone,
  sanitizePricingCandidate,
  sanitizeServiceCandidate,
} from "./signals.js";

function safeJsonParse(text = "") {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function flattenJsonLdNodes(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) flattenJsonLdNodes(item, out);
    return out;
  }

  if (value && typeof value === "object") {
    out.push(value);
    if (Array.isArray(value["@graph"])) flattenJsonLdNodes(value["@graph"], out);
  }

  return out;
}

export function extractJsonLdBlocks(html = "") {
  const out = [];

  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    const parsed = safeJsonParse(s(m[1]));
    if (!parsed) continue;
    out.push(...flattenJsonLdNodes(parsed));
  }

  return out;
}

function readSchemaTypes(node = {}) {
  const value = node?.["@type"];
  if (Array.isArray(value)) return value.map((x) => s(x)).filter(Boolean);
  if (value) return [s(value)];
  return [];
}

function addressToLine(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return sanitizeNarrativeText(cleanInlineText(value), { max: 220, min: 0 });
  }

  const parts = uniq(
    [
      value.streetAddress,
      value.addressLocality,
      value.addressRegion,
      value.postalCode,
      value.addressCountry,
    ]
      .map((x) => sanitizeNarrativeText(cleanInlineText(x), { max: 120, min: 0 }))
      .filter(Boolean)
  );

  return compactText(parts.join(", "), 220);
}

export function extractStructuredBusinessSignals(jsonLd = []) {
  const names = [];
  const descriptions = [];
  const emails = [];
  const phones = [];
  const addresses = [];
  const hours = [];
  const sameAs = [];
  const serviceNames = [];
  const priceHints = [];

  for (const rawNode of arr(jsonLd)) {
    const node = obj(rawNode);
    const types = readSchemaTypes(node).map(lower);
    const typeJoined = types.join(" ");

    if (
      /(organization|localbusiness|store|professionalservice|corporation|brand|person|medicalbusiness|dentist|restaurant|beautysalon|realestateagent|legalservice|financialservice|travelagency)/i.test(
        typeJoined
      )
    ) {
      if (node.name) names.push(compactText(cleanInlineText(node.name), 160));

      if (node.description) {
        const cleanedDescription = sanitizeNarrativeText(stripHtmlToText(node.description), {
          max: 500,
          min: 0,
        });
        if (cleanedDescription) descriptions.push(cleanedDescription);
      }

      if (node.email) emails.push(s(node.email).replace(/^mailto:/i, ""));
      if (node.telephone) phones.push(normalizePhone(node.telephone));
      if (node.address) addresses.push(addressToLine(node.address));
      if (node.sameAs) sameAs.push(...arr(node.sameAs));

      if (node.openingHours) {
        hours.push(
          ...arr(node.openingHours)
            .map((x) => sanitizeNarrativeText(cleanInlineText(x), { max: 180, min: 0 }))
            .filter(Boolean)
        );
      }

      if (node.openingHoursSpecification) {
        for (const item of arr(node.openingHoursSpecification)) {
          const day = uniq(
            arr(item?.dayOfWeek).map((x) => s(x).replace(/^https?:\/\/schema\.org\//i, ""))
          ).join(", ");
          const opens = s(item?.opens);
          const closes = s(item?.closes);

          const line = sanitizeNarrativeText(
            [day, opens && closes ? `${opens}-${closes}` : ""].filter(Boolean).join(" "),
            { max: 180, min: 0 }
          );

          if (line) hours.push(line);
        }
      }
    }

    if (/(service|offer|product)/i.test(typeJoined)) {
      if (node.name) {
        const serviceName = sanitizeServiceCandidate(cleanInlineText(node.name));
        if (serviceName) serviceNames.push(serviceName);
      }

      if (node.description) {
        const serviceDescription = sanitizeNarrativeText(stripHtmlToText(node.description), {
          max: 300,
          min: 0,
        });
        if (serviceDescription) descriptions.push(serviceDescription);
      }

      if (node.offers?.price) {
        const priceLine = sanitizePricingCandidate(
          [node.name, node.offers.priceCurrency, node.offers.price].filter(Boolean).join(" ")
        );
        if (priceLine) priceHints.push(priceLine);
      }
    }

    if (/(faqpage|question|answer)/i.test(typeJoined)) {
      const question = sanitizeNarrativeText(cleanInlineText(node.name || node.text || ""), {
        max: 220,
        min: 0,
      });

      const answer = sanitizeNarrativeText(
        stripHtmlToText(node.acceptedAnswer?.text || node.text || ""),
        { max: 700, min: 0 }
      );

      if (question) {
        descriptions.push(compactText(`${question}${answer ? ` — ${answer}` : ""}`, 700));
      }
    }
  }

  return {
    names: uniq(names).slice(0, 10),
    descriptions: uniq(descriptions).slice(0, 20),
    emails: uniq(emails.filter(Boolean)).slice(0, 20),
    phones: uniq(phones.filter((x) => x.length >= 7)).slice(0, 20),
    addresses: uniq(addresses.filter(Boolean)).slice(0, 10),
    hours: uniq(hours.filter(Boolean)).slice(0, 10),
    sameAs: uniq(sameAs.filter(Boolean)).slice(0, 20),
    serviceNames: uniq(serviceNames.filter(Boolean)).slice(0, 20),
    priceHints: uniq(priceHints.filter(Boolean)).slice(0, 12),
  };
}

export function extractFaqItems(html = "", text = "") {
  const out = [];

  for (const m of html.matchAll(/<(details|div|section|article)[^>]*>([\s\S]{0,1400}?)<\/\1>/gi)) {
    const block = s(m[2]);
    const questionMatch = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);

    const question = sanitizeNarrativeText(stripHtmlToText(questionMatch?.[1] || ""), {
      max: 220,
      min: 6,
    });

    const answer = sanitizeNarrativeText(
      stripHtmlToText(block.replace(/<summary[\s\S]*?<\/summary>/i, "")),
      { max: 800, min: 0 }
    );

    if (question && question.length >= 6) out.push({ question, answer });
  }

  const questionLines = meaningfulLines(text, 120)
    .filter((x) => x.length >= 8 && x.length <= 220 && /\?$/.test(x))
    .slice(0, 12);

  for (const q of questionLines) {
    const idx = text.indexOf(q);
    let answer = "";

    if (idx >= 0) {
      const tail = text.slice(idx + q.length, idx + q.length + 900);
      const answerLines = meaningfulLines(tail, 20).filter((x) => x && !/\?$/.test(x));
      answer = compactText(answerLines.slice(0, 3).join(" "), 700);
    }

    out.push({ question: q, answer });
  }

  return uniqBy(
    out.filter((x) => x.question && x.question.length >= 6),
    (x) => lower(x.question)
  ).slice(0, 16);
}