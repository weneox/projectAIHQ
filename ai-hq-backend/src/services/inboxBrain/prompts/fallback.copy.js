function normalizeLanguage(value = "") {
  const x = String(value || "").trim().toLowerCase();
  if (!x) return "en";

  if (x.startsWith("az")) return "az";
  if (x.startsWith("en")) return "en";
  if (x.startsWith("tr")) return "tr";
  if (x.startsWith("ru")) return "ru";
  if (x.startsWith("es")) return "es";
  if (x.startsWith("de")) return "de";
  if (x.startsWith("fr")) return "fr";
  if (x.startsWith("it")) return "it";
  if (x.startsWith("pt")) return "pt";
  if (x.startsWith("ar")) return "ar";
  if (x.startsWith("nl")) return "nl";
  if (x.startsWith("pl")) return "pl";
  if (x.startsWith("uk")) return "uk";
  if (x.startsWith("zh")) return "zh";
  if (x.startsWith("ja")) return "ja";
  if (x.startsWith("ko")) return "ko";
  if (x.startsWith("hi")) return "hi";

  return "en";
}

const FALLBACK_DEFAULT_QUESTION = {
  en: "Share the main goal in one sentence so I can guide this correctly.",
  az: "Əsas məqsədi bir cümlə ilə yazın ki, düzgün yönləndirə bilim.",
  tr: "Ana hedefi bir cümleyle yazın, doğru yönlendireyim.",
  ru: "Напишите основную цель одним предложением, и я сориентирую точнее.",
  es: "Comparte el objetivo principal en una frase para orientarte correctamente.",
  de: "Beschreibe das Hauptziel in einem Satz, damit ich dich richtig einordnen kann.",
  fr: "Partagez l’objectif principal en une phrase pour que je puisse vous orienter correctement.",
  it: "Condividi l’obiettivo principale in una frase così posso guidarti correttamente.",
  pt: "Compartilhe o objetivo principal em uma frase para que eu possa orientar corretamente.",
  ar: "اكتب الهدف الأساسي في جملة واحدة حتى أتمكن من توجيهك بشكل صحيح.",
  nl: "Deel het hoofddoel in één zin zodat ik je goed kan begeleiden.",
  pl: "Opisz główny cel w jednym zdaniu, a pokieruję Cię właściwie.",
  uk: "Опишіть основну мету одним реченням, і я точніше зорієнтую.",
  zh: "请用一句话说明你的主要目标，我会更准确地引导你。",
  ja: "主な目的を一文で教えてください。適切にご案内します。",
  ko: "주요 목표를 한 문장으로 알려주시면 정확하게 안내해드리겠습니다.",
  hi: "मुख्य उद्देश्य एक वाक्य में लिखें ताकि मैं सही दिशा दे सकूँ।",
};

