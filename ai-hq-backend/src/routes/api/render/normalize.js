import {
  asObj,
  asArr,
  clean,
  normalizeAspectRatio,
  normalizeFormat,
  pickAspectRatioFromFormat,
} from "./utils.js";

export function pickSlides(body) {
  const b = asObj(body);

  const directSlides = asArr(b.slides);
  if (directSlides.length) return directSlides;

  const contentPackSlides = asArr(asObj(b.contentPack).slides);
  if (contentPackSlides.length) return contentPackSlides;

  const payloadSlides = asArr(asObj(b.payload).slides);
  if (payloadSlides.length) return payloadSlides;

  const proposalPayloadSlides = asArr(asObj(asObj(b.proposal).payload).slides);
  if (proposalPayloadSlides.length) return proposalPayloadSlides;

  const resultSlides = asArr(asObj(b.result).slides);
  if (resultSlides.length) return resultSlides;

  const resultContentPackSlides = asArr(asObj(asObj(b.result).contentPack).slides);
  if (resultContentPackSlides.length) return resultContentPackSlides;

  return [];
}

export function pickTopLevelSources(body) {
  const b = asObj(body);

  const contentPack = asObj(b.contentPack);
  const payload = asObj(b.payload);
  const proposalPayload = asObj(asObj(b.proposal).payload);
  const result = asObj(b.result);
  const resultContentPack = asObj(result.contentPack);

  return { b, contentPack, payload, proposalPayload, result, resultContentPack };
}

export function pickFormat(body) {
  const { b, contentPack, payload, proposalPayload, result, resultContentPack } =
    pickTopLevelSources(body);

  return normalizeFormat(
    b.format ||
      contentPack.format ||
      payload.format ||
      proposalPayload.format ||
      result.format ||
      resultContentPack.format ||
      "carousel"
  );
}

export function pickAspectRatio(body, format) {
  const { b, contentPack, payload, proposalPayload, result, resultContentPack } =
    pickTopLevelSources(body);

  return normalizeAspectRatio(
    b.aspectRatio ||
      asObj(contentPack.visualPlan).aspectRatio ||
      contentPack.aspectRatio ||
      asObj(payload.visualPlan).aspectRatio ||
      payload.aspectRatio ||
      asObj(proposalPayload.visualPlan).aspectRatio ||
      proposalPayload.aspectRatio ||
      asObj(result.visualPlan).aspectRatio ||
      result.aspectRatio ||
      asObj(resultContentPack.visualPlan).aspectRatio ||
      resultContentPack.aspectRatio ||
      pickAspectRatioFromFormat(format),
    format
  );
}

export function pickGlobalLogoText(body) {
  const { b, contentPack, payload, proposalPayload, result, resultContentPack } =
    pickTopLevelSources(body);

  return clean(
    b.logoText ||
      b.brandName ||
      asObj(b.brand).logoText ||
      asObj(b.brand).name ||
      contentPack.logoText ||
      contentPack.brandName ||
      payload.logoText ||
      payload.brandName ||
      proposalPayload.logoText ||
      proposalPayload.brandName ||
      result.logoText ||
      result.brandName ||
      resultContentPack.logoText ||
      resultContentPack.brandName ||
      "Brand"
  );
}

export function pickGlobalBadge(body) {
  const { b, contentPack, payload, proposalPayload, result, resultContentPack } =
    pickTopLevelSources(body);

  return clean(
    b.badge ||
      contentPack.badge ||
      payload.badge ||
      proposalPayload.badge ||
      result.badge ||
      resultContentPack.badge ||
      ""
  );
}

export function pickGlobalCta(body) {
  const { b, contentPack, payload, proposalPayload, result, resultContentPack } =
    pickTopLevelSources(body);

  return clean(
    b.cta ||
      contentPack.cta ||
      payload.cta ||
      proposalPayload.cta ||
      result.cta ||
      resultContentPack.cta ||
      "Contact us for details"
  );
}

