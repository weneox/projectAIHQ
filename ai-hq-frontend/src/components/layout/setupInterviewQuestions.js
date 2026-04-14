export const SETUP_SOURCE_PROMPT =
  "Website varsa onu göndər. Lokal biznesdirsə Google Maps də olar. Instagram/Facebook və qısa qeyd əlavə kontekst üçündür.";

export const SETUP_INTERVIEW_QUESTIONS = [
  {
    key: "company",
    step: "company",
    title: "Business name",
    prompt: "Biznesin adı necə görünməlidir?",
    placeholder: "Məsələn: Saytpro",
    group: "business_truth",
  },
  {
    key: "description",
    step: "description",
    title: "Positioning",
    prompt:
      "Bu biznesi AI müştəriyə necə təqdim etməlidir? Nə edir və hansı nəticəni verir?",
    placeholder:
      "Məsələn: Saytpro bizneslər üçün website, reklam və branding həlləri qurur.",
    group: "business_truth",
  },
  {
    key: "website",
    step: "website",
    title: "Website",
    prompt: "Əsas website varsa linkini göndər.",
    placeholder: "Məsələn: https://saytpro.az",
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
    step: "profile",
    title: "Business hours",
    prompt:
      "İş və cavab saatları necədir? Chatbot və voice receptionist bunu necə deməlidir?",
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
      "Məsələn: starting price deyilə bilər, amma dəqiq qiymət üçün müraciət istənməlidir",
    group: "business_truth",
  },
  {
    key: "contacts",
    step: "contacts",
    title: "Primary contact route",
    prompt:
      "Müştəri sonda əsasən hara yönləndirilməlidir? Birinci prioritet route-u yaz.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form, Instagram DM",
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