const FALLBACK_BY_INTENT = {
  greeting: {
    en: "Tell me what you want to do, buy, or solve in one sentence.",
    az: "Nə qurmaq, almaq və ya həll etmək istədiyinizi bir cümlə ilə yazın.",
    tr: "Ne yapmak, almak veya çözmek istediğinizi bir cümleyle yazın.",
    ru: "Напишите одним предложением, что вы хотите сделать, получить или решить.",
    es: "Escribe en una frase qué quieres hacer, conseguir o resolver.",
    de: "Beschreibe in einem Satz, was du tun, bekommen oder lösen möchtest.",
    fr: "Décrivez en une phrase ce que vous voulez faire, obtenir ou résoudre.",
    it: "Scrivi in una frase cosa vuoi fare, ottenere o risolvere.",
    pt: "Escreva em uma frase o que você quer fazer, obter ou resolver.",
    ar: "اكتب في جملة واحدة ما الذي تريد القيام به أو الحصول عليه أو حله.",
    nl: "Schrijf in één zin wat je wilt doen, krijgen of oplossen.",
    pl: "Napisz w jednym zdaniu, co chcesz zrobić, uzyskać lub rozwiązać.",
    uk: "Опишіть одним реченням, що саме ви хочете зробити, отримати або вирішити.",
    zh: "请用一句话说明你想做什么、获得什么，或解决什么问题。",
    ja: "何をしたいか、得たいか、解決したいかを一文で教えてください。",
    ko: "무엇을 하고 싶거나, 얻고 싶거나, 해결하고 싶은지 한 문장으로 알려주세요.",
    hi: "एक वाक्य में लिखें कि आप क्या करना, पाना या हल करना चाहते हैं।",
  },

  pricing: {
    en: "Share what you need and the main one or two requirements so I can guide pricing more accurately.",
    az: "Nəyə ehtiyacınız olduğunu və əsas 1-2 tələbi yazın ki, qiymətlə bağlı daha düzgün yönləndirə bilim.",
    tr: "Neye ihtiyacınız olduğunu ve ana 1-2 gereksinimi yazın, fiyat konusunda daha doğru yönlendireyim.",
    ru: "Напишите, что именно вам нужно и 1-2 ключевых требования, чтобы я точнее сориентировал по стоимости.",
    es: "Comparte lo que necesitas y 1-2 requisitos clave para orientarte mejor sobre el precio.",
    de: "Beschreibe, was du brauchst und die 1-2 wichtigsten Anforderungen, damit ich beim Preis genauer helfen kann.",
    fr: "Décrivez ce dont vous avez besoin et 1 à 2 exigences clés pour mieux vous orienter sur le prix.",
    it: "Descrivi di cosa hai bisogno e 1-2 requisiti chiave così posso orientarti meglio sul prezzo.",
    pt: "Descreva o que você precisa e 1-2 requisitos principais para que eu possa orientar melhor sobre o preço.",
    ar: "اكتب ما تحتاجه وأهم متطلب أو متطلبين حتى أتمكن من توجيهك بشكل أدق بخصوص السعر.",
    nl: "Beschrijf wat je nodig hebt en de 1-2 belangrijkste eisen, dan kan ik beter richting geven over de prijs.",
    pl: "Opisz, czego potrzebujesz i 1-2 najważniejsze wymagania, a lepiej pokieruję Cię w sprawie ceny.",
    uk: "Опишіть, що саме вам потрібно, і 1-2 ключові вимоги, щоб я точніше зорієнтував щодо вартості.",
    zh: "请说明你的需求和 1-2 个关键要求，我可以更准确地引导你了解价格。",
    ja: "必要な内容と重要な要件を1〜2点教えてください。料金の目安をより正確に案内できます。",
    ko: "필요한 내용과 핵심 요구사항 1~2개를 알려주시면 가격 방향을 더 정확히 안내할 수 있습니다.",
    hi: "आपको क्या चाहिए और 1-2 मुख्य आवश्यकताएँ लिखें ताकि मैं कीमत के बारे में अधिक सटीक मार्गदर्शन दे सकूँ।",
  },

  service_interest: {
    en: "Share the outcome that matters most to you in one sentence.",
    az: "Sizin üçün ən vacib nəticəni bir cümlə ilə yazın.",
    tr: "Sizin için en önemli sonucu bir cümleyle yazın.",
    ru: "Опишите одним предложением результат, который для вас важнее всего.",
    es: "Comparte en una frase el resultado que más te importa.",
    de: "Beschreibe in einem Satz das Ergebnis, das dir am wichtigsten ist.",
    fr: "Partagez en une phrase le résultat qui compte le plus pour vous.",
    it: "Condividi in una frase il risultato che conta di più per te.",
    pt: "Compartilhe em uma frase o resultado que mais importa para você.",
    ar: "اكتب في جملة واحدة النتيجة الأهم بالنسبة لك.",
    nl: "Beschrijf in één zin het resultaat dat voor jou het belangrijkst is.",
    pl: "Opisz w jednym zdaniu rezultat, który jest dla Ciebie najważniejszy.",
    uk: "Опишіть одним реченням результат, який для вас найважливіший.",
    zh: "请用一句话说明对你最重要的结果是什么。",
    ja: "あなたにとって最も重要な成果を一文で教えてください。",
    ko: "당신에게 가장 중요한 결과를 한 문장으로 알려주세요.",
    hi: "आपके लिए सबसे महत्वपूर्ण परिणाम क्या है, इसे एक वाक्य में लिखें।",
  },

  support: {
    en: "Describe the issue and where it happens in one sentence.",
    az: "Problemi və harada baş verdiyini bir cümlə ilə yazın.",
    tr: "Sorunu ve nerede olduğunu bir cümleyle yazın.",
    ru: "Опишите проблему и где она возникает, одним предложением.",
    es: "Describe el problema y dónde ocurre en una frase.",
    de: "Beschreibe das Problem und wo es auftritt in einem Satz.",
    fr: "Décrivez le problème et où il se produit en une phrase.",
    it: "Descrivi il problema e dove si verifica in una frase.",
    pt: "Descreva o problema e onde ele acontece em uma frase.",
    ar: "صف المشكلة ومكان حدوثها في جملة واحدة.",
    nl: "Beschrijf het probleem en waar het gebeurt in één zin.",
    pl: "Opisz problem i miejsce, w którym występuje, w jednym zdaniu.",
    uk: "Опишіть проблему та де саме вона виникає, одним реченням.",
    zh: "请用一句话说明问题以及它发生在哪里。",
    ja: "問題の内容と発生箇所を一文で教えてください。",
    ko: "문제가 무엇인지, 어디서 발생하는지 한 문장으로 알려주세요.",
    hi: "समस्या और वह कहाँ हो रही है, इसे एक वाक्य में लिखें।",
  },

  handoff_request: {
    en: "Share the topic in one sentence so I can route this correctly.",
    az: "Mövzunu bir cümlə ilə yazın ki, düzgün yönləndirə bilim.",
    tr: "Konuyu bir cümleyle yazın, doğru yönlendireyim.",
    ru: "Опишите тему одним предложением, чтобы я направил вас правильно.",
    es: "Comparte el tema en una frase para poder dirigirlo correctamente.",
    de: "Beschreibe das Thema in einem Satz, damit ich es richtig weiterleiten kann.",
    fr: "Partagez le sujet en une phrase pour que je puisse vous orienter correctement.",
    it: "Descrivi il tema in una frase così posso indirizzarlo correttamente.",
    pt: "Descreva o tema em uma frase para que eu possa encaminhar corretamente.",
    ar: "اكتب الموضوع في جملة واحدة حتى أتمكن من توجيهه بشكل صحيح.",
    nl: "Beschrijf het onderwerp in één zin zodat ik het correct kan doorzetten.",
    pl: "Opisz temat w jednym zdaniu, abym mógł skierować to właściwie.",
    uk: "Опишіть тему одним реченням, щоб я правильно це передав далі.",
    zh: "请用一句话说明主题，我会将其正确转接。",
    ja: "内容を一文で教えてください。適切に引き継ぎます。",
    ko: "주제를 한 문장으로 알려주시면 올바르게 연결하겠습니다.",
    hi: "विषय को एक वाक्य में लिखें ताकि मैं सही तरह से आगे भेज सकूँ।",
  },

  urgent_interest: {
    en: "Share the topic in one sentence and I’ll flag it with priority.",
    az: "Mövzunu bir cümlə ilə yazın, prioritetlə qeyd edim.",
    tr: "Konuyu bir cümleyle yazın, öncelikli olarak işaretleyeyim.",
    ru: "Опишите тему одним предложением, и я отмечу её как приоритетную.",
    es: "Comparte el tema en una frase y lo marcaré con prioridad.",
    de: "Beschreibe das Thema in einem Satz, dann markiere ich es als prioritär.",
    fr: "Partagez le sujet en une phrase et je le signalerai comme prioritaire.",
    it: "Descrivi il tema in una frase e lo segnalerò come prioritario.",
    pt: "Descreva o tema em uma frase e eu o sinalizarei como prioritário.",
    ar: "اكتب الموضوع في جملة واحدة وسأضع له أولوية.",
    nl: "Beschrijf het onderwerp in één zin en ik markeer het als prioriteit.",
    pl: "Opisz temat w jednym zdaniu, a oznaczę go jako priorytetowy.",
    uk: "Опишіть тему одним реченням, і я позначу її як пріоритетну.",
    zh: "请用一句话说明主题，我会将其标记为优先事项。",
    ja: "内容を一文で教えてください。優先対応として扱います。",
    ko: "주제를 한 문장으로 알려주시면 우선순위로 표시하겠습니다.",
    hi: "विषय को एक वाक्य में लिखें, मैं इसे प्राथमिकता के रूप में चिह्नित कर दूँगा।",
  },

  knowledge_answer: {
    en: "Share what you want clarified in one sentence.",
    az: "Dəqiqləşdirmək istədiyinizi bir cümlə ilə yazın.",
    tr: "Netleştirmek istediğiniz şeyi bir cümleyle yazın.",
    ru: "Напишите одним предложением, что именно вы хотите уточнить.",
    es: "Comparte en una frase qué quieres aclarar.",
    de: "Beschreibe in einem Satz, was du genau klären möchtest.",
    fr: "Précisez en une phrase ce que vous souhaitez clarifier.",
    it: "Scrivi in una frase cosa vuoi chiarire.",
    pt: "Escreva em uma frase o que você quer esclarecer.",
    ar: "اكتب في جملة واحدة ما الذي تريد توضيحه.",
    nl: "Schrijf in één zin wat je precies wilt verduidelijken.",
    pl: "Napisz w jednym zdaniu, co dokładnie chcesz doprecyzować.",
    uk: "Опишіть одним реченням, що саме ви хочете уточнити.",
    zh: "请用一句话说明你想进一步确认什么。",
    ja: "何を確認したいのか一文で教えてください。",
    ko: "무엇을 더 명확히 하고 싶은지 한 문장으로 알려주세요.",
    hi: "आप क्या स्पष्ट करना चाहते हैं, इसे एक वाक्य में लिखें।",
  },

  unsupported_service: {
    en: "Share the need in one sentence and I’ll check how closely it fits.",
    az: "Ehtiyacı bir cümlə ilə yazın, nə qədər uyğun olduğunu yoxlayım.",
    tr: "İhtiyacı bir cümleyle yazın, ne kadar uyduğunu kontrol edeyim.",
    ru: "Опишите потребность одним предложением, и я проверю, насколько это подходит.",
    es: "Comparte la necesidad en una frase y revisaré qué tan bien encaja.",
    de: "Beschreibe den Bedarf in einem Satz, dann prüfe ich, wie gut er passt.",
    fr: "Partagez le besoin en une phrase et je vérifierai à quel point cela correspond.",
    it: "Descrivi l’esigenza in una frase e verificherò quanto si adatta.",
    pt: "Descreva a necessidade em uma frase e eu verificarei o quanto isso se encaixa.",
    ar: "اكتب الحاجة في جملة واحدة وسأتحقق من مدى توافقها.",
    nl: "Beschrijf de behoefte in één zin, dan kijk ik hoe goed dit past.",
    pl: "Opisz potrzebę w jednym zdaniu, a sprawdzę, na ile to pasuje.",
    uk: "Опишіть потребу одним реченням, і я перевірю, наскільки це підходить.",
    zh: "请用一句话说明你的需求，我会判断它是否匹配。",
    ja: "必要な内容を一文で教えてください。どれくらい適合するか確認します。",
    ko: "필요한 내용을 한 문장으로 알려주시면 얼마나 맞는지 확인하겠습니다.",
    hi: "ज़रूरत को एक वाक्य में लिखें, मैं देखूँगा कि यह कितना मेल खाता है।",
  },
};

