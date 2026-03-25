import { lower, normalizeLang, s } from "./shared.js";
import {
  getTenantBannedPhrases,
  getTenantPreferredCta,
  getTenantTone,
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
        ? `Teşekkür ederiz. ${serviceName} şu anda aktif değil. Mevcut hizmetlerde yardımcı olabiliriz.`
        : "Teşekkür ederiz. Bu hizmet şu anda aktif değil. Mevcut hizmetlerde yardımcı olabiliriz.",
      runtime
    );
  }

  if (lang === "ru") {
    return applyBannedPhraseGuard(
      serviceName
        ? `Спасибо. ${serviceName} сейчас неактивна. Мы можем помочь по доступным услугам.`
        : "Спасибо. Эта услуга сейчас неактивна. Мы можем помочь по доступным услугам.",
      runtime
    );
  }

  return applyBannedPhraseGuard(
    serviceName
      ? `Təşəkkür edirik. ${serviceName} hazırda aktiv deyil. Mövcud xidmətlər üzrə kömək edə bilərik.`
      : "Təşəkkür edirik. Bu xidmət hazırda aktiv deyil. Mövcud xidmətlər üzrə kömək edə bilərik.",
    runtime
  );
}

export function makePublicReply({ kind, runtime }) {
  const preferredCta = getTenantPreferredCta(runtime);
  const tone = lower(getTenantTone(runtime));
  const lang = normalizeLang(runtime?.language, "az");

  if (lang === "en") {
    if (kind === "sales") {
      if (tone.includes("premium") || tone.includes("modern") || tone.includes("confident")) {
        return applyBannedPhraseGuard(
          "Thank you. If you’d like, we can share the details with you briefly in DM.",
          runtime
        );
      }

      return applyBannedPhraseGuard(
        preferredCta
          ? `Thank you. We can message you in DM for ${preferredCta}.`
          : "Thank you. We can share the details with you in DM.",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Thank you for writing. We can continue in DM so we can check it more comfortably.",
        runtime
      );
    }

    if (kind === "positive") {
      return applyBannedPhraseGuard(
        "Thank you. We’re glad you liked it.",
        runtime
      );
    }

    return "";
  }

  if (lang === "tr") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        preferredCta
          ? `Teşekkür ederiz. ${preferredCta} için size DM üzerinden yazabiliriz.`
          : "Teşekkür ederiz. Detayları size DM üzerinden paylaşabiliriz.",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Yazdığınız için teşekkür ederiz. Konuyu daha rahat kontrol etmek için size DM üzerinden yazalım.",
        runtime
      );
    }

    if (kind === "positive") {
      return applyBannedPhraseGuard(
        "Teşekkür ederiz. Beğenmenize sevindik.",
        runtime
      );
    }

    return "";
  }

  if (lang === "ru") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        preferredCta
          ? `Спасибо. Мы можем написать вам в личные сообщения по поводу ${preferredCta}.`
          : "Спасибо. Мы можем кратко написать вам детали в личные сообщения.",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Спасибо за сообщение. Мы можем написать вам в личные сообщения, чтобы удобнее проверить вопрос.",
        runtime
      );
    }

    if (kind === "positive") {
      return applyBannedPhraseGuard(
        "Спасибо. Нам очень приятно.",
        runtime
      );
    }

    return "";
  }

  if (kind === "sales") {
    if (tone.includes("premium") || tone.includes("modern") || tone.includes("confident")) {
      return applyBannedPhraseGuard(
        "Təşəkkür edirik. İstəsəniz detalları sizə DM-də qısa şəkildə paylaşaq.",
        runtime
      );
    }

    return applyBannedPhraseGuard(
      preferredCta
        ? `Təşəkkür edirik. ${preferredCta} üçün sizə DM-də yazaq.`
        : "Təşəkkür edirik. Detalları sizə DM-də paylaşaq.",
      runtime
    );
  }

  if (kind === "support") {
    return applyBannedPhraseGuard(
      "Yazdığınız üçün təşəkkür edirik. Məsələni daha rahat yoxlamaq üçün sizə DM-də yazaq.",
      runtime
    );
  }

  if (kind === "positive") {
    return applyBannedPhraseGuard(
      "Təşəkkür edirik. Bəyənməyiniz bizi sevindirdi.",
      runtime
    );
  }

  return "";
}

export function makePrivateReply({ kind, runtime }) {
  const preferredCta = getTenantPreferredCta(runtime);
  const lang = normalizeLang(runtime?.language, "az");

  if (lang === "en") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        preferredCta
          ? `Hello. We’re writing regarding your comment. We can share a suitable option for ${preferredCta}. Which service are you interested in?`
          : "Hello. We’re writing regarding your comment. We can briefly share a suitable option for you. Which service are you interested in?",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Hello. We’re writing regarding your comment. You can briefly share the details with us so we can check the issue.",
        runtime
      );
    }

    return "";
  }

  if (lang === "tr") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        preferredCta
          ? `Merhaba. Yorumunuz üzerine yazıyoruz. ${preferredCta} ile ilgili size uygun seçeneği paylaşabiliriz. Hangi hizmetle ilgileniyorsunuz?`
          : "Merhaba. Yorumunuz üzerine yazıyoruz. Size uygun seçeneği kısaca paylaşabiliriz. Hangi hizmetle ilgileniyorsunuz?",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Merhaba. Yorumunuz üzerine yazıyoruz. Konuyu kontrol edebilmemiz için detayları bizimle kısaca paylaşabilirsiniz.",
        runtime
      );
    }

    return "";
  }

  if (lang === "ru") {
    if (kind === "sales") {
      return applyBannedPhraseGuard(
        preferredCta
          ? `Здравствуйте. Пишем вам по вашему комментарию. Мы можем предложить подходящий вариант по ${preferredCta}. Какая услуга вас интересует?`
          : "Здравствуйте. Пишем вам по вашему комментарию. Мы можем кратко предложить подходящий вариант. Какая услуга вас интересует?",
        runtime
      );
    }

    if (kind === "support") {
      return applyBannedPhraseGuard(
        "Здравствуйте. Пишем вам по вашему комментарию. Вы можете кратко отправить детали, чтобы мы проверили вопрос.",
        runtime
      );
    }

    return "";
  }

  if (kind === "sales") {
    return applyBannedPhraseGuard(
      preferredCta
        ? `Salam. Şərhinizə görə yazırıq. ${preferredCta} ilə bağlı sizə uyğun variantı paylaşa bilərik. Hansı xidmətlə maraqlanırsınız?`
        : "Salam. Şərhinizə görə yazırıq. Sizə uyğun variantı qısa şəkildə paylaşa bilərik. Hansı xidmətlə maraqlanırsınız?",
      runtime
    );
  }

  if (kind === "support") {
    return applyBannedPhraseGuard(
      "Salam. Şərhinizə görə yazırıq. Problemi yoxlamaq üçün qısa şəkildə detalları bizimlə paylaşa bilərsiniz.",
      runtime
    );
  }

  return "";
}