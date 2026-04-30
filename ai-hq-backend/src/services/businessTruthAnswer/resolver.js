import { arr, firstText, lower, obj, s, uniqStrings } from "./normalize.js";

function normalizeContactType(value = "") {
  const x = lower(value);

  if (["phone", "mobile", "tel", "call"].includes(x)) return "phone";
  if (["whatsapp", "wa"].includes(x)) return "whatsapp";
  if (["email", "mail", "e-mail"].includes(x)) return "email";
  if (["website", "web", "site"].includes(x)) return "website";
  if (["instagram", "ig"].includes(x)) return "instagram";
  if (["facebook", "fb"].includes(x)) return "facebook";
  if (["telegram", "tg"].includes(x)) return "telegram";
  if (["tiktok", "youtube", "linkedin"].includes(x)) return x;

  return x;
}

function visibleInAi(item = {}) {
  if (item?.enabled === false) return false;
  if (item?.visibleInAi === false) return false;
  if (item?.visible_in_ai === false) return false;
  return true;
}

function pickContactValue(contacts = [], types = []) {
  const wanted = new Set(types.map(normalizeContactType));

  const candidates = arr(contacts)
    .filter(visibleInAi)
    .map((item) => ({
      value: s(item?.value || item?.url || item?.href),
      type: normalizeContactType(
        item?.channel || item?.type || item?.contactType || item?.contact_type
      ),
      primary:
        item?.isPrimary === true ||
        item?.is_primary === true ||
        item?.primary === true,
      sortOrder: Number(item?.sortOrder ?? item?.sort_order ?? 0) || 0,
    }))
    .filter((item) => item.value && wanted.has(item.type))
    .sort(
      (a, b) =>
        Number(b.primary) - Number(a.primary) || a.sortOrder - b.sortOrder
    );

  return candidates[0]?.value || "";
}

function listContactValues(contacts = [], types = []) {
  const wanted = new Set(types.map(normalizeContactType));

  return uniqStrings(
    arr(contacts)
      .filter(visibleInAi)
      .map((item) => ({
        value: s(item?.value || item?.url || item?.href),
        type: normalizeContactType(
          item?.channel || item?.type || item?.contactType || item?.contact_type
        ),
      }))
      .filter((item) => item.value && wanted.has(item.type))
      .map((item) => item.value)
  );
}

function pickLocationAddress(locations = []) {
  const candidates = arr(locations)
    .map((item) => ({
      address: firstText(
        item?.address,
        item?.addressLine,
        item?.address_line,
        item?.fullAddress,
        item?.full_address,
        item?.title
      ),
      primary:
        item?.isPrimary === true ||
        item?.is_primary === true ||
        item?.primary === true,
      sortOrder: Number(item?.sortOrder ?? item?.sort_order ?? 0) || 0,
    }))
    .filter((item) => item.address)
    .sort(
      (a, b) =>
        Number(b.primary) - Number(a.primary) || a.sortOrder - b.sortOrder
    );

  return candidates[0]?.address || "";
}

function listNames(values = []) {
  return uniqStrings(
    arr(values)
      .map((item) =>
        s(
          item?.title ||
            item?.name ||
            item?.label ||
            item?.serviceName ||
            item?.service_name ||
            item?.productName ||
            item?.product_name ||
            item
        )
      )
      .filter(Boolean)
  );
}

function resolveProjection(profile = {}, runtimeGrounding = {}) {
  const raw = obj(profile?.raw);
  return obj(
    raw?.projection ||
      profile?.projection ||
      runtimeGrounding?.projection ||
      runtimeGrounding?.raw?.projection
  );
}