const PRICING_LEAD = {
  en: "Exact pricing usually depends on scope, features, and delivery requirements.",
  az: "Dəqiq qiymət adətən scope, funksiyalar və çatdırılma tələblərindən asılı olur.",
  tr: "Net fiyat genelde kapsam, özellikler ve teslim gereksinimlerine bağlıdır.",
  ru: "Точная стоимость обычно зависит от объёма, функционала и требований к срокам.",
  es: "El precio exacto normalmente depende del alcance, las funciones y los requisitos de entrega.",
  de: "Der genaue Preis hängt in der Regel von Umfang, Funktionen und Lieferanforderungen ab.",
  fr: "Le prix exact dépend généralement du périmètre, des fonctionnalités et des exigences de livraison.",
  it: "Il prezzo esatto dipende in genere da ambito, funzionalità e requisiti di consegna.",
  pt: "O preço exato normalmente depende do escopo, dos recursos e dos requisitos de entrega.",
  ar: "يعتمد السعر الدقيق عادةً على النطاق والميزات ومتطلبات التسليم.",
  nl: "De exacte prijs hangt meestal af van de omvang, functies en leveringsvereisten.",
  pl: "Dokładna cena zwykle zależy od zakresu, funkcji i wymagań dotyczących dostarczenia.",
  uk: "Точна вартість зазвичай залежить від обсягу, функціоналу та вимог до термінів.",
  zh: "准确价格通常取决于范围、功能和交付要求。",
  ja: "正確な料金は、通常、範囲・機能・納期要件によって決まります。",
  ko: "정확한 가격은 일반적으로 범위, 기능, 그리고 전달 요구사항에 따라 달라집니다.",
  hi: "सटीक कीमत आमतौर पर दायरे, फीचर्स और डिलीवरी आवश्यकताओं पर निर्भर करती है।",
};