export function pickGlobalTitleFallback(body) {
  const { b, contentPack, payload, proposalPayload, result, resultContentPack } =
    pickTopLevelSources(body);

  return clean(
    b.title ||
      contentPack.topic ||
      contentPack.title ||
      payload.topic ||
      payload.title ||
      proposalPayload.topic ||
      proposalPayload.title ||
      result.topic ||
      result.title ||
      resultContentPack.topic ||
      resultContentPack.title ||
      "Untitled Slide"
  );
}

export function pickGlobalSubtitleFallback(body) {
  const { b, contentPack, payload, proposalPayload, result, resultContentPack } =
    pickTopLevelSources(body);

  return clean(
    b.subtitle ||
      contentPack.hook ||
      payload.hook ||
      proposalPayload.hook ||
      result.hook ||
      resultContentPack.hook ||
      ""
  );
}

export function pickBgImageUrl(slide) {
  const s = asObj(slide);
  const visualMeta = asObj(s.visualMeta);
  const media = asObj(s.media);
  const asset = asObj(s.asset);
  const image = asObj(s.image);

  return clean(
    s.bgImageUrl ||
      s.backgroundUrl ||
      s.backgroundImageUrl ||
      s.imageUrl ||
      s.coverUrl ||
      s.assetUrl ||
      s.url ||
      visualMeta.bgImageUrl ||
      visualMeta.backgroundUrl ||
      visualMeta.imageUrl ||
      media.bgImageUrl ||
      media.backgroundUrl ||
      media.imageUrl ||
      media.url ||
      asset.url ||
      image.url ||
      ""
  );
}

export function normalizeRenderHints(slide) {
  const s = asObj(slide);
  const rh = asObj(s.renderHints);

  return {
    layoutFamily: clean(rh.layoutFamily || "editorial_left") || "editorial_left",
    textPosition: clean(rh.textPosition || s.align || "left") || "left",
    safeArea: clean(rh.safeArea || "left-heavy") || "left-heavy",
    overlayStrength: clean(rh.overlayStrength || "medium") || "medium",
    focalBias: clean(rh.focalBias || "right") || "right",
  };
}

export function normalizeSlides(rawSlides, body) {
  const format = pickFormat(body);
  const aspectRatio = pickAspectRatio(body, format);
  const globalLogoText = pickGlobalLogoText(body);
  const globalBadge = pickGlobalBadge(body);
  const globalCta = pickGlobalCta(body);
  const globalTitleFallback = pickGlobalTitleFallback(body);
  const globalSubtitleFallback = pickGlobalSubtitleFallback(body);

  const total = asArr(rawSlides).length;

  return asArr(rawSlides).map((slide, i) => {
    const s = asObj(slide);
    const slideNumber = Number(s.slideNumber || s.index || i + 1) || i + 1;
    const totalSlides = Number(s.totalSlides || total) || total;

    const defaultBadge =
      format === "reel"
        ? "REEL"
        : slideNumber === 1
        ? globalBadge || globalLogoText
        : slideNumber === totalSlides
        ? "CTA"
        : "SLIDE";

    return {
      ...s,
      title: clean(s.title || s.headline || s.text || globalTitleFallback || "Untitled Slide"),
      subtitle: clean(
        s.subtitle || s.subline || s.kicker || globalSubtitleFallback || ""
      ),
      cta: clean(s.cta || (slideNumber === totalSlides ? globalCta : "")),
      badge: clean(s.badge || defaultBadge),
      logoText: clean(s.logoText || globalLogoText || "Brand"),
      align: clean(s.align || "left") || "left",
      theme: clean(s.theme || "brand_dark") || "brand_dark",
      slideNumber,
      totalSlides,
      aspectRatio: normalizeAspectRatio(
        s.aspectRatio || asObj(s.visualMeta).aspectRatio || aspectRatio,
        format
      ),
      bgImageUrl: pickBgImageUrl(s),
      renderHints: normalizeRenderHints(s),
    };
  });
}