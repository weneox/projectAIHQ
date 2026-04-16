import { arr, compactDraftObject, obj, s } from "../draftShared.js";
import {
  inferContactType,
  normalizeSourceType,
  normalizeWebsiteUrl,
  slugify,
  uniqueStrings,
} from "./shared.js";

export function formatSetupAssistantHoursForCanonical(hours = []) {
  const DAY_LABELS = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };

  return arr(hours)
    .map((row) => {
      const item = obj(row);
      const day = DAY_LABELS[s(item.day).toLowerCase()] || s(item.day);
      if (!day) return "";

      if (item.appointmentOnly === true) return `${day} appointment only`;
      if (item.allDay === true) return `${day} 24/7`;
      if (item.closed === true) return `${day} closed`;

      const openTime = s(item.openTime || item.open_time);
      const closeTime = s(item.closeTime || item.close_time);

      if (openTime && closeTime) {
        return `${day} ${openTime}-${closeTime}`;
      }

      if (s(item.notes)) {
        return `${day} ${s(item.notes)}`;
      }

      return "";
    })
    .filter(Boolean);
}

export function buildCanonicalBusinessProfileFromSetupAssistant(setup = {}) {
  const profile = obj(setup.businessProfile);
  const pricing = obj(setup.pricingPosture);
  const contacts = arr(setup.contacts);

  const primaryPhone = s(
    contacts.find((item) => s(item.type).toLowerCase() === "phone")?.value
  );

  const primaryEmail = s(
    contacts.find((item) => s(item.type).toLowerCase() === "email")?.value
  );

  const whatsappLinks = contacts
    .filter((item) => {
      const type = s(item.type).toLowerCase();
      const value = s(item.value);
      return type === "whatsapp" || value.includes("wa.me");
    })
    .map((item) => s(item.value))
    .filter(Boolean);

  const pricingHints = uniqueStrings(
    [
      s(pricing.publicSummary),
      ...arr(pricing.perServicePricing).map((item) =>
        s(item.priceLabel || item.price_label)
      ),
    ].filter(Boolean),
    20
  );

  return compactDraftObject({
    companyName: s(profile.companyName),
    description: s(profile.description),
    websiteUrl: normalizeWebsiteUrl(profile.websiteUrl),
    primaryPhone,
    primaryEmail,
    whatsappLinks,
    hours: formatSetupAssistantHoursForCanonical(setup.hours),
    pricingPolicy: s(pricing.publicSummary),
    pricingHints,
  });
}

export function buildCanonicalServicesFromSetupAssistant(services = []) {
  return arr(services)
    .map((item) => {
      const service = obj(item);
      const title = s(service.title || service.name || service.label);
      const key =
        s(service.key || service.serviceKey || service.service_key) ||
        slugify(title);

      if (!title && !key) return null;

      return compactDraftObject({
        key: key || slugify(title),
        title: title || key,
        description: s(service.summary || service.description),
        category: s(service.category || "general").toLowerCase() || "general",
        metadataJson: compactDraftObject({
          origin: "setup_assistant",
          priceLabel: s(service.priceLabel || service.price_label),
          aliases: uniqueStrings(service.aliases, 12),
          availabilityStatus: s(
            service.availabilityStatus || service.availability_status
          ).toLowerCase(),
          operatorNotes: s(service.operatorNotes || service.operator_notes),
        }),
      });
    })
    .filter(Boolean);
}

export function buildCanonicalContactsFromSetupAssistant(contacts = []) {
  return arr(contacts)
    .map((item, index) => {
      const contact = obj(item);
      const value = s(contact.value);
      const channel =
        s(contact.type).toLowerCase() || inferContactType(value) || "other";
      const label = s(contact.label) || channel || `contact-${index + 1}`;

      if (!value && !label) return null;

      return compactDraftObject({
        contactKey: slugify(`${channel}-${label}-${index + 1}`),
        channel,
        label,
        value,
        isPrimary: contact.preferred === true,
        enabled: true,
        visiblePublic: s(contact.visibility).toLowerCase() !== "private",
        visibleInAi: true,
        sortOrder: index,
        meta: {
          origin: "setup_assistant",
        },
      });
    })
    .filter(Boolean);
}

export function buildCanonicalSourceSummaryFromSetupAssistant(setup = {}) {
  const businessProfile = obj(setup.businessProfile);
  const sourceMetadata = obj(setup.sourceMetadata);
  const websiteUrl = normalizeWebsiteUrl(s(businessProfile.websiteUrl));
  const primarySourceType = websiteUrl
    ? "website"
    : normalizeSourceType(sourceMetadata.primarySourceType);
  const primarySourceUrl = websiteUrl || s(sourceMetadata.primarySourceUrl);
  const sourceLabels = uniqueStrings(
    [...arr(sourceMetadata.sourceLabels), websiteUrl ? "Website" : ""],
    12
  );

  return {
    primarySourceType,
    primarySourceUrl,
    sourceLabels,
    evidenceSummary: uniqueStrings(sourceMetadata.evidenceSummary, 12),
    warningCount: Number(sourceMetadata.warningCount || 0) || 0,
    sourceCount: Math.max(
      Number(sourceMetadata.sourceCount || 0) || 0,
      primarySourceUrl ? 1 : 0
    ),
  };
}

export function buildCanonicalReviewDraftPatchFromSetupAssistant(setup = {}) {
  return {
    businessProfile: buildCanonicalBusinessProfileFromSetupAssistant(setup),
    services: buildCanonicalServicesFromSetupAssistant(setup.services),
    contacts: buildCanonicalContactsFromSetupAssistant(setup.contacts),
    sourceSummary: buildCanonicalSourceSummaryFromSetupAssistant(setup),
  };
}