const SUPPORT_LEAD = {
  en: "I can help with that.",
  az: "Bununla bağlı kömək edə bilərəm.",
  tr: "Bununla ilgili yardımcı olabilirim.",
  ru: "Я могу помочь с этим.",
  es: "Puedo ayudarte con eso.",
  de: "Ich kann dabei helfen.",
  fr: "Je peux vous aider avec cela.",
  it: "Posso aiutarti con questo.",
  pt: "Posso ajudar com isso.",
  ar: "يمكنني المساعدة في ذلك.",
  nl: "Ik kan daarbij helpen.",
  pl: "Mogę w tym pomóc.",
  uk: "Я можу з цим допомогти.",
  zh: "我可以帮助处理这个问题。",
  ja: "それについてお手伝いできます。",
  ko: "그 부분은 도와드릴 수 있습니다.",
  hi: "मैं इसमें मदद कर सकता हूँ।",
};

const HANDOFF_LEAD = {
  en: "Sure, I can route this to a team member.",
  az: "Əlbəttə, bunu komanda üzvünə yönləndirə bilərəm.",
  tr: "Elbette, bunu bir ekip üyesine yönlendirebilirim.",
  ru: "Конечно, я могу передать это сотруднику команды.",
  es: "Claro, puedo derivarlo a un miembro del equipo.",
  de: "Gerne, ich kann das an ein Teammitglied weiterleiten.",
  fr: "Bien sûr, je peux transmettre cela à un membre de l’équipe.",
  it: "Certo, posso inoltrarlo a un membro del team.",
  pt: "Claro, posso encaminhar isso para alguém da equipe.",
  ar: "بالتأكيد، يمكنني تحويل هذا إلى أحد أعضاء الفريق.",
  nl: "Zeker, ik kan dit doorzetten naar een teamlid.",
  pl: "Jasne, mogę przekazać to członkowi zespołu.",
  uk: "Звісно, я можу передати це члену команди.",
  zh: "当然，我可以将此转给团队成员处理。",
  ja: "もちろん、チームメンバーに引き継ぐことができます。",
  ko: "물론입니다. 팀원에게 전달할 수 있습니다.",
  hi: "ज़रूर, मैं इसे टीम के किसी सदस्य तक पहुँचा सकता हूँ।",
};

