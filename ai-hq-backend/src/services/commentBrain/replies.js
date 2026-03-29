import { lower, normalizeLang, s } from "./shared.js";
import {
  getCommentChannelBehavior,
  getTenantBannedPhrases,
  getTenantConversionGoal,
  getTenantPrimaryCta,
  getTenantPreferredCta,
  getTenantTone,
  getTenantToneProfile,
} from "./runtime.js";

export function applyBannedPhraseGuard(text, runtime) {
  const banned = getTenantBannedPhrases(runtime);
  let out = s(text || "").slice(0, 500);
  if (!out) return "";

  for (const phrase of banned) {
    if (!phrase) continue;
    const re = new RegExp(
      phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "ig"
    );
    out = out.replace(re, "").replace(/\s{2,}/g, " ").trim();
  }

  return out.slice(0, 500);
}

function getReplyBehavior(runtime) {
  const preferredCta = getTenantPreferredCta(runtime);
  const primaryCta = getTenantPrimaryCta(runtime);
  const conversionGoal = getTenantConversionGoal(runtime).replace(/_/g, " ");
  const tone = lower(getTenantTone(runtime));
  const toneProfile = lower(getTenantToneProfile(runtime));
  const commentsBehavior = getCommentChannelBehavior(runtime);
  const primaryAction = lower(commentsBehavior?.primaryAction);
  const qualificationDepth = lower(commentsBehavior?.qualificationDepth);

  return {
    ctaText: primaryCta || preferredCta || conversionGoal,
    wantsDmMove:
      primaryAction.includes("move_to_dm") || primaryAction.includes("dm"),
    guidedQualification: qualificationDepth === "guided",
    confidentTone:
      tone.includes("premium") ||
      tone.includes("modern") ||
      tone.includes("confident") ||
      toneProfile.includes("premium") ||
      toneProfile.includes("confident"),
    warmTone:
      toneProfile.includes("warm") ||
      toneProfile.includes("friendly") ||
      toneProfile.includes("welcoming") ||
      toneProfile.includes("hospitable"),
    calmTone:
      toneProfile.includes("calm") ||
      toneProfile.includes("reassuring") ||
      toneProfile.includes("supportive"),
  };
}

export function makeUnsupportedServicePublicReply({ runtime, service = null }) {
  const serviceName = s(service?.name || "");
  const disabledReplyText = s(service?.disabledReplyText || "");
  if (disabledReplyText) {
    return applyBannedPhraseGuard(disabledReplyText, runtime);
  }

  const lang = normalizeLang(runtime?.language, "az");

  if (lang === "en") {
    return applyBannedPhraseGuard(
      serviceName
        ? `Thank you. ${serviceName} is not currently active. We can help with available services.`
        : "Thank you. This service is not currently active. We can help with available services.",
      runtime
    );
  }

  if (lang === "tr") {
    return applyBannedPhraseGuard(
      serviceName
        ? `Tesekkur ederiz. ${serviceName} su anda aktif degil. Mevcut hizmetlerde yardimci olabiliriz.`
        : "Tesekkur ederiz. Bu hizmet su anda aktif degil. Mevcut hizmetlerde yardimci olabiliriz.",
      runtime
    );
  }

  if (lang === "ru") {
    return applyBannedPhraseGuard(
      serviceName
        ? `Spasibo. ${serviceName} seychas neaktivna. My mozhem pomoch po dostupnym uslugam.`
        : "Spasibo. Eta usluga seychas neaktivna. My mozhem pomoch po dostupnym uslugam.",
      runtime
    );
  }

  return applyBannedPhraseGuard(
    serviceName
      ? `Tesekkur edirik. ${serviceName} hazirda aktiv deyil. Movcud xidmetler uzre komek ede bilerik.`
      : "Tesekkur edirik. Bu xidmet hazirda aktiv deyil. Movcud xidmetler uzre komek ede bilerik.",
    runtime
  );
}

