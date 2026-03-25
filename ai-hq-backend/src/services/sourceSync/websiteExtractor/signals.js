import { arr, compactText, lower, s, uniq, uniqBy } from "./shared.js";
import {
  meaningfulLines,
  sanitizePricingHint,
  sanitizeServiceHint,
} from "./text.js";

const PHONE_CONTEXT_RE =
  /\b(phone|tel|telephone|call|contact|hotline|mobile|whatsapp|office|support|əlaqə|elaqe|telefon|nömrə|nomre|номер|контакт|звонок)\b/i;

const DATEISH_CONTEXT_RE =
  /\b(date|updated|published|post|news|blog|article|tarix|yenilənib|yenilenib|новость|дата)\b/i;

const ADDRESS_CONTEXT_RE =
  /\b(address|office|location|ünvan|unvan|filial|branch|street|st\.?|avenue|ave|road|rd\.?|boulevard|blvd|building|floor|suite|district|rayon|city|baku|bakı|azerbaijan|azərbaycan|küçə|kuce|küçəsi|prospekt|pr\.?|plaza|center|centre|mkr|mikrorayon|mall|tower|blok|block)\b/i;

const ADDRESS_STRONG_PATTERN_RE =
  /\b(street|st\.?|avenue|ave|road|rd\.?|boulevard|blvd|building|floor|suite|küçə|kuce|küçəsi|prospekt|plaza|rayon|district|blok|block|tower|mall)\b/i;

const ADDRESS_NEGATIVE_RE =
  /\b(mastercard|visa|cashback|bonus|kampaniya|campaign|loan|credit|kredit|mortgage|ipoteka|deposit|depozit|kart|offer|təklif|teklif|exclusive|üstünlükləri|ustunlukleri|service|services|xidmət|xidmet|faq|privacy|policy|cookie|blog|news|press|story|career|vacancy|job|login|register|sign in)\b/i;

const SOCIAL_TEXT_RE =
  /\b(instagram|facebook|linkedin|youtube|tiktok|telegram|whatsapp|twitter|x\.com)\b/i;

