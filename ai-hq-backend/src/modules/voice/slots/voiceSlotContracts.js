function s(value, fallback = "") {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "object") return fallback;
  return String(value).trim() || fallback;
}

function obj(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function unique(values = []) {
  return [...new Set(arr(values).map((value) => s(value)).filter(Boolean))];
}

export function cleanVoiceSlotPayload(value = {}) {
  const cleaned = Object.fromEntries(
    Object.entries(obj(value)).filter(([, item]) => item !== undefined && item !== null && item !== "")
  );

  if (!s(cleaned.issue) && s(cleaned.description)) {
    cleaned.issue = s(cleaned.description);
  }

  if (!s(cleaned.description) && s(cleaned.issue)) {
    cleaned.description = s(cleaned.issue);
  }

  return cleaned;
}

export function looksLikeUsableVoicePhone(value = "") {
  const raw = s(value);
  const lowered = raw.toLowerCase();

  if (!raw) return false;

  if (
    [
      "browser",
      "browser_lab",
      "browserlab",
      "pre_sip_browser",
      "test",
      "unknown",
      "anonymous",
      "hidden",
      "private",
      "caller",
      "customer",
      "user",
    ].includes(lowered)
  ) {
    return false;
  }

  if (lowered.includes("browser")) return false;

  const digits = raw.replace(/\D+/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function firstUsableVoicePhone(...values) {
  for (const value of values) {
    const phone = s(value);
    if (looksLikeUsableVoicePhone(phone)) return phone;
  }

  return "";
}

export const VOICE_SLOT_DEFINITIONS = Object.freeze({
  intent: {
    key: "intent",
    label: "intent",
    aliases: ["need", "goal", "callerIntent", "caller_intent"],
    pii: false,
    semanticRole: "intent",
  },
  requestType: {
    key: "requestType",
    label: "request type",
    aliases: ["type", "request_type", "kind"],
    pii: false,
    semanticRole: "classification",
  },
  service: {
    key: "service",
    label: "service",
    aliases: ["serviceType", "service_type", "appointmentType", "appointment_type"],
    pii: false,
    semanticRole: "operational_detail",
  },
  product: {
    key: "product",
    label: "product",
    aliases: ["item", "productName", "product_name"],
    pii: false,
    semanticRole: "operational_detail",
  },
  category: {
    key: "category",
    label: "category",
    aliases: ["kind", "segment"],
    pii: false,
    semanticRole: "operational_detail",
  },
  issue: {
    key: "issue",
    label: "issue",
    aliases: ["problem", "fault", "symptom"],
    pii: false,
    semanticRole: "operational_detail",
  },
  description: {
    key: "description",
    label: "description",
    aliases: ["summary", "details", "detail", "note"],
    pii: false,
    semanticRole: "summary",
  },
  date: {
    key: "date",
    label: "date",
    aliases: ["preferredDate", "preferred_date", "bookingDate", "booking_date"],
    pii: false,
    semanticRole: "time_preference",
  },
  time: {
    key: "time",
    label: "time",
    aliases: ["preferredTime", "preferred_time", "bookingTime", "booking_time"],
    pii: false,
    semanticRole: "time_preference",
  },
  preferredDateOrTime: {
    key: "preferredDateOrTime",
    label: "preferred date or time",
    aliases: ["preferred_date_or_time", "preferredSlot", "preferred_slot"],
    satisfiesAny: ["date", "time", "startDate", "endDate"],
    pii: false,
    virtual: true,
    semanticRole: "time_preference",
  },
  startDate: {
    key: "startDate",
    label: "start date",
    aliases: ["start_date", "checkIn", "check_in", "checkin"],
    pii: false,
    semanticRole: "time_preference",
  },
  endDate: {
    key: "endDate",
    label: "end date",
    aliases: ["end_date", "checkOut", "check_out", "checkout"],
    pii: false,
    semanticRole: "time_preference",
  },
  duration: {
    key: "duration",
    label: "duration",
    aliases: ["length", "nights"],
    pii: false,
    semanticRole: "time_preference",
  },
  quantity: {
    key: "quantity",
    label: "quantity",
    aliases: ["count", "qty"],
    pii: false,
    semanticRole: "quantity",
  },
  partySize: {
    key: "partySize",
    label: "party size",
    aliases: ["party_size", "people", "persons", "personCount", "person_count"],
    pii: false,
    semanticRole: "quantity",
  },
  guestCount: {
    key: "guestCount",
    label: "guest count",
    aliases: ["guest_count", "guests"],
    pii: false,
    semanticRole: "quantity",
  },
  roomType: {
    key: "roomType",
    label: "room type",
    aliases: ["room_type", "room"],
    pii: false,
    semanticRole: "operational_detail",
  },
  vehicleMake: {
    key: "vehicleMake",
    label: "vehicle make",
    aliases: ["vehicle_make", "carMake", "car_make", "make", "brand"],
    pii: false,
    semanticRole: "operational_detail",
  },
  vehicleModel: {
    key: "vehicleModel",
    label: "vehicle model",
    aliases: ["vehicle_model", "carModel", "car_model", "model"],
    pii: false,
    semanticRole: "operational_detail",
  },
  vehicleYear: {
    key: "vehicleYear",
    label: "vehicle year",
    aliases: ["vehicle_year", "carYear", "car_year", "year"],
    pii: false,
    semanticRole: "operational_detail",
  },
  licensePlate: {
    key: "licensePlate",
    label: "license plate",
    aliases: ["license_plate", "plate", "carPlate", "car_plate"],
    pii: true,
    semanticRole: "reference",
  },
  location: {
    key: "location",
    label: "location",
    aliases: ["area", "region"],
    pii: false,
    semanticRole: "location",
  },
  address: {
    key: "address",
    label: "address",
    aliases: ["deliveryAddress", "delivery_address", "serviceAddress", "service_address"],
    pii: true,
    semanticRole: "location",
  },
  deliveryArea: {
    key: "deliveryArea",
    label: "delivery area",
    aliases: ["delivery_area", "deliveryZone", "delivery_zone"],
    pii: false,
    semanticRole: "location",
  },
  budget: {
    key: "budget",
    label: "budget",
    aliases: ["priceRange", "price_range"],
    pii: false,
    semanticRole: "qualification",
  },
  urgency: {
    key: "urgency",
    label: "urgency",
    aliases: ["priority"],
    pii: false,
    semanticRole: "priority",
  },
  preferredStaff: {
    key: "preferredStaff",
    label: "preferred staff",
    aliases: ["preferred_staff", "staff"],
    pii: false,
    semanticRole: "operational_detail",
  },
  department: {
    key: "department",
    label: "department",
    aliases: ["team", "dept"],
    pii: false,
    semanticRole: "operational_detail",
  },
  customerName: {
    key: "customerName",
    label: "customer name",
    aliases: ["customer_name", "name", "fullName", "full_name"],
    pii: true,
    semanticRole: "identity",
  },
  phone: {
    key: "phone",
    label: "phone",
    aliases: ["customerPhone", "customer_phone", "callbackPhone", "callback_phone"],
    pii: true,
    semanticRole: "contact",
  },
  email: {
    key: "email",
    label: "email",
    aliases: ["customerEmail", "customer_email"],
    pii: true,
    semanticRole: "contact",
  },
  companyName: {
    key: "companyName",
    label: "company name",
    aliases: ["company_name", "company", "organization"],
    pii: false,
    semanticRole: "identity",
  },
  orderId: {
    key: "orderId",
    label: "order id",
    aliases: ["order_id", "orderNumber", "order_number"],
    pii: false,
    semanticRole: "reference",
  },
  bookingId: {
    key: "bookingId",
    label: "booking id",
    aliases: ["booking_id", "reservationId", "reservation_id"],
    pii: false,
    semanticRole: "reference",
  },
  ticketId: {
    key: "ticketId",
    label: "ticket id",
    aliases: ["ticket_id", "caseId", "case_id"],
    pii: false,
    semanticRole: "reference",
  },
  items: {
    key: "items",
    label: "items",
    aliases: ["orderItems", "order_items"],
    pii: false,
    semanticRole: "operational_detail",
  },
  fulfillment: {
    key: "fulfillment",
    label: "fulfillment",
    aliases: ["deliveryMode", "delivery_mode", "pickupOrDelivery", "pickup_or_delivery"],
    pii: false,
    semanticRole: "operational_detail",
  },
  reason: {
    key: "reason",
    label: "reason",
    aliases: ["handoffReason", "handoff_reason"],
    pii: false,
    semanticRole: "intent",
  },
  summary: {
    key: "summary",
    label: "summary",
    aliases: ["shortSummary", "short_summary"],
    pii: false,
    semanticRole: "summary",
  },
  notes: {
    key: "notes",
    label: "notes",
    aliases: ["additionalNotes", "additional_notes"],
    pii: false,
    semanticRole: "summary",
  },
  language: {
    key: "language",
    label: "language",
    aliases: ["locale", "lang"],
    pii: false,
    semanticRole: "language",
  },
});

export const VOICE_SLOT_KEYS = Object.freeze(Object.keys(VOICE_SLOT_DEFINITIONS));

export function getVoiceSlotDefinition(field = "") {
  return VOICE_SLOT_DEFINITIONS[s(field)] || null;
}

export function getVoiceSlotDescriptor(field = "") {
  const key = s(field);
  const slot = getVoiceSlotDefinition(key);

  return {
    field: key,
    label: s(slot?.label || key),
    pii: slot?.pii === true,
    virtual: slot?.virtual === true,
    semanticRole: s(slot?.semanticRole || "detail"),
    acceptedFields: unique(slot?.satisfiesAny?.length ? slot.satisfiesAny : [key, ...arr(slot?.aliases)]),
  };
}

export function getVoiceSlotPromptHint(field = "") {
  const descriptor = getVoiceSlotDescriptor(field);

  return {
    type: "missing_slot",
    field: descriptor.field,
    label: descriptor.label,
    semanticRole: descriptor.semanticRole,
    pii: descriptor.pii,
    acceptedFields: descriptor.acceptedFields,
  };
}

export function getVoiceMissingSlot(field = "") {
  const descriptor = getVoiceSlotDescriptor(field);

  return {
    ...descriptor,
    promptHint: getVoiceSlotPromptHint(field),
  };
}

function readDirectSlotValue(payload = {}, slot = {}) {
  const keys = [slot.key, ...arr(slot.aliases)];

  if (slot.key === "phone") {
    return firstUsableVoicePhone(...keys.map((key) => payload[key]));
  }

  for (const key of keys) {
    const value = payload[key];

    if (Array.isArray(value)) {
      if (value.length) return value;
      continue;
    }

    if (value && typeof value === "object") {
      continue;
    }

    if (s(value)) return value;
  }

  return "";
}

export function readVoiceSlotValue(payload = {}, field = "", seen = new Set()) {
  const key = s(field);
  if (!key || seen.has(key)) return "";

  seen.add(key);

  const slot = getVoiceSlotDefinition(key);
  if (!slot) return "";

  if (slot.virtual === true) {
    return arr(slot.satisfiesAny).some((candidate) => readVoiceSlotValue(payload, candidate, seen) !== "")
      ? true
      : "";
  }

  return readDirectSlotValue(obj(payload), slot);
}

export function hasVoiceSlot(payload = {}, field = "") {
  return readVoiceSlotValue(payload, field) !== "";
}

export function hasAnyVoiceSlot(payload = {}, fields = []) {
  return arr(fields).some((field) => hasVoiceSlot(payload, field));
}

export function collectVoiceSlots(payload = {}, fields = VOICE_SLOT_KEYS) {
  const data = cleanVoiceSlotPayload(payload);
  const collected = {};

  for (const field of arr(fields)) {
    const slot = getVoiceSlotDefinition(field);
    if (!slot || slot.virtual === true) continue;

    const value = readVoiceSlotValue(data, field);
    if (value !== "") collected[field] = value;
  }

  return collected;
}

export function readVoicePhoneFromSources({ payload = {}, call = {} } = {}) {
  const data = obj(payload);

  return firstUsableVoicePhone(
    data.phone,
    data.customerPhone,
    data.customer_phone,
    data.callbackPhone,
    data.callback_phone,
    call.fromNumber,
    call.from_number,
    call.from,
    call.phone,
    call.customerNumber,
    call.customer_number
  );
}

export function voiceRequirementSatisfied({ field = "", payload = {}, phone = "" } = {}) {
  const key = s(field);
  const data = obj(payload);

  if (!key) return true;

  if (key.includes("|")) {
    return key.split("|").some((part) =>
      voiceRequirementSatisfied({ field: part, payload: data, phone })
    );
  }

  if (key === "description") {
    return hasAnyVoiceSlot(data, ["description", "intent", "issue", "service", "product"]);
  }

  if (key === "preferredDateOrTime") {
    return hasAnyVoiceSlot(data, ["date", "time", "startDate", "endDate"]);
  }

  if (key === "service") {
    return hasAnyVoiceSlot(data, ["service", "department"]);
  }

  if (key === "phone") {
    return !!s(phone) || !!readVoiceSlotValue(data, "phone");
  }

  if (key === "requestType") {
    return !!s(data.requestType || data.request_type || data.type);
  }

  return hasVoiceSlot(data, key);
}

export function buildVoiceMissingSlots({ required = [], payload = {}, phone = "" } = {}) {
  return arr(required)
    .filter((field) => !voiceRequirementSatisfied({ field, payload, phone }))
    .map((field) => getVoiceMissingSlot(field));
}
