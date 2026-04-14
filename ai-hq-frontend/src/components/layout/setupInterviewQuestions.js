export const SETUP_SOURCE_PROMPT =
  "Biznesin linkini və ya qısa izahını göndər. (website, instagram, facebook, qısa qeyd)";

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
    key: "services",
    step: "services",
    title: "Primary services",
    prompt:
      "Müştərinin ən çox soruşacağı əsas xidmətləri ən vacibdən yaz.",
    placeholder:
      "Məsələn: website hazırlanması, reklam idarəetməsi, branding",
    group: "business_truth",
  },
  {
    key: "audience",
    step: "profile",
    title: "Ideal customer",
    prompt:
      "Əsasən kimlərə və hansı bazara xidmət göstərirsiniz?",
    placeholder:
      "Məsələn: kiçik və orta bizneslər, şəxsi brendlər, Azərbaycan bazarı",
    group: "business_truth",
  },
  {
    key: "contacts",
    step: "contacts",
    title: "Primary conversion route",
    prompt:
      "Müştəri sonda əsasən hara yönləndirilməlidir? Birinci prioritet route-u yaz.",
    placeholder:
      "Məsələn: WhatsApp, telefon zəngi, form, Instagram DM",
    group: "business_truth",
  },
  {
    key: "hours",
    step: "profile",
    title: "Availability",
    prompt:
      "İş və cavab saatları necədir? Chatbot və voice receptionist bunu necə deməlidir?",
    placeholder:
      "Məsələn: B.e.–Cümə 10:00–19:00, Şənbə 11:00–16:00, Bazar bağlı",
    group: "business_truth",
  },
  {
    key: "pricing",
    step: "pricing",
    title: "Pricing policy",
    prompt:
      "AI qiymət mövzusunda nə qədər açıq danışmalıdır?",
    placeholder:
      "Məsələn: starting price deyilə bilər, amma dəqiq qiymət üçün müraciət istənməlidir",
    group: "business_truth",
  },
  {
    key: "handoff",
    step: "handoff",
    title: "Escalation rules",
    prompt:
      "AI hansı hallarda dayanmadan insana ötürməlidir?",
    placeholder:
      "Məsələn: şikayət, fərdi quote, ödəniş problemi, təcili iş, anlaşılmaz sorğu",
    group: "ai_behavior",
  },
  {
    key: "languages",
    step: "profile",
    title: "Working languages",
    prompt:
      "AI və voice receptionist hansı dillərdə işləməlidir? Prioriteti yaz.",
    placeholder:
      "Məsələn: Azərbaycan dili əsas, İngilis dili dəstəklənsin, Rus dili opsional",
    group: "ai_behavior",
  },
  {
    key: "tone",
    step: "profile",
    title: "Tone",
    prompt:
      "AI-nin tonu necə olmalıdır?",
    placeholder:
      "Məsələn: professional, qısa, aydın, özünəinamlı, amma kobud yox",
    group: "ai_behavior",
  },
  {
    key: "greeting",
    step: "profile",
    title: "Opening style",
    prompt:
      "AI söhbətə necə başlamalıdır? Qısa qarşılamanı necə hiss etdirmək istəyirsən?",
    placeholder:
      "Məsələn: qısa salam verib birbaşa necə kömək edə biləcəyini soruşsun",
    group: "ai_behavior",
  },
  {
    key: "after_hours",
    step: "handoff",
    title: "After-hours behavior",
    prompt:
      "İş saatından kənar yazan və ya zəng edən istifadəçiyə AI necə cavab verməlidir?",
    placeholder:
      "Məsələn: hazırda bağlı olduğumuzu desin, məlumatı götürsün, operatorun geri dönüş edəcəyini bildirsin",
    group: "ai_behavior",
  },
];