const HOURS_CONTEXT_RE =
  /\b(hours|working hours|open|closed|daily|weekend|business hours|opening hours|operating hours|iş saat|is saat|iş vaxt|qrafik|grafik|режим работы|график|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|bazar ertəsi|bazar ertesi|çərşənbə axşamı|cersenbe axsami|çərşənbə|cersenbe|cümə axşamı|cume axsami|cümə|cume|şənbə|senbe|bazar|monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/i;

const WEEKDAY_RE =
  /\b(mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?|sun(day)?|bazar ertəsi|bazar ertesi|çərşənbə axşamı|cersenbe axsami|çərşənbə|cersenbe|cümə axşamı|cume axsami|cümə|cume|şənbə|senbe|bazar|понедельник|вторник|среда|четверг|пятница|суббота|воскресенье)\b/i;

const CLOCK_TOKEN_RE =
  /(\d{1,2}[:.]\d{2}|\b\d{1,2}\s\d{2}\b|\b\d{1,2}\s?(am|pm)\b|24\/7)/i;

const GENERIC_SOCIAL_PATH_RE =
  /\/(share|sharer|intent|watch|reel|reels|stories|explore|home|search|dialog|login|policy|privacy|plugins|events)(\/|$)/i;

const GENERIC_SOCIAL_HOST_RE =
  /^(m\.)?(instagram\.com|facebook\.com|linkedin\.com|youtube\.com|youtu\.be|tiktok\.com|telegram\.me|t\.me|x\.com|twitter\.com|wa\.me|whatsapp\.com)$/i;

function decodeHtmlEntities(text = "") {
  const value = s(text);
  if (!value) return "";

  return value
    .replace(/&#(\d+);?/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    })
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => {
      const n = Number.parseInt(code, 16);
      return Number.isFinite(n) ? String.fromCharCode(n) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

export function normalizeVisibleText(value = "", max = 0) {
  let x = decodeHtmlEntities(value)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

  if (!x) return "";
  return max > 0 ? compactText(x, max) : x;
}

function digitsOnly(value = "") {
  return s(value).replace(/\D/g, "");
}

function hasMultipleClockTokens(value = "") {
  const matches = normalizeVisibleText(value).match(
    /(\d{1,2}[:.]\d{2}|\b\d{1,2}\s\d{2}\b|\b\d{1,2}\s?(am|pm)\b|24\/7)/gi
  );
  return arr(matches).length >= 2;
}

export function looksLikeOperationalHoursLine(value = "") {
  const x = normalizeVisibleText(value, 220);
  if (!x) return false;

  if (HOURS_CONTEXT_RE.test(x) && CLOCK_TOKEN_RE.test(x)) return true;
  if (WEEKDAY_RE.test(x) && (CLOCK_TOKEN_RE.test(x) || /fəaliyyət göstərmir|fealiyyet gostermir|closed|выходной/i.test(x))) {
    return true;
  }
  if (hasMultipleClockTokens(x) && /(open|closed|daily|iş saat|is saat|business hours|weekend|weekday|bazar|şənbə|senbe|понедельник|воскресенье|monday|sunday)/i.test(x)) {
    return true;
  }

  return false;
}

function looksLikeDateishNumber(value = "", contextLine = "") {
  const raw = s(value);
  const digits = digitsOnly(raw);

  if (!digits) return true;
  if (digits.length < 7 || digits.length > 15) return true;

  if (!raw.startsWith("+") && /^20\d{6,12}$/.test(digits)) return true;
  if (!raw.startsWith("+") && /^\d{8}$/.test(digits) && /^20\d{6}$/.test(digits)) {
    return true;
  }

  if (!raw.startsWith("+") && DATEISH_CONTEXT_RE.test(contextLine)) return true;

  return false;
}

export function normalizePhone(raw = "") {
  let x = normalizeVisibleText(raw);
  if (!x) return "";

  x = x.replace(/^(tel:|callto:|sms:|whatsapp:)/i, "");
  x = x.split(/[?#;]/)[0];
  x = x.replace(/[^\d+]/g, "");

  if (x.startsWith("00")) x = `+${x.slice(2)}`;

  const digits = digitsOnly(x);
  if (digits.length < 7 || digits.length > 15) return "";

  return x || "";
}

export function extractEmails(text = "") {
  return uniq(
    (normalizeVisibleText(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []).map((x) =>
      s(x).toLowerCase()
    )
  ).slice(0, 20);
}

export function extractPhones(text = "") {
  const out = [];
  const lineCandidates = meaningfulLines(normalizeVisibleText(text), 180).filter(
    (x) => x.length >= 6 && x.length <= 220
  );

  for (const line of lineCandidates) {
    const value = normalizeVisibleText(line, 220);
    if (!value) continue;

    const hasContext = PHONE_CONTEXT_RE.test(value);
    const matches = value.match(/(?:\+?\d[\d\s\-()]{5,}\d)/g) || [];

    for (const raw of matches) {
      const normalized = normalizePhone(raw);
      if (!normalized) continue;
      if (looksLikeDateishNumber(normalized, value)) continue;

      const digits = digitsOnly(normalized);

      if (!hasContext && !normalized.startsWith("+")) {
        if (digits.length < 10) continue;
      }

      out.push(normalized);
    }
  }

  return uniq(out).slice(0, 20);
}

export function detectSocialPlatform(url = "") {
  const x = lower(url);
  if (x.includes("instagram.com")) return "instagram";
  if (x.includes("facebook.com")) return "facebook";
  if (x.includes("linkedin.com")) return "linkedin";
  if (x.includes("tiktok.com")) return "tiktok";
  if (x.includes("youtube.com") || x.includes("youtu.be")) return "youtube";
  if (x.includes("telegram.me") || x.includes("t.me")) return "telegram";
  if (x.includes("wa.me") || x.includes("whatsapp.com")) return "whatsapp";
  if (x.includes("x.com") || x.includes("twitter.com")) return "x";
  return "";
}

function normalizeSocialUrl(url = "") {
  try {
    const u = new URL(url);
    u.hash = "";

    const dropParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "igshid",
      "mibextid",
      "si",
      "feature",
      "ref",
      "refsrc",
    ];

    for (const key of [...u.searchParams.keys()]) {
      const lk = lower(key);
      if (dropParams.includes(lk) || lk.startsWith("utm_")) {
        u.searchParams.delete(key);
      }
    }

    if (u.pathname !== "/") u.pathname = u.pathname.replace(/\/+$/, "");
    u.search = u.searchParams.toString() ? `?${u.searchParams.toString()}` : "";
    return u.toString();
  } catch {
    return s(url);
  }
}

function getMeaningfulPathSegments(url = "") {
  try {
    const u = new URL(url);
    return u.pathname
      .split("/")
      .map((x) => s(x))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function isGenericSocialUrl(url = "", platform = "") {
  const x = lower(url);
  const parts = getMeaningfulPathSegments(url);

  if (!platform) return true;
  if (GENERIC_SOCIAL_PATH_RE.test(x)) return true;

  if (platform === "instagram") {
    if (!parts.length) return true;
    if (["p", "reel", "reels", "stories", "explore", "accounts"].includes(lower(parts[0]))) {
      return true;
    }
    return false;
  }

  if (platform === "facebook") {
    if (!parts.length) return true;
    if (
      ["share", "sharer", "dialog", "login", "watch", "events", "plugins", "policy", "privacy"].includes(
        lower(parts[0])
      )
    ) {
      return true;
    }
    return false;
  }

  if (platform === "linkedin") {
    if (!parts.length) return true;
    if (!["company", "in", "school", "showcase"].includes(lower(parts[0]))) return true;
    return parts.length < 2;
  }

  if (platform === "tiktok") {
    return !(parts[0] && parts[0].startsWith("@"));
  }

  if (platform === "youtube") {
    if (x.includes("youtu.be/")) return true;
    if (!parts.length) return true;
    if (["@", "channel", "c", "user"].includes(lower(parts[0]))) return parts.length < 2;
    return !String(parts[0] || "").startsWith("@");
  }

  if (platform === "telegram") {
    if (!parts.length) return true;
    if (["share", "s", "joinchat"].includes(lower(parts[0]))) return true;
    return false;
  }

  if (platform === "x") {
    if (!parts.length) return true;
    if (["intent", "share", "home", "explore", "search", "i"].includes(lower(parts[0]))) {
      return true;
    }
    return false;
  }

  if (platform === "whatsapp") {
    if (x.includes("wa.me/")) return false;
    if (x.includes("whatsapp.com/send")) return false;
    return true;
  }

  return false;
}

function extractSocialHandle(url = "", platform = "") {
  const parts = getMeaningfulPathSegments(url);
  if (!parts.length) return "";

  if (platform === "instagram") return s(parts[0]).replace(/^@/, "");
  if (platform === "facebook") return s(parts[0]).replace(/^@/, "");
  if (platform === "linkedin") return s(parts[1] || "").replace(/^@/, "");
  if (platform === "tiktok") return s(parts[0]).replace(/^@/, "");
  if (platform === "youtube") {
    if (String(parts[0] || "").startsWith("@")) return s(parts[0]).replace(/^@/, "");
    return s(parts[1] || "");
  }
  if (platform === "telegram") return s(parts[0]).replace(/^@/, "");
  if (platform === "x") return s(parts[0]).replace(/^@/, "");

  return "";
}

function socialLinkScore(item = {}) {
  let score = 0;
  if (item.handle) score += 6;
  if (!item.url.includes("?")) score += 1;
  if (item.platform === "linkedin" && /\/company\//i.test(item.url)) score += 3;
  if (item.platform === "youtube" && /\/@/i.test(item.url)) score += 3;
  if (item.platform === "tiktok" && /\/@/i.test(item.url)) score += 3;
  if (item.platform === "instagram" && !/\/(p|reel|stories)\//i.test(item.url)) score += 3;
  if (item.platform === "facebook" && !/\/(share|sharer|dialog|watch)\//i.test(item.url)) {
    score += 2;
  }

  try {
    const u = new URL(item.url);
    if (!GENERIC_SOCIAL_HOST_RE.test(u.host)) score -= 3;
  } catch {}

  return score;
}

export function extractSocialLinks(links = []) {
  const candidates = [];

  for (const rawUrl of arr(links)) {
    const cleanUrl = normalizeSocialUrl(rawUrl);
    const platform = detectSocialPlatform(cleanUrl);
    if (!platform || !cleanUrl) continue;
    if (isGenericSocialUrl(cleanUrl, platform)) continue;

    const handle = extractSocialHandle(cleanUrl, platform);

    candidates.push({
      platform,
      url: cleanUrl,
      handle: handle || undefined,
      label: handle ? `${platform}: ${handle}` : cleanUrl,
    });
  }

  return uniqBy(
    candidates.sort(
      (a, b) => socialLinkScore(b) - socialLinkScore(a) || a.url.localeCompare(b.url)
    ),
    (x) => x.platform
  ).slice(0, 20);
}

export function extractWhatsappLinks(links = []) {
  return uniq(
    arr(links)
      .filter((url) => /(wa\.me|whatsapp\.com\/send)/i.test(s(url)))
      .map((url) => normalizeSocialUrl(url))
      .filter(Boolean)
  ).slice(0, 10);
}

export function extractBookingLinks(links = [], anchorRecords = []) {
  const urlMatches = arr(links).filter((url) =>
    /(book|booking|schedule|appointment|calendar|calendly|consultation|demo|reserve|reservation)/i.test(
      s(url)
    )
  );

  const textMatches = arr(anchorRecords)
    .filter(
      (x) =>
        /(book|booking|schedule|appointment|calendar|calendly|consultation|demo|reserve|reservation|get started|start now|request quote|contact us)/i.test(
          `${s(x.text)} ${s(x.title)}`
        ) ||
        /(book|booking|schedule|appointment|calendar|calendly|consultation|demo|reserve|reservation)/i.test(
          s(x.url)
        )
    )
    .map((x) => x.url)
    .filter((x) => /^https?:/i.test(s(x)));

  return uniq([...urlMatches, ...textMatches]).slice(0, 12);
}

function addressSignalScore(line = "") {
  const value = normalizeVisibleText(line, 180);
  const l = lower(value);
  let score = 0;

  if (ADDRESS_CONTEXT_RE.test(value)) score += 4;
  if (ADDRESS_STRONG_PATTERN_RE.test(value)) score += 3;
  if (/(baku|bakı|azerbaijan|azərbaycan|rayon|district)/i.test(value)) score += 2;
  if (/\d/.test(value)) score += 1;
  if (/[.,/-]/.test(value)) score += 1;

  if (ADDRESS_NEGATIVE_RE.test(value)) score -= 5;
  if (SOCIAL_TEXT_RE.test(value)) score -= 3;
  if (/(https?:\/\/|@|\+?\d[\d\s()-]{6,})/i.test(value)) score -= 2;
  if (value.split(/\s+/).filter(Boolean).length > 24) score -= 2;
  if (/^[a-z0-9\s-]+$/i.test(value) && !/\d/.test(value) && !ADDRESS_CONTEXT_RE.test(value)) {
    score -= 1;
  }
  if (looksLikeOperationalHoursLine(value)) score -= 8;

  if (
    /(artıq|daha çox|üstünlükləri|ustunlukleri|kampaniya|offer|təklif|teklif|xüsusi xidmət|xususi xidmet)/i.test(
      l
    )
  ) {
    score -= 6;
  }

  return score;
}

export function looksLikeAddressLine(line = "") {
  const value = normalizeVisibleText(line, 180);
  if (!value || value.length < 10 || value.length > 180) return false;
  if (/\?$/.test(value)) return false;
  if (looksLikeOperationalHoursLine(value)) return false;

  const strong =
    ADDRESS_CONTEXT_RE.test(value) ||
    (/\d/.test(value) && ADDRESS_STRONG_PATTERN_RE.test(value)) ||
    (/(baku|bakı|azerbaijan|azərbaycan|rayon|district)/i.test(value) && /\d/.test(value));

  if (!strong) return false;
  if (ADDRESS_NEGATIVE_RE.test(value) && !ADDRESS_CONTEXT_RE.test(value)) return false;

  return addressSignalScore(value) >= 4;
}

export function extractAddresses(text = "") {
  const out = [];
  const lineCandidates = meaningfulLines(normalizeVisibleText(text), 180);

  for (const line of lineCandidates) {
    const cleaned = normalizeVisibleText(line, 180);
    if (!looksLikeAddressLine(cleaned)) continue;
    out.push(compactText(cleaned, 180));
  }

  return uniq(out).slice(0, 10);
}

export function extractHours(text = "") {
  const out = [];
  const lineCandidates = meaningfulLines(normalizeVisibleText(text), 140).filter(
    (x) => x.length >= 6 && x.length <= 180
  );

  for (const line of lineCandidates) {
    const value = normalizeVisibleText(line, 180);
    const lowered = lower(value);

    if (
      (
        /\b(hours|working hours|open|closed|mon|tue|wed|thu|fri|sat|sun|monday|friday|daily|weekend|iş saat|is saat|iş vaxt|business hours|opening hours|operating hours)\b/i.test(
          lowered
        ) &&
        CLOCK_TOKEN_RE.test(lowered)
      ) ||
      looksLikeOperationalHoursLine(lowered)
    ) {
      if (/(price|pricing|package|plan|qiymət|qiymet)/i.test(lowered)) continue;
      out.push(compactText(value, 180));
    }
  }

  return uniq(out).slice(0, 10);
}

export function sanitizeServiceCandidate(text = "") {
  const value = normalizeVisibleText(sanitizeServiceHint(text), 140);
  if (!value) return "";

  if (looksLikeAddressLine(value)) return "";
  if (looksLikeOperationalHoursLine(value)) return "";
  if (/\b(\+?\d[\d\s()-]{6,}|@)\b/.test(value)) return "";
  if (/(privacy|policy|cookie|terms|conditions|refund|return|shipping)/i.test(value)) return "";
  if (/(mon|tue|wed|thu|fri|sat|sun|hours|iş saat|business hours)/i.test(value)) return "";
  if (/(price|pricing|plan|package|qiymət|qiymet)/i.test(value) && /\d/.test(value)) return "";
  if (ADDRESS_NEGATIVE_RE.test(value)) return "";

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 10) return "";

  return value;
}

export function sanitizePricingCandidate(text = "") {
  const value = normalizeVisibleText(sanitizePricingHint(text), 160);
  if (!value) return "";
  if (looksLikeAddressLine(value)) return "";
  if (looksLikeOperationalHoursLine(value)) return "";
  if (/\b(\+?\d[\d\s()-]{6,}|@)\b/.test(value)) return "";
  return value;
}

export function extractEmailsFromAnchors(anchorRecords = []) {
  return uniq(
    arr(anchorRecords)
      .map((x) => s(x?.url))
      .filter((x) => /^mailto:/i.test(x))
      .map((x) => x.replace(/^mailto:/i, "").split("?")[0].trim().toLowerCase())
      .filter(Boolean)
  ).slice(0, 20);
}

export function extractPhonesFromAnchors(anchorRecords = []) {
  return uniq(
    arr(anchorRecords)
      .map((x) => s(x?.url))
      .filter((x) => /^tel:/i.test(x))
      .map((x) => normalizePhone(x.replace(/^tel:/i, "")))
      .filter((x) => x.length >= 7)
      .filter((x) => !looksLikeDateishNumber(x))
  ).slice(0, 20);
}

export function extractPrimaryCta(anchorRecords = []) {
  const matches = arr(anchorRecords)
    .filter(
      (x) =>
        !/(menu|search|login|sign in|read more|learn more|details|privacy|policy|cookie)/i.test(
          `${s(x.text)} ${s(x.title)}`
        )
    )
    .filter(
      (x) =>
        /(book|schedule|appointment|get started|start now|contact us|request quote|demo|consultation|shop now|order now|call now)/i.test(
          `${s(x.text)} ${s(x.title)}`
        )
    )
    .map((x) => ({ label: compactText(normalizeVisibleText(s(x.text || x.title), 80), 80), url: s(x.url) }))
    .filter((x) => x.label || x.url);

  return matches[0] || null;
}