const URGENT_LEAD = {
  en: "Understood.",
  az: "Qeyd etdim.",
  tr: "Anladım.",
  ru: "Понял.",
  es: "Entendido.",
  de: "Verstanden.",
  fr: "Compris.",
  it: "Capito.",
  pt: "Entendido.",
  ar: "تم.",
  nl: "Begrepen.",
  pl: "Rozumiem.",
  uk: "Зрозуміло.",
  zh: "已了解。",
  ja: "承知しました。",
  ko: "알겠습니다.",
  hi: "समझ गया।",
};

const UNSUPPORTED_EXAMPLES = {
  en: (examples) => `What we support most clearly right now includes ${examples}.`,
  az: (examples) => `Hazırda daha aydın dəstəklənən istiqamətlərə ${examples} daxildir.`,
  tr: (examples) => `Şu anda en net desteklediğimiz alanlara ${examples} dahildir.`,
  ru: (examples) => `Сейчас наиболее понятно поддерживаются такие направления, как ${examples}.`,
  es: (examples) => `Lo que ahora mismo está más claramente cubierto incluye ${examples}.`,
  de: (examples) => `Was wir aktuell am klarsten abdecken, umfasst ${examples}.`,
  fr: (examples) => `Ce que nous couvrons le plus clairement actuellement inclut ${examples}.`,
  it: (examples) => `Ciò che al momento copriamo più chiaramente include ${examples}.`,
  pt: (examples) => `O que cobrimos com mais clareza neste momento inclui ${examples}.`,
  ar: (examples) => `ما ندعمه بشكل أوضح حاليًا يشمل ${examples}.`,
  nl: (examples) => `Wat we op dit moment het duidelijkst ondersteunen, omvat ${examples}.`,
  pl: (examples) => `To, co obecnie wspieramy najbardziej wyraźnie, obejmuje ${examples}.`,
  uk: (examples) => `Найчіткіше зараз підтримуються такі напрямки, як ${examples}.`,
  zh: (examples) => `我们目前最明确支持的方向包括 ${examples}。`,
  ja: (examples) => `現在、特に明確に対応している範囲には ${examples} が含まれます。`,
  ko: (examples) => `현재 가장 명확하게 지원하는 범위에는 ${examples}가 포함됩니다.`,
  hi: (examples) => `इस समय हम जिन चीज़ों को सबसे स्पष्ट रूप से सपोर्ट करते हैं, उनमें ${examples} शामिल हैं।`,
};