export function resolveApprovedTruthFacts({
  runtimeGrounding = {},
  profile = {},
} = {}) {
  const projection = resolveProjection(profile, runtimeGrounding);

  const profileJson = obj(projection?.profile_json || projection?.profileJson);
  const identityJson = obj(projection?.identity_json || projection?.identityJson);
  const capabilitiesJson = obj(
    projection?.capabilities_json || projection?.capabilitiesJson
  );
  const contactsJson = arr(projection?.contacts_json || projection?.contactsJson);
  const locationsJson = arr(
    projection?.locations_json || projection?.locationsJson
  );
  const servicesJson = arr(projection?.services_json || projection?.servicesJson);
  const productsJson = arr(projection?.products_json || projection?.productsJson);

  const contactGrounding = obj(runtimeGrounding?.contactGrounding);
  const salesContext = obj(runtimeGrounding?.salesContext);

  const summary = firstText(
    profileJson?.summaryShort,
    profileJson?.summary,
    profileJson?.description,
    profileJson?.businessSummary,
    profileJson?.shortDescription,
    profileJson?.brandSummary,
    profileJson?.summaryLong,
    profileJson?.valueProposition,
    runtimeGrounding?.businessSummary,
    profile?.businessSummary,
    profile?.summary,
    profile?.description
  );

  const displayName = firstText(
    profileJson?.displayName,
    profileJson?.companyName,
    profileJson?.businessName,
    identityJson?.displayName,
    identityJson?.companyName,
    runtimeGrounding?.displayName,
    profile?.displayName,
    profile?.companyName
  );

  const phone = firstText(
    profileJson?.primaryPhone,
    profileJson?.phone,
    contactGrounding?.primaryPhone,
    arr(contactGrounding?.contactPhones)[0],
    pickContactValue(contactsJson, ["phone", "whatsapp"]),
    runtimeGrounding?.primaryPhone
  );

  const email = firstText(
    profileJson?.primaryEmail,
    profileJson?.email,
    contactGrounding?.primaryEmail,
    arr(contactGrounding?.contactEmails)[0],
    pickContactValue(contactsJson, ["email"]),
    runtimeGrounding?.primaryEmail
  );

  const website = firstText(
    profileJson?.websiteUrl,
    profileJson?.website,
    identityJson?.websiteUrl,
    contactGrounding?.websiteUrl,
    arr(contactGrounding?.websiteUrls)[0],
    runtimeGrounding?.websiteUrl,
    arr(runtimeGrounding?.websiteUrls)[0],
    pickContactValue(contactsJson, ["website"])
  );

  const address = firstText(
    profileJson?.primaryAddress,
    profileJson?.address,
    contactGrounding?.primaryAddress,
    arr(contactGrounding?.contactAddresses)[0],
    runtimeGrounding?.primaryAddress,
    pickLocationAddress(locationsJson)
  );

  const services = uniqStrings([
    ...listNames(servicesJson),
    ...listNames(runtimeGrounding?.services),
    ...arr(runtimeGrounding?.activeServiceNames).map((item) => s(item)),
    ...arr(salesContext?.offerNames).map((item) => s(item)),
    ...listNames(salesContext?.keyOffers),
  ]);

  const products = uniqStrings([
    ...listNames(productsJson),
    ...listNames(runtimeGrounding?.products),
    ...arr(runtimeGrounding?.activeProductNames).map((item) => s(item)),
  ]);

  const pricing = firstText(
    profileJson?.pricingGuidance,
    profileJson?.pricingText,
    profileJson?.pricingSummary,
    profileJson?.pricing,
    profileJson?.price,
    profileJson?.pricingMode,
    arr(runtimeGrounding?.pricingHints)[0],
    salesContext?.pricingHint,
    runtimeGrounding?.pricingMode,
    capabilitiesJson?.pricingMode,
    capabilitiesJson?.pricing_mode
  );

  const booking = firstText(
    profileJson?.bookingUrl,
    profileJson?.appointmentUrl,
    profileJson?.bookingMode,
    arr(runtimeGrounding?.bookingLinks)[0],
    runtimeGrounding?.bookingUrl,
    runtimeGrounding?.appointmentUrl,
    runtimeGrounding?.bookingMode,
    runtimeGrounding?.bookingFlowType,
    capabilitiesJson?.bookingMode,
    capabilitiesJson?.booking_mode
  );

  const socialLinks = uniqStrings([
    ...arr(runtimeGrounding?.socialLinks).map((item) => s(item)),
    ...arr(runtimeGrounding?.socialUrls).map((item) => s(item)),
    ...arr(profileJson?.socialLinks).map((item) => s(item)),
    ...arr(profileJson?.socialUrls).map((item) => s(item)),
    ...listContactValues(contactsJson, [
      "instagram",
      "facebook",
      "telegram",
      "whatsapp",
      "tiktok",
      "youtube",
      "linkedin",
    ]),
  ]);

  const behavior = obj(
    profileJson?.nicheBehavior ||
      profileJson?.niche_behavior ||
      capabilitiesJson?.behavior ||
      capabilitiesJson?.nicheBehavior ||
      capabilitiesJson?.niche_behavior
  );

  return {
    displayName,
    summary,
    industry: firstText(
      profileJson?.industry,
      profileJson?.industryKey,
      runtimeGrounding?.industry
    ),
    phone,
    email,
    website,
    address,
    services,
    products,
    pricing,
    booking,
    socialLinks,
    languages: uniqStrings([
      ...arr(runtimeGrounding?.languages).map((item) => s(item)),
      profileJson?.language,
      profileJson?.primaryLanguage,
      profileJson?.mainLanguage,
      capabilitiesJson?.primaryLanguage,
      capabilitiesJson?.primary_language,
    ]).filter(Boolean),
    behavior: {
      tone: firstText(
        behavior?.tone,
        behavior?.replyTone,
        behavior?.reply_tone,
        runtimeGrounding?.toneProfile,
        runtimeGrounding?.tone,
        runtimeGrounding?.replyStyle,
        capabilitiesJson?.replyStyle,
        capabilitiesJson?.reply_style
      ),
      primaryCta: firstText(
        behavior?.primaryCta,
        behavior?.primary_cta,
        profileJson?.primaryCta,
        salesContext?.primaryCta,
        runtimeGrounding?.primaryCta,
        capabilitiesJson?.ctaStyle,
        capabilitiesJson?.cta_style
      ),
      handoffPolicy: firstText(
        behavior?.handoffPolicy,
        behavior?.handoff_policy,
        runtimeGrounding?.handoffPolicy
      ),
    },
  };
}