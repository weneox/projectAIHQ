export const SETUP_SOURCE_PROMPT =
  "Salam. Gəlin biznes setup-ını düzgün quraq. Website, Google Maps, Instagram, Facebook və ya qısa qeyd göndərə bilərsən. Heç nə hazır deyilsə, mən səndən yalnız ən vacib şeyləri bir-bir soruşacağam.";

export const SETUP_INTERVIEW_QUESTIONS = [
  {
    key: "company",
    step: "company",
    title: "Business name",
    prompt: "Biznesin adı necə görünməlidir?",
    placeholder: "Məsələn: Aurora Studio",
    group: "business_truth",
  },
  {
    key: "description",
    step: "description",
    title: "Positioning",
    prompt:
      "Bu biznesi AI müştəriyə necə təqdim etməlidir? Nə edir və hansı nəticəni verir?",
    placeholder:
      "Məsələn: Lokal bizneslər üçün website və rəqəmsal təqdimat həlləri qururuq.",
    group: "business_truth",
  },
  {
    key: "website",
    step: "website",
    title: "Website",
    prompt: "Əsas website varsa domeni və ya linki göndər.",
    placeholder: "Məsələn: yourbusiness.com",
    group: "business_truth",
  },
  {
    key: "services",
    step: "services",
    title: "Core services",
    prompt:
      "Müştərinin ən çox soruşacağı əsas xidmətləri ən vacibdən yaz.",
    placeholder:
      "Məsələn: website hazırlanması, reklam idarəetməsi, branding",
    group: "business_truth",
  },
  {
    key: "hours",
    step: "hours",
    title: "Business hours",
    prompt: "Is ve cavab saatlari necedir? AI assistant bunu nece demelidir?",
    placeholder:
      "Məsələn: B.e.–Cümə 10:00–19:00, Şənbə 11:00–16:00, Bazar bağlı",
    group: "business_truth",
  },
  {
    key: "pricing",
    step: "pricing",
    title: "Pricing posture",
    prompt: "AI qiymət mövzusunda nə qədər açıq danışmalıdır?",
    placeholder:
      "Məsələn: starting price deyilə bilər, amma dəqiq quote üçün müraciət istənməlidir",
    group: "business_truth",
  },
  {
    key: "contacts",
    step: "contacts",
    title: "Primary contact route",
    prompt:
      "Müştəri sonda əsasən hara yönləndirilməlidir? Birinci prioritet route-u yaz.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form və ya email",
    group: "business_truth",
  },
  {
    key: "handoff",
    step: "handoff",
    title: "Operator handoff",
    prompt: "AI hansı hallarda dayanmadan insana ötürməlidir?",
    placeholder:
      "Məsələn: şikayət, fərdi quote, ödəniş problemi, təcili iş, anlaşılmaz sorğu",
    group: "business_truth",
  },
];