export function makeBehaviorSafePublicReply({
  runtime,
  matchedDisallowedClaim = "",
  matchedHandoffTrigger = "",
} = {}) {
  const lang = normalizeLang(runtime?.language, "az");
  const { ctaText, wantsDmMove, calmTone } = getReplyBehavior(runtime);
  const safeCta = ctaText || "accurate details";
  const routedCta = wantsDmMove ? "in DM" : "briefly";

  if (lang === "en") {
    if (matchedDisallowedClaim) {
      return applyBannedPhraseGuard(
        `Thanks for asking. We do not make unverified claims here. We can share ${safeCta} ${routedCta}.`,
        runtime
      );
    }

    if (matchedHandoffTrigger) {
      return applyBannedPhraseGuard(
        calmTone
          ? `Thank you. We can continue ${routedCta} so the right person can help with ${safeCta}.`
          : `Thank you. We can continue ${routedCta} with the right next step for ${safeCta}.`,
        runtime
      );
    }
  }

  return applyBannedPhraseGuard(
    matchedDisallowedClaim
      ? `Tesekkur edirik. Burada tesdiqlenmemis iddia vermirik. ${safeCta} ile bagli duzgun melumati ${wantsDmMove ? "DM-de" : "qisa sekilde"} paylasaq.`
      : `Tesekkur edirik. ${safeCta} ile bagli size ${wantsDmMove ? "DM-de" : "qisa sekilde"} duzgun yonlendirme verik.`,
    runtime
  );
}

export function makePublicReply({ kind, runtime }) {
  const lang = normalizeLang(runtime?.language, "az");
  const {
    ctaText,
    wantsDmMove,
    confidentTone,
    calmTone,
  } = getReplyBehavior(runtime);

  if (lang === "en") {
    if (kind === "sales") {
      if (confidentTone) {
        return applyBannedPhraseGuard(
          wantsDmMove
            ? `Thank you. We can continue in DM about ${ctaText || "the next step"}.`
            : `Thank you. We can share the next step about ${ctaText || "this"} briefly.`,
          runtime
        );
      }

      return applyBannedPhraseGuard(
        wantsDmMove
          ? ctaText
            ? `Thank you. We can message you in DM about ${ctaText}.`
            : "Thank you. We can share the details with you in DM."
          : ctaText
            ? `Thank you. We can share brief details about ${ctaText}.`
            : "Thank you. We can share brief details.",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        calmTone
          ? "Thank you for writing. We can continue in DM so we can check this carefully."
          : "Thank you for writing. We can continue in DM so we can check it more comfortably.",
        runtime
      );
    }

    if (kind === "positive") {
      return applyBannedPhraseGuard(
        "Thank you. We are glad you liked it.",
        runtime
      );
    }

    return "";
  }

  if (lang === "tr") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        wantsDmMove
          ? ctaText
            ? `Tesekkur ederiz. ${ctaText} icin size DM uzerinden yazabiliriz.`
            : "Tesekkur ederiz. Detaylari size DM uzerinden paylasabiliriz."
          : ctaText
            ? `Tesekkur ederiz. ${ctaText} ile ilgili kisa bilgi paylasabiliriz.`
            : "Tesekkur ederiz. Kisa bilgi paylasabiliriz.",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Yazdiginiz icin tesekkur ederiz. Konuyu kontrol etmek icin size DM uzerinden yazalim.",
        runtime
      );
    }

    if (kind === "positive") {
      return applyBannedPhraseGuard(
        "Tesekkur ederiz. Begenmenize sevindik.",
        runtime
      );
    }

    return "";
  }

  if (lang === "ru") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        wantsDmMove
          ? ctaText
            ? `Spasibo. My mozhem napisat vam v lichnye soobshcheniya po povodu ${ctaText}.`
            : "Spasibo. My mozhem kratko napisat vam detali v lichnye soobshcheniya."
          : ctaText
            ? `Spasibo. My mozhem kratko podelitsya detalami po ${ctaText}.`
            : "Spasibo. My mozhem kratko podelitsya detalyami.",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Spasibo za soobshchenie. My mozhem napisat vam v lichnye soobshcheniya, chtoby proverit vopros.",
        runtime
      );
    }

    if (kind === "positive") {
      return applyBannedPhraseGuard(
        "Spasibo. Nam ochen priyatno.",
        runtime
      );
    }

    return "";
  }

  if (kind === "sales") {
    if (confidentTone) {
      return applyBannedPhraseGuard(
        wantsDmMove
          ? `Tesekkur edirik. ${ctaText || "Novbeti addim"} ucun size DM-de yazaq.`
          : `Tesekkur edirik. ${ctaText || "Novbeti addim"} ile bagli qisa melumat paylasaq.`,
        runtime
      );
    }

    return applyBannedPhraseGuard(
      wantsDmMove
        ? ctaText
          ? `Tesekkur edirik. ${ctaText} ucun size DM-de yazaq.`
          : "Tesekkur edirik. Detallari size DM-de paylasaq."
        : ctaText
          ? `Tesekkur edirik. ${ctaText} ile bagli qisa melumat paylasaq.`
          : "Tesekkur edirik. Qisa melumat paylasaq.",
      runtime
    );
  }

  if (kind === "support") {
    return applyBannedPhraseGuard(
      calmTone
        ? "Yazdiginiz ucun tesekkur edirik. Meseleye diqqetle baxmaq ucun size DM-de yazaq."
        : "Yazdiginiz ucun tesekkur edirik. Meseleyni daha rahat yoxlamaq ucun size DM-de yazaq.",
      runtime
    );
  }

  if (kind === "positive") {
    return applyBannedPhraseGuard(
      "Tesekkur edirik. Beyenmeyiniz bizi sevindirdi.",
      runtime
    );
  }

  return "";
}

