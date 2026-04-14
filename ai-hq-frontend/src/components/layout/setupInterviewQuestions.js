export const SETUP_SOURCE_PROMPT =
  "Biznesin linkini və ya qısa izahını göndər. (website, instagram, facebook, qısa qeyd)";

export const SETUP_INTERVIEW_QUESTIONS = [
  {
    key: "company",
    step: "company",
    title: "Business name",
    prompt: "Biznesin adı necə görünməlidir?",
    placeholder: "Məsələn: Saytpro",
  },
  {
    key: "description",
    step: "description",
    title: "Positioning",
    prompt:
      "Bu biznesi AI müştəriyə necə təqdim etməlidir? Nə edir və hansı nəticəni verir?",
    placeholder:
      "Məsələn: Saytpro bizneslər üçün website, reklam və branding həlləri qurur.",
  },
  {
    key: "services",
    step: "services",
    title: "Primary services",
    prompt:
      "Müştərinin ən çox soruşacağı əsas xidmətləri ən vacibdən yaz.",
    placeholder:
      "Məsələn: website hazırlanması, reklam idarəetməsi, branding",
  },
  {
    key: "audience",
    step: "profile",
    title: "Ideal customer",
    prompt:
      "Əsasən kimlərə və hansı bazara xidmət göstərirsiniz?",
    placeholder:
      "Məsələn: kiçik və orta bizneslər, şəxsi brendlər, Azərbaycan bazarı",
  },
  {
    key: "pricing",
    step: "pricing",
    title: "Pricing policy",
    prompt:
      "AI qiymət mövzusunda nə qədər açıq danışmalıdır?",
    placeholder:
      "Məsələn: starting price deyilə bilər, amma dəqiq qiymət üçün müraciət istənməlidir",
  },
  {
    key: "contacts",
    step: "contacts",
    title: "Primary conversion route",
    prompt:
      "Müştəri sonda əsasən hara yönləndirilməlidir? Birinci prioritet route-u yaz.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form, Instagram DM",
  },
  {
    key: "hours",
    step: "profile",
    title: "Availability",
    prompt:
      "İş və cavab saatları necədir? Voice receptionist və chatbot bunu necə deməlidir?",
    placeholder:
      "Məsələn: B.e.–Cümə 10:00–19:00, Şənbə 11:00–16:00, Bazar bağlı",
  },
  {
    key: "handoff",
    step: "handoff",
    title: "Escalation rules",
    prompt:
      "AI hansı hallarda dayanmadan insana ötürməlidir?",
    placeholder:
      "Məsələn: şikayət, fərdi quote, ödəniş problemi, təcili iş, anlaşılmaz sorğu",
  },
];