const UNSUPPORTED_CHECK = {
  en: "Share the need in one sentence and I’ll check how closely it fits.",
  az: "Ehtiyacı bir cümlə ilə yazın, nə qədər uyğun olduğunu yoxlayım.",
  tr: "İhtiyacı bir cümleyle yazın, ne kadar uyduğunu kontrol edeyim.",
  ru: "Опишите потребность одним предложением, и я проверю, насколько это подходит.",
  es: "Comparte la necesidad en una frase y revisaré qué tan bien encaja.",
  de: "Beschreibe den Bedarf in einem Satz, dann prüfe ich, wie gut er passt.",
  fr: "Partagez le besoin en une phrase et je vérifierai à quel point cela correspond.",
  it: "Descrivi l’esigenza in una frase e verificherò quanto si adatta.",
  pt: "Descreva a necessidade em uma frase e eu verificarei o quanto isso se encaixa.",
  ar: "اكتب الحاجة في جملة واحدة وسأتحقق من مدى توافقها.",
  nl: "Beschrijf de behoefte in één zin, dan kijk ik hoe goed dit past.",
  pl: "Opisz potrzebę w jednym zdaniu, a sprawdzę, na ile to pasuje.",
  uk: "Опишіть потребу одним реченням, і я перевірю, наскільки це підходить.",
  zh: "请用一句话说明你的需求，我会判断它是否匹配。",
  ja: "必要な内容を一文で教えてください。どれくらい適合するか確認します。",
  ko: "필요한 내용을 한 문장으로 알려주시면 얼마나 맞는지 확인하겠습니다.",
  hi: "ज़रूरत को एक वाक्य में लिखें, मैं देखूँगा कि यह कितना मेल खाता है।",
};

export function getFallbackDefaultQuestion(language = "en") {
  const lang = normalizeLanguage(language);
  return FALLBACK_DEFAULT_QUESTION[lang] || FALLBACK_DEFAULT_QUESTION.en;
}

export function getFallbackQuestionByIntent(intent = "", language = "en") {
  const lang = normalizeLanguage(language);
  const safeIntent = String(intent || "").trim();

  if (FALLBACK_BY_INTENT[safeIntent]) {
    return FALLBACK_BY_INTENT[safeIntent][lang] || FALLBACK_BY_INTENT[safeIntent].en;
  }

  return getFallbackDefaultQuestion(lang);
}

export function getPricingLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return PRICING_LEAD[lang] || PRICING_LEAD.en;
}

export function getSupportLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return SUPPORT_LEAD[lang] || SUPPORT_LEAD.en;
}

export function getHandoffLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return HANDOFF_LEAD[lang] || HANDOFF_LEAD.en;
}

export function getUrgentLeadSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return URGENT_LEAD[lang] || URGENT_LEAD.en;
}

export function getUnsupportedExamplesSentence(examples = "", language = "en") {
  const lang = normalizeLanguage(language);
  const formatter = UNSUPPORTED_EXAMPLES[lang] || UNSUPPORTED_EXAMPLES.en;
  return formatter(String(examples || "").trim());
}

export function getUnsupportedCheckSentence(language = "en") {
  const lang = normalizeLanguage(language);
  return UNSUPPORTED_CHECK[lang] || UNSUPPORTED_CHECK.en;
}