export function makePrivateReply({ kind, runtime }) {
  const lang = normalizeLang(runtime?.language, "az");
  const { ctaText, guidedQualification, warmTone } = getReplyBehavior(runtime);

  if (lang === "en") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        ctaText
          ? `${warmTone ? "Hi" : "Hello"}. We are writing regarding your comment. We can share a suitable option for ${ctaText}. ${guidedQualification ? "What would you like help with first?" : "Which service are you interested in?"}`
          : `${warmTone ? "Hi" : "Hello"}. We are writing regarding your comment. We can briefly share a suitable option for you. ${guidedQualification ? "What would you like help with first?" : "Which service are you interested in?"}`,
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Hello. We are writing regarding your comment. You can briefly share the details with us so we can check the issue.",
        runtime
      );
    }

    return "";
  }

  if (lang === "tr") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        ctaText
          ? `Merhaba. Yorumunuz uzerine yaziyoruz. ${ctaText} ile ilgili size uygun secenegi paylasabiliriz. ${guidedQualification ? "Ilk olarak hangi konuda yardim istersiniz?" : "Hangi hizmetle ilgileniyorsunuz?"}`
          : `Merhaba. Yorumunuz uzerine yaziyoruz. Size uygun secenegi kisaca paylasabiliriz. ${guidedQualification ? "Ilk olarak hangi konuda yardim istersiniz?" : "Hangi hizmetle ilgileniyorsunuz?"}`,
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Merhaba. Yorumunuz uzerine yaziyoruz. Konuyu kontrol edebilmemiz icin detaylari bizimle kisaca paylasabilirsiniz.",
        runtime
      );
    }

    return "";
  }

  if (lang === "ru") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        ctaText
          ? `Zdravstvuyte. Pishem vam po vashemu kommentariyu. My mozhem predlozhit podkhodyashchiy variant po ${ctaText}. ${guidedQualification ? "S chem pomoch v pervuyu ochered?" : "Kakaya usluga vas interesuet?"}`
          : `Zdravstvuyte. Pishem vam po vashemu kommentariyu. My mozhem kratko predlozhit podkhodyashchiy variant. ${guidedQualification ? "S chem pomoch v pervuyu ochered?" : "Kakaya usluga vas interesuet?"}`,
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Zdravstvuyte. Pishem vam po vashemu kommentariyu. Vy mozhete kratko otpravit detali, chtoby my proverili vopros.",
        runtime
      );
    }

    return "";
  }

  if (kind === "sales") {
    return applyBannedPhraseGuard(
      ctaText
        ? `Salam. Serhinize gore yaziriq. ${ctaText} ile bagli size uygun varianti paylasa bilerik. ${guidedQualification ? "En cox ne ile komek isteyirsiniz?" : "Hansi xidmetle maraqlanirsiniz?"}`
        : `Salam. Serhinize gore yaziriq. Size uygun varianti qisa sekilde paylasa bilerik. ${guidedQualification ? "En cox ne ile komek isteyirsiniz?" : "Hansi xidmetle maraqlanirsiniz?"}`,
      runtime
    );
  }

  if (kind === "support") {
    return applyBannedPhraseGuard(
      "Salam. Serhinize gore yaziriq. Problemi yoxlamaq ucun qisa sekilde detallari bizimle paylasa bilersiniz.",
      runtime
    );
  }

  return "";
}
