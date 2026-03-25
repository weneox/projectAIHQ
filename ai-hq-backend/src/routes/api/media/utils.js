import path from "path";

export function clean(x) {
  return String(x || "").trim();
}

export function lower(x) {
  return clean(x).toLowerCase();
}

export function positiveNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function isObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function arr(v) {
  return Array.isArray(v) ? v : [];
}

export function getAuthTenantKey(req) {
  return lower(
    req?.auth?.tenantKey ||
      req?.auth?.tenant_key ||
      req?.user?.tenantKey ||
      req?.user?.tenant_key ||
      req?.tenant?.key ||
      ""
  );
}

export function normalizeAspectRatio(x) {
  const v = clean(x);
  if (v === "9:16" || v === "4:5" || v === "1:1") return v;
  return "1:1";
}

export function normalizeVisualPreset(x) {
  const v = clean(x);
  if (
    v === "robotic_unit" ||
    v === "ai_core" ||
    v === "automation_device" ||
    v === "abstract_tech_scene"
  ) {
    return v;
  }
  return "";
}

export function pickDimsFromAspectRatio(aspectRatio) {
  const ar = normalizeAspectRatio(aspectRatio);
  if (ar === "9:16") return { width: 1080, height: 1920 };
  if (ar === "4:5") return { width: 1080, height: 1350 };
  return { width: 1080, height: 1080 };
}

export function normalizeSlidesInput(slides = [], fallback = {}) {
  return arr(slides)
    .map((slide, i) => {
      const x = isObject(slide) ? slide : {};
      const aspectRatio = normalizeAspectRatio(
        x.aspectRatio || x?.visualMeta?.aspectRatio || fallback.aspectRatio || "1:1"
      );

      return {
        title: clean(x.title || x.headline || x.text || `Slide ${i + 1}`),
        subtitle: clean(x.subtitle || x.subline || x.kicker || ""),
        cta: clean(x.cta || fallback.cta || ""),
        badge: clean(x.badge || fallback.badge || "BRAND"),
        align: clean(x.align || fallback.align || "left"),
        theme: clean(x.theme || fallback.theme || "premium_dark"),
        slideNumber: Number(x.slideNumber || i + 1),
        totalSlides: Number(x.totalSlides || slides.length || 1),
        bgImageUrl: clean(
          x.bgImageUrl ||
            x.backgroundUrl ||
            x.imageUrl ||
            x.image_url ||
            x.url ||
            ""
        ),
        logoText: clean(
          x.logoText || x.brandName || fallback.logoText || fallback.brandName || "BRAND"
        ),
        language: lower(x.language || x.lang || fallback.language || "az") || "az",
        aspectRatio,
        renderHints: {
          layoutFamily:
            clean(x?.renderHints?.layoutFamily || fallback?.renderHints?.layoutFamily) ||
            "editorial_left",
          textPosition:
            clean(x?.renderHints?.textPosition || x.align || fallback?.renderHints?.textPosition) ||
            "left",
          safeArea:
            clean(x?.renderHints?.safeArea || fallback?.renderHints?.safeArea) ||
            "left-heavy",
          overlayStrength:
            clean(
              x?.renderHints?.overlayStrength || fallback?.renderHints?.overlayStrength
            ) || "medium",
          focalBias:
            clean(x?.renderHints?.focalBias || fallback?.renderHints?.focalBias) || "right",
        },
      };
    })
    .filter((x) => x.title);
}

export function buildCarouselPaths(tenantKey) {
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const renderDir = path.join(uploadsDir, "renders", tenantKey || "public");
  return { uploadsDir, renderDir };
}
